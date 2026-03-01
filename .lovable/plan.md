

## Sync Expiry Dates and Packages from Excel Data

### What This Does
Match each PPPoE username from your Excel data (already embedded in the code) against existing PPPoE usernames in the database. For each match:
1. Update the customer's **expiry_date** to the date from the Excel
2. If the customer has **no package assigned**, assign the matching package from the Excel
3. Update customer **status** based on the Excel data (active/expired)

No customers will be deleted or created -- this is a safe update-only operation.

### Changes

**1. New Edge Function: `supabase/functions/sync-expiry-dates/index.ts`**

A new backend function that:
- Receives the array of `{ username, expiry_date, package_name, status }` records
- For each username, looks up the `mikrotik_users` table to find the matching `customer_id`
- Updates the customer's `expiry_date` to the Excel value
- If the customer currently has no `package_id`, looks up the package by name and assigns it
- Updates status (maps "expire" to "expired")
- Returns a summary: how many matched/updated, how many not found, any errors

**2. Update `src/components/settings/CustomerDataImport.tsx`**

Add a second button: **"Sync Expiry Dates Only"** (non-destructive, safe)
- Calls the new edge function with just the username + expiry_date + package_name + status data
- Shows progress and results (matched, updated, not found counts)
- This sits alongside the existing destructive import button but is clearly labeled as safe

### How It Works (Technical)

```text
For each Excel row:
  1. SELECT customer_id FROM mikrotik_users WHERE username = row.username
  2. If found:
     a. UPDATE customers SET expiry_date = row.expiry_date WHERE id = customer_id
     b. If customer has no package_id AND row.package_name != 'Expired':
        - Look up package by name -> get package_id
        - UPDATE customers SET package_id = package_id
     c. Update status if needed
  3. If not found: log as "unmatched"
```

### Safety
- No deletions, no new customer creation
- Only updates `expiry_date`, `package_id` (if null), and `status`
- Unmatched usernames are reported but skipped
- Existing packages and other customer data remain untouched

