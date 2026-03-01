

## Fix: Restore PPPoE Username Display Across Customer Pages

### Problem
The previous fix removed the `mikrotik_users:mikrotik_users_safe(id, username, status)` join from the Customers page query, thinking the view-to-view join was broken. However, the same join works correctly on other pages (Dashboard, Reminders, CallRecords). This caused all PPPoE usernames to show "Not set" on the customer list.

Your PPPoE data is safe -- 174 out of 175 customers have their PPPoE records intact in the database. Only one customer (ISP00494 - Md Gulam Mustafa) has no PPPoE record, which is expected since they were recently added.

### Fix

**File: `src/pages/Customers.tsx`** (1 line change)

Restore the mikrotik_users join in the customer query:

```
// FROM:
.select('*, packages(*), areas(*), routers(*)', { count: 'exact' })

// TO:
.select('*, packages(*), areas(*), routers(*), mikrotik_users:mikrotik_users_safe(id, username, status)', { count: 'exact' })
```

This is the only change needed. The `CustomerEditDialog` already fetches mikrotik_users directly from the table (added in the previous fix), so editing PPPoE credentials will continue to work correctly regardless of the join.

### Why This Is Safe
- The same join pattern (`mikrotik_users:mikrotik_users_safe`) is already used successfully on Dashboard, Reminders, and CallRecords pages
- The `CustomerViewDialog` also relies on `customer.mikrotik_users?.[0]?.username` from the parent data, so restoring the join fixes the Credentials tab display too
- No data was lost -- all 174 PPPoE records are intact in the database

