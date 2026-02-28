import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CustomerRow {
  name: string;
  phone: string;
  username: string;
  status: string;
  expiry_date: string;
  package_name: string;
  bill: number;
  zone: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { customers, clean_existing } = (await req.json()) as {
      customers: CustomerRow[];
      clean_existing?: boolean;
    };

    if (!customers || !Array.isArray(customers)) {
      return new Response(JSON.stringify({ error: "customers array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Clean existing data if requested (FK-safe order)
    if (clean_existing) {
      const deletionOrder = [
        "invoice_items",
        "invoices",
        "payments",
        "billing_records",
        "asset_assignments",
        "metered_usage_logs",
        "call_records",
        "reminder_logs",
        "mikrotik_users",
        "customers",
      ];
      for (const table of deletionOrder) {
        const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) console.error(`Error deleting ${table}:`, error.message);
      }
    }

    // Step 2: Ensure packages exist
    const uniquePackages = new Map<string, { name: string; speed: number; price: number }>();
    const packageDefs: Record<string, { speed: number; price: number }> = {
      "FRN-8Mbps": { speed: 8, price: 600 },
      "FRN-25Mbps": { speed: 25, price: 700 },
      "Sync-36Mbps-800-Unlimited": { speed: 36, price: 800 },
      "Sync-70Mbps-1000-Unlimited": { speed: 70, price: 1000 },
      "Sync-80Mbps-1200-Unlimited": { speed: 80, price: 1200 },
    };

    for (const [name, def] of Object.entries(packageDefs)) {
      uniquePackages.set(name, { name, ...def });
    }

    // Upsert packages
    for (const [name, def] of uniquePackages) {
      const { data: existing } = await supabase
        .from("packages")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      if (!existing) {
        await supabase.from("packages").insert({
          name,
          speed_mbps: def.speed,
          monthly_price: def.price,
          validity_days: 30,
          is_active: true,
        });
      }
    }

    // Step 3: Ensure areas exist
    const uniqueZones = [...new Set(customers.map((c) => c.zone).filter(Boolean))];
    for (const zone of uniqueZones) {
      const { data: existing } = await supabase
        .from("areas")
        .select("id")
        .eq("name", zone)
        .maybeSingle();
      if (!existing) {
        await supabase.from("areas").insert({ name: zone });
      }
    }

    // Fetch all packages and areas for mapping
    const { data: allPackages } = await supabase.from("packages").select("id, name");
    const { data: allAreas } = await supabase.from("areas").select("id, name");

    const packageMap = new Map((allPackages || []).map((p) => [p.name, p.id]));
    const areaMap = new Map((allAreas || []).map((a) => [a.name, a.id]));

    // Step 4: Hash default password
    const { data: hashedPw } = await supabase.rpc("hash_password", {
      raw_password: "123456",
    });

    const defaultPasswordHash = hashedPw || "$2b$10$placeholder";

    // Step 5: Insert customers
    const results = { success: 0, errors: [] as string[] };

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      try {
        // Generate user ID
        const { data: userId } = await supabase.rpc("generate_customer_user_id");

        // Normalize phone
        let phone = String(c.phone).replace(/\D/g, "");
        if (phone.startsWith("880")) phone = "0" + phone.slice(3);
        if (!phone.startsWith("0")) phone = "0" + phone;

        // Map status
        const status = c.status === "expire" || c.status === "expired" ? "expired" : "active";

        // Map package (skip "Expired" package name)
        let packageId: string | null = null;
        if (c.package_name && c.package_name !== "Expired") {
          packageId = packageMap.get(c.package_name) || null;
        }

        // Map area
        const areaId = areaMap.get(c.zone) || null;

        // Calculate billing start date (expiry - 30 days)
        const expiryDate = new Date(c.expiry_date);
        const billingStart = new Date(expiryDate);
        billingStart.setDate(billingStart.getDate() - 30);

        // Insert customer
        const { data: customer, error: custError } = await supabase
          .from("customers")
          .insert({
            user_id: userId,
            full_name: c.name,
            phone,
            address: c.zone || "N/A",
            password_hash: defaultPasswordHash,
            package_id: packageId,
            area_id: areaId,
            status,
            expiry_date: expiryDate.toISOString().split("T")[0],
            billing_start_date: billingStart.toISOString().split("T")[0],
            total_due: c.bill || 0,
            connection_type: "pppoe",
            billing_cycle: "monthly",
            auto_renew: true,
          })
          .select("id")
          .single();

        if (custError) {
          results.errors.push(`${c.name}: ${custError.message}`);
          continue;
        }

        // Insert MikroTik user
        if (c.username && customer) {
          await supabase.from("mikrotik_users").insert({
            customer_id: customer.id,
            username: c.username,
            password_encrypted: "12345678",
            status: status === "active" ? "enabled" : "disabled",
          });
        }

        results.success++;
      } catch (err) {
        results.errors.push(`${c.name}: ${String(err)}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
