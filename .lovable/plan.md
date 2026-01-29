

## Issues Identified

### Issue 1: "Failed to secure password" Error
**Root Cause:** The `hash_password` database function uses `gen_salt()` and `crypt()` from `pgcrypto`, but these functions are in the `extensions` schema while the function's `search_path` is set to only `public`. This causes the function to fail with "function gen_salt(unknown, integer) does not exist".

### Issue 2: Role Permissions System
**Current State:** 
- The RolePermissions UI correctly shows tabs for Super Admin, Admin, and Staff
- Admin permissions exist in the database and can be toggled
- However, the RLS policies on some tables only check for `admin` role (not checking the granular `permissions` table)

---

## Implementation Plan

### Step 1: Fix the `hash_password` Function
Update the database function to include the `extensions` schema in its search path:

```sql
CREATE OR REPLACE FUNCTION public.hash_password(raw_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN crypt(raw_password, gen_salt('bf', 10));
END;
$$;
```

This change will allow the function to find `gen_salt()` and `crypt()` from the `extensions` schema.

### Step 2: Fix the `verify_password` Function
Apply the same fix to ensure password verification also works:

```sql
CREATE OR REPLACE FUNCTION public.verify_password(raw_password text, hashed_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN hashed_password = crypt(raw_password, hashed_password);
END;
$$;
```

### Step 3: Redesign the Role Permissions UI
Improve the RolePermissions component to be cleaner and more intuitive:

1. **Better Visual Design:**
   - Use a table-based layout instead of cards for better scannability
   - Add icons for each resource type
   - Color-code permission states (green for allowed, gray for denied)
   - Show a summary row for each resource

2. **Improved UX:**
   - Add "Enable All" / "Disable All" buttons for each role
   - Add quick filters to see only enabled/disabled permissions
   - Show permission change count before saving
   - Add confirmation dialog when saving changes

3. **UI Structure:**
   - Header section with role selector tabs
   - Permission matrix table with resources as rows and CRUD actions as columns
   - Bulk action buttons
   - Save button with unsaved changes indicator

### Step 4: Ensure RLS Policies Use Permission Checks
Verify that the database RLS policies properly reference the `has_permission()` function for granular access control. Currently, some policies use `has_role()` which gives full access to admin/staff, but they should use `has_permission()` for configurable access.

**Example policy update:**
```sql
-- Before (hardcoded role check)
CREATE POLICY "Staff and admins can view customers"
ON customers FOR SELECT
USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

-- After (permission-based check)
CREATE POLICY "Users with read permission can view customers"
ON customers FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_permission(auth.uid(), 'customers', 'read')
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/*.sql` | Fix `hash_password` and `verify_password` functions |
| `src/components/settings/RolePermissions.tsx` | Redesign UI with table layout and bulk actions |
| Database policies | Update RLS to use `has_permission()` for granular control |

---

## Expected Outcome

1. Customer creation will work without "Failed to secure password" error
2. Admin and Staff roles will have fully configurable permissions through the UI
3. Permission changes will immediately affect database access via RLS policies
4. Cleaner, more professional permissions management interface

