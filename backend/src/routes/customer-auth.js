/**
 * Customer Authentication Routes
 * 
 * Separate authentication for customer portal
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { queryOne, query } from '../config/database.js';
import { generateToken } from '../config/auth.js';
import { verifyPassword, hashPassword, generateRandomString } from '../utils/encryption.js';
import { authenticateCustomer } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { sendEmail } from '../services/email.service.js';

const router = Router();

/**
 * POST /api/customer-auth/login
 * Customer portal login
 */
router.post('/login', [
  body('userId').notEmpty().trim(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, password } = req.body;

  // Get customer by user_id
  const customer = await queryOne(
    `SELECT id, user_id, full_name, phone, email, password_hash, status
     FROM customers
     WHERE user_id = ?`,
    [userId.toUpperCase()]
  );

  if (!customer) {
    return res.status(401).json({ error: 'Invalid User ID or password' });
  }

  if (customer.status === 'suspended') {
    return res.status(401).json({ error: 'Your account is suspended. Please contact support.' });
  }

  // Verify password
  const isValid = await verifyPassword(password, customer.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid User ID or password' });
  }

  // Generate token
  const token = generateToken({
    customerId: customer.id,
    userId: customer.user_id,
    type: 'customer',
  });

  res.json({
    customer: {
      id: customer.id,
      user_id: customer.user_id,
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
    },
    token,
  });
}));

/**
 * GET /api/customer-auth/me
 * Get current customer info
 */
router.get('/me', authenticateCustomer, asyncHandler(async (req, res) => {
  const customer = await queryOne(
    `SELECT c.id, c.user_id, c.full_name, c.phone, c.alt_phone, c.email, c.address,
            c.status, c.expiry_date, c.billing_start_date, c.total_due, c.auto_renew,
            p.name as package_name, p.speed_mbps, p.monthly_price,
            a.name as area_name
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     LEFT JOIN areas a ON c.area_id = a.id
     WHERE c.id = ?`,
    [req.customer.id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json({ customer });
}));

/**
 * GET /api/customer-auth/billing
 * Get customer billing history
 */
router.get('/billing', authenticateCustomer, asyncHandler(async (req, res) => {
  const billingRecords = await query(
    `SELECT id, billing_date, amount, amount_paid, status, due_date, paid_date, package_name
     FROM billing_records
     WHERE customer_id = ?
     ORDER BY billing_date DESC
     LIMIT 12`,
    [req.customer.id]
  );

  res.json({ billingRecords });
}));

/**
 * GET /api/customer-auth/payments
 * Get customer payment history
 */
router.get('/payments', authenticateCustomer, asyncHandler(async (req, res) => {
  const payments = await query(
    `SELECT id, payment_date, amount, method, transaction_id, remaining_due
     FROM payments
     WHERE customer_id = ?
     ORDER BY payment_date DESC
     LIMIT 20`,
    [req.customer.id]
  );

  res.json({ payments });
}));

/**
 * POST /api/customer-auth/change-password
 * Customer password change
 */
router.post('/change-password', authenticateCustomer, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  // Validate new password (alphanumeric only)
  if (!/^[a-zA-Z0-9]+$/.test(newPassword)) {
    return res.status(400).json({ error: 'Password can only contain letters and numbers' });
  }

  // Get current password hash
  const customer = await queryOne(
    `SELECT password_hash FROM customers WHERE id = ?`,
    [req.customer.id]
  );

  // Verify current password
  const isValid = await verifyPassword(currentPassword, customer.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash and update new password
  const newHash = await hashPassword(newPassword);
  await query(
    `UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
    [newHash, req.customer.id]
  );

  res.json({ message: 'Password updated successfully' });
}));

/**
 * POST /api/customer-auth/forgot-password
 * Request password reset for customer
 */
router.post('/forgot-password', [
  body('userId').notEmpty().trim(),
  body('phone').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, phone } = req.body;

  // Verify user_id and phone match
  const customer = await queryOne(
    `SELECT id, user_id, full_name, email, phone FROM customers WHERE user_id = ? AND phone = ?`,
    [userId.toUpperCase(), phone]
  );

  if (!customer) {
    // Return success anyway to prevent enumeration
    return res.json({ message: 'If the information matches, a new password will be sent' });
  }

  // Generate new password
  const newPassword = generateRandomString(8);
  const newHash = await hashPassword(newPassword);

  // Update password
  await query(
    `UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
    [newHash, customer.id]
  );

  // Send email if customer has email
  if (customer.email) {
    try {
      await sendEmail({
        to: customer.email,
        subject: 'Password Reset - EasyLink ISP',
        html: `
          <h2>Password Reset</h2>
          <p>Hello ${customer.full_name},</p>
          <p>Your password has been reset. Here are your new login credentials:</p>
          <p><strong>User ID:</strong> ${customer.user_id}</p>
          <p><strong>New Password:</strong> ${newPassword}</p>
          <p>Please login and change your password immediately.</p>
          <p>Best regards,<br>EasyLink ISP Team</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }
  }

  res.json({ 
    message: 'Password has been reset',
    // Only show new password if no email (for staff to communicate)
    ...(customer.email ? {} : { newPassword }),
  });
}));

export default router;
