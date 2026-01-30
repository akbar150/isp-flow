/**
 * Payments Routes
 */

import { Router } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query, queryOne, withTransaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID } from '../utils/encryption.js';
import { 
  formatDateForMySQL, 
  logActivity, 
  paginate, 
  paginationResponse 
} from '../utils/helpers.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/payments
 * List payments with filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, customer_id, method, search, start_date, end_date } = req.query;
  const { limit: pageLimit, offset } = paginate(parseInt(page), parseInt(limit));

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (customer_id) {
    whereClause += ' AND p.customer_id = ?';
    params.push(customer_id);
  }

  if (method) {
    whereClause += ' AND p.method = ?';
    params.push(method);
  }

  if (search) {
    whereClause += ' AND (c.full_name LIKE ? OR c.user_id LIKE ? OR p.transaction_id LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (start_date) {
    whereClause += ' AND p.payment_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND p.payment_date <= ?';
    params.push(end_date);
  }

  // Get total count
  const [countResult] = await query(
    `SELECT COUNT(*) as total 
     FROM payments p
     JOIN customers c ON p.customer_id = c.id
     ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Get payments
  const payments = await query(
    `SELECT p.*, c.user_id as customer_user_id, c.full_name as customer_name
     FROM payments p
     JOIN customers c ON p.customer_id = c.id
     ${whereClause}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageLimit, offset]
  );

  res.json(paginationResponse(payments, total, parseInt(page), pageLimit));
}));

/**
 * GET /api/payments/:id
 * Get single payment
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const payment = await queryOne(
    `SELECT p.*, c.user_id as customer_user_id, c.full_name as customer_name
     FROM payments p
     JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    [req.params.id]
  );

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  res.json({ payment });
}));

/**
 * POST /api/payments
 * Record new payment
 */
router.post('/', [
  body('customer_id').isUUID(),
  body('amount').isFloat({ min: 0.01, max: 999999 }),
  body('method').isIn(['bkash', 'cash', 'bank_transfer', 'due']),
  body('transaction_id').optional().isLength({ max: 100 }),
  body('notes').optional().isLength({ max: 500 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { customer_id, amount, method, transaction_id, notes } = req.body;

  // Get customer
  const customer = await queryOne(
    `SELECT id, user_id, full_name, total_due FROM customers WHERE id = ?`,
    [customer_id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Validate transaction ID for electronic payments
  if (['bkash', 'bank_transfer'].includes(method) && !transaction_id?.trim()) {
    return res.status(400).json({ error: 'Transaction ID is required for bKash and Bank Transfer' });
  }

  const paymentId = generateUUID();
  const remainingDue = Math.max(0, customer.total_due - amount);

  await withTransaction(async (conn) => {
    // Create payment record
    await conn.execute(
      `INSERT INTO payments (id, customer_id, amount, method, transaction_id, notes, remaining_due, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, customer_id, amount, method, transaction_id || null, notes || null, remainingDue, req.user.id]
    );

    // Update customer total_due
    await conn.execute(
      `UPDATE customers SET total_due = GREATEST(0, total_due - ?), updated_at = NOW() WHERE id = ?`,
      [amount, customer_id]
    );

    // Update billing records if applicable
    await conn.execute(
      `UPDATE billing_records 
       SET amount_paid = amount_paid + ?, 
           status = CASE WHEN amount_paid + ? >= amount THEN 'paid' ELSE status END,
           paid_date = CASE WHEN amount_paid + ? >= amount THEN CURRENT_DATE ELSE paid_date END,
           updated_at = NOW()
       WHERE customer_id = ? AND status != 'paid'
       ORDER BY billing_date ASC
       LIMIT 1`,
      [amount, amount, amount, customer_id]
    );

    // Create transaction record for accounting
    await conn.execute(
      `INSERT INTO transactions (id, type, amount, payment_method, description, reference_id, created_by)
       VALUES (?, 'income', ?, ?, ?, ?, ?)`,
      [generateUUID(), amount, method, `Payment from ${customer.user_id}`, paymentId, req.user.id]
    );
  });

  await logActivity(req.user.id, 'record_payment', 'payment', paymentId, {
    customer_id,
    amount,
    method,
  });

  res.status(201).json({
    message: 'Payment recorded successfully',
    payment: { id: paymentId, amount, method, remaining_due: remainingDue },
  });
}));

/**
 * DELETE /api/payments/:id
 * Delete payment (admin only, reverses the payment)
 */
router.delete('/:id', requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await queryOne(
    `SELECT p.*, c.user_id as customer_user_id
     FROM payments p
     JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    [id]
  );

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  await withTransaction(async (conn) => {
    // Restore customer total_due
    await conn.execute(
      `UPDATE customers SET total_due = total_due + ?, updated_at = NOW() WHERE id = ?`,
      [payment.amount, payment.customer_id]
    );

    // Delete associated transaction
    await conn.execute(
      `DELETE FROM transactions WHERE reference_id = ?`,
      [id]
    );

    // Delete payment
    await conn.execute(`DELETE FROM payments WHERE id = ?`, [id]);
  });

  await logActivity(req.user.id, 'delete_payment', 'payment', id, payment);

  res.json({ message: 'Payment deleted and reversed' });
}));

/**
 * GET /api/payments/summary
 * Get payment summary/statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  let dateFilter = '';
  const params = [];
  
  if (start_date) {
    dateFilter += ' AND payment_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ' AND payment_date <= ?';
    params.push(end_date);
  }

  const summary = await query(
    `SELECT 
       method,
       COUNT(*) as count,
       SUM(amount) as total
     FROM payments
     WHERE 1=1 ${dateFilter}
     GROUP BY method`,
    params
  );

  const totals = await queryOne(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount
     FROM payments
     WHERE 1=1 ${dateFilter}`,
    params
  );

  res.json({
    byMethod: summary,
    totals,
  });
}));

export default router;
