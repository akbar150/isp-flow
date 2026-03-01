

# Full System Data Backup - All Tables

## Current Problem
The existing backup only exports the `customers` table with basic fields. It misses all other critical business data -- payments, invoices, accounting, HRM, inventory, tickets, and more.

## Solution
Upgrade the edge function to export **every business table** as a multi-sheet Excel file (using the already-installed `xlsx` library pattern) or as a ZIP containing multiple CSV files. Since edge functions run in Deno (no `xlsx` on server), we'll export multiple CSVs bundled into a single JSON response, and generate the Excel file on the **client side** using the existing `xlsx` dependency.

## Architecture

```text
Edge Function (export-customer-backup)
  |
  +--> Fetches ALL tables with service role
  |    - customers + areas + packages + routers
  |    - payments
  |    - invoices + invoice_items
  |    - billing_records
  |    - transactions (accounting)
  |    - support_tickets + ticket_comments
  |    - service_tasks
  |    - inventory_items + stock_movements + metered_usage_logs
  |    - employees (safe view) + leave_requests + payroll (safe view)
  |    - reminder_logs
  |    - call_records
  |    - mikrotik_users (username only, no passwords)
  |    - resellers + reseller_customers + reseller_commissions
  |    - packages
  |    - routers (safe view)
  |
  +--> Generates one CSV per table
  +--> Bundles into a single ZIP-like upload or multiple files
  +--> Uploads to storage bucket
  +--> Logs result in backup_logs
```

## Changes

### 1. Rewrite Edge Function: `export-customer-backup`

Update `supabase/functions/export-customer-backup/index.ts` to:

- Query all 18+ business tables using the service role key
- Generate a separate CSV sheet for each table
- Combine all CSVs into a single multi-section CSV file (sections separated by clear headers) or upload individual CSV files per table
- Use proper Dhaka timezone throughout (UTC+6)
- Track total record count across all tables
- Handle the 1000-row Supabase limit by paginating large tables

**Tables to export (with key columns):**

| Sheet Name | Table | Key Columns |
|---|---|---|
| Customers | customers | user_id, name, phone, address, area, package, status, due, expiry |
| Payments | payments | customer, amount, method, date, received_by |
| Invoices | invoices | invoice_number, customer, total, status, issue_date, due_date |
| Invoice Items | invoice_items | invoice, description, qty, unit_price, total |
| Billing Records | billing_records | customer, package, amount, status, billing_date, due_date |
| Transactions | transactions | type, amount, payment_method, category, date, description |
| Support Tickets | support_tickets | ticket_number, customer, subject, category, priority, status |
| Service Tasks | service_tasks | customer, title, type, status, priority, assigned_to, scheduled_date |
| Inventory | inventory_items | product, serial, MAC, status, purchase_price, supplier |
| Stock Movements | stock_movements | item, from_status, to_status, quantity, date |
| Cable Usage | metered_usage_logs | product, customer, quantity, color, core_count, date |
| Employees | employees_safe | name, code, department, designation, status, joining_date |
| Leave Requests | leave_requests | employee, leave_type, start, end, status |
| Reminders | reminder_logs | customer, type, channel, message, sent_at |
| Call Records | call_records | customer, notes, call_date |
| PPPoE Users | mikrotik_users_safe | customer, username, profile, status, router |
| Packages | packages | name, speed, price, validity_days |
| Routers | routers_safe | name, ip_address, mode, is_active |
| Resellers | resellers | name, phone, code, commission_rate, status |
| Reseller Customers | reseller_customers | reseller, customer |
| Reseller Commissions | reseller_commissions | reseller, customer, amount, status |
| Areas | areas | name |

### 2. Fix Timezone to Dhaka (UTC+6)

- All timestamps in the exported data will be converted to Dhaka time
- Filename will use Dhaka time: `full_backup_2026-03-01_03-35.csv`
- The backup log `created_at` already uses database `now()` which respects server timezone

### 3. Update `BackupManagement.tsx`

- Update description text to say "Full system backup (all data)" instead of just "Customer Data Backups"
- Show which tables were included in the backup (from the response metadata)

### 4. Pagination for Large Tables

Since the database has a 1000-row default limit, the function will use range-based pagination to fetch all records from large tables (customers, payments, invoices, transactions).

## Technical Details

**Files to modify:**
- `supabase/functions/export-customer-backup/index.ts` -- complete rewrite to export all tables
- `src/components/settings/BackupManagement.tsx` -- minor label updates

**Key considerations:**
- Uses safe views (`employees_safe`, `mikrotik_users_safe`, `routers_safe`) to avoid exporting passwords
- Paginated fetches to handle tables with more than 1000 rows
- Single combined CSV file with section headers for each table (easy to split in Excel)
- Dhaka timezone (UTC+6) for all timestamps and filenames
- File uploaded to existing `customer-backups` storage bucket
