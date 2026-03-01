

# Backup Delete and Data Restore Feature

## Overview
Add two capabilities to the Backup Management panel:
1. **Delete backups** -- remove backup files from storage and their log entries
2. **Upload & Restore** -- upload a previously downloaded backup CSV and restore all data back into the system

## Changes

### 1. Delete Backup (Frontend only)

Update `src/components/settings/BackupManagement.tsx`:
- Add a **Trash** icon button next to each backup's download button
- On click, show an AlertDialog confirmation ("This will permanently delete the backup file")
- On confirm: delete the file from the `customer-backups` storage bucket, then delete the `backup_logs` row
- Refresh the list after deletion

### 2. Restore from Backup -- New Edge Function

Create `supabase/functions/restore-customer-backup/index.ts`:

This function receives the parsed backup data (JSON with table arrays) and restores it into the database using the service role key.

**Restore logic:**
- Accept a JSON body with `{ tables: { Customers: [...], Payments: [...], ... }, clean_existing: boolean }`
- If `clean_existing` is true, delete existing data in FK-safe order (same pattern as the bulk import function)
- Insert data table by table in dependency order:
  1. Areas, Packages, Routers (reference data)
  2. Customers (with area/package lookups)
  3. MikroTik Users, Payments, Invoices, Billing Records, etc.
  4. Dependent records: Invoice Items, Ticket Comments, Reseller Customers/Commissions, Stock Movements, etc.
- For each table, map the CSV column names back to database columns
- Use upsert where possible to avoid duplicates
- Return a summary of restored record counts and any errors

**Key considerations:**
- Customers are matched/created by `user_id` field
- Packages and Areas are matched by name (upsert)
- Foreign key relationships are resolved by name lookups (e.g., customer `user_id` to `customers.id`)
- Passwords: restored customers get default password hash (same as bulk import)
- PPPoE users get default password

### 3. Restore UI in BackupManagement.tsx

Add a new section below the backup list:
- **"Restore from Backup"** card with:
  - File upload input (accepts `.csv` files)
  - Checkbox: "Clear existing data before restore" (with warning text)
  - A text confirmation input requiring user to type "RESTORE" before proceeding
  - "Start Restore" button
- The client-side logic will:
  1. Read the uploaded CSV file
  2. Parse the multi-section format (split by `=== TableName (N records) ===` headers)
  3. Convert each section's CSV rows back into JSON objects
  4. Send the parsed data to the `restore-customer-backup` edge function
  5. Show progress/result toast with record counts

### 4. Config & Permissions

- Add `restore-customer-backup` to `supabase/config.toml` with `verify_jwt = false`
- The restore UI will only be visible to `super_admin` (already gated by the Backups tab)
- The edge function uses service role key to bypass RLS

## Technical Details

**Files to create:**
- `supabase/functions/restore-customer-backup/index.ts`

**Files to modify:**
- `src/components/settings/BackupManagement.tsx` -- add delete button + restore upload UI
- `supabase/config.toml` -- add restore function config

**Deletion order for clean restore (FK-safe):**
```text
invoice_items -> invoices -> payments -> billing_records -> 
reseller_commissions -> reseller_customers -> 
ticket_comments -> support_tickets -> service_tasks ->
stock_movements -> metered_usage_logs -> inventory_items ->
leave_requests -> call_records -> reminder_logs -> 
mikrotik_users -> customers -> resellers -> 
packages -> areas -> routers
```

**CSV parsing approach:**
The backup file uses section markers like `=== Customers (150 records) ===` followed by a header row and data rows. The client parser will:
1. Split file content by lines
2. Detect section markers via regex `/^=== (.+?) \(\d+ records\) ===/`
3. Parse CSV rows between markers into arrays of objects using the header row as keys

