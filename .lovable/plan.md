

# Use Actual Month Names in Due Breakdown

## Change
In the Due Breakdown popover, replace "Month 1", "Month 2" etc. with actual month names (e.g., "January", "February") calculated backwards from the customer's expiry date.

## Logic
- Use the customer's `expiry_date` as the reference point
- Work backwards: the most recent due month is the one the expiry date falls in, then go back for each additional month
- Use `date-fns` `format` and `subMonths` to get month names

## Changes to `src/pages/Customers.tsx`

### Import
Add `format, subMonths` from `date-fns` (already partially imported).

### Update breakdown logic (lines 612-632)
Replace the current `Month {i + 1}` logic with:

```typescript
const monthlyPrice = customer.packages?.monthly_price || 0;
if (monthlyPrice <= 0) return <p className="text-sm text-muted-foreground">No package assigned</p>;
const fullMonths = Math.floor(customer.total_due / monthlyPrice);
const remainder = customer.total_due % monthlyPrice;
const expiryDate = new Date(customer.expiry_date);
return (
  <>
    {Array.from({ length: fullMonths }, (_, i) => {
      const monthDate = subMonths(expiryDate, i);
      return (
        <div key={i} className="flex justify-between text-sm">
          <span>{format(monthDate, 'MMMM yyyy')}</span>
          <span>৳{monthlyPrice}</span>
        </div>
      );
    })}
    {remainder > 0 && (
      <div className="flex justify-between text-sm">
        <span>Partial</span>
        <span>৳{remainder}</span>
      </div>
    )}
  </>
);
```

This shows month names like "January 2026", "December 2025" working backwards from the expiry date.

## Files to modify
- `src/pages/Customers.tsx`

