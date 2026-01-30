/**
 * Billing Routes
 */

import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import { query, queryOne, withTransaction } from '../config/database.js';
import { authenticate, authenticateCron } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID } from '../utils/encryption.js';
import { formatDateForMySQL, logActivity, paginate, paginationResponse } from '../utils/helpers.js';

const router = Router();

/**
 * POST /api/billing/generate
 * Generate billing for expired customers (called by cron)
 */
router.post('/generate', authenticateCron, asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateForMySQL(today);

  console.log(`Running billing generation for date: ${todayStr}`);

  // Get customers with expired/expiring billing dates
  const customers = await query(
    `SELECT c.id, c.user_id, c.full_name, c.expiry_date, c.status, c.total_due,
            p.id as package_id, p.name as package_name, p.monthly_price, p.validity_days
     FROM customers c
     JOIN packages p ON c.package_id = p.id
     WHERE c.expiry_date <= ?
     AND c.status != 'suspended'`,
    [todayStr]
  );

  console.log(`Found ${customers.length} customers with expired/expiring billing dates`);

  const results = {
    processed: 0,
    billsGenerated: 0,
    billingRecordsCreated: 0,
    errors: [],
  };

  for (const customer of customers) {
    try {
      const expiryDate = new Date(customer.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);

      if (expiryDate > today) continue;

      const daysOverdue = Math.floor((today - expiryDate) / (1000 * 60 * 60 * 24));

      // Check if billing record already exists for this period
      const existingBill = await queryOne(
        `SELECT id FROM billing_records WHERE customer_id = ? AND billing_date = ?`,
        [customer.id, customer.expiry_date]
      );

      // Only generate bill if it doesn't exist yet
      if (!existingBill && daysOverdue >= 0) {
        await withTransaction(async (conn) => {
          // Create billing record
          await conn.execute(
            `INSERT INTO billing_records 
             (id, customer_id, billing_date, amount, package_name, status, amount_paid, due_date)
             VALUES (?, ?, ?, ?, ?, 'unpaid', 0, ?)`,
            [generateUUID(), customer.id, customer.expiry_date, customer.monthly_price, 
             customer.package_name, customer.expiry_date]
          );

          results.billingRecordsCreated++;

          // Add monthly price to total due (only on the exact expiry day)
          if (daysOverdue === 0) {
            const newTotalDue = customer.total_due + customer.monthly_price;

            await conn.execute(
              `UPDATE customers SET total_due = ?, status = 'expired', updated_at = NOW() WHERE id = ?`,
              [newTotalDue, customer.id]
            );

            console.log(`Generated bill for ${customer.user_id}: ৳${customer.monthly_price} added`);
            results.billsGenerated++;
          }
        });
      }

      // Update status for overdue customers
      if (daysOverdue > 0 && customer.status !== 'expired') {
        await query(
          `UPDATE customers SET status = 'expired', updated_at = NOW() WHERE id = ?`,
          [customer.id]
        );
      }

      results.processed++;
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      results.errors.push(`${customer.user_id}: ${errorMsg}`);
      console.error(`Error processing customer ${customer.user_id}:`, errorMsg);
    }
  }

  console.log('Billing generation completed:', results);

  res.json({
    success: true,
    message: `Processed ${results.processed} customers, generated ${results.billsGenerated} bills`,
    details: results,
  });
}));

/**
 * GET /api/billing/records
 * List billing records
 */
router.get('/records', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, customer_id, status, start_date, end_date } = req.query;
  const { limit: pageLimit, offset } = paginate(parseInt(page), parseInt(limit));

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (customer_id) {
    whereClause += ' AND b.customer_id = ?';
    params.push(customer_id);
  }

  if (status) {
    whereClause += ' AND b.status = ?';
    params.push(status);
  }

  if (start_date) {
    whereClause += ' AND b.billing_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND b.billing_date <= ?';
    params.push(end_date);
  }

  const [countResult] = await query(
    `SELECT COUNT(*) as total FROM billing_records b ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  const records = await query(
    `SELECT b.*, c.user_id as customer_user_id, c.full_name as customer_name
     FROM billing_records b
     JOIN customers c ON b.customer_id = c.id
     ${whereClause}
     ORDER BY b.billing_date DESC
     LIMIT ? OFFSET ?`,
    [...params, pageLimit, offset]
  );

  res.json(paginationResponse(records, total, parseInt(page), pageLimit));
}));

/**
 * GET /api/billing/records/:id
 * Get single billing record
 */
router.get('/records/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const record = await queryOne(
    `SELECT b.*, c.user_id as customer_user_id, c.full_name as customer_name
     FROM billing_records b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ?`,
    [req.params.id]
  );

  if (!record) {
    return res.status(404).json({ error: 'Billing record not found' });
  }

  res.json({ record });
}));

/**
 * GET /api/billing/customer/:customerId
 * Get billing history for a customer
 */
router.get('/customer/:customerId', authenticate, [
  param('customerId').isUUID(),
], asyncHandler(async (req, res) => {
  const records = await query(
    `SELECT * FROM billing_records 
     WHERE customer_id = ?
     ORDER BY billing_date DESC`,
    [req.params.customerId]
  );

  res.json({ records });
}));

/**
 * GET /api/billing/summary
 * Get billing summary
 */
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  
  let dateFilter = '';
  const params = [];
  
  if (month && year) {
    dateFilter = 'AND MONTH(billing_date) = ? AND YEAR(billing_date) = ?';
    params.push(parseInt(month), parseInt(year));
  }

  const summary = await query(
    `SELECT 
       status,
       COUNT(*) as count,
       SUM(amount) as total_amount,
       SUM(amount_paid) as total_paid,
       SUM(amount - amount_paid) as total_outstanding
     FROM billing_records
     WHERE 1=1 ${dateFilter}
     GROUP BY status`,
    params
  );

  const totals = await queryOne(
    `SELECT 
       COUNT(*) as total_records,
       COALESCE(SUM(amount), 0) as total_billed,
       COALESCE(SUM(amount_paid), 0) as total_collected,
       COALESCE(SUM(amount - amount_paid), 0) as total_outstanding
     FROM billing_records
     WHERE 1=1 ${dateFilter}`,
    params
  );

  res.json({
    byStatus: summary,
    totals,
  });
}));

export default router;
