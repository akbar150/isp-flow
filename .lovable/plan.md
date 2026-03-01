

# Plan: Upgrade Bulk Import with Excel Support and Duplicate Detection

## What This Does
Upgrades the Bulk Customer Import to:
1. Accept Excel files (.xlsx/.xls) in addition to CSV
2. Before importing, check all PPPoE usernames against existing database records
3. Automatically skip duplicates and only import new customers
4. Show which rows are duplicates vs new in the preview table

## Changes

### File: `src/components/BulkCustomerUpload.tsx`

**1. Add Excel file support**
- Import `xlsx` (SheetJS) library (already installed)
- Change file input to accept `.xlsx, .xls, .csv`
- Parse Excel files using `XLSX.read()` and `sheet_to_json()`
- Auto-map common Excel column names (e.g., "Username" -> `pppoe_username`, "Package" -> `package_name`)

**2. Duplicate PPPoE username detection**
- After file is parsed, fetch all existing PPPoE usernames from `mikrotik_users_safe` view
- Compare each row's `pppoe_username` against the existing list
- Mark duplicate rows with a "Duplicate" badge and exclude them from the valid import count
- Add a `isDuplicate` flag to each parsed row

**3. Updated preview UI**
- Add a "Duplicate" status icon (yellow/orange) alongside the existing valid/invalid icons
- Show summary: "X new, Y duplicates, Z with errors"
- Duplicate rows shown with a distinct background color
- Import button only counts non-duplicate valid rows

**4. Import logic update**
- Skip rows flagged as duplicates during the import loop
- Progress counter only reflects actually-imported rows

### Column Auto-Mapping
Will detect these common Excel column names from your file:
- "Username" / "PPPoE Username" / "User" -> `pppoe_username`
- "Password" / "PPPoE Password" -> `pppoe_password`
- "Name" / "Full Name" / "Customer Name" -> `full_name`
- "Phone" / "Mobile" -> `phone`
- "Package" / "Package Name" -> `package_name`
- "Address" -> `address`
- "Area" / "Zone" -> `area_name`
- "Router" -> `router_name`

No database changes required.

