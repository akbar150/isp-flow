/**
 * Packages Routes
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne } from '../config/database.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requirePermission, requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID } from '../utils/encryption.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/packages
 * List all packages (public for customer portal)
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { active_only } = req.query;
  
  let sql = `SELECT id, name, speed_mbps, monthly_price, validity_days, description, is_active, created_at
             FROM packages`;
  
  if (active_only === 'true') {
    sql += ` WHERE is_active = true`;
  }
  
  sql += ` ORDER BY monthly_price ASC`;
  
  const packages = await query(sql);
  res.json({ packages });
}));

/**
 * GET /api/packages/:id
 * Get single package
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const pkg = await queryOne(
    `SELECT * FROM packages WHERE id = ?`,
    [req.params.id]
  );

  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }

  res.json({ package: pkg });
}));

/**
 * POST /api/packages
 * Create new package
 */
router.post('/', authenticate, requirePermission('packages', 'create'), [
  body('name').notEmpty().isLength({ min: 3, max: 50 }),
  body('speed_mbps').isInt({ min: 1, max: 10000 }),
  body('monthly_price').isFloat({ min: 1, max: 999999 }),
  body('validity_days').optional().isInt({ min: 1, max: 365 }),
  body('description').optional().isLength({ max: 500 }),
  body('is_active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, speed_mbps, monthly_price, validity_days = 30, description, is_active = true } = req.body;
  const packageId = generateUUID();

  await query(
    `INSERT INTO packages (id, name, speed_mbps, monthly_price, validity_days, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [packageId, name.trim(), speed_mbps, monthly_price, validity_days, description || null, is_active]
  );

  await logActivity(req.user.id, 'create_package', 'package', packageId, { name });

  res.status(201).json({
    message: 'Package created successfully',
    package: { id: packageId, name, speed_mbps, monthly_price, validity_days, is_active },
  });
}));

/**
 * PUT /api/packages/:id
 * Update package
 */
router.put('/:id', authenticate, requirePermission('packages', 'update'), [
  param('id').isUUID(),
  body('name').optional().isLength({ min: 3, max: 50 }),
  body('speed_mbps').optional().isInt({ min: 1, max: 10000 }),
  body('monthly_price').optional().isFloat({ min: 1, max: 999999 }),
  body('validity_days').optional().isInt({ min: 1, max: 365 }),
  body('is_active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  const pkg = await queryOne(`SELECT id FROM packages WHERE id = ?`, [id]);
  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }

  const allowedFields = ['name', 'speed_mbps', 'monthly_price', 'validity_days', 'description', 'is_active'];
  const updateFields = [];
  const updateValues = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(field === 'name' ? updates[field].trim() : updates[field]);
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await query(
    `UPDATE packages SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  await logActivity(req.user.id, 'update_package', 'package', id, updates);

  res.json({ message: 'Package updated successfully' });
}));

/**
 * DELETE /api/packages/:id
 * Delete package
 */
router.delete('/:id', authenticate, requirePermission('packages', 'delete'), [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await queryOne(`SELECT name FROM packages WHERE id = ?`, [id]);
  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }

  // Check if package is in use
  const inUse = await queryOne(
    `SELECT COUNT(*) as count FROM customers WHERE package_id = ?`,
    [id]
  );

  if (inUse.count > 0) {
    return res.status(409).json({ 
      error: 'Cannot delete package',
      message: `Package is assigned to ${inUse.count} customer(s)`,
    });
  }

  await query(`DELETE FROM packages WHERE id = ?`, [id]);

  await logActivity(req.user.id, 'delete_package', 'package', id, { name: pkg.name });

  res.json({ message: 'Package deleted successfully' });
}));

export default router;
