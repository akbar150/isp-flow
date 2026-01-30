
# cPanel Migration Plan: EasyLink ISP Billing System

## Executive Summary

This plan migrates your ISP Billing application from Lovable Cloud (Supabase/PostgreSQL) to a cPanel VPS with Node.js and MySQL 8.0. The migration preserves all existing functionality while enabling unrestricted SMTP, SMS, and API access.

---

## Current Architecture Analysis

### What We're Migrating

```text
+------------------+          +------------------+
|    CURRENT       |    =>    |    TARGET        |
+------------------+          +------------------+
| React Frontend   |          | React Frontend   |
| Supabase Client  |          | Axios HTTP       |
| Edge Functions   |          | Express.js API   |
| PostgreSQL DB    |          | MySQL 8.0        |
| Supabase Auth    |          | JWT Auth + bcrypt|
| pg_cron          |          | cPanel Cron      |
+------------------+          +------------------+
```

### Components Inventory

| Component | Current | Target |
|-----------|---------|--------|
| Database | PostgreSQL (16 tables) | MySQL 8.0 |
| Auth | Supabase Auth | JWT + bcrypt |
| Edge Functions | 6 Deno functions | Express.js routes |
| Email | Brevo HTTP API (restricted) | Native SMTP or Brevo |
| SMS | RouteMobile API | RouteMobile API (unchanged) |
| WhatsApp | wa.me links | wa.me links (unchanged) |
| Cron Jobs | pg_cron | cPanel Scheduler |
| Frontend | React + Vite | React + Vite (static build) |

---

## Phase 1: Backend Development (Express.js API)

### 1.1 Project Structure

```text
backend/
├── src/
│   ├── config/
│   │   ├── database.js       # MySQL connection pool
│   │   ├── auth.js           # JWT configuration
│   │   └── email.js          # SMTP/Brevo config
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   ├── cors.js           # CORS handling
│   │   └── permissions.js    # Role-based access
│   ├── routes/
│   │   ├── auth.js           # Admin/Staff login
│   │   ├── customer-auth.js  # Customer portal auth
│   │   ├── users.js          # User management
│   │   ├── customers.js      # Customer CRUD
│   │   ├── packages.js       # Package management
│   │   ├── payments.js       # Payment processing
│   │   ├── billing.js        # Billing generation
│   │   ├── reminders.js      # Email/SMS sending
│   │   └── settings.js       # System settings
│   ├── services/
│   │   ├── email.service.js  # SMTP + Brevo fallback
│   │   ├── sms.service.js    # RouteMobile integration
│   │   └── billing.service.js# Billing logic
│   ├── utils/
│   │   ├── encryption.js     # AES encryption (passwords)
│   │   └── helpers.js        # Shared utilities
│   └── app.js                # Express application
├── .env                       # Environment variables
├── package.json
└── ecosystem.config.js        # PM2 configuration
```

### 1.2 Edge Function to Express Route Mapping

| Edge Function | Express Route | Purpose |
|---------------|---------------|---------|
| `customer-auth` | `/api/customer-auth` | Customer login, register, reset password |
| `manage-user` | `/api/users` | Admin/Staff user CRUD |
| `create-admin-user` | `/api/users/create-admin` | First admin setup |
| `generate-billing` | `/api/billing/generate` | Automated billing (cron) |
| `send-email-brevo` | `/api/email/send` | Email sending |
| `send-password-reset` | `/api/auth/reset-password` | Password reset emails |

### 1.3 Authentication System Replacement

**Current (Supabase Auth):**
- Uses `supabase.auth.signInWithPassword()`
- JWT tokens managed by Supabase
- Service role key for admin operations

**Target (Custom JWT):**
```javascript
// Login flow
1. User submits email/password
2. API verifies against users table (bcrypt)
3. API generates JWT with role claims
4. Frontend stores JWT in localStorage
5. All API requests include Authorization header
6. API middleware validates JWT on each request
```

**JWT Payload Structure:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "admin|staff|super_admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 1.4 Permission System Migration

The current permission system uses PostgreSQL functions:
- `has_role(user_id, role)`
- `has_permission(user_id, resource, action)`

**MySQL Equivalent:**
```sql
-- Stored procedure for permission check
DELIMITER //
CREATE FUNCTION has_permission(
  p_user_id CHAR(36),
  p_resource VARCHAR(50),
  p_action VARCHAR(50)
) RETURNS BOOLEAN
READS SQL DATA
BEGIN
  DECLARE has_perm BOOLEAN DEFAULT FALSE;
  
  SELECT EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN permissions p ON ur.role = p.role
    WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND p.action = p_action
    AND p.allowed = TRUE
  ) INTO has_perm;
  
  RETURN has_perm;
END //
DELIMITER ;
```

---

## Phase 2: Database Migration (PostgreSQL to MySQL)

### 2.1 Schema Conversion

**Key Differences:**
| PostgreSQL | MySQL |
|------------|-------|
| `uuid` | `CHAR(36)` with `UUID()` default |
| `JSONB` | `JSON` |
| `timestamp with time zone` | `DATETIME` |
| `text` | `VARCHAR(65535)` or `TEXT` |
| Custom ENUM types | MySQL ENUM |
| `gen_random_uuid()` | `UUID()` |

### 2.2 Table Migration Scripts

All 16 tables will be converted:

```sql
-- Example: customers table
CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  alt_phone VARCHAR(20),
  address TEXT NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  package_id CHAR(36),
  area_id CHAR(36),
  router_id CHAR(36),
  status ENUM('active', 'expiring', 'expired', 'suspended') DEFAULT 'active',
  expiry_date DATE NOT NULL,
  billing_start_date DATE DEFAULT (CURRENT_DATE),
  total_due DECIMAL(10,2) DEFAULT 0,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_expiry (expiry_date),
  INDEX idx_phone (phone),
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3 Data Migration Process

1. **Export from PostgreSQL** (via Supabase dashboard or pg_dump)
2. **Transform data** (UUID format, JSON syntax, date formats)
3. **Import to MySQL** (via phpMyAdmin or mysql CLI)

I will provide complete SQL scripts for all 16 tables with proper indexes and constraints.

---

## Phase 3: Frontend Modifications

### 3.1 API Client Replacement

**Current (`supabase` client):**
```typescript
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.from('customers').select('*');
```

**Target (Axios HTTP client):**
```typescript
import api from "@/lib/api";
const { data } = await api.get('/customers');
```

### 3.2 New API Client (`src/lib/api.ts`)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://isp.easylinkbd.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 3.3 Auth Hook Replacement (`src/hooks/useAuth.tsx`)

**Changes:**
- Remove Supabase auth listener
- Implement JWT token validation
- Store token in localStorage
- Add refresh token logic

### 3.4 Files Requiring Modification

| File | Changes Required |
|------|------------------|
| `src/integrations/supabase/client.ts` | Replace with `src/lib/api.ts` |
| `src/hooks/useAuth.tsx` | JWT-based auth |
| `src/pages/Auth.tsx` | API login endpoint |
| `src/pages/CustomerLogin.tsx` | API customer auth |
| `src/pages/Customers.tsx` | API CRUD operations |
| `src/pages/Packages.tsx` | API CRUD operations |
| `src/pages/Payments.tsx` | API CRUD operations |
| All other pages... | Similar API migrations |

---

## Phase 4: Email, SMS, and Integrations

### 4.1 Email Configuration (Unrestricted SMTP)

**Benefits on cPanel:**
- Direct SMTP access on ports 25, 465, 587
- No IP restrictions
- cPanel email accounts available

**Implementation:**
```javascript
// email.service.js
import nodemailer from 'nodemailer';

// Primary: cPanel SMTP
const cpanelTransport = nodemailer.createTransport({
  host: 'mail.easylinkbd.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Fallback: Brevo API
async function sendViaBrevо(to, subject, html) {
  // Existing Brevo implementation
}

// Send email with fallback
async function sendEmail(to, subject, html) {
  try {
    await cpanelTransport.sendMail({ from, to, subject, html });
  } catch (error) {
    console.log('SMTP failed, trying Brevo...');
    await sendViaBrevo(to, subject, html);
  }
}
```

### 4.2 SMS Integration (RouteMobile)

**No changes needed** - the SMS integration will work the same way via HTTP API calls from the Express backend.

### 4.3 WhatsApp Integration

**No changes needed** - wa.me links work identically from any domain.

---

## Phase 5: Cron Jobs

### 5.1 Billing Generation Cron

**Current (pg_cron):**
```sql
cron.schedule('daily-billing', '1 0 * * *', ...)
```

**Target (cPanel Cron Job):**
```bash
# Run daily at 12:01 AM
1 0 * * * /usr/bin/node /home/username/backend/src/jobs/generate-billing.js
```

**Alternative (curl-based):**
```bash
1 0 * * * curl -X POST https://isp.easylinkbd.com/api/billing/generate \
  -H "Authorization: Bearer $CRON_SECRET_KEY"
```

---

## Phase 6: cPanel Deployment

### 6.1 Directory Structure on cPanel

```text
/home/username/
├── public_html/              # React build (frontend)
│   ├── index.html
│   ├── assets/
│   └── ...
├── backend/                  # Node.js API
│   ├── src/
│   ├── node_modules/
│   ├── .env
│   └── ecosystem.config.js
└── logs/                     # Application logs
```

### 6.2 Node.js Application Setup

1. **SSH into server** or use cPanel Terminal
2. **Navigate to backend folder**
3. **Install dependencies:** `npm install`
4. **Configure PM2:** `pm2 start ecosystem.config.js`
5. **Enable PM2 startup:** `pm2 startup`

### 6.3 Domain Configuration

```text
Main domain: isp.easylinkbd.com
├── / (root)     -> public_html (React frontend)
└── /api/*       -> Proxy to Node.js (port 3001)
```

**Apache .htaccess (ProxyPass):**
```apache
RewriteEngine On

# Proxy API requests to Node.js
RewriteRule ^api/(.*)$ http://127.0.0.1:3001/api/$1 [P,L]

# Serve React app for all other routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## Phase 7: Environment Variables

### 7.1 Backend `.env` File

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DB_HOST=localhost
DB_USER=username_isp
DB_PASS=secure_password
DB_NAME=username_isp_billing

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=7d

# Email (cPanel SMTP)
SMTP_HOST=mail.easylinkbd.com
SMTP_PORT=587
SMTP_USER=noreply@easylinkbd.com
SMTP_PASS=smtp_password

# Brevo Fallback
BREVO_API_KEY=xkeysib-...

# SMS (RouteMobile)
ROUTEMOBILE_USERNAME=your_username
ROUTEMOBILE_PASSWORD=your_password
ROUTEMOBILE_SENDER_ID=EasyLink

# Encryption
ENCRYPTION_KEY=32-byte-encryption-key

# Cron Secret
CRON_SECRET_KEY=random-secret-for-cron-auth
```

### 7.2 Frontend `.env` File

```env
VITE_API_URL=https://isp.easylinkbd.com/api
VITE_APP_NAME=EasyLink ISP Billing
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current Supabase database (export all tables)
- [ ] Document all system_settings values
- [ ] Export user accounts and roles
- [ ] Test MySQL connection on cPanel

### Backend Development
- [ ] Create Express.js project structure
- [ ] Implement authentication middleware
- [ ] Convert all 6 Edge Functions to routes
- [ ] Set up MySQL connection pool
- [ ] Implement permission system
- [ ] Add email service with SMTP

### Database Migration
- [ ] Create all 16 MySQL tables
- [ ] Set up foreign keys and indexes
- [ ] Migrate data from PostgreSQL
- [ ] Verify data integrity
- [ ] Create MySQL stored procedures

### Frontend Modifications
- [ ] Create API client library
- [ ] Update useAuth hook
- [ ] Modify Auth.tsx for JWT login
- [ ] Update CustomerLogin.tsx
- [ ] Convert all Supabase queries
- [ ] Test all CRUD operations

### Deployment
- [ ] Upload backend to cPanel
- [ ] Configure PM2
- [ ] Build React app
- [ ] Upload to public_html
- [ ] Configure .htaccess
- [ ] Set up SSL certificate
- [ ] Configure cron jobs

### Post-Migration Testing
- [ ] Test admin login
- [ ] Test customer login
- [ ] Test all CRUD operations
- [ ] Test email sending
- [ ] Test SMS sending
- [ ] Verify billing generation
- [ ] Test permission system

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Full backup before migration |
| Authentication issues | High | Thorough testing of JWT flow |
| Permission system gaps | Medium | Re-implement all RLS as middleware |
| SMTP deliverability | Medium | Keep Brevo as fallback |
| Node.js memory limits | Low | PM2 cluster mode |

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Backend Development | 3-4 days |
| Database Migration | 1-2 days |
| Frontend Modifications | 2-3 days |
| Testing & Bug Fixes | 2-3 days |
| Deployment | 1 day |
| **Total** | **9-13 days** |

---

## Technical Notes

### What Changes
1. Database engine (PostgreSQL to MySQL)
2. Backend runtime (Deno Edge Functions to Node.js)
3. Authentication (Supabase Auth to JWT)
4. API client (Supabase SDK to Axios)

### What Stays the Same
1. All UI components and layouts
2. Business logic and workflows
3. WhatsApp message formatting
4. SMS integration (RouteMobile)
5. Email templates (HTML content)
6. Permission matrix structure
7. Billing calculation logic

### Branding Updates
- All "Lovable" references will be replaced with "EasyLink"
- Custom favicon and logos remain unchanged

