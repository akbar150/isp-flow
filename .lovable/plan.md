

# Add Time Support to Connection Date and Expiry Date (Dhaka UTC+6)

## Overview
Currently `expiry_date` and `billing_start_date` are stored as `DATE` (no time). This plan upgrades them to store full date+time in Dhaka timezone (UTC+6), and updates the bulk import to accept formats like `2025-10-15 06:20:31 PM`.

## Database Migration

Alter two columns on the `customers` table:
- `expiry_date`: Change from `DATE` to `TIMESTAMP WITH TIME ZONE` (preserving existing data by casting `date -> timestamptz` at midnight Dhaka time)
- `billing_start_date`: Change from `DATE` to `TIMESTAMP WITH TIME ZONE` (same treatment)

Also update the `customers_safe` view to reflect the new column types.

## Changes to `src/components/BulkCustomerUpload.tsx`

### 1. Update `normalizeExcelDate` to `normalizeExcelDateTime`
- Rename and enhance the helper to preserve time components
- If the input is a date-only string (e.g., `2025-10-15`), append `T00:00:00+06:00` (Dhaka midnight)
- If the input includes time (e.g., `2025-10-15 06:20:31 PM`), parse it and convert to ISO with `+06:00` offset
- Handle Excel serial numbers with fractional time component (e.g., `45678.76` = date + time)
- Output format: ISO 8601 with Dhaka offset, e.g., `2025-10-15T18:20:31+06:00`

### 2. Update date validation
- Change `isValidDate` regex from `YYYY-MM-DD` only to also accept full ISO timestamps
- Both formats accepted: `2025-10-15` and `2025-10-15T18:20:31+06:00`

### 3. Update import logic (`handleImport`)
- When no `connection_date` provided, use current Dhaka time instead of just today's date
- When no `expiry_date` provided, calculate expiry as Dhaka time + validity days
- Pass full timestamp strings to the database insert

### 4. Update preview table
- Show date+time in the "Connection" and "Expiry" columns (formatted as `YYYY-MM-DD hh:mm A`)

### 5. Update sample CSV
- Update example values to include time: `2025-01-15 09:00:00 AM` and `2025-02-14 11:59:00 PM`

## Technical Details

**Timezone handling**: All dates are treated as Dhaka time (UTC+6). When a user provides `2025-10-15 06:20:31 PM`, it is stored as `2025-10-15T18:20:31+06:00`. PostgreSQL's `timestamptz` will store this correctly and convert as needed.

**Backward compatibility**: 
- Existing date-only values (from previous imports) will be cast to midnight Dhaka time during migration
- CSV/Excel files with date-only values still work -- time defaults to `00:00:00` Dhaka

**Migration SQL (summary)**:
```text
ALTER TABLE customers 
  ALTER COLUMN expiry_date TYPE timestamptz USING expiry_date::timestamptz,
  ALTER COLUMN billing_start_date TYPE timestamptz USING billing_start_date::timestamptz;
```
Then recreate the `customers_safe` view to match.

