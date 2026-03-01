

## Fix Expiry Date Timezone Shift

### Problem
When the Excel data was converted to hardcoded values in the code, dates like "2026-03-01 11:59:00 PM" (Bangladesh time, UTC+6) were incorrectly shifted by timezone offset, turning "March 1st 11:59 PM" into "March 2nd". The `expiry_date` column is a `date` type (no time component), so the correct value should be **2026-03-01** (the local date from the Excel).

This affects multiple records in the hardcoded `CUSTOMER_DATA` array where the original Excel times were near midnight.

### Solution

1. **Parse the uploaded Excel file properly** -- Instead of relying on hardcoded data that was already incorrectly converted, update the `CustomerDataImport` component to allow re-uploading the Excel file and parsing dates correctly at runtime using a date-only extraction (strip time, use the date as-is without timezone conversion).

2. **Fix the hardcoded dates** -- Since the data is already embedded, the quickest fix is to correct the affected dates in the `CUSTOMER_DATA` array. However, since many entries may be affected, we should add proper date handling in the edge function as a safeguard.

3. **Update the edge function** to extract only the date portion (YYYY-MM-DD) from any datetime string before storing, preventing timezone shifts:
   - Parse the incoming `expiry_date` string
   - Extract just the date part (first 10 characters if ISO format, or parse and extract year/month/day)
   - Store only the date portion

### Files to Change

**`supabase/functions/sync-expiry-dates/index.ts`**
- Add a date normalization function that extracts just the YYYY-MM-DD portion from any date/datetime string, preventing timezone-based day shifts

**`src/components/settings/CustomerDataImport.tsx`**  
- Fix the hardcoded `expiry_date` for `easy307-habibur.vat` from `"2026-03-02"` to `"2026-03-01"` (and audit other entries for similar off-by-one shifts)
- Add a "Re-sync" capability so the corrected data can be pushed again

### Technical Detail

The edge function will normalize dates like this:
```text
Input: "2026-03-01 11:59:00 PM" or "2026-03-02" or "2026-03-01T23:59:00+06:00"
Output: "2026-03-01" (date-only, no timezone shift)
```

The normalization strips the time component before sending to the database, so the `date` column always gets the intended calendar date.

