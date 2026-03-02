

# Merge Name and PPPoE Username Columns in Customer Table

## Current State
- Customers are already sorted by `created_at DESC` (newest first) -- this is correct
- The table has two separate columns: "PPPoE Username" (hidden on mobile) and "Name"
- On mobile, PPPoE username already shows under the name in the Name column

## Changes to `src/pages/Customers.tsx`

### 1. Remove the separate "PPPoE Username" column header (line 535)
Delete the standalone `<th>` for PPPoE Username.

### 2. Merge into the "Name" column
Rename the column to "Customer" and always show PPPoE username below the name (not just on mobile). Remove the `sm:hidden` class so it's visible on all screen sizes.

### 3. Remove the separate PPPoE Username `<td>` cell (lines 574-576)
Delete the standalone PPPoE data cell.

### 4. Update the Name `<td>` cell (lines 577-590)
Always show PPPoE username below the customer name, removing the `sm:hidden` restriction:

```
<td>
  <div>
    <button ...>{customer.full_name}</button>
    <p className="text-xs text-muted-foreground font-mono">{pppoeUsername || 'No PPPoE'}</p>
  </div>
</td>
```

### 5. Update colspan
Adjust the "No customers found" colspan from 8 to 7.

## Result
- One unified "Customer" column showing name + PPPoE username on all screen sizes
- Matches the existing mobile layout pattern
- No sorting changes needed -- already sorted newest first by default
