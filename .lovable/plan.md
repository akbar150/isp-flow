

# Update Data Reset Panel: Single Date to Date Range

## What Changes
Replace the single "Select Date to Reset" input with a **From Date** and **To Date** range picker. All queries (both count preview and actual deletion) will use `>=` from-date and `<=` to-date instead of a single date equality check.

## Changes

### File: `src/components/settings/DataResetPanel.tsx`

1. **State**: Replace `selectedDate` (string) with `dateFrom` and `dateTo` (both strings).

2. **UI**: Replace the single date input with two side-by-side date inputs labeled "From Date" and "To Date". The "To Date" will have a `min` constraint set to `dateFrom` and both will have `max` set to today.

3. **Query logic (preview counts)**: For both timestamp and date columns, use `.gte(column, startValue).lte(column, endValue)` where:
   - Timestamp columns: `startValue = dateFrom + "T00:00:00"`, `endValue = dateTo + "T23:59:59"`
   - Date columns: `startValue = dateFrom`, `endValue = dateTo`

4. **Delete logic**: Same range-based filtering as the preview.

5. **Validation**: Button disabled unless both `dateFrom` and `dateTo` are set and at least one data type is selected.

6. **Confirmation dialog text**: Show the date range (e.g., "01 Jan 2025 - 31 Jan 2025") instead of a single date.

7. **Success toast**: Show the date range in the success message.

## Technical Details

- No database changes needed -- this is a purely frontend update to a single component file.
- The existing `isTimestampColumn()` helper and `getOrderedSelectedTypes()` remain unchanged.
- The `gte/lte` pattern already exists for timestamp columns; it will now also apply to date columns with the range values.
