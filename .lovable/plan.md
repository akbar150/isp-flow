

# Dashboard Collection Cards with Month Selector

## What to Build
Add 3 new stat cards below the existing 6 on the Dashboard overview tab:
- **Total Cash Collection** — sum of payments where `method = 'cash'`
- **Total bKash Collection** — sum of payments where `method = 'bkash'`
- **Total Collection** — sum of all payments (all methods)

Each filtered by a selected month. A dropdown selector above these cards lets the user pick the current month (default) or any previous month (last 12 months).

## Technical Approach

### File: `src/pages/Dashboard.tsx`

1. Add state for `selectedMonth` (default: current month as `YYYY-MM` string)
2. Add state for collection stats: `cashCollection`, `bkashCollection`, `totalCollection`
3. Add a `fetchCollectionStats(month)` function that queries the `payments` table filtered by `payment_date` within the selected month range, grouping by `method`
4. Re-fetch when `selectedMonth` changes via `useEffect`
5. Render a month dropdown (Select component) + 3 StatCards in a new section between the existing stats grid and the "Expiring Soon" table

### Month Dropdown
- Generate last 12 months as options (e.g., "March 2026", "February 2026", ...)
- Default to current month
- On change, re-query payments for that month's date range

### Query Logic
```text
payments where payment_date >= month_start AND payment_date < next_month_start
- Cash: filter method = 'cash'
- bKash: filter method = 'bkash'  
- Total: sum all
```

### UI Layout
```text
[Month Dropdown: March 2026 ▼]
[Total Cash ৳X] [Total bKash ৳X] [Total Collection ৳X]
```

No database changes needed — reads existing `payments` table.

