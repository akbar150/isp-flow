
# Implementation Plan: Enhanced Inventory & Customer Asset Management

## Overview
This plan addresses multiple enhancements to create a comprehensive asset tracking and inventory management system for the ISP application. The changes span database schema updates, new UI components, and enhanced customer management features.

---

## Summary of Changes

### 1. Customer View Dialog - Show Assigned Products
Add a new "Assets" tab showing all products assigned to the customer with:
- Product name, ID, MAC address, serial number
- Assignment date, technician name, condition
- "Return" button to mark device as returned

### 2. Enhanced Category Management
When creating a product category, specify whether items require:
- Serial number tracking
- MAC address tracking  
- No tracking (e.g., cables, consumables)

### 3. Stock Purchase with Full Details
When adding stock items, enforce entry of:
- All MAC addresses/serials (for trackable items)
- Supplier information
- For cables: core count, quantity, color, details

### 4. Supplier Management
New sidebar menu for managing suppliers with:
- Supplier name, contact, address
- Link purchases to suppliers

### 5. Customer GPS - "Go Location" Button
Add action button to open customer GPS coordinates in Google Maps

### 6. New Customer Form - Tabbed Interface
Reorganize with tabs:
- Basic Info (name, phone, address, etc.)
- GPS & Location (coordinates, area, router)  
- Products (assign multiple products during creation)

---

## Technical Implementation

### Phase 1: Database Schema Updates

**New Tables:**
```text
+-------------------+     +------------------+
|    suppliers      |     | product_categories |
+-------------------+     +------------------+
| id                |     | id               |
| name              |     | name             |
| contact_person    |     | description      |
| phone             |     | requires_serial  | <-- NEW
| email             |     | requires_mac     | <-- NEW
| address           |     | is_active        |
| is_active         |     +------------------+
+-------------------+

+-------------------+
| inventory_items   |
+-------------------+
| ...existing...    |
| supplier_id       | <-- NEW (foreign key)
| core_count        | <-- NEW (for cables)
| cable_color       | <-- NEW (for cables)
| cable_length_m    | <-- NEW (for cables)
+-------------------+
```

**Migration SQL:**
- Add `requires_serial` (boolean, default false) to `product_categories`
- Add `requires_mac` (boolean, default false) to `product_categories`
- Create `suppliers` table with name, contact, phone, email, address, is_active
- Add `supplier_id` foreign key to `inventory_items`
- Add cable-specific fields: `core_count`, `cable_color`, `cable_length_m` to `inventory_items`

### Phase 2: Supplier Management

**New File: `src/pages/Suppliers.tsx`**
- Full CRUD for suppliers
- Table view with search
- Used in stock item forms as a dropdown

**Update: `src/components/AppSidebar.tsx`**
- Add "Suppliers" menu item under Inventory section

**Update: `src/App.tsx`**
- Add `/suppliers` route

### Phase 3: Enhanced Category Form

**Update: `src/pages/Inventory.tsx`**
- Category form additions:
  - Checkbox: "Requires Serial Number" 
  - Checkbox: "Requires MAC Address"
- When adding stock items, check the category settings:
  - If `requires_serial` = true, serial number field is mandatory
  - If `requires_mac` = true, MAC address field is mandatory

### Phase 4: Enhanced Stock Item Form

**Update: `src/pages/Inventory.tsx`**
- Add supplier dropdown (from suppliers table)
- Add conditional fields for cables:
  - Core count (number)
  - Cable color (text/select)
  - Cable length in meters (number)
- Bulk add feature: When quantity > 1 for serialized products, show multiple MAC/Serial input fields

### Phase 5: Customer View Dialog - Assets Tab

**Update: `src/components/CustomerViewDialog.tsx`**
- Add new "Assets" tab in the TabsList
- Fetch asset_assignments for the customer with inventory_items and products
- Display table with columns:
  - Product Name | Serial/MAC | Condition | Assigned Date | Technician | Status | Actions
- "Return" button opens dialog to:
  - Set return date
  - Record condition on return
  - Update inventory_item status back to "returned"
  - Mark asset_assignment with returned_date

### Phase 6: GPS "Go Location" Button

**Update: `src/components/CustomerViewDialog.tsx`**
- In the Details tab, add "Go Location" button next to GPS coordinates
- Opens: `https://www.google.com/maps?q={latitude},{longitude}` in new tab
- Only visible when latitude/longitude are set

**Update: `src/components/CustomerEditDialog.tsx`**
- Add "Go Location" button in GPS section

### Phase 7: Tabbed New Customer Form

**Update: `src/pages/Customers.tsx`**
- Replace single-column form with tabbed interface:

```text
Tabs: [Basic Info] [Location & GPS] [Products]

Tab 1 - Basic Info:
- Full Name, Phone, Alt Phone
- Package, Password fields
- PPPoE Username/Password

Tab 2 - Location & GPS:
- Address
- Area/Zone, Router
- Connection Type, Billing Cycle
- Latitude, Longitude

Tab 3 - Products:
- List of products to assign (dynamic add/remove)
- Each row: Product dropdown, Condition dropdown, Notes
- Technician name field
```

- On submit, create customer first, then create asset_assignments for each selected product

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Suppliers.tsx` | Supplier management page |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppSidebar.tsx` | Add Suppliers menu link |
| `src/App.tsx` | Add Suppliers route |
| `src/pages/Inventory.tsx` | Enhanced category form, stock item form with supplier, cable fields, bulk MAC entry |
| `src/components/CustomerViewDialog.tsx` | Add Assets tab, GPS "Go Location" button |
| `src/components/CustomerEditDialog.tsx` | Add GPS "Go Location" button |
| `src/pages/Customers.tsx` | Tabbed new customer form with product assignment |

## Database Migration

```sql
-- 1. Add tracking flags to product_categories
ALTER TABLE product_categories 
  ADD COLUMN requires_serial BOOLEAN DEFAULT false,
  ADD COLUMN requires_mac BOOLEAN DEFAULT false;

-- 2. Create suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage suppliers" ON suppliers FOR ALL 
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Authenticated users can view suppliers" ON suppliers FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- 3. Add supplier and cable fields to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id),
  ADD COLUMN core_count INTEGER,
  ADD COLUMN cable_color TEXT,
  ADD COLUMN cable_length_m NUMERIC;
```

---

## User Experience Flow

**Adding a Cable Product:**
1. Create category "Fibre Cable" with requires_serial=false, requires_mac=false
2. Create product under that category
3. When adding stock: enter quantity, supplier, core count, color, length
4. No serial/MAC required

**Adding ONU/Router:**
1. Create category "ONU" with requires_serial=true, requires_mac=true
2. Create product under that category  
3. When adding stock of 10 units: enter 10 MAC addresses + serials
4. Each becomes a separate inventory_item

**Assigning to Customer:**
1. Open new customer dialog
2. Fill Basic Info tab
3. Fill Location tab with GPS
4. Go to Products tab
5. Select "ONU" from dropdown
6. Select specific unit (shows MAC address)
7. Set condition as "New"
8. Enter technician name
9. Submit - creates customer + asset assignment

**Returning Device:**
1. View customer details
2. Go to Assets tab
3. Click "Return" on the ONU row
4. Set condition on return
5. Device status changes to "returned", back in stock
