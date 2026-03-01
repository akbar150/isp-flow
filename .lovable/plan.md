

## Bug Fix Plan: Customer Edit PPPoE + Search Pagination

### Bug 1: PPPoE Username/Password Not Saving

**Root Cause:** The `CustomerEditDialog` component has no PPPoE username or password fields. It only updates the `customers` table -- it never touches the `mikrotik_users` table where PPPoE credentials are stored.

**Fix:**
- Add PPPoE username and PPPoE password fields to `CustomerEditDialog`
- On dialog open, fetch the existing PPPoE credentials from `mikrotik_users` (via the customer's `mikrotik_users` relation already available)
- On save, update `mikrotik_users` table in addition to the `customers` table
- For the PPPoE password: since it's stored as a hash (`password_encrypted`), the field will be blank by default. If the user enters a new password, hash it via `hash_password` RPC and update. If left blank, skip the password update.
- Accept the `mikrotik_users` data from the parent component (already passed as part of customer data)

**Files Modified:**
- `src/components/CustomerEditDialog.tsx` -- Add PPPoE username + password fields, update `mikrotik_users` on save

---

### Bug 2: Search Shows Wrong Pagination (e.g., "1/4")

**Root Cause:** Search is done **client-side** -- it filters only the 50 records loaded on the current page. But the `TablePagination` component still uses `totalCount` from the server (the total number of all customers in the database), so it shows pages like "1/4" even when searching.

This means:
- Searching only filters within the current page's 50 records
- Customers matching the search on other pages are invisible
- The page count is incorrect during search

**Fix:**
- Move search to **server-side** using Supabase `.or()` with `.ilike()` filters
- Move status filter to server-side using `.eq()` 
- Reset `currentPage` to 1 whenever `searchTerm` or `statusFilter` changes
- Include `searchTerm` and `statusFilter` in the `useEffect` dependency array alongside `currentPage`
- Remove client-side `filteredCustomers` filtering logic (keep only the date sort which is fine client-side)

**Server-side search query pattern:**
```
query.or(`full_name.ilike.%${search}%,user_id.ilike.%${search}%,phone.ilike.%${search}%`)
```

**Files Modified:**
- `src/pages/Customers.tsx` -- Move search/filter to server-side, fix pagination dependency

---

### Technical Details

**CustomerEditDialog changes:**
1. Expand the Customer interface to include `mikrotik_users` array
2. Add form fields: `pppoe_username` (text input) and `pppoe_password` (text input, optional)
3. Pre-populate `pppoe_username` from `customer.mikrotik_users[0].username`
4. On submit: update `mikrotik_users` with new username; if password provided, hash it and update `password_encrypted`
5. Add password visibility toggle for PPPoE password field

**Customers.tsx search changes:**
1. In `fetchData()`, build the query conditionally:
   - If `searchTerm` is set, add `.or(...)` with ilike on full_name, user_id, phone
   - If `statusFilter` is not "all", add `.eq('status', statusFilter)`
2. Add `searchTerm` and `statusFilter` to the `useEffect` deps
3. When search or filter changes, reset page to 1
4. Remove the client-side `filteredCustomers` filter (keep only sort)

