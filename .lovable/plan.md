

# Make Bulk Import Validation Errors Clearly Visible

## Problem
When uploading a file with 6 rows that have errors, the user sees "6 with errors" in the summary but cannot easily identify which fields are causing the errors. The error badges in the last table column are difficult to read due to narrow column width and horizontal scrolling.

## Solution
Add a dedicated **Error Summary Panel** that appears above the data table when there are invalid rows, listing each error by row number and field. Also improve the existing error display in the table.

## Changes to `src/components/BulkCustomerUpload.tsx`

### 1. Add Error Summary Panel
Between the validation summary counts and the data table, add a collapsible error details section that lists all errors grouped by row number:
- "Row 1: Name required (min 3 chars), Invalid phone"
- "Row 4: Invalid package, Password min 6 chars"

This panel will only appear when there are errors, with a red border and clear formatting.

### 2. Improve Error Column in Table
- Make the Errors column wider with `min-w-[200px]`  
- Show errors as a comma-separated list instead of tiny badges for better readability
- Highlight the specific invalid field values in red text

### 3. Add Tooltip on Error Icon
When hovering over the red error icon in the Status column, show the full list of errors in a tooltip so users can quickly see issues without scrolling horizontally.

## Technical Details

- The error data already exists in `row.errors[]` array on each `ParsedCustomer` -- no new parsing logic needed
- Will use the existing Collapsible component from Radix UI for the expandable error panel
- The error summary filters `parsedData` to only rows where `!isValid && !isDuplicate`
- Each error string from `validateRow()` already describes the field and issue (e.g., "Name required (min 3 chars)")

