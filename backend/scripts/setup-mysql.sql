-- =====================================================
-- MySQL Database Setup Script for EasyLink ISP Billing
-- Run this BEFORE the migration script
-- =====================================================

-- Create database (run as root/admin user)
-- CREATE DATABASE IF NOT EXISTS easylink_isp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE easylink_isp;

-- =====================================================
-- ENUM TYPES (MySQL uses inline ENUM)
-- =====================================================

-- =====================================================
-- TABLES (in order of dependencies)
-- =====================================================

-- Areas/Zones
CREATE TABLE IF NOT EXISTS areas (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Internet Packages
CREATE TABLE IF NOT EXISTS packages (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  speed_mbps INT NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL,
  validity_days INT DEFAULT 30,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MikroTik Routers
CREATE TABLE IF NOT EXISTS routers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  port INT DEFAULT 8728,
  username VARCHAR(255),
  password_encrypted TEXT,
  mode ENUM('dummy', 'real') DEFAULT 'dummy',
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions Matrix
CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) PRIMARY KEY,
  role ENUM('admin', 'staff', 'super_admin') NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  allowed TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_permission (role, resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
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
  auto_renew TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_expiry (expiry_date),
  INDEX idx_phone (phone),
  INDEX idx_area (area_id),
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MikroTik PPPoE Users
CREATE TABLE IF NOT EXISTS mikrotik_users (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_encrypted TEXT NOT NULL,
  profile VARCHAR(255),
  router_id CHAR(36),
  status ENUM('enabled', 'disabled') DEFAULT 'enabled',
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing Records
CREATE TABLE IF NOT EXISTS billing_records (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  billing_date DATE DEFAULT (CURRENT_DATE),
  due_date DATE NOT NULL,
  paid_date DATE,
  package_name VARCHAR(255) NOT NULL,
  status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('bkash', 'cash', 'bank_transfer', 'due') NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  transaction_id VARCHAR(255),
  notes TEXT,
  remaining_due DECIMAL(10,2) DEFAULT 0,
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_date (payment_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call Records
CREATE TABLE IF NOT EXISTS call_records (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  notes TEXT NOT NULL,
  call_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  called_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_date (call_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reminder Logs
CREATE TABLE IF NOT EXISTS reminder_logs (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  reminder_type ENUM('3_days_before', '1_day_before', 'expiry_day', '3_days_overdue') NOT NULL,
  channel VARCHAR(50) DEFAULT 'whatsapp',
  message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_by CHAR(36),
  INDEX idx_customer (customer_id),
  INDEX idx_type (reminder_type),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions (Income/Expense)
CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY,
  type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category_id CHAR(36),
  description TEXT,
  payment_method VARCHAR(50) NOT NULL,
  reference_id VARCHAR(255),
  transaction_date DATE DEFAULT (CURRENT_DATE),
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_date (transaction_date),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Profiles (for admin/staff users)
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  password_hash VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'staff', 'super_admin') DEFAULT 'staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50),
  entity_id CHAR(36),
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STORED FUNCTIONS (replacing PostgreSQL functions)
-- =====================================================

DELIMITER //

-- Check if user has a specific role
CREATE FUNCTION IF NOT EXISTS has_role(p_user_id CHAR(36), p_role VARCHAR(20))
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE result BOOLEAN DEFAULT FALSE;
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = p_role
  ) INTO result;
  RETURN result;
END //

-- Check if user has permission for resource/action
CREATE FUNCTION IF NOT EXISTS has_permission(
  p_user_id CHAR(36),
  p_resource VARCHAR(50),
  p_action VARCHAR(50)
)
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE result BOOLEAN DEFAULT FALSE;
  SELECT EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN permissions p ON ur.role = p.role
    WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND p.action = p_action
    AND p.allowed = 1
  ) INTO result;
  RETURN result;
END //

-- Generate customer user ID (ISP00001 format)
CREATE FUNCTION IF NOT EXISTS generate_customer_user_id()
RETURNS VARCHAR(20)
READS SQL DATA
BEGIN
  DECLARE next_num INT;
  DECLARE new_id VARCHAR(20);
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0) + 1
  INTO next_num
  FROM customers;
  
  SET new_id = CONCAT('ISP', LPAD(next_num, 5, '0'));
  RETURN new_id;
END //

DELIMITER ;

-- =====================================================
-- TRIGGERS
-- =====================================================

DELIMITER //

-- Update customer due when payment is made
CREATE TRIGGER IF NOT EXISTS update_customer_due_on_payment
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  UPDATE customers
  SET total_due = GREATEST(0, total_due - NEW.amount)
  WHERE id = NEW.customer_id;
END //

DELIMITER ;

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default permissions
INSERT IGNORE INTO permissions (id, role, resource, action, allowed) VALUES
  (UUID(), 'super_admin', 'customers', 'create', 1),
  (UUID(), 'super_admin', 'customers', 'read', 1),
  (UUID(), 'super_admin', 'customers', 'update', 1),
  (UUID(), 'super_admin', 'customers', 'delete', 1),
  (UUID(), 'admin', 'customers', 'create', 1),
  (UUID(), 'admin', 'customers', 'read', 1),
  (UUID(), 'admin', 'customers', 'update', 1),
  (UUID(), 'admin', 'customers', 'delete', 1),
  (UUID(), 'staff', 'customers', 'create', 1),
  (UUID(), 'staff', 'customers', 'read', 1),
  (UUID(), 'staff', 'customers', 'update', 0),
  (UUID(), 'staff', 'customers', 'delete', 0),
  (UUID(), 'super_admin', 'payments', 'create', 1),
  (UUID(), 'super_admin', 'payments', 'read', 1),
  (UUID(), 'admin', 'payments', 'create', 1),
  (UUID(), 'admin', 'payments', 'read', 1),
  (UUID(), 'staff', 'payments', 'create', 1),
  (UUID(), 'staff', 'payments', 'read', 1);

SELECT 'MySQL schema setup complete!' AS status;
