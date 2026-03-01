import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Dhaka timezone offset (UTC+6)
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function toDhaka(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dhaka = new Date(d.getTime() + DHAKA_OFFSET_MS);
    return dhaka.toISOString().replace("T", " ").replace("Z", "") + " (BD)";
  } catch {
    return dateStr;
  }
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function fetchAll(supabase: any, table: string, select = "*", orderBy = "created_at") {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function buildCSVSection(sheetName: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map(r => r.map(escapeCSV).join(",")).join("\n");
  return `\n=== ${sheetName} (${rows.length} records) ===\n${headerLine}\n${dataLines}\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let totalRecords = 0;
    const tableSummary: Record<string, number> = {};
    const sections: string[] = [];

    // 1. Customers
    const customers = await fetchAll(supabase, "customers",
      "user_id, full_name, phone, alt_phone, address, email, status, connection_type, billing_cycle, expiry_date, total_due, auto_renew, created_at, areas(name), packages(name, speed_mbps, monthly_price), routers(name)");
    tableSummary["Customers"] = customers.length;
    totalRecords += customers.length;
    sections.push(buildCSVSection("Customers",
      ["User ID", "Name", "Phone", "Alt Phone", "Email", "Address", "Area", "Package", "Speed", "Price", "Status", "Connection", "Billing Cycle", "Expiry", "Due", "Auto Renew", "Created"],
      customers.map((c: any) => [c.user_id, c.full_name, c.phone, c.alt_phone, c.email, c.address, c.areas?.name, c.packages?.name, c.packages?.speed_mbps, c.packages?.monthly_price, c.status, c.connection_type, c.billing_cycle, toDhaka(c.expiry_date), c.total_due, c.auto_renew, toDhaka(c.created_at)])));

    // 2. Payments
    const payments = await fetchAll(supabase, "payments", "*, customers(user_id, full_name)");
    tableSummary["Payments"] = payments.length;
    totalRecords += payments.length;
    sections.push(buildCSVSection("Payments",
      ["Customer ID", "Customer", "Amount", "Method", "Payment Date", "Remaining Due", "Transaction ID", "Notes", "Created"],
      payments.map((p: any) => [p.customers?.user_id, p.customers?.full_name, p.amount, p.method, toDhaka(p.payment_date), p.remaining_due, p.transaction_id, p.notes, toDhaka(p.created_at)])));

    // 3. Invoices
    const invoices = await fetchAll(supabase, "invoices", "*, customers(user_id, full_name)");
    tableSummary["Invoices"] = invoices.length;
    totalRecords += invoices.length;
    sections.push(buildCSVSection("Invoices",
      ["Invoice #", "Customer ID", "Customer", "Subtotal", "Discount", "Tax", "Total", "Paid", "Status", "Issue Date", "Due Date", "Notes", "Created"],
      invoices.map((i: any) => [i.invoice_number, i.customers?.user_id, i.customers?.full_name, i.subtotal, i.discount, i.tax, i.total, i.amount_paid, i.status, i.issue_date, i.due_date, i.notes, toDhaka(i.created_at)])));

    // 4. Invoice Items
    const invoiceItems = await fetchAll(supabase, "invoice_items", "*, invoices(invoice_number)");
    tableSummary["Invoice Items"] = invoiceItems.length;
    totalRecords += invoiceItems.length;
    sections.push(buildCSVSection("Invoice Items",
      ["Invoice #", "Description", "Qty", "Unit Price", "Total", "Created"],
      invoiceItems.map((ii: any) => [ii.invoices?.invoice_number, ii.description, ii.quantity, ii.unit_price, ii.total, toDhaka(ii.created_at)])));

    // 5. Billing Records
    const billing = await fetchAll(supabase, "billing_records", "*, customers(user_id, full_name)");
    tableSummary["Billing Records"] = billing.length;
    totalRecords += billing.length;
    sections.push(buildCSVSection("Billing Records",
      ["Customer ID", "Customer", "Package", "Amount", "Paid", "Status", "Billing Date", "Due Date", "Paid Date", "Notes", "Created"],
      billing.map((b: any) => [b.customers?.user_id, b.customers?.full_name, b.package_name, b.amount, b.amount_paid, b.status, b.billing_date, b.due_date, b.paid_date, b.notes, toDhaka(b.created_at)])));

    // 6. Transactions (Accounting)
    const transactions = await fetchAll(supabase, "transactions", "*, expense_categories(name)");
    tableSummary["Transactions"] = transactions.length;
    totalRecords += transactions.length;
    sections.push(buildCSVSection("Transactions",
      ["Type", "Amount", "Payment Method", "Category", "Date", "Description", "Reference", "Created"],
      transactions.map((t: any) => [t.type, t.amount, t.payment_method, t.expense_categories?.name, t.transaction_date, t.description, t.reference_id, toDhaka(t.created_at)])));

    // 7. Support Tickets
    const tickets = await fetchAll(supabase, "support_tickets", "*, customers(user_id, full_name)");
    tableSummary["Support Tickets"] = tickets.length;
    totalRecords += tickets.length;
    sections.push(buildCSVSection("Support Tickets",
      ["Ticket #", "Customer ID", "Customer", "Subject", "Category", "Priority", "Status", "SLA Deadline", "Resolved At", "Created"],
      tickets.map((t: any) => [t.ticket_number, t.customers?.user_id, t.customers?.full_name, t.subject, t.category, t.priority, t.status, toDhaka(t.sla_deadline), toDhaka(t.resolved_at), toDhaka(t.created_at)])));

    // 8. Ticket Comments
    const comments = await fetchAll(supabase, "ticket_comments", "*, support_tickets(ticket_number)");
    tableSummary["Ticket Comments"] = comments.length;
    totalRecords += comments.length;
    sections.push(buildCSVSection("Ticket Comments",
      ["Ticket #", "Comment", "Internal", "Created"],
      comments.map((c: any) => [c.support_tickets?.ticket_number, c.comment, c.is_internal, toDhaka(c.created_at)])));

    // 9. Service Tasks
    const tasks = await fetchAll(supabase, "service_tasks", "*, customers(user_id, full_name)");
    tableSummary["Service Tasks"] = tasks.length;
    totalRecords += tasks.length;
    sections.push(buildCSVSection("Service Tasks",
      ["Customer ID", "Customer", "Title", "Type", "Status", "Priority", "Scheduled", "Completed", "Notes", "Created"],
      tasks.map((t: any) => [t.customers?.user_id, t.customers?.full_name, t.title, t.task_type, t.status, t.priority, t.scheduled_date, toDhaka(t.completed_at), t.notes, toDhaka(t.created_at)])));

    // 10. Inventory Items
    const inventory = await fetchAll(supabase, "inventory_items", "*, products(name), suppliers(name)");
    tableSummary["Inventory"] = inventory.length;
    totalRecords += inventory.length;
    sections.push(buildCSVSection("Inventory",
      ["Product", "Serial", "MAC", "Status", "Purchase Price", "Purchase Date", "Warranty End", "Supplier", "Cable Color", "Core Count", "Cable Length", "Notes", "Created"],
      inventory.map((i: any) => [i.products?.name, i.serial_number, i.mac_address, i.status, i.purchase_price, i.purchase_date, i.warranty_end_date, i.suppliers?.name, i.cable_color, i.core_count, i.cable_length_m, i.notes, toDhaka(i.created_at)])));

    // 11. Stock Movements
    const stockMoves = await fetchAll(supabase, "stock_movements", "*");
    tableSummary["Stock Movements"] = stockMoves.length;
    totalRecords += stockMoves.length;
    sections.push(buildCSVSection("Stock Movements",
      ["Item ID", "From", "To", "Type", "Qty", "Notes", "Created"],
      stockMoves.map((s: any) => [s.inventory_item_id, s.from_status, s.to_status, s.movement_type, s.quantity, s.notes, toDhaka(s.created_at)])));

    // 12. Metered Usage (Cable)
    const usage = await fetchAll(supabase, "metered_usage_logs", "*, products(name), customers(user_id, full_name)", "created_at");
    tableSummary["Cable Usage"] = usage.length;
    totalRecords += usage.length;
    sections.push(buildCSVSection("Cable Usage",
      ["Product", "Customer ID", "Customer", "Qty", "Color", "Core Count", "Type", "Selling Price", "Account Type", "Technician", "Date", "Notes"],
      usage.map((u: any) => [u.products?.name, u.customers?.user_id, u.customers?.full_name, u.quantity_used, u.color, u.core_count, u.usage_type, u.selling_price, u.account_type, u.technician_name, u.usage_date, u.notes])));

    // 13. Employees (safe view)
    const employees = await fetchAll(supabase, "employees_safe", "*");
    tableSummary["Employees"] = employees.length;
    totalRecords += employees.length;
    sections.push(buildCSVSection("Employees",
      ["Code", "Name", "Department ID", "Designation ID", "Status", "Joining Date", "Termination Date", "Notes"],
      employees.map((e: any) => [e.employee_code, e.full_name, e.department_id, e.designation_id, e.status, e.joining_date, e.termination_date, e.notes])));

    // 14. Leave Requests
    const leaves = await fetchAll(supabase, "leave_requests", "*, employees(full_name, employee_code), leave_types(name)");
    tableSummary["Leave Requests"] = leaves.length;
    totalRecords += leaves.length;
    sections.push(buildCSVSection("Leave Requests",
      ["Employee Code", "Employee", "Leave Type", "Start", "End", "Status", "Reason", "Created"],
      leaves.map((l: any) => [l.employees?.employee_code, l.employees?.full_name, l.leave_types?.name, l.start_date, l.end_date, l.status, l.reason, toDhaka(l.created_at)])));

    // 15. Reminder Logs
    const reminders = await fetchAll(supabase, "reminder_logs", "*, customers(user_id, full_name)", "sent_at");
    tableSummary["Reminders"] = reminders.length;
    totalRecords += reminders.length;
    sections.push(buildCSVSection("Reminders",
      ["Customer ID", "Customer", "Type", "Channel", "Message", "Sent At"],
      reminders.map((r: any) => [r.customers?.user_id, r.customers?.full_name, r.reminder_type, r.channel, r.message, toDhaka(r.sent_at)])));

    // 16. Call Records
    const calls = await fetchAll(supabase, "call_records", "*, customers(user_id, full_name)");
    tableSummary["Call Records"] = calls.length;
    totalRecords += calls.length;
    sections.push(buildCSVSection("Call Records",
      ["Customer ID", "Customer", "Notes", "Call Date", "Created"],
      calls.map((c: any) => [c.customers?.user_id, c.customers?.full_name, c.notes, toDhaka(c.call_date), toDhaka(c.created_at)])));

    // 17. PPPoE Users (safe - no passwords)
    const pppoe = await fetchAll(supabase, "mikrotik_users", "customer_id, username, profile, status, router_id, customers(user_id, full_name)");
    tableSummary["PPPoE Users"] = pppoe.length;
    totalRecords += pppoe.length;
    sections.push(buildCSVSection("PPPoE Users",
      ["Customer ID", "Customer", "Username", "Profile", "Status", "Router ID"],
      pppoe.map((m: any) => [m.customers?.user_id, m.customers?.full_name, m.username, m.profile, m.status, m.router_id])));

    // 18. Packages
    const packages = await fetchAll(supabase, "packages", "*");
    tableSummary["Packages"] = packages.length;
    totalRecords += packages.length;
    sections.push(buildCSVSection("Packages",
      ["Name", "Speed (Mbps)", "Price", "Validity Days", "Active", "Description"],
      packages.map((p: any) => [p.name, p.speed_mbps, p.monthly_price, p.validity_days, p.is_active, p.description])));

    // 19. Routers (safe - no passwords)
    const routers = await fetchAll(supabase, "routers_safe", "*");
    tableSummary["Routers"] = routers.length;
    totalRecords += routers.length;
    sections.push(buildCSVSection("Routers",
      ["Name", "IP Address", "Username", "Port", "Mode", "Active"],
      routers.map((r: any) => [r.name, r.ip_address, r.username, r.port, r.mode, r.is_active])));

    // 20. Areas
    const areas = await fetchAll(supabase, "areas", "*");
    tableSummary["Areas"] = areas.length;
    totalRecords += areas.length;
    sections.push(buildCSVSection("Areas",
      ["Name", "Description", "Created"],
      areas.map((a: any) => [a.name, a.description, toDhaka(a.created_at)])));

    // 21. Resellers
    const resellers = await fetchAll(supabase, "resellers", "id, reseller_code, name, phone, email, address, commission_rate, status, created_at");
    tableSummary["Resellers"] = resellers.length;
    totalRecords += resellers.length;
    sections.push(buildCSVSection("Resellers",
      ["Code", "Name", "Phone", "Email", "Address", "Commission %", "Status", "Created"],
      resellers.map((r: any) => [r.reseller_code, r.name, r.phone, r.email, r.address, r.commission_rate, r.status, toDhaka(r.created_at)])));

    // 22. Reseller Customers
    const resellerCust = await fetchAll(supabase, "reseller_customers", "*, resellers(name, reseller_code), customers(user_id, full_name)");
    tableSummary["Reseller Customers"] = resellerCust.length;
    totalRecords += resellerCust.length;
    sections.push(buildCSVSection("Reseller Customers",
      ["Reseller Code", "Reseller", "Customer ID", "Customer", "Created"],
      resellerCust.map((rc: any) => [rc.resellers?.reseller_code, rc.resellers?.name, rc.customers?.user_id, rc.customers?.full_name, toDhaka(rc.created_at)])));

    // 23. Reseller Commissions
    const commissions = await fetchAll(supabase, "reseller_commissions", "*, resellers(name, reseller_code), customers(user_id, full_name)");
    tableSummary["Reseller Commissions"] = commissions.length;
    totalRecords += commissions.length;
    sections.push(buildCSVSection("Reseller Commissions",
      ["Reseller Code", "Reseller", "Customer ID", "Customer", "Amount", "Status", "Notes", "Created"],
      commissions.map((c: any) => [c.resellers?.reseller_code, c.resellers?.name, c.customers?.user_id, c.customers?.full_name, c.amount, c.status, c.notes, toDhaka(c.created_at)])));

    // Build final CSV
    const now = new Date();
    const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
    const dateStr = dhaka.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");

    const summaryLines = Object.entries(tableSummary).map(([k, v]) => `${k}: ${v} records`).join("\n");
    const header = `=== FULL SYSTEM BACKUP ===\nGenerated: ${dhaka.toISOString().replace("T", " ").replace("Z", "")} (Dhaka UTC+6)\nTotal Records: ${totalRecords}\n\n${summaryLines}\n`;

    const BOM = "\uFEFF";
    const csvContent = BOM + header + sections.join("");
    const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

    const fileName = `full_backup_${dateStr}.csv`;

    const { error: uploadError } = await supabase.storage
      .from("customer-backups")
      .upload(fileName, csvBlob, { contentType: "text/csv", upsert: false });

    if (uploadError) throw uploadError;

    // Log
    const { error: logError } = await supabase.from("backup_logs").insert({
      file_name: fileName,
      file_path: fileName,
      file_size_bytes: csvBlob.size,
      record_count: totalRecords,
      status: "success",
    });
    if (logError) console.error("Failed to log backup:", logError);

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        record_count: totalRecords,
        file_size_bytes: csvBlob.size,
        tables: tableSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Backup failed:", error);
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
