

# Advance Payment Support (Multi-Month Renewal)

## Problem
Currently, the database trigger `update_customer_due_on_payment()` always extends expiry by exactly `validity_days` (typically 30 days), regardless of whether the customer paid for 1 month or 3 months. There's no way to record an advance payment that extends the subscription by multiple months.

## Solution

### 1. Update Database Trigger — Calculate months from payment amount
Modify `update_customer_due_on_payment()` to calculate how many months the payment covers:

```text
months_paid = FLOOR(NEW.amount / monthly_price)
new_expiry = base_date + (validity_days * months_paid)
```

Where `base_date` is:
- Current expiry if it's in the future (advance payment on active account)
- Today if expired

This means paying ৳1800 on a ৳600/month plan extends by 90 days (3 × 30).

### 2. Update QuickPaymentRecord UI — Add advance month quick-buttons
Add quick-select buttons for 2-month and 3-month advance payments alongside the existing "Full Month" and "Clear Due" buttons:

```text
[1 Month (৳600)] [2 Months (৳1200)] [3 Months (৳1800)] [Clear Due (৳X)]
```

### 3. Update the `total_due` deduction logic
When a customer pays advance (amount > total_due), the trigger should set `total_due = 0` (not negative). The advance portion extends expiry, it doesn't create credit.

## Files to Modify

| File | Change |
|------|--------|
| Database (migration) | Update trigger to calculate multi-month extension from payment amount |
| `src/components/QuickPaymentRecord.tsx` | Add 2-month and 3-month advance quick buttons |

