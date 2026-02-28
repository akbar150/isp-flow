import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, reseller_code, password } = await req.json();

    if (action === "login") {
      if (!reseller_code || !password) {
        return new Response(JSON.stringify({ success: false, error: "Reseller code and password required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      const { data: reseller, error } = await supabase
        .from("resellers")
        .select("*")
        .eq("reseller_code", reseller_code.toUpperCase())
        .single();

      if (error || !reseller) {
        return new Response(JSON.stringify({ success: false, error: "Invalid reseller code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      if (reseller.status !== "active") {
        return new Response(JSON.stringify({ success: false, error: "Account is " + reseller.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
        });
      }

      // Verify password
      const { data: valid } = await supabase.rpc("verify_password", {
        raw_password: password,
        hashed_password: reseller.password_hash,
      });

      if (!valid) {
        return new Response(JSON.stringify({ success: false, error: "Invalid password" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        reseller: {
          id: reseller.id,
          name: reseller.name,
          reseller_code: reseller.reseller_code,
          phone: reseller.phone,
          email: reseller.email,
          commission_rate: reseller.commission_rate,
          status: reseller.status,
        },
        session_token: `reseller_${reseller.id}_${Date.now()}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add_customer") {
      const body = await req.json().catch(() => ({}));
      // This is handled separately
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
