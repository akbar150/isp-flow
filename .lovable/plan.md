

## Inventory Module Enhancement Plan

### Overview
Implement all 6 missing features for the Inventory module: pagination with status filters, stock movement audit trail, warranty expiry tracking, CSV/PDF export, return workflow, and bulk status updates.

---

### 1. Database: Stock Movement Audit Trail Table

Create a new `stock_movements` table to track every status change for inventory items.

```text
stock_movements
+----------------+------------------+
| id             | uuid (PK)        |
| inventory_item_id | uuid (FK)     |
| from_status    | text (nullable)  |
| to_status      | text             |
| movement_type  | text             |
| quantity        | numeric (1)     |
| performed_by   | uuid (nullable) |
| notes          | text (nullable)  |
| created_at     | timestamptz      |
+----------------+------------------+
```

Movement types: `stock_in`, `assigned`, `returned`, `sold`, `damaged`, `status_change`

RLS: Admins/super_admins full access, staff can view and insert.

A database trigger `trg_log_stock_movement` on `inventory_items` will automatically log every status change into this table.

---

### 2. Status Filter + Pagination for Stock Items Tab

**Current problem**: Hard-capped at 100 items, no status filter.

Changes to `src/pages/Inventory.tsx`:
- Add a status dropdown filter (All, In Stock, Assigned, Returned, Damaged, Sold) next to the existing search bar
- Add pagination controls (Previous / Next / page numbers) below the stock items table
- Page size: 25 items per page
- Track `currentPage` and `statusFilter` in state
- Apply both filters before slicing for display

---

### 3. Warranty Expiry Tracking

Add a new **"Warranty"** sub-section in the Stock Items tab header area:
- Show a warning banner when items have warranties expiring within 30 days
- Add "Warranty" column to the stock items table showing expiry date with color coding:
  - Green: > 90 days remaining
  - Yellow: 30-90 days remaining  
  - Red: < 30 days or expired
- Add a filter option "Expiring Soon" to the status filter dropdown

---

### 4. CSV/PDF Export

Add export buttons to each tab using the existing `exportToCSV` and `exportToPDF` utilities from `src/lib/exportUtils.ts`.

- **Products tab**: Export product name, category, brand, model, purchase price, selling price, stock count
- **Stock Items tab**: Export product name, serial, MAC, supplier, status, purchase price, warranty end date
- **Suppliers tab**: Export name, contact, phone, email, address

Two buttons (CSV, PDF) placed next to each tab's action buttons.

---

### 5. Return Workflow for Assigned Assets

Add a "Return" action in the Stock Items dropdown menu for items with status `assigned`:
- Opens a Return Dialog with:
  - Item details (product name, serial, currently assigned customer)
  - Condition on return dropdown: New, Good, Fair, Damaged
  - Return notes textarea
- On submit:
  - Update `asset_assignments` table: set `returned_date` and `condition_on_return`
  - Update `inventory_items` status based on condition:
    - New/Good/Fair -> `in_stock` (re-stock)
    - Damaged -> `damaged`
  - Update product `stock_quantity` accordingly (increment if re-stocked)
  - Log a `stock_movements` record with type `returned`
  - Show success toast with return summary

---

### 6. Bulk Status Updates

Add bulk selection capability to the Stock Items tab:
- Checkbox column in the table for selecting multiple items
- "Select All" checkbox in the header
- When items are selected, show a floating action bar at the bottom:
  - "Change Status" button with dropdown (In Stock, Damaged, Returned)
  - "Delete Selected" button (requires confirmation)
  - Selected count display
- On bulk status change:
  - Update all selected items' status
  - Log stock movements for each item
  - Update product stock quantities
  - Show summary toast

---

### Technical Summary

| Feature | Files Modified/Created |
|---------|----------------------|
| Stock movements table + trigger | New DB migration |
| Status filter + pagination | `src/pages/Inventory.tsx` |
| Warranty tracking | `src/pages/Inventory.tsx` |
| CSV/PDF export | `src/pages/Inventory.tsx` |
| Return workflow | `src/pages/Inventory.tsx` |
| Bulk status updates | `src/pages/Inventory.tsx` |

### Migration SQL (Key Parts)

```sql
-- stock_movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  movement_type text NOT NULL DEFAULT 'status_change',
  quantity numeric NOT NULL DEFAULT 1,
  performed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-log trigger on inventory_items status change
CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.stock_movements 
      (inventory_item_id, from_status, to_status, movement_type)
    VALUES 
      (NEW.id, OLD.status::text, NEW.status::text, 'status_change');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_stock_movement
  AFTER UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();
```

All changes stay within the existing architecture patterns -- using the same Supabase client, permission checks, and UI component library already in use.

