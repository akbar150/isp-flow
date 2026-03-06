

# Plan: Partial Payment Reactivation + Auto-Renewal Testing

## Current State
- The `update_customer_due_on_payment()` trigger currently only renews when `new_due = 0` (full payment clears all debt)
- All 177 customers are currently active (data repair already applied)
- `processPayment()` in `billingService.ts` is dead code (unused anywhere) — duplicates trigger logic
- No expired customers exist to test with right now

## Changes

### 1. Database Migration — Update trigger for partial payment reactivation

Update `update_customer_due_on_payment()` to allow reactivation when:
- Customer status is `expired` or `suspended`
- Payment amount >= package `monthly_price` (at least one month paid)
- Even if `new_due > 0` (remaining balance from previous months)

```sql
-- Key logic change:
-- Old: IF new_due = 0 AND ...
-- New: IF (new_due = 0 OR (NEW.amount >= monthly_price AND status IN ('expired','suspended')))
--      AND validity_days IS NOT NULL THEN renew
```

This means: A customer with ৳2400 total_due (4 months overdue) who pays ৳600 (1 month) gets reactivated with 30 days extension, but still has ৳1800 remaining due.

### 2. Clean up dead code — Remove `processPayment` from billingService.ts

The `processPayment` function (lines 83-130) manually updates `total_due` and `expiry_date`, duplicating the trigger. It's not imported anywhere. Remove it along with its import of `format` from date-fns (if no longer needed).

### 3. End-to-end test

After migration deploys, use the browser to:
1. Navigate to Customers page, find a customer with due > 0 (e.g., Ali Akbar with ৳1200 due)
2. Record a payment via Quick Payment
3. Verify the trigger fires and status/expiry updates correctly

## Files to Modify

| File | Change |
|------|--------|
| Database (migration) | Update trigger to support partial payment reactivation |
| `src/services/billing/billingService.ts` | Remove dead `processPayment` function |

