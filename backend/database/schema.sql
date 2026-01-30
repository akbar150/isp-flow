-- =====================================================
-- EasyLink ISP Billing System - MySQL 8.0 Schema
-- =====================================================
-- Run this script to create all tables and initial data
-- =====================================================

-- Set character set
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================================
-- 1. USERS AND AUTHENTICATION
-- =====================================================

-- Users table (for admin/staff accounts)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  full_name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  role ENUM('super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  role ENUM('super_admin', 'admin', 'staff') NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_role_resource_action (role, resource, action),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. CORE BUSINESS TABLES
-- =====================================================

-- Areas/Zones
CREATE TABLE IF NOT EXISTS areas (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Routers (MikroTik)
CREATE TABLE IF NOT EXISTS routers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  mode ENUM('dummy', 'real') DEFAULT 'dummy',
  ip_address VARCHAR(45),
  port INT DEFAULT 8728,
  username VARCHAR(100),
  password_encrypted TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Packages
CREATE TABLE IF NOT EXISTS packages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  speed_mbps INT NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL,
  validity_days INT DEFAULT 30,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_active (is_active),
  INDEX idx_price (monthly_price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  alt_phone VARCHAR(20),
  email VARCHAR(255),
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
  
  INDEX idx_user_id (user_id),
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_expiry (expiry_date),
  INDEX idx_area (area_id),
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MikroTik Users (PPPoE credentials)
CREATE TABLE IF NOT EXISTS mikrotik_users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_encrypted VARCHAR(255) NOT NULL,
  router_id CHAR(36),
  profile VARCHAR(100),
  status ENUM('enabled', 'disabled') DEFAULT 'enabled',
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_customer (customer_id),
  INDEX idx_username (username),
  INDEX idx_status (status),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. FINANCIAL TABLES
-- =====================================================

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  method ENUM('bkash', 'cash', 'bank_transfer', 'due') NOT NULL,
  transaction_id VARCHAR(100),
  notes TEXT,
  remaining_due DECIMAL(10,2) DEFAULT 0,
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_customer (customer_id),
  INDEX idx_date (payment_date),
  INDEX idx_method (method),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing Records
CREATE TABLE IF NOT EXISTS billing_records (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  billing_date DATE DEFAULT (CURRENT_DATE),
  amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  package_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'unpaid',
  due_date DATE NOT NULL,
  paid_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_customer (customer_id),
  INDEX idx_billing_date (billing_date),
  INDEX idx_status (status),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions (for accounting)
CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  description TEXT,
  category_id CHAR(36),
  reference_id VARCHAR(100),
  transaction_date DATE DEFAULT (CURRENT_DATE),
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type (type),
  INDEX idx_date (transaction_date),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. COMMUNICATION & LOGGING
-- =====================================================

-- Call Records
CREATE TABLE IF NOT EXISTS call_records (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  call_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NOT NULL,
  called_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_customer (customer_id),
  INDEX idx_date (call_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reminder Logs
CREATE TABLE IF NOT EXISTS reminder_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  reminder_type ENUM('3_days_before', '1_day_before', 'expiry_day', '3_days_overdue') NOT NULL,
  channel VARCHAR(20) DEFAULT 'whatsapp',
  message TEXT,
  sent_by CHAR(36),
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_customer (customer_id),
  INDEX idx_sent_at (sent_at),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id CHAR(36),
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. SYSTEM SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `key` VARCHAR(100) NOT NULL UNIQUE,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. STORED FUNCTIONS
-- =====================================================

DELIMITER //

-- Check if user has specific role
CREATE FUNCTION IF NOT EXISTS has_role(p_user_id CHAR(36), p_role VARCHAR(20))
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE has_it BOOLEAN DEFAULT FALSE;
  SELECT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = p_role
  ) INTO has_it;
  RETURN has_it;
END //

-- Check if user has permission
CREATE FUNCTION IF NOT EXISTS has_permission(p_user_id CHAR(36), p_resource VARCHAR(50), p_action VARCHAR(50))
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE has_perm BOOLEAN DEFAULT FALSE;
  
  -- Super admin always has permission
  IF has_role(p_user_id, 'super_admin') THEN
    RETURN TRUE;
  END IF;
  
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

-- =====================================================
-- 7. INITIAL DATA
-- =====================================================

-- Insert default permissions for staff role
INSERT INTO permissions (id, role, resource, action, allowed) VALUES
  (UUID(), 'staff', 'customers', 'read', TRUE),
  (UUID(), 'staff', 'customers', 'create', TRUE),
  (UUID(), 'staff', 'customers', 'update', FALSE),
  (UUID(), 'staff', 'customers', 'delete', FALSE),
  (UUID(), 'staff', 'packages', 'read', TRUE),
  (UUID(), 'staff', 'packages', 'create', FALSE),
  (UUID(), 'staff', 'packages', 'update', FALSE),
  (UUID(), 'staff', 'packages', 'delete', FALSE),
  (UUID(), 'staff', 'payments', 'read', TRUE),
  (UUID(), 'staff', 'payments', 'create', TRUE),
  (UUID(), 'staff', 'reminders', 'read', TRUE),
  (UUID(), 'staff', 'reminders', 'create', TRUE),
  (UUID(), 'staff', 'call_records', 'read', TRUE),
  (UUID(), 'staff', 'call_records', 'create', TRUE),
  (UUID(), 'staff', 'routers', 'read', TRUE),
  (UUID(), 'staff', 'settings', 'read', FALSE),
  (UUID(), 'staff', 'reports', 'read', FALSE),
  (UUID(), 'staff', 'transactions', 'read', FALSE)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

-- Insert default permissions for admin role
INSERT INTO permissions (id, role, resource, action, allowed) VALUES
  (UUID(), 'admin', 'customers', 'read', TRUE),
  (UUID(), 'admin', 'customers', 'create', TRUE),
  (UUID(), 'admin', 'customers', 'update', TRUE),
  (UUID(), 'admin', 'customers', 'delete', TRUE),
  (UUID(), 'admin', 'packages', 'read', TRUE),
  (UUID(), 'admin', 'packages', 'create', TRUE),
  (UUID(), 'admin', 'packages', 'update', TRUE),
  (UUID(), 'admin', 'packages', 'delete', TRUE),
  (UUID(), 'admin', 'payments', 'read', TRUE),
  (UUID(), 'admin', 'payments', 'create', TRUE),
  (UUID(), 'admin', 'payments', 'delete', TRUE),
  (UUID(), 'admin', 'reminders', 'read', TRUE),
  (UUID(), 'admin', 'reminders', 'create', TRUE),
  (UUID(), 'admin', 'call_records', 'read', TRUE),
  (UUID(), 'admin', 'call_records', 'create', TRUE),
  (UUID(), 'admin', 'routers', 'read', TRUE),
  (UUID(), 'admin', 'routers', 'create', TRUE),
  (UUID(), 'admin', 'routers', 'update', TRUE),
  (UUID(), 'admin', 'routers', 'delete', TRUE),
  (UUID(), 'admin', 'settings', 'read', TRUE),
  (UUID(), 'admin', 'settings', 'update', TRUE),
  (UUID(), 'admin', 'reports', 'read', TRUE),
  (UUID(), 'admin', 'transactions', 'read', TRUE),
  (UUID(), 'admin', 'transactions', 'create', TRUE)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

-- Insert default system settings
INSERT INTO system_settings (id, `key`, value) VALUES
  (UUID(), 'isp_name', '"EasyLink ISP"'),
  (UUID(), 'email_from_name', '"EasyLink ISP"'),
  (UUID(), 'email_from_address', '"noreply@easylinkbd.com"')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- NOTES FOR MIGRATION:
-- 
-- 1. Export data from PostgreSQL using:
--    pg_dump -h host -U user -d database --data-only --inserts > data.sql
--
-- 2. Transform the data:
--    - Convert gen_random_uuid() to UUID()
--    - Convert timestamp with time zone to DATETIME
--    - Ensure JSON format compatibility
--
-- 3. Import using:
--    mysql -h host -u user -p database < schema.sql
--    mysql -h host -u user -p database < data.sql
-- =====================================================
