/**
 * Reports Routes
 */

import { Router } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/reports/dashboard
 * Dashboard summary statistics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  // Customer stats
  const customerStats = await queryOne(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN status = 'expiring' THEN 1 ELSE 0 END) as expiring,
       SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
       SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended
     FROM customers`
  );

  // Revenue this month
  const monthlyRevenue = await queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM payments
     WHERE payment_date >= ? AND payment_date <= ?`,
    [monthStart, monthEnd]
  );

  // Today's collections
  const todayCollections = await queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM payments
     WHERE payment_date = ?`,
    [todayStr]
  );

  // Total outstanding
  const outstanding = await queryOne(
    `SELECT COALESCE(SUM(total_due), 0) as total FROM customers`
  );

  // Expiring soon (next 7 days)
  const expiringWeek = format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const expiringSoon = await queryOne(
    `SELECT COUNT(*) as count
     FROM customers
     WHERE expiry_date <= ? AND expiry_date >= ? AND status != 'suspended'`,
    [expiringWeek, todayStr]
  );

  // New customers this month
  const newCustomers = await queryOne(
    `SELECT COUNT(*) as count
     FROM customers
     WHERE created_at >= ?`,
    [monthStart]
  );

  res.json({
    customers: customerStats,
    revenue: {
      monthly: monthlyRevenue.total,
      today: todayCollections.total,
      todayCount: todayCollections.count,
    },
    outstanding: outstanding.total,
    expiringSoon: expiringSoon.count,
    newCustomersThisMonth: newCustomers.count,
  });
}));

/**
 * GET /api/reports/revenue
 * Revenue report by date range
 */
router.get('/revenue', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const { start_date, end_date, group_by = 'day' } = req.query;

  const startDate = start_date || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = end_date || format(new Date(), 'yyyy-MM-dd');

  let groupFormat;
  switch (group_by) {
    case 'month':
      groupFormat = '%Y-%m';
      break;
    case 'week':
      groupFormat = '%Y-%u';
      break;
    default:
      groupFormat = '%Y-%m-%d';
  }

  const revenue = await query(
    `SELECT 
       DATE_FORMAT(payment_date, ?) as period,
       method,
       COUNT(*) as count,
       SUM(amount) as total
     FROM payments
     WHERE payment_date >= ? AND payment_date <= ?
     GROUP BY period, method
     ORDER BY period ASC, method`,
    [groupFormat, startDate, endDate]
  );

  const totals = await queryOne(
    `SELECT 
       COUNT(*) as total_transactions,
       COALESCE(SUM(amount), 0) as total_revenue
     FROM payments
     WHERE payment_date >= ? AND payment_date <= ?`,
    [startDate, endDate]
  );

  const byMethod = await query(
    `SELECT 
       method,
       COUNT(*) as count,
       SUM(amount) as total
     FROM payments
     WHERE payment_date >= ? AND payment_date <= ?
     GROUP BY method`,
    [startDate, endDate]
  );

  res.json({
    data: revenue,
    totals,
    byMethod,
    dateRange: { startDate, endDate },
  });
}));

/**
 * GET /api/reports/customers
 * Customer statistics report
 */
router.get('/customers', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  // By status
  const byStatus = await query(
    `SELECT status, COUNT(*) as count
     FROM customers
     GROUP BY status`
  );

  // By area
  const byArea = await query(
    `SELECT 
       COALESCE(a.name, 'Unassigned') as area,
       COUNT(c.id) as count
     FROM customers c
     LEFT JOIN areas a ON c.area_id = a.id
     GROUP BY a.id, a.name
     ORDER BY count DESC`
  );

  // By package
  const byPackage = await query(
    `SELECT 
       COALESCE(p.name, 'No Package') as package_name,
       p.monthly_price,
       COUNT(c.id) as count
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     GROUP BY p.id, p.name, p.monthly_price
     ORDER BY count DESC`
  );

  // Monthly growth
  const monthlyGrowth = await query(
    `SELECT 
       DATE_FORMAT(created_at, '%Y-%m') as month,
       COUNT(*) as new_customers
     FROM customers
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month
     ORDER BY month ASC`
  );

  res.json({
    byStatus,
    byArea,
    byPackage,
    monthlyGrowth,
  });
}));

/**
 * GET /api/reports/outstanding
 * Outstanding dues report
 */
router.get('/outstanding', requirePermission('reports', 'read'), asyncHandler(async (req, res) => {
  const customers = await query(
    `SELECT 
       c.id, c.user_id, c.full_name, c.phone, c.total_due, c.expiry_date, c.status,
       p.name as package_name,
       a.name as area_name
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     LEFT JOIN areas a ON c.area_id = a.id
     WHERE c.total_due > 0
     ORDER BY c.total_due DESC`
  );

  const summary = await queryOne(
    `SELECT 
       COUNT(*) as customer_count,
       COALESCE(SUM(total_due), 0) as total_outstanding
     FROM customers
     WHERE total_due > 0`
  );

  res.json({
    customers,
    summary,
  });
}));

/**
 * GET /api/reports/expiry
 * Expiry report
 */
router.get('/expiry', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const today = new Date();
  const futureDate = format(new Date(today.getTime() + parseInt(days) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  // Expiring in next X days
  const expiring = await query(
    `SELECT 
       c.id, c.user_id, c.full_name, c.phone, c.expiry_date, c.total_due, c.status,
       p.name as package_name,
       DATEDIFF(c.expiry_date, CURRENT_DATE) as days_until_expiry
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.expiry_date >= ? AND c.expiry_date <= ?
     AND c.status != 'suspended'
     ORDER BY c.expiry_date ASC`,
    [todayStr, futureDate]
  );

  // Already expired
  const expired = await query(
    `SELECT 
       c.id, c.user_id, c.full_name, c.phone, c.expiry_date, c.total_due, c.status,
       p.name as package_name,
       DATEDIFF(CURRENT_DATE, c.expiry_date) as days_overdue
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.expiry_date < ?
     AND c.status != 'suspended'
     ORDER BY c.expiry_date ASC
     LIMIT 100`,
    [todayStr]
  );

  res.json({
    expiring,
    expired,
    summary: {
      expiringCount: expiring.length,
      expiredCount: expired.length,
    },
  });
}));

export default router;
