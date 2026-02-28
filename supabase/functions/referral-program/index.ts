import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      case "get_or_create_code": {
        const { customer_id } = body;
        if (!customer_id) throw new Error("Missing customer_id");

        // Check existing code
        const { data: existing } = await supabaseAdmin
          .from("referral_codes")
          .select("*")
          .eq("customer_id", customer_id)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ success: true, code: existing.code }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate unique code: REF-XXXXX
        const code = "REF-" + crypto.randomUUID().substring(0, 6).toUpperCase();

        const { error } = await supabaseAdmin
          .from("referral_codes")
          .insert({ customer_id, code });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, code }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_referrals": {
        const { customer_id } = body;
        if (!customer_id) throw new Error("Missing customer_id");

        const { data: referrals } = await supabaseAdmin
          .from("referrals")
          .select("*, referred_customer:customers!referrals_referred_customer_id_fkey(user_id, full_name, status)")
          .eq("referrer_id", customer_id)
          .order("created_at", { ascending: false });

        // Get total credit
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("referral_credit")
          .eq("id", customer_id)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            referrals: referrals || [],
            total_credit: customer?.referral_credit || 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "apply_referral": {
        // Called when a new customer signs up with a referral code
        const { referral_code, new_customer_id } = body;
        if (!referral_code || !new_customer_id) throw new Error("Missing fields");

        // Find the referral code
        const { data: codeRecord } = await supabaseAdmin
          .from("referral_codes")
          .select("customer_id, is_active")
          .eq("code", referral_code.toUpperCase())
          .single();

        if (!codeRecord || !codeRecord.is_active) {
          throw new Error("Invalid or inactive referral code");
        }

        // Prevent self-referral
        if (codeRecord.customer_id === new_customer_id) {
          throw new Error("Cannot use your own referral code");
        }

        // Check if this customer was already referred
        const { data: existingRef } = await supabaseAdmin
          .from("referrals")
          .select("id")
          .eq("referred_customer_id", new_customer_id)
          .limit(1);

        if (existingRef && existingRef.length > 0) {
          throw new Error("This customer was already referred");
        }

        // Create pending referral
        const { error } = await supabaseAdmin
          .from("referrals")
          .insert({
            referrer_id: codeRecord.customer_id,
            referred_customer_id: new_customer_id,
            status: "pending",
            credit_amount: 0,
          });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: "Referral recorded" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "credit_referral": {
        // Called by admin or auto-trigger when referred customer makes first payment
        const { referred_customer_id, credit_amount } = body;
        if (!referred_customer_id) throw new Error("Missing referred_customer_id");

        const amount = credit_amount || 100; // Default ৳100 credit

        // Find pending referral for this customer
        const { data: referral } = await supabaseAdmin
          .from("referrals")
          .select("id, referrer_id")
          .eq("referred_customer_id", referred_customer_id)
          .eq("status", "pending")
          .single();

        if (!referral) {
          return new Response(
            JSON.stringify({ success: true, message: "No pending referral found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update referral status
        await supabaseAdmin
          .from("referrals")
          .update({
            status: "credited",
            credit_amount: amount,
            credited_at: new Date().toISOString(),
          })
          .eq("id", referral.id);

        // Add credit to referrer's account
        const { data: referrer } = await supabaseAdmin
          .from("customers")
          .select("referral_credit, total_due")
          .eq("id", referral.referrer_id)
          .single();

        if (referrer) {
          const newCredit = (referrer.referral_credit || 0) + amount;
          const newDue = Math.max(0, referrer.total_due - amount);

          await supabaseAdmin
            .from("customers")
            .update({
              referral_credit: newCredit,
              total_due: newDue,
            })
            .eq("id", referral.referrer_id);
        }

        // Notify admin
        await supabaseAdmin.from("admin_notifications").insert({
          type: "system",
          title: "Referral Credit Applied",
          message: `৳${amount} referral credit applied to referrer for referred customer.`,
          entity_type: "referral",
          entity_id: referral.id,
        });

        return new Response(
          JSON.stringify({ success: true, message: `৳${amount} credit applied` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin_overview": {
        // Admin view of all referrals
        const { data: referrals } = await supabaseAdmin
          .from("referrals")
          .select(`
            *,
            referrer:customers!referrals_referrer_id_fkey(user_id, full_name),
            referred_customer:customers!referrals_referred_customer_id_fkey(user_id, full_name, status)
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        const { data: stats } = await supabaseAdmin
          .from("referrals")
          .select("status");

        const pending = (stats || []).filter((r: any) => r.status === "pending").length;
        const credited = (stats || []).filter((r: any) => r.status === "credited").length;

        return new Response(
          JSON.stringify({
            success: true,
            referrals: referrals || [],
            stats: { total: (stats || []).length, pending, credited },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("referral-program error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
