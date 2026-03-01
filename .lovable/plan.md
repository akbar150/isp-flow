

# Add Connection Date and Expiry Date to Bulk Import

## Overview
Add two new date fields -- "Connection Date" (billing_start_date) and "Expiry Date" -- to the bulk customer import. When provided in the CSV/Excel file, these dates will be used instead of auto-calculating them from today's date.

## Changes to `src/components/BulkCustomerUpload.tsx`

### 1. Add column mappings for new date fields
Add entries to `COLUMN_MAP` for:
- `connection_date`, `connection date`, `billing_start_date`, `billing start date`, `start date` -> `connection_date`
- `expiry_date`, `expiry date`, `expire date`, `expire`, `expiry` -> `expiry_date`

### 2. Update `ParsedCustomer` interface
Add two new optional string fields:
- `connection_date: string`
- `expiry_date: string`

### 3. Update sample CSV
Add `connection_date` and `expiry_date` columns to the sample CSV template with example values like `2025-01-15` and `2025-02-14`.

### 4. Add Excel date normalization
Reuse the same `normalizeExcelDate` helper from `CustomerDataImport.tsx` to handle Excel serial numbers and various date string formats for both new fields.

### 5. Update parseCSV and parseExcel functions
Extract `connection_date` and `expiry_date` from each row, normalizing date values.

### 6. Update import logic (handleImport)
- If `connection_date` is provided and valid, use it as `billing_start_date` instead of today
- If `expiry_date` is provided and valid, use it instead of calculating from `today + validity_days`
- If neither is provided, keep the current auto-calculation behavior (backward compatible)

### 7. Update preview table
Add "Connection" and "Expiry" columns to the data preview table so users can verify dates before importing.

## Technical Details

**Date handling**: The `normalizeExcelDate` function will convert Excel serial numbers (e.g., 45678) and various string formats (DD/MM/YYYY, YYYY-MM-DD, ISO) into `YYYY-MM-DD` format. This is critical for Excel files where dates are stored as numbers.

**Backward compatibility**: Both fields are optional. Existing CSV files without these columns will continue to work exactly as before.
