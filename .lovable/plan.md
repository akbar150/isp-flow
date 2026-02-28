

# ISP Billing System -- 15 Feature Enhancement Plan

This is a comprehensive roadmap to transform your ISP billing system into a unique, feature-rich platform. Features are organized into 4 phases, ordered by impact and dependency.

---

## Phase 1: Core Revenue & Operations (Features 1-4)

### Feature 1: Revenue Analytics Dashboard
Add rich analytics widgets to the Dashboard page with:
- Monthly Recurring Revenue (MRR) chart
- Churn rate (customers lost vs gained per month)
- Collection efficiency % (collected vs billed)
- ARPU (Average Revenue Per User)
- Area-wise revenue breakdown chart
- **Files**: New `src/components/dashboard/RevenueAnalytics.tsx`, modify `src/pages/Dashboard.tsx`
- **DB**: No schema changes -- all computed from existing `payments`, `customers`, `billing_records` tables

### Feature 2: Ticket/Complaint Management System
Full support ticket system for customers and staff:
- Customers raise tickets from Customer Portal (connection issue, billing dispute, etc.)
- Staff/admin can assign, prioritize, and resolve tickets
- SLA tracking with configurable resolution time targets
- Resolution time reports
- **Files**: New `src/pages/Tickets.tsx`, new `src/components/tickets/` folder
- **DB**: New `support_tickets` table (id, customer_id, subject, description, category, priority, status, assigned_to, sla_deadline, resolved_at, created_at), new `ticket_comments` table

### Feature 3: Network Outage Notification System
Broadcast area-wise outage alerts to affected customers:
- Create outage event with affected area(s) and estimated restoration time
- Auto-send WhatsApp/SMS to all customers in affected area(s)
- Outage history log with duration tracking
- Customer Portal shows active outages for their area
- **Files**: New `src/pages/Outages.tsx` or section in Dashboard
- **DB**: New `network_outages` table (id, area_ids, title, description, status, estimated_restore, actual_restore, created_by, created_at)

### Feature 4: Automated Billing Engine Enhancement
Improve the existing billing engine with:
- Auto-suspend expired customers (update status + disable on MikroTik)
- Auto-reactivate on payment (detect payment, re-enable customer)
- Grace period configuration (e.g., 3 days after expiry before suspension)
- **Files**: Modify `supabase/functions/generate-billing/index.ts`, new settings in `system_settings`
- **DB**: Add `grace_period_days` to system_settings

---

## Phase 2: Customer Experience (Features 5-8)

### Feature 5: Customer Self-Service Tools
Enhance the Customer Portal with:
- Package upgrade/downgrade request (creates a pending request for admin approval)
- Usage history chart (payment timeline, due history)
- Download invoices as PDF
- **Files**: Modify `src/pages/CustomerPortal.tsx`, new components in `src/components/portal/`
- **DB**: New `package_change_requests` table

### Feature 6: Online Payment Gateway Integration
Add bKash/Nagad/SSLCommerz payment support:
- Customer Portal "Pay Now" button
- Payment verification via webhook
- Auto-update invoice and customer due on successful payment
- Payment receipt generation
- **Files**: New edge function `supabase/functions/process-payment/index.ts`, modify Customer Portal
- **DB**: Add `gateway_transaction_id`, `gateway_status` columns to `payments` table
- **Secrets**: Payment gateway API keys required

### Feature 7: Speed Test Integration
Embed a speed test tool in the Customer Portal:
- Integration with a speed test API or embedded widget (e.g., LibreSpeed)
- Log results with timestamp for troubleshooting
- Compare actual speed vs package speed
- **Files**: New `src/components/portal/SpeedTest.tsx`
- **DB**: New `speed_test_results` table (optional, for logging)

### Feature 8: Customer Satisfaction Survey
Post-ticket-resolution survey:
- Auto-trigger survey after ticket is resolved
- Simple star rating + optional comment
- Survey analytics for admin
- **Files**: New `src/components/portal/SurveyDialog.tsx`
- **DB**: New `customer_surveys` table

---

## Phase 3: Operational Excellence (Features 9-12)

### Feature 9: Technician Field Service Management
Assign and track field tasks:
- Create field tasks (new connection, repair, disconnection)
- Assign to technician (employee)
- Track task status (pending, in-progress, completed)
- GPS location of task with directions
- **Files**: New `src/pages/FieldTasks.tsx`
- **DB**: New `field_tasks` table (id, customer_id, assigned_to, task_type, status, location, scheduled_date, completed_at, notes)

### Feature 10: Staff Performance Tracking
Track and report on staff productivity:
- Payments collected per staff member
- Tickets resolved per staff
- Calls made per staff
- Field tasks completed per staff
- Leaderboard view
- **Files**: New `src/components/reports/StaffPerformance.tsx`, add to Reports page
- **DB**: No schema changes -- computed from existing tables using `created_by`/`called_by`/`assigned_to`

### Feature 11: Referral Program
Customers refer friends and earn credits:
- Unique referral code per customer
- Track referrals and award discount on next bill
- Referral dashboard in Customer Portal
- **Files**: Modify Customer Portal, new components
- **DB**: New `referrals` table (id, referrer_customer_id, referred_customer_id, reward_amount, status, created_at), add `referral_code` to `customers`

### Feature 12: Bandwidth/FUP Monitoring
Monitor and manage bandwidth usage:
- Pull traffic data from MikroTik API (for real mode)
- Display daily/monthly usage per customer
- FUP (Fair Usage Policy) alerts when threshold crossed
- **Files**: New `src/components/dashboard/BandwidthMonitor.tsx`, modify MikroTik adapter
- **DB**: New `bandwidth_logs` table

---

## Phase 4: Growth & Scale (Features 13-15)

### Feature 13: Reseller/Sub-dealer Module
Allow ISP to manage sub-dealers:
- Create reseller accounts with assigned areas
- Resellers manage their own customers
- Commission tracking (% of customer payments)
- Reseller dashboard with their customer stats
- **Files**: New `src/pages/Resellers.tsx`
- **DB**: New `resellers` table, add `reseller_id` to `customers`

### Feature 14: Multi-Branch Support
Support multiple office locations:
- Branch management (name, address, manager)
- Assign customers, staff, and routers to branches
- Branch-wise reporting and filtering
- **Files**: Modify multiple pages to add branch filter
- **DB**: New `branches` table, add `branch_id` to `customers`, `employees`, `routers`

### Feature 15: SLA Monitoring Dashboard
Track and visualize service level agreements:
- Uptime tracking per area/router
- Response time metrics for tickets
- SLA breach alerts and reports
- Monthly SLA compliance report
- **Files**: New `src/components/reports/SLADashboard.tsx`
- **DB**: Computed from `network_outages`, `support_tickets` tables

---

## Implementation Order

I will implement these one at a time in sequence. The recommended starting order is:

1. **Revenue Analytics Dashboard** -- Immediate value, no DB changes
2. **Ticket/Complaint System** -- High customer impact
3. **Network Outage Notifications** -- Critical operational tool
4. **Auto Billing Engine Enhancement** -- Revenue protection
5. **Customer Self-Service Tools** -- Reduce support load
6-15: Continue in phase order

Each feature will be implemented as a separate step, so you can review and test before moving to the next one.

## Technical Notes

- New database tables will require migrations with proper RLS policies
- New pages will need route entries in `App.tsx` and sidebar links in `AppSidebar.tsx`
- Permission resources will be added for each new module
- All new features will follow existing patterns (DashboardLayout, form-section styling, toast notifications)

