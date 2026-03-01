

# Automated Customer Data Backup/Export Feature

## Overview
Build a scheduled backup system that automatically exports all customer data (with related package, area, and billing info) as CSV files, stores them in cloud storage, and provides a UI to manage backup settings and download past backups.

## Architecture

```text
+------------------+       +-----------------------+       +------------------+
| pg_cron schedule | ----> | Edge Function:        | ----> | Storage Bucket:  |
| (daily/weekly)   |       | export-customer-backup|       | customer-backups |
+------------------+       +-----------------------+       +------------------+
                                    |
                                    v
                           +------------------+
                           | backup_logs table |
                           +------------------+
                                    ^
                                    |
                           +------------------+
                           | Settings UI:     |
                           | Backup tab       |
                           +------------------+
```

## Changes

### 1. Database: Create `backup_logs` table and storage bucket

New migration:
- **`backup_logs` table** with columns: `id`, `file_name`, `file_path`, `file_size_bytes`, `record_count`, `status` (success/failed), `error_message`, `created_at`
- RLS: Only admins/super_admins can view and manage
- **Storage bucket** `customer-backups` (private) with RLS for admin-only access
- Enable `pg_cron` and `pg_net` extensions for scheduled execution

### 2. Edge Function: `export-customer-backup`

New file: `supabase/functions/export-customer-backup/index.ts`

- Queries all customers joined with packages, areas, routers, and mikrotik_users
- Generates a CSV with columns: User ID, Name, Phone, Alt Phone, Address, Area, Package, Speed, Price, Status, Connection Type, Billing Cycle, Expiry Date, Total Due, PPPoE Username, Router, Created At
- Uploads CSV to `customer-backups` bucket with filename like `backup_2026-03-01_18-30.csv`
- Logs the result in `backup_logs` table
- Uses service role key for full data access

### 3. Scheduled Cron Job

SQL insert (not migration) to set up a daily cron job at midnight Dhaka time (18:00 UTC) that calls the edge function via `net.http_post`.

### 4. Settings UI: Backup Management Tab

New file: `src/components/settings/BackupManagement.tsx`

- Shows list of past backups from `backup_logs` (date, file size, record count, status)
- Download button for each backup (generates signed URL from storage)
- "Run Backup Now" button to manually trigger the edge function
- Display next scheduled backup time

Add a new "Backups" tab in `src/pages/Settings.tsx` (visible to super_admin only).

### 5. Update Settings Page

Add a new tab with a HardDrive icon labeled "Backups" in the TabsList, gated behind `isSuperAdmin`.

## Technical Details

**Files to create:**
- `supabase/functions/export-customer-backup/index.ts` -- edge function
- `src/components/settings/BackupManagement.tsx` -- UI component
- Database migration for `backup_logs` table + storage bucket + extensions

**Files to modify:**
- `src/pages/Settings.tsx` -- add Backups tab
- `supabase/config.toml` -- add function config (auto-managed)

**Key considerations:**
- Uses `supabase_service_role_key` in the edge function to bypass RLS for full data export
- CSV includes BOM for Excel compatibility (matching existing exportUtils pattern)
- Storage files are private; downloads use signed URLs (valid 1 hour)
- Backup retention: UI shows all logs but old files can be manually deleted
- The cron job runs daily; frequency can be adjusted in the SQL schedule

