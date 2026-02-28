

## Cross-Module Audit: Missing Features and Improvements

### Overview
After reviewing all 18+ modules, here is a prioritized list of gaps organized by severity.

---

### CRITICAL -- Will break at scale

| Module | Issue | Detail | Status |
|--------|-------|--------|--------|
| **Customers** | No pagination | Loads ALL customers in one query. | ✅ Done |
| **Payments** | No pagination | Hard-capped at 100 with `.limit(100)`. | ✅ Done |
| **Tickets** | No pagination | Loads all tickets in one query. | ✅ Done |
| **HRM - Attendance** | No pagination | Capped at `.limit(100)`. | ✅ Done |
| **HRM - Payroll** | No pagination | Capped at `.limit(50)`. | ✅ Done |
| **Service Tasks** | No pagination | Loads all tasks in one query. | ✅ Done |
| **Invoices** | No pagination | Loads all invoices in one query. | ✅ Done |

---

### HIGH -- Missing for daily ISP operations

| Module | Issue | Detail | Status |
|--------|-------|--------|--------|
| **Payments** | No date range filter | Cannot filter payments by date. | ✅ Done |
| **Payments** | No CSV/PDF export | No export on Payments page. | ✅ Done |
| **Payments** | No method filter | Cannot filter by payment method. | ✅ Done |
| **Customers** | No CSV/PDF export | Cannot export customer list. | ✅ Done |
| **Tickets** | No CSV/PDF export | Cannot export ticket data. | ✅ Done |
| **Accounting** | Shared income/expense categories | Need separate category types. | ✅ Done |
| **Settings** | No Activity Log viewer | No UI to view activity_logs. | ✅ Done |
| **Customer Portal** | localStorage session | Should use signed tokens. | ⬜ TODO |
| **Customer Portal** | No ticket submission | Customers cannot create tickets. | ✅ Done |
| **HRM** | No CSV/PDF export | No export capability. | ✅ Done |

---

### MEDIUM -- Functional gaps

| Module | Issue | Detail | Status |
|--------|-------|--------|--------|
| **Routers** | No health monitoring | No connected user count, uptime, or traffic stats displayed. | ⬜ TODO |
| **Routers** | Real MikroTik adapter is a stub | `RealMikrotikAdapter` returns "not_implemented" for all methods. | ⬜ TODO |
| **Outages** | No pagination for history | Resolved outages capped at `.slice(0, 20)` in UI. | ⬜ TODO |
| **Outages** | WhatsApp broadcast is manual | Opens WhatsApp for the first customer only; no real bulk broadcast. | ⬜ TODO |
| **Service Tasks** | No status update from admin UI | View-only task detail dialog; admin cannot update status without going to technician portal. | ✅ Done |
| **Invoices** | No automated overdue detection | Invoice status must be updated manually; no scheduled check for overdue invoices. | ✅ Done |
| **Dashboard** | No area-based breakdown | Stats are aggregated across all areas; no per-area view. | ⬜ TODO |
| **Reminders** | No scheduled/auto reminders | All reminders are manual; no cron-based auto-reminder for expiring customers. | ✅ Done |
| **Resellers** | Thin wrapper page | Just renders `ResellerManagement` component; no dashboard stats or commission overview on the page. | ⬜ TODO |
| **Packages** | No customer count per package | Cannot see how many customers are on each package. | ✅ Done |

---

### LOW -- Polish and UX improvements

| Module | Issue | Detail |
|--------|-------|--------|
| **Payments** | No edit/delete capability | Payment records are insert-only; no correction workflow. |
| **Tickets** | No category-based filter | Can filter by status but not by category (connection_issue, billing_dispute, etc.). |
| **HRM** | Leave request form missing | `leave_requests` table exists but no creation form in the HRM UI (only leave types management). |
| **Invoices** | No email delivery | Invoices can be printed but not emailed directly to customers. |
| **Dashboard** | Expiring list capped at 5 | Only shows 5 expiring customers; should link to full filtered list. |
| **Call Records** | Separate page is thin | The dedicated Call Records page could integrate with customer context better. |
| **Settings** | No system backup/restore | Data reset exists but no backup functionality. |

---

### Recommended Implementation Order

**Phase 1 -- Scalability (Critical) ✅ COMPLETE**
1. ✅ Add pagination to Customers, Payments, Tickets, Invoices, Service Tasks, HRM (Attendance + Payroll)
2. ✅ Add date range filters and method filter to Payments page
3. ✅ Add CSV export to Customers and Payments

**Phase 2 -- Operations (High) ✅ COMPLETE**
4. ✅ Add Activity Log viewer in Settings
5. ✅ Separate income/expense categories in Accounting
6. ✅ Add customer ticket submission to Customer Portal
7. ⬜ Secure Customer Portal sessions (replace localStorage with signed JWT) -- deferred, needs backend infra
8. ✅ Add CSV export to Tickets and HRM

**Phase 3 -- Automation (Medium) ✅ COMPLETE**
9. ✅ Add admin status update to Service Tasks detail dialog
10. ✅ Add automated overdue invoice detection (scheduled function -- runs daily at 2 AM)
11. ✅ Add scheduled auto-reminders for expiring customers (runs daily at 8 AM)
12. ✅ Add customer count per package display

**Phase 4 -- Advanced (Low) ✅ COMPLETE**
13. ⬜ Invoice email delivery -- deferred, requires email domain setup
14. ✅ Leave request creation form in HRM
15. ✅ Reseller dashboard stats
16. ✅ Area-based dashboard breakdown

---

### Technical Notes

- Pagination pattern: Use `currentPage` state + Supabase `.range(from, to)` for server-side pagination with total count via `.select('*', { count: 'exact' })`.
- Reusable `TablePagination` component created at `src/components/TablePagination.tsx`.
- Export utilities already exist in `src/lib/exportUtils.ts` -- just need to wire them into each page.
- Activity logs table already has RLS policies for admin/super_admin read access.
- All changes follow existing patterns (DashboardLayout, permission checks via `usePermissions`, Supabase client from `@/integrations/supabase/client`).
