

# Switch to Calendar-Month Billing

## Change

Update the `update_customer_due_on_payment()` trigger to use PostgreSQL `INTERVAL '1 month'` instead of adding `validity_days * months_paid` days.

### Current logic
```sql
new_expiry := base_date + (customer_record.validity_days * months_paid);
-- Feb 21 + 30 = Mar 23 (drifts)
```

### New logic
```sql
new_expiry := base_date + (months_paid * INTERVAL '1 month');
-- Feb 21 + 1 month = Mar 21 (fixed)
-- Jan 31 + 1 month = Feb 28 (PostgreSQL handles automatically)
```

## Files

| File | Change |
|------|--------|
| Database migration | Replace `validity_days * months_paid` with `months_paid * INTERVAL '1 month'` in trigger function |

The `validity_days` column remains in the `packages` table for backward compatibility but will no longer be used for expiry calculation in this trigger. The `generate-billing` edge function does not need changes as it reads `expiry_date` directly.

