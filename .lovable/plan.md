

# Phase 2-4 Feature Implementation Roadmap

## Overview
You've selected 9 major features to build. Given the complexity, this plan proposes a phased approach, building each feature incrementally across multiple sessions. Here's the prioritized order and what each involves:

---

## Phase 2: Customer Self-Service (Build First)

### Feature 1: Online Payment Gateway (bKash/Nagad/SSLCommerz)
- Integrate SSLCommerz (most popular BD gateway -- supports bKash, Nagad, cards)
- Add a "Pay Now" button in the Customer Portal
- Create a backend function to initiate payment sessions and verify callbacks
- Auto-update customer dues and expiry on successful payment
- **Requires**: SSLCommerz merchant credentials (Store ID + Store Password)

### Feature 2: Speed Test Integration
- Embed an open-source speed test (LibreSpeed or similar) in the Customer Portal
- Show download/upload speed and ping results
- Compare results against the customer's subscribed package speed
- No external API needed -- runs entirely in the browser

### Feature 3: Package Upgrade/Downgrade Requests
- Add a "Change Package" button in the Customer Portal
- Create a `package_change_requests` database table (customer, current package, requested package, status, prorated amount)
- Calculate prorated billing (credit remaining days, charge new rate)
- Admin approval workflow with notification
- Auto-apply changes on approval (update customer package, adjust billing)

### Feature 4: Referral Program
- Create `referrals` table (referrer customer, referred customer, status, credit amount)
- Generate unique referral codes per customer
- Show referral link/code in Customer Portal
- Auto-apply bill credits when referred customer completes first payment
- Referral dashboard showing earned credits and referred customers

---

## Phase 3: Operational Excellence

### Feature 5: Contract & Agreement Management
- Create `contracts` table (customer, start date, end date, terms, auto-renew, early termination fee)
- Digital agreement templates with customer details auto-filled
- E-signature capture (canvas-based signature pad)
- Auto-renewal tracking and termination fee calculation
- PDF export of signed contracts

### Feature 6: Technician Mobile App / Field Service
- Create `service_tasks` table (type, customer, technician, status, GPS coordinates, notes)
- Task assignment interface for admins
- PWA-based mobile view for technicians (installable web app)
- Job completion with photo upload and customer signature
- GPS tracking of task locations on map

### Feature 7: Reseller/Sub-dealer Module
- Create `resellers` table and `reseller_customers` mapping
- Separate reseller login and dashboard
- Commission tracking (percentage per customer payment)
- Reseller can add/manage their own customers under the main ISP
- Consolidated reporting for the main ISP admin

---

## Phase 4: Growth & Intelligence

### Feature 8: AI-Powered Churn Prediction
- Analyze payment patterns (late payments, missed cycles)
- Track usage trends and ticket frequency
- Generate risk scores per customer (High/Medium/Low churn risk)
- Dashboard with at-risk customers and recommended retention actions
- Uses Lovable AI (Gemini) for pattern analysis -- no external API key needed

### Feature 9: Bandwidth Usage Monitoring (MikroTik)
- Pull traffic data from MikroTik routers via API
- Per-customer usage graphs (daily/weekly/monthly)
- Heavy user detection and alerts
- FUP (Fair Usage Policy) threshold configuration
- **Requires**: Real MikroTik router connection (not dummy mode)

---

## Recommended Starting Point

I suggest we begin with **Feature 2: Speed Test Integration** as it's self-contained, requires no external credentials, and provides immediate customer value. Then move to **Feature 3: Package Upgrade/Downgrade** and **Feature 4: Referral Program**.

For the **Online Payment Gateway**, you'll need to obtain SSLCommerz merchant credentials first, so we can set that up in parallel.

## Technical Notes
- Each feature will require new database tables (created via migrations)
- New pages/tabs in both admin dashboard and customer portal
- Backend functions for payment processing, AI analysis, and MikroTik communication
- All features will follow existing patterns: RLS policies, role-based access, real-time notifications

