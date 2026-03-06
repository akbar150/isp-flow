

# Fix: Payment Trigger Duplicate + Renewal Not Working

## Root Cause Analysis

**Two issues found:**

### Issue 1: Duplicate Triggers
The `payments` table has **two triggers** calling the same function `update_customer_due_on_payment()`:
- `payment_update_customer_due` (from migration `20260129`)
- `trg_update_customer_due_on_payment` (from migration `20260228`)

This means every payment insert **deducts `total_due` twice** (once per trigger). For example, a ৳600 payment reduces `total_due` by ৳1200. The `GREATEST(0, ...)` prevents negative values, so this silently double-processes.

### Issue 2: Renewal Condition Not Met
The trigger only reactivates when `new_due = 0 AND customer_record.status IN ('expired', 'suspended')`. But here's what happens:

1. The `generate-billing` edge function sets status to `'expired'` and adds `monthly_price` to `total_due` when expiry passes
2. However, **if the customer's status was manually set to `'active'` before the billing run** (e.g., via manual update or the duplicate trigger already zeroed the due), the trigger's reactivation condition (`status IN ('expired', 'suspended')`) is never met
3. The customer ends up with `status = 'active'` but `expiry_date` in the past — essentially active but expired

For easy351-rabbi.kg: The duplicate trigger zeroed `total_due` on the first trigger fire, then the second trigger also ran (no-op since due was already 0). Since the customer was likely already `active` (due to the earlier manual fix or duplicate trigger behavior), the renewal branch (`status IN ('expired', 'suspended')`) was skipped, so `expiry_date` was never extended.

**11 customers** are currently in this broken state: `total_due = 0`, `expiry_date <= today`, `status = active`.

## Proposed Fix

### Step 1: Database Migration — Remove duplicate trigger
```sql
DROP TRIGGER IF EXISTS payment_update_customer_due ON public.payments;
```
Keep only `trg_update_customer_due_on_payment` (the newer, enhanced version with reactivation logic).

### Step 2: Database Migration — Improve trigger function
Update `update_customer_due_on_payment()` to also handle the case where the customer is `active` but past expiry (the broken state):

```sql
-- Reactivate if:
-- 1. new_due = 0 AND status IN ('expired', 'suspended') [existing]
-- 2. new_due = 0 AND status = 'active' AND expiry_date <= today [new - fixes the gap]
```

This ensures that even if a customer is technically `active` but their billing date has passed, paying clears the due and extends the expiry.

### Step 3: Data Repair — Fix all 11 affected accounts
Run a one-time UPDATE to extend `expiry_date` for all customers where `total_due = 0` and `expiry_date <= CURRENT_DATE` and `status != 'suspended'`:

```sql
UPDATE public.customers c
SET expiry_date = CURRENT_DATE + p.validity_days
FROM public.packages p
WHERE p.id = c.package_id
  AND c.total_due = 0
  AND c.expiry_date::date <= CURRENT_DATE
  AND c.status != 'suspended'
  AND p.validity_days IS NOT NULL;
```

### Step 4: Fix InvoicePaymentDialog double-deduction
`src/components/InvoicePaymentDialog.tsx` lines 99-111 manually update `customers.total_due` **after** inserting into `payments` — but the trigger already handles this. This causes a **second deduction**. Remove the manual `total_due` update from this component.

## Files to Modify

| File | Change |
|------|--------|
| Database (migration) | Drop duplicate trigger `payment_update_customer_due` |
| Database (migration) | Update trigger function to handle active-but-expired state |
| Database (data fix) | Extend expiry for 11 affected zero-due customers |
| `src/components/InvoicePaymentDialog.tsx` | Remove manual `total_due` update (lines 99-111) — trigger handles it |

## No Frontend Changes Needed
The `QuickPaymentRecord`, `Payments` page, and `Reminders` page all correctly insert into `payments` and let the trigger handle `total_due`. Only `InvoicePaymentDialog` has the redundant manual update.

