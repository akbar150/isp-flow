

# Add Bill Column and Due Breakdown to Customer Table

## Overview
Add a "Bill" column showing the package monthly price, fix the "Due" column to show actual accumulated dues (including multi-month), and make the due amount clickable to show a breakdown popover.

## Changes to `src/pages/Customers.tsx`

### 1. Add "Bill" column header
Insert a new `<th>Bill</th>` column between "Billing Date" and "Due" in the table header.

### 2. Add "Bill" column data
Show the customer's package monthly price (`customer.packages?.monthly_price || 0`) formatted as currency in each row.

### 3. Fix "Due" column
Replace `billingInfo.displayDue` with `customer.total_due` directly -- show the actual due from the database:
- If `total_due > 0`, display the amount in red
- If `total_due === 0`, display `0` in green

### 4. Clickable Due with Breakdown Popover
When the due amount is clicked (and is greater than 0):
- Use a Popover component to show a breakdown
- Calculate how many months of dues are accumulated: `total_due / monthly_price`
- Show each month's portion (e.g., "Month 1: 500 Tk", "Month 2: 500 Tk")
- Show total at the bottom

### 5. Update colspan
Change "No customers found" colspan from 7 to 8 to account for the new column.

## Technical Details

### New imports needed
- `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`

### Bill column cell
```typescript
<td className="hidden lg:table-cell">
  ৳{customer.packages?.monthly_price || 0}
</td>
```

### Due breakdown popover
```typescript
<td>
  {customer.total_due > 0 ? (
    <Popover>
      <PopoverTrigger asChild>
        <button className="amount-due cursor-pointer hover:underline">
          ৳{customer.total_due}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Due Breakdown</h4>
          {/* Show monthly breakdown */}
          <div className="border-t pt-2 font-semibold">
            Total: ৳{customer.total_due}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    <span className="amount-positive">৳0</span>
  )}
</td>
```

### Monthly breakdown logic
Calculate months from `total_due / monthly_price`, show each month's line item, plus any remainder for partial months.

## Files to modify
- `src/pages/Customers.tsx` -- add Bill column, update Due column with popover breakdown
