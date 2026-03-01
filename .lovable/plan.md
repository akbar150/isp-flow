
Goal: Make PPPoE changes from customer editing persist reliably and always appear after refresh (especially for customers currently showing “Not set”, like ISP00494), without bulk auto-creation.

What I found
1) Backend data is mostly healthy:
- 175 customers total
- 174 PPPoE records exist
- 1 customer (ISP00494) has no `mikrotik_users` row yet

2) The “looks saved but still Not set” behavior is caused by a silent no-op path:
- In `CustomerViewDialog.tsx`, `handleSaveCredentials` only updates PPPoE if `customer.mikrotik_users?.[0]` exists.
- If a customer has no PPPoE row yet, it performs no insert, but still shows success toast.
- After refresh, PPPoE remains “Not set”.

3) Customer list join itself is working:
- The list query with `mikrotik_users:mikrotik_users_safe(...)` is returning usernames for existing rows.
- So the main issue is missing create logic (and no-op success handling) in one edit flow.

Implementation plan (no database migration needed)

1) Fix credentials save logic in `src/components/CustomerViewDialog.tsx` (primary fix)
- Add local `mikrotikUser` state and fetch actual row directly from `mikrotik_users` on dialog open (same robust pattern already used in `CustomerEditDialog`).
- Stop relying only on `customer.mikrotik_users?.[0]` for write decisions.
- Update `handleSaveCredentials` to support both update and create:
  - Trim username input.
  - If existing PPPoE row: update changed username and/or password hash.
  - If no existing row and user entered PPPoE username: create new `mikrotik_users` row with:
    - `customer_id`
    - `username`
    - `password_encrypted` (hash of entered PPPoE password, or fallback to username if password blank)
    - `router_id` from customer if present (else null, keeping current behavior)
    - `status: 'enabled'`
- Only show success toast if at least one credential mutation actually happened.
- If user clicks save with no actual changes, show neutral “No changes to save” feedback instead of success.
- After successful mutation, call `onSuccess()` so list refetches and “Not set” is replaced.

2) Harden `src/components/CustomerEditDialog.tsx` to prevent edge-case false-success behavior
- Normalize PPPoE username with trim before create/update checks.
- Keep existing direct fetch/update/insert approach, but add explicit no-op guard:
  - If no PPPoE record exists and username is empty, do not claim credentials were updated.
- Keep current strict error handling (already good) so customer+PPPoE writes fail loudly when needed.

3) Keep `src/pages/Customers.tsx` join as-is (no revert)
- Continue using:
  `mikrotik_users:mikrotik_users_safe(id, username, status)`
- This already powers table + view dialog display for existing PPPoE rows.
- No bulk data creation will be added (per your “keep existing only” preference).

Why this solves your exact issue
- For customers like ISP00494 (no current PPPoE row), saving from customer credentials edit will now create the missing row instead of silently doing nothing.
- For existing PPPoE users, updates continue to work.
- After refresh, username appears because the record now exists and the customer list join can read it.

Validation checklist after implementation
1) Open customer ISP00494 → enter PPPoE username (and optional password) → Save.
2) Confirm success toast appears only when a write occurred.
3) Refresh Customers page → PPPoE column should show the new username (not “Not set”).
4) Test existing PPPoE customer username change from:
   - Quick Edit dialog
   - Customer Details → Credentials tab
5) Confirm both flows persist and are visible after refresh.

Risk and safety
- Low risk: frontend logic-only fix, no schema/RLS changes.
- No destructive operations.
- No bulk auto-creation; only manual create when explicitly saved by user.
