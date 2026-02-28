

## Settings Page Redesign & Mobile Responsiveness

### 1. Merge Communication Settings into Single Tab

Combine the WhatsApp, Email, SMS, and OTP tabs into one **"Communications"** tab. Each section will be a collapsible card (using Radix Collapsible) within that tab:

- **WhatsApp Settings** (collapsible card with MessageSquare icon)
- **Email / SMTP Settings** (collapsible card with Mail icon)  
- **SMS Settings** (collapsible card with Smartphone icon)
- **OTP / Firebase Settings** (collapsible card with Lock icon)

This reduces the tab count from 13 to 10, making the settings page much cleaner.

**File**: `src/pages/Settings.tsx`
- Remove individual WhatsApp, Email, SMS, OTP tab triggers and tab content
- Add single "Communications" tab trigger
- Create a new tab content section with 4 collapsible cards
- Move the WhatsApp template form inline into the first collapsible card
- EmailTemplates, SmsSettings, FirebaseOtpSettings components go inside their respective collapsible cards

### 2. Move Resellers to Main Sidebar Navigation

Remove the "Resellers" tab from Settings and add it as a top-level sidebar navigation item with its own route.

**Files to modify**:
- `src/components/AppSidebar.tsx` -- Add `{ path: "/resellers", label: "Resellers", icon: Store, resource: "resellers" }` to navItems (above Settings)
- `src/App.tsx` -- Add a new `<ProtectedRoute resource="resellers">` route for `/resellers`
- Create `src/pages/Resellers.tsx` -- A standalone page wrapping `ResellerManagement` inside `DashboardLayout`
- `src/pages/Settings.tsx` -- Remove the Resellers tab and its import

### 3. Add Missing Resources to Permissions CRUD List

The `RolePermissions.tsx` RESOURCES array is missing several resources that exist as routes or features. Add:

- `{ key: "service_tasks", label: "Service Tasks", icon: Wrench }`
- `{ key: "resellers", label: "Resellers", icon: Store }`
- `{ key: "contracts", label: "Contracts", icon: FileText }`

Also need to create corresponding permission rows in the database for these new resources (for admin and staff roles, all 4 CRUD actions each).

**Files to modify**:
- `src/components/settings/RolePermissions.tsx` -- Add 3 new entries to RESOURCES array, import Wrench and Store icons
- Database migration -- Insert permission rows for `service_tasks`, `resellers`, `contracts` resources with all CRUD actions for `admin` and `staff` roles

### 4. Mobile Responsiveness Improvements

#### Customer Portal (`src/pages/CustomerPortal.tsx`):
- Wrap `TabsList` in a horizontal `ScrollArea` so tabs don't overflow on mobile
- Make overview cards stack properly on small screens (already uses grid, but ensure gap/padding is mobile-friendly)
- Reduce padding on mobile for the main container

#### Settings Page (`src/pages/Settings.tsx`):
- The TabsList already uses ScrollArea -- verify it works with the new consolidated tabs

#### Dashboard Layout (`src/components/DashboardLayout.tsx`):
- Already has mobile sidebar -- no changes needed

#### General CSS (`src/index.css`):
- Add responsive utilities for collapsible cards
- Ensure tables scroll horizontally on mobile

---

### Technical Summary

| Change | Files |
|--------|-------|
| Merge 4 communication tabs into 1 collapsible tab | `src/pages/Settings.tsx` |
| Move Resellers to main nav | `src/components/AppSidebar.tsx`, `src/App.tsx`, new `src/pages/Resellers.tsx`, `src/pages/Settings.tsx` |
| Add missing permission resources | `src/components/settings/RolePermissions.tsx`, new DB migration |
| Mobile responsiveness | `src/pages/CustomerPortal.tsx`, `src/pages/Settings.tsx` |

### Database Migration

```sql
-- Add permission rows for missing resources
INSERT INTO public.permissions (role, resource, action, allowed)
SELECT r.role, r.resource, r.action, false
FROM (
  VALUES 
    ('admin'::app_role, 'service_tasks', 'create'),
    ('admin'::app_role, 'service_tasks', 'read'),
    ('admin'::app_role, 'service_tasks', 'update'),
    ('admin'::app_role, 'service_tasks', 'delete'),
    ('admin'::app_role, 'resellers', 'create'),
    ('admin'::app_role, 'resellers', 'read'),
    ('admin'::app_role, 'resellers', 'update'),
    ('admin'::app_role, 'resellers', 'delete'),
    ('admin'::app_role, 'contracts', 'create'),
    ('admin'::app_role, 'contracts', 'read'),
    ('admin'::app_role, 'contracts', 'update'),
    ('admin'::app_role, 'contracts', 'delete'),
    ('staff'::app_role, 'service_tasks', 'create'),
    ('staff'::app_role, 'service_tasks', 'read'),
    ('staff'::app_role, 'service_tasks', 'update'),
    ('staff'::app_role, 'service_tasks', 'delete'),
    ('staff'::app_role, 'resellers', 'create'),
    ('staff'::app_role, 'resellers', 'read'),
    ('staff'::app_role, 'resellers', 'update'),
    ('staff'::app_role, 'resellers', 'delete'),
    ('staff'::app_role, 'contracts', 'create'),
    ('staff'::app_role, 'contracts', 'read'),
    ('staff'::app_role, 'contracts', 'update'),
    ('staff'::app_role, 'contracts', 'delete')
) AS r(role, resource, action)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p 
  WHERE p.role = r.role AND p.resource = r.resource AND p.action = r.action
);
```

