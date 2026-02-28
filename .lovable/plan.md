

# Implementation Plan: 7 Major Features

Given the scale (7 complex features), this plan breaks them into manageable phases that can be built incrementally across multiple sessions.

---

## Build Order (by dependency and complexity)

### Session 1: Package Upgrade/Downgrade Requests

**Database:**
- Create `package_change_requests` table (id, customer_id, current_package_id, requested_package_id, status [pending/approved/rejected], prorated_credit, prorated_charge, admin_notes, created_at, updated_at)

**Customer Portal:**
- Add "Change Package" tab showing available packages
- Show prorated billing calculation (credit for remaining days on current plan, charge for new plan)
- Submit request with confirmation dialog

**Admin Dashboard:**
- Add "Package Requests" section in Customers or Settings page
- Approve/reject workflow with notes
- On approval: auto-update customer package, adjust billing, extend/recalculate expiry

---

### Session 2: Referral Program

**Database:**
- Create `referral_codes` table (id, customer_id, code, is_active, created_at)
- Create `referrals` table (id, referrer_id, referred_customer_id, status [pending/credited/expired], credit_amount, credited_at, created_at)
- Add `referral_credit` column to customers table

**Customer Portal:**
- "Referrals" tab showing unique referral code/link
- List of referred friends with status
- Total earned credits display

**Admin Dashboard:**
- Referral overview in Reports or Settings
- Auto-credit trigger when referred customer makes first payment

---

### Session 3: Online Payment Gateway (SSLCommerz)

**Requires:** SSLCommerz Store ID and Store Password from user

**Database:**
- Create `online_payments` table (id, customer_id, amount, gateway, session_id, status, transaction_id, gateway_response, created_at)

**Backend:**
- Edge function `initiate-payment` -- creates SSLCommerz session
- Edge function `payment-callback` -- verifies payment, updates customer dues/expiry
- IPN (Instant Payment Notification) handler for reliability

**Customer Portal:**
- "Pay Now" button showing due amount
- Redirects to SSLCommerz hosted checkout (bKash, Nagad, cards)
- Success/failure callback pages

---

### Session 4: Contract & Agreement Management

**Database:**
- Create `contracts` table (id, customer_id, start_date, end_date, terms_text, auto_renew, early_termination_fee, signature_data, signed_at, status, created_at)
- Create `contract_templates` table (id, name, body_template, is_default, created_at)

**Admin Dashboard:**
- Contract templates editor (Settings page)
- Generate contract per customer with auto-filled details
- Canvas-based e-signature capture
- PDF export of signed contracts
- Track renewal dates and termination fees

**Customer Portal:**
- View active contract
- Sign pending contracts digitally

---

### Session 5: Technician Field Service (PWA)

**Database:**
- Create `service_tasks` table (id, customer_id, assigned_to, task_type [installation/repair/maintenance], status [pending/in_progress/completed], priority, scheduled_date, completed_at, gps_lat, gps_lng, notes, photos, customer_signature, created_by, created_at)

**Admin Dashboard:**
- Task assignment interface (assign to employees)
- Task status tracking with map view
- Completion reports

**Technician View:**
- Mobile-optimized PWA page at `/technician`
- View assigned tasks, navigate to customer location
- Mark complete with photo upload and signature capture
- GPS auto-capture on completion

---

### Session 6: Reseller/Sub-dealer Module

**Database:**
- Create `resellers` table (id, user_id, name, phone, email, commission_rate, status, created_at)
- Create `reseller_customers` table (id, reseller_id, customer_id, created_at)
- Create `reseller_commissions` table (id, reseller_id, payment_id, amount, status, created_at)

**New Pages:**
- `/reseller-login` -- separate login for resellers
- `/reseller-portal` -- dashboard showing their customers, commissions, earnings
- Reseller can add customers under the main ISP

**Admin Dashboard:**
- Reseller management in Settings
- Commission tracking and payout reports
- Consolidated view across all resellers

---

### Session 7: AI-Powered Churn Prediction

**Backend:**
- Edge function `analyze-churn` using Lovable AI (Gemini) to analyze:
  - Payment patterns (late payments, missed cycles)
  - Ticket frequency and resolution
  - Package downgrade requests
  - Days overdue trends

**Admin Dashboard:**
- "Churn Risk" widget on Dashboard page
- Customer list with risk scores (High/Medium/Low)
- Recommended retention actions per customer
- No external API key needed (uses built-in Lovable AI)

---

## Technical Notes

- Each session creates its own database migration, RLS policies, and UI components
- All new tables follow existing patterns: UUID primary keys, timestamps, RLS with role-based access
- Customer portal features use the existing session token auth (no Supabase Auth needed for customers)
- The SSLCommerz integration requires merchant credentials -- will prompt before building
- Total estimated: 7 implementation sessions

## Recommended Start

Begin with **Package Upgrade/Downgrade** (Session 1) as it's self-contained and high-value for customers.

