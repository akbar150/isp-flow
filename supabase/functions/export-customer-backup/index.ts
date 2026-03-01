import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all customers with related data
    const { data: customers, error: fetchError } = await supabase
      .from("customers")
      .select(`
        user_id, full_name, phone, alt_phone, address, status,
        connection_type, billing_cycle, expiry_date, total_due, created_at,
        areas(name),
        packages(name, speed_mbps, monthly_price),
        routers(name)
      `)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    // Fetch PPPoE usernames
    const { data: mikrotikUsers } = await supabase
      .from("mikrotik_users")
      .select("customer_id, username");

    const pppoeMap = new Map(
      (mikrotikUsers || []).map((m: any) => [m.customer_id, m.username])
    );

    // Build CSV
    const headers = [
      "User ID", "Name", "Phone", "Alt Phone", "Address", "Area",
      "Package", "Speed (Mbps)", "Price", "Status", "Connection Type",
      "Billing Cycle", "Expiry Date", "Total Due", "PPPoE Username",
      "Router", "Created At",
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = (customers || []).map((c: any) => [
      c.user_id,
      c.full_name,
      c.phone,
      c.alt_phone,
      c.address,
      c.areas?.name,
      c.packages?.name,
      c.packages?.speed_mbps,
      c.packages?.monthly_price,
      c.status,
      c.connection_type,
      c.billing_cycle,
      c.expiry_date,
      c.total_due,
      pppoeMap.get(c.id) || "",
      c.routers?.name,
      c.created_at,
    ].map(escapeCSV).join(","));

    // BOM for Excel compatibility
    const BOM = "\uFEFF";
    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

    // Generate filename
    const now = new Date();
    const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const dateStr = dhaka.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    const fileName = `backup_${dateStr}.csv`;
    const filePath = fileName;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("customer-backups")
      .upload(filePath, csvBlob, {
        contentType: "text/csv",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Log the backup
    const { error: logError } = await supabase.from("backup_logs").insert({
      file_name: fileName,
      file_path: filePath,
      file_size_bytes: csvBlob.size,
      record_count: customers?.length || 0,
      status: "success",
    });

    if (logError) console.error("Failed to log backup:", logError);

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        record_count: customers?.length || 0,
        file_size_bytes: csvBlob.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Backup failed:", error);

    // Try to log the failure
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("backup_logs").insert({
        file_name: "failed",
        file_path: "failed",
        status: "failed",
        error_message: error.message || String(error),
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
