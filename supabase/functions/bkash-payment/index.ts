import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BkashConfig {
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  is_sandbox: boolean;
}

async function getBkashConfig(supabaseAdmin: any): Promise<BkashConfig> {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .in("key", ["bkash_app_key", "bkash_app_secret", "bkash_username", "bkash_password", "bkash_sandbox"]);

  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => {
    const val = s.value;
    map[s.key] = typeof val === "string" ? val : JSON.stringify(val);
  });

  if (!map.bkash_app_key || !map.bkash_app_secret || !map.bkash_username || !map.bkash_password) {
    throw new Error("bKash payment gateway is not configured. Please contact admin.");
  }

  return {
    app_key: map.bkash_app_key.replace(/^"|"$/g, ""),
    app_secret: map.bkash_app_secret.replace(/^"|"$/g, ""),
    username: map.bkash_username.replace(/^"|"$/g, ""),
    password: map.bkash_password.replace(/^"|"$/g, ""),
    is_sandbox: map.bkash_sandbox === '"true"' || map.bkash_sandbox === "true",
  };
}

function getBaseUrl(isSandbox: boolean): string {
  return isSandbox
    ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout"
    : "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout";
}

async function getToken(config: BkashConfig): Promise<string> {
  const baseUrl = getBaseUrl(config.is_sandbox);
  const response = await fetch(`${baseUrl}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: config.username,
      password: config.password,
    },
    body: JSON.stringify({
      app_key: config.app_key,
      app_secret: config.app_secret,
    }),
  });

  const data = await response.json();
  if (!data.id_token) {
    console.error("bKash token error:", data);
    throw new Error("Failed to authenticate with bKash");
  }
  return data.id_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create_payment": {
        const { customer_id, amount, callback_url } = body;
        if (!customer_id || !amount || !callback_url) throw new Error("Missing required fields");
        if (amount < 1) throw new Error("Minimum payment amount is ৳1");

        const config = await getBkashConfig(supabaseAdmin);
        const token = await getToken(config);
        const baseUrl = getBaseUrl(config.is_sandbox);

        // Create payment record first
        const { data: paymentRecord, error: dbErr } = await supabaseAdmin
          .from("online_payments")
          .insert({
            customer_id,
            amount,
            gateway: "bkash",
            status: "initiated",
          })
          .select("id")
          .single();

        if (dbErr) throw dbErr;

        // Create bKash payment
        const createRes = await fetch(`${baseUrl}/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: token,
            "X-APP-Key": config.app_key,
          },
          body: JSON.stringify({
            mode: "0011",
            payerReference: customer_id,
            callbackURL: callback_url,
            amount: amount.toString(),
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: paymentRecord.id,
          }),
        });

        const createData = await createRes.json();
        console.log("bKash create response:", JSON.stringify(createData));

        if (createData.statusCode !== "0000" && !createData.bkashURL) {
          await supabaseAdmin
            .from("online_payments")
            .update({ status: "failed", gateway_response: createData })
            .eq("id", paymentRecord.id);
          throw new Error(createData.statusMessage || "Failed to create bKash payment");
        }

        // Update record with bKash payment ID
        await supabaseAdmin
          .from("online_payments")
          .update({
            payment_id: createData.paymentID,
            status: "pending",
            gateway_response: createData,
          })
          .eq("id", paymentRecord.id);

        return new Response(
          JSON.stringify({
            success: true,
            bkashURL: createData.bkashURL,
            paymentID: createData.paymentID,
            recordId: paymentRecord.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "execute_payment": {
        const { payment_id } = body;
        if (!payment_id) throw new Error("Missing payment_id");

        const config = await getBkashConfig(supabaseAdmin);
        const token = await getToken(config);
        const baseUrl = getBaseUrl(config.is_sandbox);

        // Execute payment
        const execRes = await fetch(`${baseUrl}/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: token,
            "X-APP-Key": config.app_key,
          },
          body: JSON.stringify({ paymentID: payment_id }),
        });

        const execData = await execRes.json();
        console.log("bKash execute response:", JSON.stringify(execData));

        // Find our payment record
        const { data: paymentRecord } = await supabaseAdmin
          .from("online_payments")
          .select("id, customer_id, amount")
          .eq("payment_id", payment_id)
          .single();

        if (!paymentRecord) throw new Error("Payment record not found");

        if (execData.statusCode === "0000" && execData.transactionStatus === "Completed") {
          // Payment successful
          await supabaseAdmin
            .from("online_payments")
            .update({
              status: "completed",
              trx_id: execData.trxID,
              gateway_response: execData,
            })
            .eq("id", paymentRecord.id);

          // Record payment in main payments table (triggers customer due update)
          await supabaseAdmin.from("payments").insert({
            customer_id: paymentRecord.customer_id,
            amount: paymentRecord.amount,
            method: "bkash",
            transaction_id: execData.trxID,
            notes: `bKash online payment - TrxID: ${execData.trxID}`,
          });

          // Also try to credit referral if this is first payment
          try {
            const { data: existingPayments } = await supabaseAdmin
              .from("payments")
              .select("id")
              .eq("customer_id", paymentRecord.customer_id)
              .limit(2);

            if (existingPayments && existingPayments.length <= 1) {
              // First payment — trigger referral credit
              await supabaseAdmin.functions.invoke("referral-program", {
                body: {
                  action: "credit_referral",
                  referred_customer_id: paymentRecord.customer_id,
                },
              });
            }
          } catch (refErr) {
            console.error("Referral credit attempt:", refErr);
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Payment completed successfully",
              trxID: execData.trxID,
              amount: paymentRecord.amount,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Payment failed
          await supabaseAdmin
            .from("online_payments")
            .update({
              status: "failed",
              gateway_response: execData,
            })
            .eq("id", paymentRecord.id);

          throw new Error(execData.statusMessage || "Payment execution failed");
        }
      }

      case "check_status": {
        const { payment_id } = body;
        if (!payment_id) throw new Error("Missing payment_id");

        const { data } = await supabaseAdmin
          .from("online_payments")
          .select("status, trx_id, amount")
          .eq("payment_id", payment_id)
          .single();

        return new Response(
          JSON.stringify({ success: true, payment: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("bkash-payment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
