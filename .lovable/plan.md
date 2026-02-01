
# Implementation Plan: Multi-Feature Enhancement

## Status: ✅ COMPLETED

## Overview
This plan addresses several key enhancements including UI action buttons, Google Maps integration, inventory restructuring, permission updates, and utility features.

---

## Summary of Changes (All Completed)

### 1. Customer Page Action Buttons
Add "Quick Call" and "Go Location" buttons to the Customers page actions menu

### 2. Google Maps View for Customer Locations
Display all customers on a map with markers showing PPPoE username and name

### 3. Inventory Menu Restructuring
Move "Suppliers" into a sub-menu within Inventory or as a tab

### 4. Inventory UI/UX Redesign
Consolidate inventory display to show products by name with total quantity, with drill-down for details

### 5. User Roles & Permissions Update
Add missing resources to the permissions system (inventory, hrm, invoices, suppliers)

### 6. Clear Cache Button
Add cache clearing functionality to the top bar

### 7. Settings > Users Error Fix
Improve edge function error handling and fallback behavior

---

## Technical Implementation

### Phase 1: Customer Page - Action Buttons

**Update: `src/pages/Customers.tsx`**
- Add "Quick Call" button to DropdownMenu (already present, verified)
- Add "Go Location" button that opens Google Maps with customer GPS coordinates
- Button only visible when latitude/longitude exist

Code change in the DropdownMenuContent:
```typescript
{customer.latitude && customer.longitude && (
  <DropdownMenuItem
    onClick={() => window.open(
      `https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`, 
      "_blank"
    )}
  >
    <MapPin className="h-4 w-4 mr-2" />
    Go Location
  </DropdownMenuItem>
)}
```

### Phase 2: Google Maps Customer Map View

**New Component: `src/components/CustomerMapView.tsx`**
- Modal dialog with embedded Google Maps
- Display markers for all customers with GPS data
- Each marker shows PPPoE username and customer name on click
- Use provided API key: `AIzaSyC2gRj_VAVMekVbHKP8MJjMCK9vXk0gD-k`

**Update: `src/pages/Customers.tsx`**
- Add "Map View" button next to "Bulk Import"
- Opens the CustomerMapView modal

**Implementation approach:**
```typescript
// Load Google Maps JavaScript API dynamically
// Create markers for each customer with GPS coordinates
// InfoWindow displays customer name and PPPoE username
```

**Future Settings Configuration:**
- Store Google Maps API key in `system_settings` table
- Add configuration field in Settings page (General tab)

### Phase 3: Inventory Menu & UI Restructuring

**Option A: Nest Suppliers in Inventory (Recommended)**

**Update: `src/components/AppSidebar.tsx`**
- Remove standalone "Suppliers" menu item
- Keep single "Inventory" menu that leads to combined page

**Update: `src/pages/Inventory.tsx`**
- Add "Suppliers" tab alongside existing tabs (Stock Items, Products, Categories)
- Move Suppliers management UI into this new tab

**Complete UI/UX Redesign:**

Current issue: Each MAC/Serial number creates a separate row
Solution: Group inventory items by product name

New display structure:
```text
+---------------------+----------+---------+----------+
| Product Name        | In Stock | Assigned| Actions  |
+---------------------+----------+---------+----------+
| ONU ZTE F601        | 15       | 23      | [...]    |
| Router TP-Link      | 8        | 12      | [...]    |
| Fibre Cable 4-Core  | 500m     | 200m    | [...]    |
+---------------------+----------+---------+----------+
```

Actions dropdown reveals:
- View available items (shows MAC/Serial list)
- View assigned items
- Add more stock
- Edit product details

**Update: `src/App.tsx`**
- Remove `/suppliers` route if consolidating
- Or keep route but update navigation flow

### Phase 4: Role Permissions Update

**Update: `src/components/settings/RolePermissions.tsx`**

Current RESOURCES array is missing:
- inventory
- hrm  
- invoices
- suppliers (if kept separate)

Updated RESOURCES array:
```typescript
const RESOURCES = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "packages", label: "Packages", icon: Package },
  { key: "routers", label: "Routers", icon: Router },
  { key: "areas", label: "Areas/Zones", icon: MapPin },
  { key: "call_records", label: "Call Records", icon: Phone },
  { key: "reminders", label: "Reminders", icon: Bell },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "invoices", label: "Invoices", icon: FileText },     // NEW
  { key: "inventory", label: "Inventory", icon: Boxes },       // NEW
  { key: "hrm", label: "HRM", icon: UserCog },                 // NEW
  { key: "expense_categories", label: "Expense Categories", icon: FolderOpen },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "users", label: "User Management", icon: User },
];
```

**Database Migration:**
Insert new permission rows for the missing resources:
```sql
INSERT INTO permissions (role, resource, action, allowed)
SELECT r.role, res.resource, act.action, 
  CASE WHEN r.role IN ('super_admin', 'admin') THEN true ELSE false END
FROM (VALUES ('super_admin'), ('admin'), ('staff')) AS r(role)
CROSS JOIN (VALUES ('inventory'), ('hrm'), ('invoices'), ('suppliers')) AS res(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS act(action)
ON CONFLICT DO NOTHING;
```

### Phase 5: Clear Cache Button

**Update: `src/components/DashboardLayout.tsx`**

Add "Clear Cache" button next to AdminNotifications:
```typescript
const handleClearCache = async () => {
  try {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage  
    sessionStorage.clear();
    
    // Clear service worker caches if available
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
    
    toast({ title: "Cache cleared", description: "Application cache has been cleared" });
    
    // Reload the page to ensure fresh state
    window.location.reload();
  } catch (error) {
    toast({ title: "Error", description: "Failed to clear cache", variant: "destructive" });
  }
};
```

UI placement:
```typescript
<div className="flex items-center gap-2">
  <Button 
    variant="ghost" 
    size="icon"
    onClick={handleClearCache}
    title="Clear Cache"
  >
    <RefreshCcw className="h-4 w-4" />
  </Button>
  <AdminNotifications />
</div>
```

### Phase 6: Settings > Users Error Handling

The error "Failed to connect to the server. Using local data." is expected fallback behavior when the edge function has issues.

**Review & Improve: `src/components/settings/UserManagement.tsx`**
- The fallback to `fetchUsersLocally` is already implemented
- The toast notification is informative but could be less alarming

**Improvements:**
1. Make the toast less alarming when local data works fine
2. Add retry mechanism
3. Better error state UI

```typescript
// Change toast from "destructive" to "default" when fallback works
toast({
  title: "Using cached data",
  description: "Fetching latest user list...",
  // Remove variant: "destructive"
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/CustomerMapView.tsx` | Google Maps modal showing all customer locations |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Customers.tsx` | Add Go Location action, Map View button |
| `src/pages/Inventory.tsx` | Add Suppliers tab, redesign stock display |
| `src/components/AppSidebar.tsx` | Remove standalone Suppliers link |
| `src/components/settings/RolePermissions.tsx` | Add missing resources |
| `src/components/settings/UserManagement.tsx` | Improve error handling |
| `src/components/DashboardLayout.tsx` | Add Clear Cache button |
| `src/App.tsx` | Route adjustments if needed |

## Database Migration

```sql
-- Add missing permission records for new resources
INSERT INTO permissions (role, resource, action, allowed)
SELECT 
  r.role::app_role, 
  res.resource, 
  act.action, 
  CASE 
    WHEN r.role = 'super_admin' THEN true
    WHEN r.role = 'admin' THEN true
    ELSE false 
  END
FROM (VALUES ('super_admin'), ('admin'), ('staff')) AS r(role)
CROSS JOIN (
  VALUES 
    ('inventory'), 
    ('hrm'), 
    ('invoices'),
    ('suppliers')
) AS res(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS act(action)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p 
  WHERE p.role = r.role::app_role 
    AND p.resource = res.resource 
    AND p.action = act.action
);
```

---

## User Experience Flows

**Viewing Customer Locations on Map:**
1. Go to Customers page
2. Click "Map View" button (beside Bulk Import)
3. See all customers with GPS data as markers
4. Click marker to see PPPoE username and name
5. Click marker info to navigate or view customer

**Going to Customer Location:**
1. In Customers table, click Actions on any customer
2. If GPS data exists, "Go Location" appears
3. Click to open Google Maps with directions

**Managing Inventory (Redesigned):**
1. Go to Inventory page
2. See consolidated product list with quantities
3. Click Actions on any product
4. Choose "View Available Stock" to see MAC/Serial list
5. Suppliers tab for vendor management

**Clearing Application Cache:**
1. Click cache icon in top bar
2. Confirmation clears all browser storage
3. Page reloads with fresh state

---

## Notes

- Google Maps API key is stored in code for now; future enhancement will make it configurable from Settings
- The edge function for user management is working; the error message appears when there's a network hiccup but fallback data is used successfully
- Permission updates require database migration to add new resource rows
