/**
 * Customers Routes
 */

import { Router } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query, queryOne, withTransaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { hashPassword, generateUUID, encrypt } from '../utils/encryption.js';
import { 
  generateCustomerUserId, 
  formatDateForMySQL, 
  logActivity,
  paginate,
  paginationResponse,
  isValidBDPhone,
} from '../utils/helpers.js';
import { addDays, format } from 'date-fns';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/customers
 * List customers with filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, search, area_id, sortBy, sortDir } = req.query;
  const { limit: pageLimit, offset } = paginate(parseInt(page), parseInt(limit));

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    whereClause += ' AND c.status = ?';
    params.push(status);
  }

  if (search) {
    whereClause += ' AND (c.full_name LIKE ? OR c.user_id LIKE ? OR c.phone LIKE ? OR mu.username LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (area_id) {
    whereClause += ' AND c.area_id = ?';
    params.push(area_id);
  }

  // Get total count
  const [countResult] = await query(
    `SELECT COUNT(DISTINCT c.id) as total 
     FROM customers c 
     LEFT JOIN mikrotik_users mu ON c.id = mu.customer_id
     ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Build ORDER BY
  let orderBy = 'c.created_at DESC';
  if (sortBy === 'expiry_date') {
    orderBy = `c.expiry_date ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (sortBy === 'name') {
    orderBy = `c.full_name ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;
  }

  // Get customers
  const customers = await query(
    `SELECT c.id, c.user_id, c.full_name, c.phone, c.alt_phone, c.address,
            c.email, c.status, c.expiry_date, c.billing_start_date, 
            c.total_due, c.auto_renew, c.created_at,
            p.id as package_id, p.name as package_name, p.speed_mbps, p.monthly_price,
            a.id as area_id, a.name as area_name,
            r.id as router_id, r.name as router_name,
            mu.id as mikrotik_user_id, mu.username as pppoe_username, mu.status as pppoe_status
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     LEFT JOIN areas a ON c.area_id = a.id
     LEFT JOIN routers r ON c.router_id = r.id
     LEFT JOIN mikrotik_users mu ON c.id = mu.customer_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageLimit, offset]
  );

  res.json(paginationResponse(customers, total, parseInt(page), pageLimit));
}));

/**
 * GET /api/customers/:id
 * Get single customer
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const customer = await queryOne(
    `SELECT c.*, 
            p.name as package_name, p.speed_mbps, p.monthly_price, p.validity_days,
            a.name as area_name,
            r.name as router_name,
            mu.id as mikrotik_user_id, mu.username as pppoe_username, mu.status as pppoe_status
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     LEFT JOIN areas a ON c.area_id = a.id
     LEFT JOIN routers r ON c.router_id = r.id
     LEFT JOIN mikrotik_users mu ON c.id = mu.customer_id
     WHERE c.id = ?`,
    [req.params.id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Remove password hash from response
  delete customer.password_hash;

  res.json({ customer });
}));

/**
 * POST /api/customers
 * Create new customer
 */
router.post('/', [
  body('full_name').notEmpty().isLength({ min: 3, max: 100 }),
  body('phone').notEmpty().custom(isValidBDPhone),
  body('address').notEmpty().isLength({ min: 10, max: 500 }),
  body('password').isLength({ min: 6 }).matches(/^[a-zA-Z0-9]+$/),
  body('package_id').isUUID(),
  body('pppoe_username').notEmpty().isLength({ min: 3 }),
  body('pppoe_password').isLength({ min: 4 }).matches(/^[a-zA-Z0-9]+$/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    full_name, phone, alt_phone, email, address,
    area_id, router_id, package_id,
    password, pppoe_username, pppoe_password,
  } = req.body;

  // Get package info
  const pkg = await queryOne(`SELECT * FROM packages WHERE id = ? AND is_active = true`, [package_id]);
  if (!pkg) {
    return res.status(400).json({ error: 'Invalid or inactive package' });
  }

  const customerId = generateUUID();
  const userId = await generateCustomerUserId();
  const today = new Date();
  const expiryDate = addDays(today, pkg.validity_days);

  const passwordHash = await hashPassword(password);
  const pppoePasswordEncrypted = await hashPassword(pppoe_password);

  await withTransaction(async (conn) => {
    // Create customer
    await conn.execute(
      `INSERT INTO customers 
       (id, user_id, full_name, phone, alt_phone, email, address, area_id, router_id, 
        package_id, password_hash, billing_start_date, expiry_date, status, total_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        customerId, userId, full_name, phone, alt_phone || null, email || null, address,
        area_id || null, router_id || null, package_id, passwordHash,
        formatDateForMySQL(today), formatDateForMySQL(expiryDate),
        pkg.monthly_price,
      ]
    );

    // Create mikrotik user
    await conn.execute(
      `INSERT INTO mikrotik_users 
       (id, customer_id, username, password_encrypted, router_id, profile, status)
       VALUES (?, ?, ?, ?, ?, ?, 'enabled')`,
      [generateUUID(), customerId, pppoe_username, pppoePasswordEncrypted, router_id || null, pkg.name]
    );
  });

  await logActivity(req.user.id, 'create_customer', 'customer', customerId, { userId, full_name });

  res.status(201).json({
    message: 'Customer created successfully',
    customer: {
      id: customerId,
      user_id: userId,
      full_name,
      pppoe_username,
      // Return plain passwords for credentials display (one-time)
      password,
      pppoe_password,
    },
  });
}));

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put('/:id', requirePermission('customers', 'update'), [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const customer = await queryOne(`SELECT id FROM customers WHERE id = ?`, [id]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Build update query dynamically
  const allowedFields = [
    'full_name', 'phone', 'alt_phone', 'email', 'address',
    'area_id', 'router_id', 'package_id', 'status', 'auto_renew',
    'expiry_date', 'total_due',
  ];

  const updateFields = [];
  const updateValues = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updates[field] === '' ? null : updates[field]);
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await query(
    `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  await logActivity(req.user.id, 'update_customer', 'customer', id, updates);

  res.json({ message: 'Customer updated successfully' });
}));

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
router.delete('/:id', requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await queryOne(`SELECT user_id, full_name FROM customers WHERE id = ?`, [id]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  await withTransaction(async (conn) => {
    // Delete related records first
    await conn.execute(`DELETE FROM mikrotik_users WHERE customer_id = ?`, [id]);
    await conn.execute(`DELETE FROM call_records WHERE customer_id = ?`, [id]);
    await conn.execute(`DELETE FROM reminder_logs WHERE customer_id = ?`, [id]);
    await conn.execute(`DELETE FROM billing_records WHERE customer_id = ?`, [id]);
    await conn.execute(`DELETE FROM payments WHERE customer_id = ?`, [id]);
    await conn.execute(`DELETE FROM customers WHERE id = ?`, [id]);
  });

  await logActivity(req.user.id, 'delete_customer', 'customer', id, customer);

  res.json({ message: 'Customer deleted successfully' });
}));

/**
 * POST /api/customers/:id/renew
 * Renew customer subscription
 */
router.post('/:id/renew', requirePermission('customers', 'update'), [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { months = 1 } = req.body;

  const customer = await queryOne(
    `SELECT c.*, p.validity_days, p.monthly_price
     FROM customers c
     JOIN packages p ON c.package_id = p.id
     WHERE c.id = ?`,
    [id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const currentExpiry = new Date(customer.expiry_date);
  const today = new Date();
  const startDate = currentExpiry > today ? currentExpiry : today;
  const newExpiry = addDays(startDate, customer.validity_days * months);

  await query(
    `UPDATE customers SET expiry_date = ?, status = 'active', updated_at = NOW() WHERE id = ?`,
    [formatDateForMySQL(newExpiry), id]
  );

  await logActivity(req.user.id, 'renew_customer', 'customer', id, { months, newExpiry });

  res.json({ 
    message: 'Subscription renewed',
    newExpiryDate: formatDateForMySQL(newExpiry),
  });
}));

export default router;
