

# Allow Customer Login with PPPoE Username or Email

## Overview
Currently, customers can only log in using their User ID (e.g., ISP00001). This update will allow them to also log in using their **PPPoE Username** or **Email address** -- whichever they have.

## Changes

### 1. Update Edge Function: `customer-auth/index.ts` (Login action)
Instead of only querying `customers` by `user_id`, the login logic will detect the input type and search accordingly:

- **If input looks like an email** (contains `@`): Query `customers` table where `email = input`
- **If input starts with `ISP`** (case-insensitive): Query `customers` table where `user_id = input` (existing behavior)
- **Otherwise** (treat as PPPoE username): Query `mikrotik_users` table where `username = input`, then get the linked `customer_id` to fetch the customer record and verify the **customer portal password** (not the PPPoE password)

The password verification remains against the customer's `password_hash` in all cases -- only the lookup method changes.

### 2. Update Frontend: `CustomerLogin.tsx`
- Rename the "User ID" label to **"User ID / PPPoE Username / Email"**
- Update placeholder from `ISP00001` to `ISP00001, PPPoE username, or email`
- Update the Zod schema field name from `user_id` to `login_id` for clarity
- Same changes on the Reset Password tab's User ID field

### Technical Details

**Edge function login logic change:**
```text
1. Receive login_id (was user_id) + password
2. Detect type:
   - Contains "@" -> query customers.email
   - Starts with "ISP" -> query customers.user_id (existing)
   - Otherwise -> query mikrotik_users.username to get customer_id, then fetch customer
3. Verify password against customer.password_hash (same for all paths)
4. Return customer data + session token (unchanged)
```

**Files to modify:**
- `supabase/functions/customer-auth/index.ts` -- login action multi-lookup logic
- `src/pages/CustomerLogin.tsx` -- UI label/placeholder updates

