/**
 * Areas Routes
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID } from '../utils/encryption.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/areas
 * List all areas
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const areas = await query(
    `SELECT a.*, COUNT(c.id) as customer_count
     FROM areas a
     LEFT JOIN customers c ON a.id = c.area_id
     GROUP BY a.id
     ORDER BY a.name ASC`
  );

  res.json({ areas });
}));

/**
 * GET /api/areas/:id
 * Get single area
 */
router.get('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const area = await queryOne(
    `SELECT a.*, COUNT(c.id) as customer_count
     FROM areas a
     LEFT JOIN customers c ON a.id = c.area_id
     WHERE a.id = ?
     GROUP BY a.id`,
    [req.params.id]
  );

  if (!area) {
    return res.status(404).json({ error: 'Area not found' });
  }

  res.json({ area });
}));

/**
 * POST /api/areas
 * Create new area
 */
router.post('/', authenticate, requireAdmin, [
  body('name').notEmpty().isLength({ min: 2, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;
  const areaId = generateUUID();

  await query(
    `INSERT INTO areas (id, name, description) VALUES (?, ?, ?)`,
    [areaId, name.trim(), description || null]
  );

  await logActivity(req.user.id, 'create_area', 'area', areaId, { name });

  res.status(201).json({
    message: 'Area created successfully',
    area: { id: areaId, name, description },
  });
}));

/**
 * PUT /api/areas/:id
 * Update area
 */
router.put('/:id', authenticate, requireAdmin, [
  param('id').isUUID(),
  body('name').optional().isLength({ min: 2, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, description } = req.body;

  const area = await queryOne(`SELECT id FROM areas WHERE id = ?`, [id]);
  if (!area) {
    return res.status(404).json({ error: 'Area not found' });
  }

  const updates = [];
  const values = [];

  if (name) {
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  await query(`UPDATE areas SET ${updates.join(', ')} WHERE id = ?`, values);

  await logActivity(req.user.id, 'update_area', 'area', id, { name, description });

  res.json({ message: 'Area updated successfully' });
}));

/**
 * DELETE /api/areas/:id
 * Delete area
 */
router.delete('/:id', authenticate, requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const area = await queryOne(`SELECT name FROM areas WHERE id = ?`, [id]);
  if (!area) {
    return res.status(404).json({ error: 'Area not found' });
  }

  // Check if area is in use
  const inUse = await queryOne(
    `SELECT COUNT(*) as count FROM customers WHERE area_id = ?`,
    [id]
  );

  if (inUse.count > 0) {
    return res.status(409).json({
      error: 'Cannot delete area',
      message: `Area is assigned to ${inUse.count} customer(s)`,
    });
  }

  await query(`DELETE FROM areas WHERE id = ?`, [id]);

  await logActivity(req.user.id, 'delete_area', 'area', id, { name: area.name });

  res.json({ message: 'Area deleted successfully' });
}));

export default router;
