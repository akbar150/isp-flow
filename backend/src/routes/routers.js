/**
 * Routers Routes
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID, encrypt, decrypt } from '../utils/encryption.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/routers
 * List all routers (without passwords)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const routers = await query(
    `SELECT id, name, ip_address, port, username, mode, is_active, created_at, updated_at,
            (SELECT COUNT(*) FROM customers WHERE router_id = routers.id) as customer_count
     FROM routers
     ORDER BY name ASC`
  );

  res.json({ routers });
}));

/**
 * GET /api/routers/:id
 * Get single router
 */
router.get('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const router_data = await queryOne(
    `SELECT id, name, ip_address, port, username, mode, is_active, created_at, updated_at
     FROM routers
     WHERE id = ?`,
    [req.params.id]
  );

  if (!router_data) {
    return res.status(404).json({ error: 'Router not found' });
  }

  res.json({ router: router_data });
}));

/**
 * POST /api/routers
 * Create new router
 */
router.post('/', authenticate, requireAdmin, [
  body('name').notEmpty().isLength({ min: 2, max: 100 }),
  body('mode').isIn(['dummy', 'real']),
  body('ip_address').optional().isIP(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  body('username').optional().isLength({ max: 100 }),
  body('password').optional().isLength({ max: 100 }),
  body('is_active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, mode, ip_address, port, username, password, is_active = true } = req.body;
  const routerId = generateUUID();

  // Encrypt password if provided
  const passwordEncrypted = password ? encrypt(password) : null;

  await query(
    `INSERT INTO routers (id, name, mode, ip_address, port, username, password_encrypted, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [routerId, name.trim(), mode, ip_address || null, port || 8728, username || null, passwordEncrypted, is_active]
  );

  await logActivity(req.user.id, 'create_router', 'router', routerId, { name, mode });

  res.status(201).json({
    message: 'Router created successfully',
    router: { id: routerId, name, mode, ip_address, port, is_active },
  });
}));

/**
 * PUT /api/routers/:id
 * Update router
 */
router.put('/:id', authenticate, requireAdmin, [
  param('id').isUUID(),
  body('name').optional().isLength({ min: 2, max: 100 }),
  body('mode').optional().isIn(['dummy', 'real']),
  body('ip_address').optional(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  body('is_active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  const existing = await queryOne(`SELECT id FROM routers WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Router not found' });
  }

  const allowedFields = ['name', 'mode', 'ip_address', 'port', 'username', 'is_active'];
  const updateFields = [];
  const updateValues = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(field === 'name' ? updates[field].trim() : updates[field]);
    }
  }

  // Handle password separately
  if (updates.password && updates.password !== '••••••••') {
    updateFields.push('password_encrypted = ?');
    updateValues.push(encrypt(updates.password));
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await query(`UPDATE routers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

  await logActivity(req.user.id, 'update_router', 'router', id, { name: updates.name });

  res.json({ message: 'Router updated successfully' });
}));

/**
 * DELETE /api/routers/:id
 * Delete router
 */
router.delete('/:id', authenticate, requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const router_data = await queryOne(`SELECT name FROM routers WHERE id = ?`, [id]);
  if (!router_data) {
    return res.status(404).json({ error: 'Router not found' });
  }

  // Check if router is in use
  const inUse = await queryOne(
    `SELECT COUNT(*) as count FROM customers WHERE router_id = ?`,
    [id]
  );

  if (inUse.count > 0) {
    return res.status(409).json({
      error: 'Cannot delete router',
      message: `Router is assigned to ${inUse.count} customer(s)`,
    });
  }

  await query(`DELETE FROM routers WHERE id = ?`, [id]);

  await logActivity(req.user.id, 'delete_router', 'router', id, { name: router_data.name });

  res.json({ message: 'Router deleted successfully' });
}));

/**
 * POST /api/routers/:id/test
 * Test router connection
 */
router.post('/:id/test', authenticate, requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const router_data = await queryOne(`SELECT * FROM routers WHERE id = ?`, [id]);
  if (!router_data) {
    return res.status(404).json({ error: 'Router not found' });
  }

  if (router_data.mode === 'dummy') {
    return res.json({
      success: true,
      message: 'Dummy mode - simulated connection success',
    });
  }

  // For real mode, would need actual MikroTik API connection
  // This is a placeholder - implement actual connection test
  res.json({
    success: false,
    message: 'Real mode connection test not implemented yet',
  });
}));

export default router;
