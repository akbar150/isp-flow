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

/** Extract YYYY-MM-DD from any date/datetime string, preventing timezone shifts */
function normalizeDateToLocal(dateStr: string): string {
  if (!dateStr) return dateStr;
  // If already YYYY-MM-DD (10 chars, no time), return as-is
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // If ISO format with T, take the date part before T
  if (trimmed.includes("T")) return trimmed.split("T")[0];
  // If has space (e.g. "2026-03-01 11:59:00 PM"), take date part before space
  if (trimmed.includes(" ")) return trimmed.split(" ")[0];
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
          expiry_date: normalizeDateToLocal(row.expiry_date),
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
