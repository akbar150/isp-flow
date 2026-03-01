

## Fix: PPPoE Data Not Saving in Customer Edit

### Root Cause

The customer list fetches data from `customers_safe` (a view) and tries to join `mikrotik_users_safe` (another view). PostgREST often can't detect foreign key relationships between views, so `customer.mikrotik_users` is always null/empty. This means:

- The edit dialog never sees existing PPPoE credentials
- It always tries to INSERT new mikrotik_users records instead of UPDATING existing ones
- The INSERT has no error checking, so failures are silent

### Fix (2 files)

**1. `src/components/CustomerEditDialog.tsx`**
- When the dialog opens with a customer, **fetch mikrotik_users directly** from the `mikrotik_users` table using `customer_id` instead of relying on data passed from the parent
- Use the fetched data to determine whether to UPDATE or INSERT
- Add proper error checking on the INSERT operation
- Ensure dialog closes and shows correct error messages on failure

**2. `src/pages/Customers.tsx`**
- Remove the broken `mikrotik_users_safe` join from the query (it doesn't work between views)
- Instead, fetch mikrotik_users separately and merge the data client-side, OR just let the edit dialog handle its own mikrotik data fetching (simpler approach)

### Technical Details

**CustomerEditDialog changes:**
```typescript
// When dialog opens, fetch mikrotik_users directly
useEffect(() => {
  if (customer && open) {
    // Fetch fresh mikrotik_users data from the actual table
    supabase.from('mikrotik_users')
      .select('id, username, status')
      .eq('customer_id', customer.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setMikrotikUser(data);
          setFormData(prev => ({ ...prev, pppoe_username: data.username }));
        }
      });
  }
}, [customer, open]);
```

On save, use `mikrotikUser` state (from direct fetch) instead of `customer.mikrotik_users?.[0]` to decide INSERT vs UPDATE. Also add error checking on the insert.

**Customers.tsx changes:**
- Remove `mikrotik_users:mikrotik_users_safe(id, username, status)` from the main query
- For the customer list table display (PPPoE username column), fetch mikrotik_users separately and merge, or keep the join attempt but handle null gracefully

