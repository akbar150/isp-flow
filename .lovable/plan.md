

# Add New Features to Role & Permissions

## Current State
The Role Permissions UI in Settings shows 16 resources but is missing the two new features: **Support Tickets** and **Network Outages**. The database has partial permission rows for these (admin and staff only, missing super_admin).

## Changes

### 1. Database: Seed Missing Permission Rows
Insert the missing `super_admin` permission rows for `tickets` and `outages` resources (all 4 CRUD actions each = 8 new rows).

### 2. UI: Update RolePermissions.tsx
Add two new entries to the `RESOURCES` array:
- `tickets` -- "Support Tickets" with `TicketCheck` icon
- `outages` -- "Network Outages" with `WifiOff` icon

Import the two new icons (`TicketCheck`, `WifiOff`) from lucide-react.

### Technical Details

**Database inserts** (8 rows):
```text
tickets  | super_admin | create/read/update/delete | allowed=true
outages  | super_admin | create/read/update/delete | allowed=true
```

**RolePermissions.tsx changes**:
- Add `TicketCheck` and `WifiOff` to the lucide-react import
- Add two entries to RESOURCES array after "User Management":
  - `{ key: "tickets", label: "Support Tickets", icon: TicketCheck }`
  - `{ key: "outages", label: "Network Outages", icon: WifiOff }`

This ensures all three roles (super_admin, admin, staff) have configurable permissions for both new modules, and the permissions table in Settings displays them for management.
