# EasyLink ISP Billing System - cPanel Deployment Guide

## Prerequisites

- cPanel VPS with SSH access
- Node.js 18+ (via cPanel Node.js Selector or manually installed)
- MySQL 8.0+
- Domain configured: `isp.easylinkbd.com`
- SSL certificate (Let's Encrypt via cPanel)

---

## Step 1: Database Setup

### 1.1 Create MySQL Database

1. Login to cPanel → **MySQL Databases**
2. Create new database: `your_username_isp`
3. Create database user with strong password
4. Add user to database with **ALL PRIVILEGES**

### 1.2 Import Schema

```bash
# Via SSH
mysql -u username_isp -p database_name < backend/database/schema.sql

# Or via phpMyAdmin: Import → Select schema.sql
```

### 1.3 Create First Admin User

Run this SQL in phpMyAdmin or via CLI:

```sql
-- Replace with your actual values
SET @user_id = UUID();
SET @email = 'admin@easylinkbd.com';
-- Password: admin123 (change immediately after first login!)
SET @password_hash = '$2a$10$your_bcrypt_hash_here';

INSERT INTO users (id, email, password_hash, is_active) 
VALUES (@user_id, @email, @password_hash, TRUE);

INSERT INTO profiles (id, user_id, full_name) 
VALUES (UUID(), @user_id, 'Super Admin');

INSERT INTO user_roles (id, user_id, role) 
VALUES (UUID(), @user_id, 'super_admin');
```

To generate password hash, use this Node.js script:
```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your_password', 10));
```

---

## Step 2: Backend Deployment

### 2.1 Upload Files

Upload the `backend/` folder to your home directory:

```
/home/username/backend/
├── src/
├── package.json
├── ecosystem.config.js
└── .env
```

### 2.2 Configure Environment

Create `/home/username/backend/.env`:

```env
# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://isp.easylinkbd.com

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=username_isp
DB_PASS=your_secure_password
DB_NAME=username_isp_billing

# JWT (generate strong secrets!)
JWT_SECRET=your-256-bit-secret-change-this
JWT_EXPIRES_IN=7d

# Email (cPanel SMTP)
SMTP_HOST=mail.easylinkbd.com
SMTP_PORT=587
SMTP_USER=noreply@easylinkbd.com
SMTP_PASS=email_password

# Brevo Fallback (optional)
BREVO_API_KEY=xkeysib-your-key

# Encryption (32 bytes)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Cron Authentication
CRON_SECRET_KEY=random-secret-for-cron-jobs
```

### 2.3 Install Dependencies

```bash
cd /home/username/backend
npm install --production
```

### 2.4 Start with PM2

```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Start application
cd /home/username/backend
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Enable PM2 startup on reboot
pm2 startup
# Run the command it outputs
```

### 2.5 Verify Backend

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok",...}
```

---

## Step 3: Frontend Deployment

### 3.1 Build React App

On your local machine:

```bash
# Update .env for production
echo "VITE_API_URL=https://isp.easylinkbd.com/api" > .env.production

# Build
npm run build
```

### 3.2 Upload to public_html

Upload contents of `dist/` folder to:

```
/home/username/public_html/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── ...
```

---

## Step 4: Apache Configuration

### 4.1 Create .htaccess

Create `/home/username/public_html/.htaccess`:

```apache
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Proxy API requests to Node.js backend
RewriteRule ^api/(.*)$ http://127.0.0.1:3001/api/$1 [P,L]

# React Router - serve index.html for all other routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
  AddOutputFilterByType DEFLATE application/javascript application/json
</IfModule>
```

### 4.2 Enable mod_proxy (if needed)

Contact your hosting provider or use WHM to enable:
- `mod_proxy`
- `mod_proxy_http`

---

## Step 5: Cron Jobs

### 5.1 Billing Generation

In cPanel → **Cron Jobs**, add:

```
# Daily billing generation at 12:01 AM
1 0 * * * curl -X POST https://isp.easylinkbd.com/api/billing/generate -H "X-Cron-Secret: your_cron_secret"
```

### 5.2 Customer Status Update (Optional)

```
# Update customer statuses every 6 hours
0 */6 * * * curl -X POST https://isp.easylinkbd.com/api/billing/update-statuses -H "X-Cron-Secret: your_cron_secret"
```

---

## Step 6: Email Configuration

### 6.1 cPanel Email Accounts

1. Go to cPanel → **Email Accounts**
2. Create: `noreply@easylinkbd.com`
3. Note the password for `.env` configuration

### 6.2 SPF & DKIM Records

Add DNS records for better email deliverability:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 a mx include:_spf.your-server.com ~all
```

**DKIM:** Enable via cPanel → Email Deliverability

---

## Step 7: SSL Certificate

### 7.1 Let's Encrypt (AutoSSL)

1. Go to cPanel → **SSL/TLS Status**
2. Click **Run AutoSSL**
3. Wait for certificate to be issued

### 7.2 Force HTTPS

Already configured in `.htaccess` above.

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs easylink-api

# Check if port is in use
netstat -tlnp | grep 3001

# Restart
pm2 restart easylink-api
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u username_isp -p database_name -e "SELECT 1"

# Check .env credentials
cat /home/username/backend/.env | grep DB_
```

### API Returning 503

- Check if mod_proxy is enabled
- Verify PM2 is running: `pm2 status`
- Check Apache error logs: `/var/log/apache2/error.log`

### CORS Errors

- Verify `CORS_ORIGIN` in `.env` matches your domain
- Check browser console for specific CORS error messages

---

## Maintenance

### Update Application

```bash
# Stop PM2
pm2 stop easylink-api

# Upload new files

# Install dependencies
npm install --production

# Restart
pm2 restart easylink-api
```

### Database Backup

```bash
# Create backup
mysqldump -u username_isp -p database_name > backup_$(date +%Y%m%d).sql

# Or via cPanel → Backup → Download a MySQL Database Backup
```

### Log Rotation

PM2 handles log rotation automatically. Check logs:

```bash
pm2 logs easylink-api --lines 100
```

---

## Security Checklist

- [ ] Strong database password
- [ ] Unique JWT_SECRET (256+ bits)
- [ ] Unique ENCRYPTION_KEY (32 bytes)
- [ ] Unique CRON_SECRET_KEY
- [ ] SSL certificate active
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Regular database backups
- [ ] PM2 monitoring enabled

---

## Support

For issues, check:
1. PM2 logs: `pm2 logs easylink-api`
2. Apache error logs: `/var/log/apache2/error.log`
3. MySQL logs: `/var/log/mysql/error.log`

Contact: support@easylinkbd.com
