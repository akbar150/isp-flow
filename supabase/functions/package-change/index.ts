import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PackageChangeRequest {
  action: "submit" | "list" | "approve" | "reject";
  customer_id?: string;
  current_package_id?: string;
  requested_package_id?: string;
  request_id?: string;
  admin_notes?: string;
  // For customer auth
  user_id?: string;
  password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: PackageChangeRequest = await req.json();
    const { action } = body;

    switch (action) {
      case "submit": {
        const { customer_id, current_package_id, requested_package_id, user_id, password } = body;
        if (!customer_id || !current_package_id || !requested_package_id || !user_id || !password) {
          throw new Error("Missing required fields");
        }

        // Verify customer identity
        const { data: customer, error: custErr } = await supabaseAdmin
          .from("customers")
          .select("id, password_hash, expiry_date, package_id")
          .eq("id", customer_id)
          .single();

        if (custErr || !customer) throw new Error("Customer not found");

        const { data: isValid } = await supabaseAdmin.rpc("verify_password", {
          raw_password: password,
          hashed_password: customer.password_hash,
        });
        if (!isValid) throw new Error("Invalid password");

        // Check no pending request exists
        const { data: existing } = await supabaseAdmin
          .from("package_change_requests")
          .select("id")
          .eq("customer_id", customer_id)
          .eq("status", "pending")
          .limit(1);

        if (existing && existing.length > 0) {
          throw new Error("You already have a pending package change request");
        }

        // Get both packages for proration
        const { data: currentPkg } = await supabaseAdmin
          .from("packages")
          .select("*")
          .eq("id", current_package_id)
          .single();

        const { data: requestedPkg } = await supabaseAdmin
          .from("packages")
          .select("*")
          .eq("id", requested_package_id)
          .single();

        if (!currentPkg || !requestedPkg) throw new Error("Package not found");

        // Calculate prorated amounts
        const today = new Date();
        const expiry = new Date(customer.expiry_date);
        const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        const dailyRateCurrent = currentPkg.monthly_price / currentPkg.validity_days;
        const dailyRateNew = requestedPkg.monthly_price / requestedPkg.validity_days;

        const prorated_credit = Math.round(daysRemaining * dailyRateCurrent);
        const prorated_charge = Math.round(daysRemaining * dailyRateNew);

        const { error: insertErr } = await supabaseAdmin
          .from("package_change_requests")
          .insert({
            customer_id,
            current_package_id,
            requested_package_id,
            prorated_credit,
            prorated_charge,
            status: "pending",
          });

        if (insertErr) throw insertErr;

        // Create admin notification
        await supabaseAdmin.from("admin_notifications").insert({
          type: "system",
          title: "Package Change Request",
          message: `Customer ${user_id} requested to change from ${currentPkg.name} to ${requestedPkg.name}`,
          entity_type: "package_change",
          entity_id: customer_id,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Package change request submitted. You'll be notified once approved.",
            prorated_credit,
            prorated_charge,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const { customer_id } = body;
        if (!customer_id) throw new Error("Missing customer_id");

        const { data, error } = await supabaseAdmin
          .from("package_change_requests")
          .select(`
            *,
            current_package:packages!package_change_requests_current_package_id_fkey(name, speed_mbps, monthly_price),
            requested_package:packages!package_change_requests_requested_package_id_fkey(name, speed_mbps, monthly_price)
          `)
          .eq("customer_id", customer_id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, requests: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "approve": {
        const { request_id, admin_notes } = body;
        if (!request_id) throw new Error("Missing request_id");

        // Get the request
        const { data: request, error: reqErr } = await supabaseAdmin
          .from("package_change_requests")
          .select("*, current_package:packages!package_change_requests_current_package_id_fkey(*), requested_package:packages!package_change_requests_requested_package_id_fkey(*)")
          .eq("id", request_id)
          .single();

        if (reqErr || !request) throw new Error("Request not found");
        if (request.status !== "pending") throw new Error("Request already processed");

        // Update customer's package and recalculate expiry
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("expiry_date, total_due")
          .eq("id", request.customer_id)
          .single();

        if (!customer) throw new Error("Customer not found");

        const newPkg = request.requested_package as any;
        const today = new Date();
        const newExpiry = new Date(today.getTime() + newPkg.validity_days * 24 * 60 * 60 * 1000);

        // Net charge = new package charge - credit from old package
        const netCharge = request.prorated_charge - request.prorated_credit;
        const newDue = Math.max(0, customer.total_due + netCharge);

        // Update customer
        await supabaseAdmin
          .from("customers")
          .update({
            package_id: request.requested_package_id,
            expiry_date: newExpiry.toISOString().split("T")[0],
            total_due: newDue,
          })
          .eq("id", request.customer_id);

        // Update MikroTik profile if exists
        await supabaseAdmin
          .from("mikrotik_users")
          .update({ profile: newPkg.name })
          .eq("customer_id", request.customer_id);

        // Mark request as approved
        await supabaseAdmin
          .from("package_change_requests")
          .update({
            status: "approved",
            admin_notes: admin_notes || null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", request_id);

        return new Response(
          JSON.stringify({ success: true, message: "Package change approved and applied" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reject": {
        const { request_id, admin_notes } = body;
        if (!request_id) throw new Error("Missing request_id");

        await supabaseAdmin
          .from("package_change_requests")
          .update({
            status: "rejected",
            admin_notes: admin_notes || null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", request_id);

        return new Response(
          JSON.stringify({ success: true, message: "Package change request rejected" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("package-change error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
