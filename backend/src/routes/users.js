/**
 * User Management Routes (Admin/Staff CRUD)
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne, withTransaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { hashPassword, generateUUID } from '../utils/encryption.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * List all admin/staff users
 */
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const users = await query(
    `SELECT u.id, u.email, u.is_active, u.created_at, u.updated_at,
            p.full_name, ur.role
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     ORDER BY u.created_at DESC`
  );

  res.json({ users });
}));

/**
 * GET /api/users/:id
 * Get single user
 */
router.get('/:id', requireAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await queryOne(
    `SELECT u.id, u.email, u.is_active, u.created_at, u.updated_at,
            p.full_name, ur.role
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     WHERE u.id = ?`,
    [req.params.id]
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}));

/**
 * POST /api/users
 * Create new admin/staff user
 */
router.post('/', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').notEmpty().trim(),
  body('role').isIn(['admin', 'staff']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, full_name, role } = req.body;

  // Only super_admin can create admin users
  if (role === 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admin can create admin users' });
  }

  // Check if email already exists
  const existing = await queryOne(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const userId = generateUUID();
  const passwordHash = await hashPassword(password);

  await withTransaction(async (conn) => {
    // Create user
    await conn.execute(
      `INSERT INTO users (id, email, password_hash, is_active) VALUES (?, ?, ?, true)`,
      [userId, email, passwordHash]
    );

    // Create profile
    await conn.execute(
      `INSERT INTO profiles (id, user_id, full_name) VALUES (?, ?, ?)`,
      [generateUUID(), userId, full_name]
    );

    // Assign role
    await conn.execute(
      `INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)`,
      [generateUUID(), userId, role]
    );
  });

  await logActivity(req.user.id, 'create_user', 'user', userId, { email, role });

  res.status(201).json({
    message: 'User created successfully',
    user: { id: userId, email, full_name, role },
  });
}));

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', requireAdmin, [
  param('id').isUUID(),
  body('full_name').optional().notEmpty().trim(),
  body('role').optional().isIn(['admin', 'staff']),
  body('is_active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { full_name, role, is_active } = req.body;

  // Prevent self-demotion
  if (id === req.user.id && role && role !== req.user.role) {
    return res.status(403).json({ error: 'Cannot change your own role' });
  }

  // Only super_admin can change roles to/from admin
  if (role === 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admin can set admin role' });
  }

  // Check user exists
  const user = await queryOne(`SELECT id FROM users WHERE id = ?`, [id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await withTransaction(async (conn) => {
    // Update user active status
    if (is_active !== undefined) {
      await conn.execute(
        `UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
        [is_active, id]
      );
    }

    // Update profile
    if (full_name) {
      await conn.execute(
        `UPDATE profiles SET full_name = ?, updated_at = NOW() WHERE user_id = ?`,
        [full_name, id]
      );
    }

    // Update role
    if (role) {
      await conn.execute(
        `UPDATE user_roles SET role = ? WHERE user_id = ?`,
        [role, id]
      );
    }
  });

  await logActivity(req.user.id, 'update_user', 'user', id, { full_name, role, is_active });

  res.json({ message: 'User updated successfully' });
}));

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireSuperAdmin, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  // Prevent self-deletion
  if (id === req.user.id) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }

  // Check user exists
  const user = await queryOne(`SELECT email FROM users WHERE id = ?`, [id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await withTransaction(async (conn) => {
    await conn.execute(`DELETE FROM user_roles WHERE user_id = ?`, [id]);
    await conn.execute(`DELETE FROM profiles WHERE user_id = ?`, [id]);
    await conn.execute(`DELETE FROM users WHERE id = ?`, [id]);
  });

  await logActivity(req.user.id, 'delete_user', 'user', id, { email: user.email });

  res.json({ message: 'User deleted successfully' });
}));

/**
 * POST /api/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/:id/reset-password', requireSuperAdmin, [
  param('id').isUUID(),
  body('newPassword').isLength({ min: 8 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { newPassword } = req.body;

  const user = await queryOne(`SELECT id FROM users WHERE id = ?`, [id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const passwordHash = await hashPassword(newPassword);
  await query(
    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
    [passwordHash, id]
  );

  await logActivity(req.user.id, 'reset_password', 'user', id, {});

  res.json({ message: 'Password reset successfully' });
}));

export default router;
