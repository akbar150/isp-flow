import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// FK-safe deletion order
const DELETION_ORDER = [
  "invoice_items",
  "invoices",
  "payments",
  "billing_records",
  "reseller_commissions",
  "reseller_customers",
  "ticket_comments",
  "support_tickets",
  "service_tasks",
  "stock_movements",
  "metered_usage_logs",
  "asset_assignments",
  "inventory_items",
  "leave_requests",
  "call_records",
  "reminder_logs",
  "mikrotik_users",
  "customers",
  "resellers",
  "packages",
  "areas",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tables, clean_existing } = await req.json();

    if (!tables || typeof tables !== "object") {
      return new Response(JSON.stringify({ error: "tables object required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { success: number; errors: string[] }> = {};

    // Step 1: Clean existing data if requested
    if (clean_existing) {
      for (const table of DELETION_ORDER) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) console.error(`Delete ${table}:`, error.message);
      }
    }

    // Step 2: Hash default password
    const { data: hashedPw } = await supabase.rpc("hash_password", {
      raw_password: "123456",
    });
    const defaultHash = hashedPw || "$2b$10$placeholder";

    // Helper: ensure areas exist and build map
    const areaRows = tables["Areas"] || [];
    for (const row of areaRows) {
      if (!row["Name"]) continue;
      const { data: existing } = await supabase
        .from("areas")
        .select("id")
        .eq("name", row["Name"])
        .maybeSingle();
      if (!existing) {
        await supabase.from("areas").insert({
          name: row["Name"],
          description: row["Description"] || null,
        });
      }
    }
    const { data: allAreas } = await supabase.from("areas").select("id, name");
    const areaMap = new Map((allAreas || []).map((a: any) => [a.name, a.id]));
    results["Areas"] = { success: areaRows.length, errors: [] };

    // Helper: ensure packages exist and build map
    const pkgRows = tables["Packages"] || [];
    for (const row of pkgRows) {
      if (!row["Name"]) continue;
      const { data: existing } = await supabase
        .from("packages")
        .select("id")
        .eq("name", row["Name"])
        .maybeSingle();
      if (!existing) {
        await supabase.from("packages").insert({
          name: row["Name"],
          speed_mbps: parseInt(row["Speed (Mbps)"]) || 10,
          monthly_price: parseFloat(row["Price"]) || 0,
          validity_days: parseInt(row["Validity Days"]) || 30,
          is_active: row["Active"] === "true",
          description: row["Description"] || null,
        });
      }
    }
    const { data: allPkgs } = await supabase.from("packages").select("id, name");
    const pkgMap = new Map((allPkgs || []).map((p: any) => [p.name, p.id]));
    results["Packages"] = { success: pkgRows.length, errors: [] };

    // Step 3: Restore Customers
    const custRows = tables["Customers"] || [];
    results["Customers"] = { success: 0, errors: [] };
    const custIdMap = new Map<string, string>(); // user_id -> uuid

    for (const c of custRows) {
      try {
        if (!c["User ID"] || !c["Name"]) continue;

        // Check if customer already exists
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", c["User ID"])
          .maybeSingle();

        if (existing) {
          custIdMap.set(c["User ID"], existing.id);
          results["Customers"].success++;
          continue;
        }

        let phone = String(c["Phone"] || "").replace(/\D/g, "");
        if (phone.startsWith("0") && phone.length === 11) phone = "88" + phone;
        if (phone.startsWith("1") && phone.length === 10) phone = "880" + phone;

        const expiryStr = c["Expiry"] ? c["Expiry"].replace(" (BD)", "").trim() : new Date().toISOString();

        const { data: cust, error } = await supabase
          .from("customers")
          .insert({
            user_id: c["User ID"],
            full_name: c["Name"],
            phone: phone || "8801000000000",
            alt_phone: c["Alt Phone"] || null,
            email: c["Email"] || null,
            address: c["Address"] || "N/A",
            area_id: areaMap.get(c["Area"]) || null,
            package_id: pkgMap.get(c["Package"]) || null,
            status: c["Status"] || "active",
            connection_type: c["Connection"] || "pppoe",
            billing_cycle: c["Billing Cycle"] || "monthly",
            expiry_date: expiryStr,
            total_due: parseFloat(c["Due"]) || 0,
            auto_renew: c["Auto Renew"] === "true",
            password_hash: defaultHash,
          })
          .select("id")
          .single();

        if (error) {
          results["Customers"].errors.push(`${c["User ID"]}: ${error.message}`);
        } else {
          custIdMap.set(c["User ID"], cust.id);
          results["Customers"].success++;
        }
      } catch (e) {
        results["Customers"].errors.push(`${c["User ID"]}: ${String(e)}`);
      }
    }

    // Build fresh customer lookup from DB for matching
    const { data: allCusts } = await supabase.from("customers").select("id, user_id");
    for (const cu of allCusts || []) {
      if (!custIdMap.has(cu.user_id)) custIdMap.set(cu.user_id, cu.id);
    }

    // Helper to resolve customer UUID from user_id
    const resolveCustomerId = (userId: string | undefined): string | null => {
      if (!userId) return null;
      return custIdMap.get(userId) || null;
    };

    // Step 4: PPPoE Users
    const pppoeRows = tables["PPPoE Users"] || [];
    results["PPPoE Users"] = { success: 0, errors: [] };
    for (const m of pppoeRows) {
      try {
        const cid = resolveCustomerId(m["Customer ID"]);
        if (!cid || !m["Username"]) continue;
        const { data: existing } = await supabase
          .from("mikrotik_users")
          .select("id")
          .eq("customer_id", cid)
          .eq("username", m["Username"])
          .maybeSingle();
        if (existing) { results["PPPoE Users"].success++; continue; }
        const { error } = await supabase.from("mikrotik_users").insert({
          customer_id: cid,
          username: m["Username"],
          password_encrypted: "12345678",
          profile: m["Profile"] || null,
          status: m["Status"] || "enabled",
        });
        if (error) results["PPPoE Users"].errors.push(`${m["Username"]}: ${error.message}`);
        else results["PPPoE Users"].success++;
      } catch (e) {
        results["PPPoE Users"].errors.push(String(e));
      }
    }

    // Step 5: Payments
    const payRows = tables["Payments"] || [];
    results["Payments"] = { success: 0, errors: [] };
    for (const p of payRows) {
      try {
        const cid = resolveCustomerId(p["Customer ID"]);
        if (!cid) continue;
        const { error } = await supabase.from("payments").insert({
          customer_id: cid,
          amount: parseFloat(p["Amount"]) || 0,
          method: p["Method"] || "cash",
          payment_date: p["Payment Date"]?.replace(" (BD)", "") || new Date().toISOString(),
          remaining_due: parseFloat(p["Remaining Due"]) || 0,
          transaction_id: p["Transaction ID"] || null,
          notes: p["Notes"] || null,
        });
        if (error) results["Payments"].errors.push(error.message);
        else results["Payments"].success++;
      } catch (e) {
        results["Payments"].errors.push(String(e));
      }
    }

    // Step 6: Billing Records
    const billRows = tables["Billing Records"] || [];
    results["Billing Records"] = { success: 0, errors: [] };
    for (const b of billRows) {
      try {
        const cid = resolveCustomerId(b["Customer ID"]);
        if (!cid) continue;
        const { error } = await supabase.from("billing_records").insert({
          customer_id: cid,
          package_name: b["Package"] || "Unknown",
          amount: parseFloat(b["Amount"]) || 0,
          amount_paid: parseFloat(b["Paid"]) || 0,
          status: b["Status"] || "unpaid",
          billing_date: b["Billing Date"] || new Date().toISOString().slice(0, 10),
          due_date: b["Due Date"] || new Date().toISOString().slice(0, 10),
          paid_date: b["Paid Date"] || null,
          notes: b["Notes"] || null,
        });
        if (error) results["Billing Records"].errors.push(error.message);
        else results["Billing Records"].success++;
      } catch (e) {
        results["Billing Records"].errors.push(String(e));
      }
    }

    // Step 7: Invoices
    const invRows = tables["Invoices"] || [];
    results["Invoices"] = { success: 0, errors: [] };
    const invoiceNumMap = new Map<string, string>();
    for (const inv of invRows) {
      try {
        const cid = resolveCustomerId(inv["Customer ID"]);
        if (!cid || !inv["Invoice #"]) continue;
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("invoice_number", inv["Invoice #"])
          .maybeSingle();
        if (existing) {
          invoiceNumMap.set(inv["Invoice #"], existing.id);
          results["Invoices"].success++;
          continue;
        }
        const { data: created, error } = await supabase.from("invoices").insert({
          customer_id: cid,
          invoice_number: inv["Invoice #"],
          subtotal: parseFloat(inv["Subtotal"]) || 0,
          discount: parseFloat(inv["Discount"]) || 0,
          tax: parseFloat(inv["Tax"]) || 0,
          total: parseFloat(inv["Total"]) || 0,
          amount_paid: parseFloat(inv["Paid"]) || 0,
          status: inv["Status"] || "draft",
          issue_date: inv["Issue Date"] || new Date().toISOString().slice(0, 10),
          due_date: inv["Due Date"] || new Date().toISOString().slice(0, 10),
          notes: inv["Notes"] || null,
        }).select("id").single();
        if (error) results["Invoices"].errors.push(`${inv["Invoice #"]}: ${error.message}`);
        else {
          invoiceNumMap.set(inv["Invoice #"], created.id);
          results["Invoices"].success++;
        }
      } catch (e) {
        results["Invoices"].errors.push(String(e));
      }
    }

    // Step 8: Invoice Items
    const iiRows = tables["Invoice Items"] || [];
    results["Invoice Items"] = { success: 0, errors: [] };
    // Build invoice lookup from DB
    const { data: allInvoices } = await supabase.from("invoices").select("id, invoice_number");
    for (const inv of allInvoices || []) {
      if (!invoiceNumMap.has(inv.invoice_number)) invoiceNumMap.set(inv.invoice_number, inv.id);
    }
    for (const ii of iiRows) {
      try {
        const invId = invoiceNumMap.get(ii["Invoice #"]);
        if (!invId) continue;
        const { error } = await supabase.from("invoice_items").insert({
          invoice_id: invId,
          description: ii["Description"] || "Item",
          quantity: parseInt(ii["Qty"]) || 1,
          unit_price: parseFloat(ii["Unit Price"]) || 0,
          total: parseFloat(ii["Total"]) || 0,
        });
        if (error) results["Invoice Items"].errors.push(error.message);
        else results["Invoice Items"].success++;
      } catch (e) {
        results["Invoice Items"].errors.push(String(e));
      }
    }

    // Step 9: Transactions
    const txRows = tables["Transactions"] || [];
    results["Transactions"] = { success: 0, errors: [] };
    // Build category map
    const { data: allCats } = await supabase.from("expense_categories").select("id, name");
    const catMap = new Map((allCats || []).map((c: any) => [c.name, c.id]));
    for (const tx of txRows) {
      try {
        const { error } = await supabase.from("transactions").insert({
          type: tx["Type"] || "expense",
          amount: parseFloat(tx["Amount"]) || 0,
          payment_method: tx["Payment Method"] || "cash",
          category_id: catMap.get(tx["Category"]) || null,
          transaction_date: tx["Date"] || new Date().toISOString().slice(0, 10),
          description: tx["Description"] || null,
          reference_id: tx["Reference"] || null,
        });
        if (error) results["Transactions"].errors.push(error.message);
        else results["Transactions"].success++;
      } catch (e) {
        results["Transactions"].errors.push(String(e));
      }
    }

    // Step 10: Support Tickets
    const tktRows = tables["Support Tickets"] || [];
    results["Support Tickets"] = { success: 0, errors: [] };
    const ticketNumMap = new Map<string, string>();
    for (const t of tktRows) {
      try {
        const cid = resolveCustomerId(t["Customer ID"]);
        if (!cid || !t["Ticket #"]) continue;
        const { data: existing } = await supabase
          .from("support_tickets")
          .select("id")
          .eq("ticket_number", t["Ticket #"])
          .maybeSingle();
        if (existing) {
          ticketNumMap.set(t["Ticket #"], existing.id);
          results["Support Tickets"].success++;
          continue;
        }
        const { data: created, error } = await supabase.from("support_tickets").insert({
          customer_id: cid,
          ticket_number: t["Ticket #"],
          subject: t["Subject"] || "Restored ticket",
          category: t["Category"] || "other",
          priority: t["Priority"] || "medium",
          status: t["Status"] || "open",
          description: t["Subject"] || "Restored from backup",
        }).select("id").single();
        if (error) results["Support Tickets"].errors.push(`${t["Ticket #"]}: ${error.message}`);
        else {
          ticketNumMap.set(t["Ticket #"], created.id);
          results["Support Tickets"].success++;
        }
      } catch (e) {
        results["Support Tickets"].errors.push(String(e));
      }
    }

    // Step 11: Call Records
    const callRows = tables["Call Records"] || [];
    results["Call Records"] = { success: 0, errors: [] };
    for (const cr of callRows) {
      try {
        const cid = resolveCustomerId(cr["Customer ID"]);
        if (!cid) continue;
        const { error } = await supabase.from("call_records").insert({
          customer_id: cid,
          notes: cr["Notes"] || "Restored",
          call_date: cr["Call Date"]?.replace(" (BD)", "") || new Date().toISOString(),
        });
        if (error) results["Call Records"].errors.push(error.message);
        else results["Call Records"].success++;
      } catch (e) {
        results["Call Records"].errors.push(String(e));
      }
    }

    // Step 12: Reminders
    const remRows = tables["Reminders"] || [];
    results["Reminders"] = { success: 0, errors: [] };
    for (const r of remRows) {
      try {
        const cid = resolveCustomerId(r["Customer ID"]);
        if (!cid) continue;
        const { error } = await supabase.from("reminder_logs").insert({
          customer_id: cid,
          reminder_type: r["Type"] || "payment_due",
          channel: r["Channel"] || "whatsapp",
          message: r["Message"] || null,
          sent_at: r["Sent At"]?.replace(" (BD)", "") || new Date().toISOString(),
        });
        if (error) results["Reminders"].errors.push(error.message);
        else results["Reminders"].success++;
      } catch (e) {
        results["Reminders"].errors.push(String(e));
      }
    }

    // Step 13: Resellers
    const resRows = tables["Resellers"] || [];
    results["Resellers"] = { success: 0, errors: [] };
    for (const r of resRows) {
      try {
        if (!r["Code"]) continue;
        const { data: existing } = await supabase
          .from("resellers")
          .select("id")
          .eq("reseller_code", r["Code"])
          .maybeSingle();
        if (existing) { results["Resellers"].success++; continue; }
        const { error } = await supabase.from("resellers").insert({
          reseller_code: r["Code"],
          name: r["Name"] || "Unknown",
          phone: r["Phone"] || "8801000000000",
          email: r["Email"] || null,
          address: r["Address"] || null,
          commission_rate: parseFloat(r["Commission %"]) || 10,
          status: r["Status"] || "active",
          password_hash: defaultHash,
        });
        if (error) results["Resellers"].errors.push(`${r["Code"]}: ${error.message}`);
        else results["Resellers"].success++;
      } catch (e) {
        results["Resellers"].errors.push(String(e));
      }
    }

    // Build summary
    let totalRestored = 0;
    let totalErrors = 0;
    for (const [, v] of Object.entries(results)) {
      totalRestored += v.success;
      totalErrors += v.errors.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_restored: totalRestored,
        total_errors: totalErrors,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Restore failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
