
# Comprehensive Bug Fixes and Feature Enhancements Plan

## Issues Identified

### 1. Google Maps "ApiTargetBlockedMapError"
**Root Cause**: The Google Maps API key exists in the database (`AIzaSyC2gRj_VAVMekVbHKP8MJjMCK9vXk0gD-k`) but the error indicates API restrictions. The key may be:
- Blocked for the current domain
- Missing required API services enabled (Maps JavaScript API)
- Having HTTP referrer restrictions that don't match the preview domain

**Note**: This is a Google Cloud Console configuration issue, not a code issue. However, I'll improve the error handling to show clearer instructions.

### 2. GPS Coordinates Not Saving/Retrieving
**Root Cause**: The `customers_safe` view already includes `latitude` and `longitude` columns. The issue appears to be:
- The CustomerEditDialog correctly saves coordinates to the `customers` table
- However, the form is not being populated properly when editing existing customers

**Fix**: Verify the form initialization and data retrieval flow.

### 3. Missing "Go Location" and "Quick Call" Buttons
**Current State**: These buttons exist on the Customers page
**Missing From**: Reminders and Call Records pages need these action buttons

### 4. Inventory - Fibre Cable Quantity Issue
**Critical Problem**: When adding 5000 meters of Fibre Cable, the system creates 5000 individual `inventory_items` rows instead of tracking as bulk metered stock.

**Solution Architecture**:
- Add `is_metered` flag to `product_categories` to identify bulk/metered products
- For metered products:
  - Store total quantity in meters directly on the product
  - Do NOT create individual `inventory_items` rows for each meter
  - Track usage through a new `cable_usage_logs` table
  - When assigning to customer, record meters used, color, and link to customer

### 5. Customer Asset Assignment Editing
**Issue**: Cannot edit asset assignments for existing customers
**Root Cause**: The CustomerAssets component only allows returning devices, not editing assignments

---

## Technical Implementation

### Phase 1: Improve Google Maps Error Handling

**File: `src/components/CustomerMapView.tsx`**

Add better error messaging and instructions for API key configuration:
- Display specific error about domain restrictions
- Add link to Google Cloud Console for API configuration
- Show the required APIs that need to be enabled

### Phase 2: Fix GPS Data Flow

**Files to Review/Fix**:
- `src/components/CustomerEditDialog.tsx` - Already handles GPS correctly
- `src/components/CustomerViewDialog.tsx` - Need to add GPS editing to the details form

**Changes**:
Add latitude/longitude fields to the CustomerViewDialog edit form so GPS can be edited inline without needing the separate edit dialog.

### Phase 3: Add Action Buttons to Reminders and Call Records

**File: `src/pages/Reminders.tsx`**

Add to the actions dropdown:
```typescript
<CallCustomerButton
  customerName={reminder.customers.full_name}
  primaryPhone={reminder.customers.phone}
  alternativePhone={reminder.customers.alt_phone}
  variant="dropdown"
/>
{reminder.customers.latitude && reminder.customers.longitude && (
  <DropdownMenuItem
    onClick={() => window.open(
      `https://www.google.com/maps?q=${reminder.customers.latitude},${reminder.customers.longitude}`, 
      "_blank"
    )}
  >
    <MapPin className="h-4 w-4 mr-2" />
    Go Location
  </DropdownMenuItem>
)}
```

**File: `src/pages/CallRecords.tsx`**

Ensure both buttons are properly implemented (CallCustomerButton was added, verify Go Location).

### Phase 4: Redesign Inventory for Metered Products (Fibre Cable)

This is the most complex change requiring database schema updates.

**Database Migration**:

```sql
-- Add metered product support to categories
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_metered BOOLEAN DEFAULT false;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'piece';

-- Add metered quantity tracking to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS metered_quantity NUMERIC DEFAULT 0;

-- Create cable/metered usage log table
CREATE TABLE IF NOT EXISTS metered_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  customer_id UUID REFERENCES customers(id),
  quantity_used NUMERIC NOT NULL,
  color TEXT,
  core_count INTEGER,
  usage_type TEXT NOT NULL DEFAULT 'assignment', -- assignment, sale, waste
  notes TEXT,
  technician_name TEXT,
  usage_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE metered_usage_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Admins can manage metered_usage_logs" ON metered_usage_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view metered_usage_logs" ON metered_usage_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can insert metered_usage_logs" ON metered_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

-- Update Fibre Cable category to be metered
UPDATE product_categories 
SET is_metered = true, unit_of_measure = 'meter'
WHERE name ILIKE '%fibre%' OR name ILIKE '%fiber%' OR name ILIKE '%cable%';
```

**File: `src/pages/Inventory.tsx`**

Major changes needed:

1. **Add Stock Dialog Changes**:
   - Detect if selected product category is metered
   - If metered: Show single quantity field (in meters) instead of serial/MAC arrays
   - Add fields for cable color, core count
   - On save: Update product's `metered_quantity` instead of creating inventory_items

2. **Product Card Display Changes**:
   - For metered products: Show "Available: 4500m" instead of counting items
   - Show "Used: 500m" based on usage logs

3. **Assign to Customer Flow**:
   - For metered products: Ask for meters to use, color, technician
   - Create entry in `metered_usage_logs` instead of `asset_assignments`
   - Deduct from product's `metered_quantity`

4. **View Customer Cable Usage**:
   - In CustomerAssets or CustomerViewDialog, show cable usage history
   - Display: Date, Meters Used, Color, Core Count, Technician

**New Component: `src/components/MeteredProductAssignment.tsx`**

Dialog for assigning metered products (cable) to customers:
- Customer selector
- Meters to use (with validation against available stock)
- Color dropdown
- Core count display
- Technician name
- Notes

### Phase 5: Fix Customer Asset Assignment Editing

**File: `src/components/CustomerAssets.tsx`**

Add edit functionality for existing assignments:
- Add "Edit" button to each active assignment card
- Edit dialog to modify:
  - Account type (Free/Paid)
  - Selling price (if Paid)
  - Technician name
  - Condition
  - Notes

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/CustomerMapView.tsx` | Better error handling and API key instructions |
| `src/components/CustomerViewDialog.tsx` | Add GPS fields to edit form |
| `src/pages/Reminders.tsx` | Add CallCustomerButton and Go Location actions |
| `src/pages/CallRecords.tsx` | Verify and fix action buttons |
| `src/pages/Inventory.tsx` | Complete redesign for metered products support |
| `src/components/CustomerAssets.tsx` | Add edit assignment functionality |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/components/MeteredProductAssignment.tsx` | Dialog for assigning cable/metered products to customers |
| `src/components/CableUsageHistory.tsx` | Display cable usage for a customer |

## Database Migration

New migration file to add metered product support:
- Add columns to `product_categories`
- Add column to `products`
- Create `metered_usage_logs` table with RLS policies
- Update existing Fibre Cable category

---

## User Experience Flows

### Adding Fibre Cable Stock (After Fix):
1. Go to Inventory > Stock Items > Add Stock
2. Select "Bizli 2 Core FTTH" (a Fibre Cable product)
3. System detects it's a metered product
4. Enter: 5000 meters, Purchase Price per meter
5. Select Color, Core Count
6. Click Save
7. System updates product's metered_quantity to 5000

### Assigning Cable to Customer (After Fix):
1. Go to Customer > View Details > Assets
2. Click "Assign Cable"
3. Select cable product from dropdown
4. Enter: 50 meters, Select Color (Blue)
5. Enter Technician Name
6. Click Assign
7. System creates usage log, deducts 50m from stock
8. Customer's asset tab shows "Bizli 2 Core FTTH - 50m (Blue)"

### Editing Existing Asset Assignment:
1. Go to Customer > View Details > Assets
2. Click Edit on an active assignment
3. Modify account type, selling price, notes
4. Save changes

---

## Notes

- The Google Maps API key configuration is a Google Cloud Console issue - I'll add clear instructions in the error UI
- Metered products require a fundamentally different tracking approach than discrete items
- This change is backward-compatible - existing discrete products (ONUs) work as before
- The `inventory_items` table continues to be used for discrete products only
