

# Import Customer Data from Excel & Clean Old Data

## Overview
Import 175 customers from your Excel file into the system, replacing all existing customer data. The data includes customer names, phone numbers, PPPoE usernames, expiry dates, packages, bill amounts, and zones (areas).

## Data Summary
- **Total customers**: 175
- **Active**: ~130 | **Expired**: ~45
- **Packages found**: FRN-8Mbps (600), Sync-36Mbps-800-Unlimited (800), Sync-70Mbps-1000-Unlimited (1000), Sync-80Mbps-1200-Unlimited (1200)
- **Areas/Zones**: Vata, Islampur, Lakhawara, Khagria, Uforpara, Lalmati, Nalia, Guabari

## Step-by-step Plan

### Step 1: Create missing packages and areas in the database
Insert the 4 packages and 8 areas listed above so they can be referenced during import. If any already exist, they will be matched by name.

### Step 2: Delete all existing customer-related data
Using the proper FK-safe deletion order (same as your Data Reset tool):
1. Invoice items
2. Invoices
3. Payments
4. Billing records
5. Asset assignments
6. Metered usage logs
7. Call records
8. Reminder logs
9. MikroTik users
10. Customers

### Step 3: Create a backend function for bulk import
Build a new edge function (`import-customers-bulk`) that:
- Accepts the full customer array in one request
- For each customer: generates a user ID (ISP00XXX), creates the customer record with the **exact expiry date** from your Excel, sets status (active/expired), sets `total_due` from the Bill column, and creates the PPPoE/MikroTik user entry
- Maps each customer to the correct package and area by name
- Sets a default password hash for all imported customers (you can reset later)

### Step 4: Create an import trigger page/button
Add a one-time import action in the Settings page that:
- Reads the hardcoded customer data (parsed from your Excel)
- Calls the edge function to process all 175 customers
- Shows progress and results

## Technical Details

### Data Mapping (Excel to Database)
```text
Excel Column    -> Database Field
Name            -> customers.full_name
Phone           -> customers.phone
Username        -> mikrotik_users.username
Status          -> customers.status (active/expired)
Expire Date     -> customers.expiry_date
Package         -> customers.package_id (lookup by name)
Bill            -> customers.total_due
Zone            -> customers.area_id (lookup by name)
```

### Edge Function Logic
- Phone numbers normalized to `01XXXXXXXXX` format
- Expired customers (status = "expire") mapped to status `expired`
- Customers with "Expired" package name mapped to the package matching their Bill amount, or left without package
- Default customer password set to `123456` (hashed via `hash_password` RPC)
- PPPoE password defaults to `12345678`
- `billing_start_date` calculated as expiry_date minus 30 days
- `connection_type` defaults to `pppoe`, `billing_cycle` to `monthly`

### Files to Create/Modify
- **Create**: `supabase/functions/import-customers-bulk/index.ts` -- edge function for bulk import
- **Modify**: `src/pages/Settings.tsx` -- add one-time import button
- **Create**: `src/components/settings/CustomerDataImport.tsx` -- import UI component with hardcoded data from Excel

