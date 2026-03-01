import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRow {
  username: string;
  expiry_date: string;
  package_name: string;
  status: string;
}

/** Normalize date/datetime string to ISO with Dhaka +06:00 offset for timestamptz */
function normalizeDateTimeToDbFormat(dateStr: string): string {
  if (!dateStr) return dateStr;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00+06:00`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed;
  if (trimmed.includes(" ")) {
    const datePart = trimmed.split(" ")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return `${datePart}T00:00:00+06:00`;
  }
  return trimmed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { records } = (await req.json()) as { records: SyncRow[] };

    if (!records || !Array.isArray(records)) {
      return new Response(JSON.stringify({ error: "records array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-fetch all packages for lookup
    const { data: allPackages } = await supabase.from("packages").select("id, name");
    const packageMap = new Map((allPackages || []).map((p) => [p.name, p.id]));

    const results = { updated: 0, not_found: 0, errors: [] as string[], unmatched: [] as string[] };

    for (const row of records) {
      try {
        // Find customer_id via mikrotik_users username
        const { data: mkUser } = await supabase
          .from("mikrotik_users")
          .select("customer_id")
          .eq("username", row.username)
          .maybeSingle();

        if (!mkUser) {
          results.not_found++;
          results.unmatched.push(row.username);
          continue;
        }

        const customerId = mkUser.customer_id;
        const status = row.status === "expire" || row.status === "expired" ? "expired" : "active";

        // Build update payload
        const updatePayload: Record<string, unknown> = {
          expiry_date: normalizeDateTimeToDbFormat(row.expiry_date),
          status,
        };

        // Only assign package if customer currently has none
        if (row.package_name && row.package_name !== "Expired") {
          const { data: customer } = await supabase
            .from("customers")
            .select("package_id")
            .eq("id", customerId)
            .single();

          if (customer && !customer.package_id) {
            const pkgId = packageMap.get(row.package_name);
            if (pkgId) {
              updatePayload.package_id = pkgId;
            }
          }
        }

        const { error: updateError } = await supabase
          .from("customers")
          .update(updatePayload)
          .eq("id", customerId);

        if (updateError) {
          results.errors.push(`${row.username}: ${updateError.message}`);
        } else {
          results.updated++;
        }
      } catch (err) {
        results.errors.push(`${row.username}: ${String(err)}`);
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
