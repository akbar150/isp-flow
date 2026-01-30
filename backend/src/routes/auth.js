/**
 * Authentication Routes (Admin/Staff)
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { queryOne, query } from '../config/database.js';
import { generateToken, generateRefreshToken, verifyToken } from '../config/auth.js';
import { verifyPassword, hashPassword } from '../utils/encryption.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

/**
 * POST /api/auth/login
 * Admin/Staff login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  // Get user with role
  const user = await queryOne(
    `SELECT u.id, u.email, u.password_hash, u.is_active, p.full_name, ur.role
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     WHERE u.email = ?`,
    [email]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_active) {
    return res.status(401).json({ error: 'Account is disabled' });
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Log activity
  await logActivity(user.id, 'login', 'user', user.id, { email });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = verifyToken(refreshToken);
    
    // Verify user still exists and is active
    const user = await queryOne(
      `SELECT u.id, u.email, ur.role
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = ? AND u.is_active = true`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await queryOne(
    `SELECT u.id, u.email, p.full_name, ur.role, u.created_at
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     WHERE u.id = ?`,
    [req.user.id]
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}));

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  // Get current password hash
  const user = await queryOne(
    `SELECT password_hash FROM users WHERE id = ?`,
    [req.user.id]
  );

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash and update new password
  const newHash = await hashPassword(newPassword);
  await query(
    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
    [newHash, req.user.id]
  );

  await logActivity(req.user.id, 'change_password', 'user', req.user.id, {});

  res.json({ message: 'Password updated successfully' });
}));

/**
 * POST /api/auth/reset-password-request
 * Request password reset email
 */
router.post('/reset-password-request', [
  body('email').isEmail().normalizeEmail(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  // Check if user exists
  const user = await queryOne(
    `SELECT id, email FROM users WHERE email = ? AND is_active = true`,
    [email]
  );

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, a reset link has been sent' });
  }

  // Generate reset token (valid for 1 hour)
  const resetToken = generateToken({ userId: user.id, type: 'reset' });

  // TODO: Send email with reset link
  // await sendPasswordResetEmail(email, resetToken);

  res.json({ message: 'If an account exists, a reset link has been sent' });
}));

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, server-side logging)
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await logActivity(req.user.id, 'logout', 'user', req.user.id, {});
  res.json({ message: 'Logged out successfully' });
}));

export default router;
