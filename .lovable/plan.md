

## Fix Customer Search

### Problems Found
1. **No debounce on search input** -- every keystroke fires a database query. Fast typing causes race conditions where stale results from earlier partial queries overwrite correct results from the final query (e.g., typing "Easy261" fires queries for "E", "Ea", "Eas", etc., and the last one to resolve wins, which may not be "Easy261").
2. **PPPoE username not searchable** -- the search placeholder promises PPPoE username search, but the query only searches `full_name`, `user_id`, and `phone`. Since `mikrotik_users_safe` is a joined relation, PostgREST cannot filter it in the parent `.or()`.

### Solution

**File: `src/pages/Customers.tsx`**

1. Add a **debounced search term** (400ms delay) so the query only fires after the user stops typing, eliminating race conditions.
   - Keep `searchTerm` for instant input display
   - Add `debouncedSearch` state that updates 400ms after the last keystroke
   - Use `debouncedSearch` (not `searchTerm`) in the `useEffect` that triggers `fetchData` and in the query itself

2. Add **PPPoE username search** by including the mikrotik username in the `.or()` filter using the PostgREST nested filter syntax: `mikrotik_users_safe.username.ilike.%term%`. If PostgREST does not support cross-table `.or()`, fall back to a two-query approach: first search mikrotik_users_safe for matching usernames to get customer IDs, then include those IDs in the main query.

### Technical Details

```text
Before (fires on every keystroke):
  searchTerm changes -> fetchData() immediately

After (debounced):
  searchTerm changes -> 400ms timer -> debouncedSearch updates -> fetchData()
```

- Uses a `useEffect` with `setTimeout`/`clearTimeout` for debounce (no new dependency needed)
- Page reset (`setCurrentPage(1)`) triggers on `debouncedSearch` change, not raw `searchTerm`
- The PPPoE search will use a preliminary query to `mikrotik_users_safe` when search term is present, fetching matching `customer_id`s, then merging them into the main query via `.or()` with `.in('id', customerIds)`

### Files Changed
- `src/pages/Customers.tsx` (add debounce logic + PPPoE username search)

