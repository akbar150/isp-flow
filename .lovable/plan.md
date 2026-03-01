

# Plan: Add CSV File Upload for Expiry Date Sync

## Problem
The current "Sync Expiry Dates" feature uses a hardcoded `CUSTOMER_DATA` array (174 records). Your new Excel has 177 records with updated expiry dates, but since I cannot read binary `.xlsx` files, the data can't be hardcoded.

## Solution
Replace the hardcoded data approach with a **CSV file upload** for the sync feature. You'll export your Excel as CSV, upload it in the Settings page, preview the data, and sync.

## Changes

### 1. Add XLSX parsing library
- Install `xlsx` (SheetJS) package to parse Excel files directly in the browser -- no need to convert to CSV manually.

### 2. Update `CustomerDataImport.tsx`
- Add a file upload input (accepts `.xlsx` and `.csv`)
- Parse the uploaded file using SheetJS to extract rows
- Map Excel columns to the expected format: `username`, `expiry_date`, `package_name`, `status`, `bill`, `phone`, `name`, `zone`
- Show a preview of parsed records count and sample data
- Keep the existing "Sync Expiry Dates Only" button but wire it to the uploaded data instead of `CUSTOMER_DATA`
- Keep the hardcoded `CUSTOMER_DATA` as a fallback option

### 3. Column auto-mapping
- Auto-detect common column names from the Excel (e.g., "Username", "PPPoE Username", "Expiry Date", "Package", "Status")
- Show the user which columns were detected before syncing

### 4. Safety
- The sync still uses the existing `sync-expiry-dates` edge function (non-destructive)
- Only updates `expiry_date`, `status`, and fills missing `package_id`
- No data deletion occurs

## Technical Details

**File**: `src/components/settings/CustomerDataImport.tsx`
- Add `xlsx` dependency for browser-side Excel parsing
- Add file input with drag-and-drop support
- Parse file on upload, extract records into the same format as current `CUSTOMER_DATA`
- Display record count and validation summary before sync
- Use the parsed data array in `handleSyncExpiry()` instead of the hardcoded array

**No backend changes needed** -- the existing `sync-expiry-dates` edge function handles the sync logic correctly.

