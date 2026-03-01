

# Update Assigned Inventory Items to In Stock

## What needs to happen
A simple database data update to change 4 inventory items currently marked as "assigned" back to "in_stock".

**Affected items:**
| Product | MAC Address | Current Status |
|---------|------------|----------------|
| Patch Cord | -- | assigned |
| Solitine | 10:AF:8F:71:93:F5 | assigned |
| Patch Cord | -- | assigned |
| Solitine | 10:AF:8F:74:45:73 | assigned |

## Change
Run a single SQL update:
```sql
UPDATE inventory_items SET status = 'in_stock' WHERE status = 'assigned';
```

This will change all 4 items from "assigned" to "in_stock". The stock movement trigger (`log_stock_movement`) will automatically log this status change in the `stock_movements` table for audit purposes.

## Result
- **Before:** 20 in_stock, 4 assigned
- **After:** 24 in_stock, 0 assigned

No code changes needed -- this is a data-only fix.

