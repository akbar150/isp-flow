/**
 * Reminders Routes
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID } from '../utils/encryption.js';
import { sendBillingReminderEmail } from '../services/email.service.js';
import { sendBillingReminderSMS, sendExpiryNotificationSMS } from '../services/sms.service.js';
import { logActivity, formatDateForMySQL } from '../utils/helpers.js';
import { format, addDays, subDays } from 'date-fns';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/reminders/due
 * Get customers due for reminders
 */
router.get('/due', asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStr = formatDateForMySQL(today);
  const threeDaysBefore = formatDateForMySQL(addDays(today, 3));
  const oneDayBefore = formatDateForMySQL(addDays(today, 1));
  const threeDaysAfter = formatDateForMySQL(subDays(today, 3));

  // Get customers needing reminders
  const customers = await query(
    `SELECT c.id, c.user_id, c.full_name, c.phone, c.email, c.expiry_date, c.total_due,
            p.name as package_name, p.monthly_price,
            CASE 
              WHEN c.expiry_date = ? THEN '3_days_before'
              WHEN c.expiry_date = ? THEN '1_day_before'
              WHEN c.expiry_date = ? THEN 'expiry_day'
              WHEN c.expiry_date = ? THEN '3_days_overdue'
              ELSE 'other'
            END as reminder_type
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.status != 'suspended'
     AND (
       c.expiry_date = ? OR
       c.expiry_date = ? OR
       c.expiry_date = ? OR
       c.expiry_date = ?
     )
     ORDER BY c.expiry_date ASC`,
    [threeDaysBefore, oneDayBefore, todayStr, threeDaysAfter,
     threeDaysBefore, oneDayBefore, todayStr, threeDaysAfter]
  );

  // Group by reminder type
  const grouped = {
    '3_days_before': customers.filter(c => c.reminder_type === '3_days_before'),
    '1_day_before': customers.filter(c => c.reminder_type === '1_day_before'),
    'expiry_day': customers.filter(c => c.reminder_type === 'expiry_day'),
    '3_days_overdue': customers.filter(c => c.reminder_type === '3_days_overdue'),
  };

  res.json({
    customers,
    grouped,
    summary: {
      total: customers.length,
      threeDaysBefore: grouped['3_days_before'].length,
      oneDayBefore: grouped['1_day_before'].length,
      expiryDay: grouped['expiry_day'].length,
      threeDaysOverdue: grouped['3_days_overdue'].length,
    },
  });
}));

/**
 * POST /api/reminders/send
 * Send reminder to a customer
 */
router.post('/send', [
  body('customer_id').isUUID(),
  body('channel').isIn(['whatsapp', 'sms', 'email']),
  body('reminder_type').isIn(['3_days_before', '1_day_before', 'expiry_day', '3_days_overdue']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { customer_id, channel, reminder_type, message } = req.body;

  // Get customer details
  const customer = await queryOne(
    `SELECT c.*, p.name as package_name, p.monthly_price
     FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.id = ?`,
    [customer_id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Get ISP settings
  const settings = await query(`SELECT \`key\`, value FROM system_settings WHERE \`key\` = 'isp_name'`);
  const ispName = settings.find(s => s.key === 'isp_name')?.value || 'EasyLink ISP';

  let result = { success: false };

  try {
    if (channel === 'email' && customer.email) {
      result = await sendBillingReminderEmail({
        to: customer.email,
        customerName: customer.full_name,
        userId: customer.user_id,
        dueAmount: customer.total_due,
        expiryDate: format(new Date(customer.expiry_date), 'dd/MM/yyyy'),
        packageName: customer.package_name,
        ispName,
      });
    } else if (channel === 'sms') {
      result = await sendBillingReminderSMS({
        phone: customer.phone,
        customerName: customer.full_name,
        userId: customer.user_id,
        dueAmount: customer.total_due,
        expiryDate: format(new Date(customer.expiry_date), 'dd/MM/yyyy'),
        ispName,
      });
    } else if (channel === 'whatsapp') {
      // WhatsApp is handled client-side via wa.me links
      result = { success: true, note: 'WhatsApp handled client-side' };
    }

    // Log the reminder
    await query(
      `INSERT INTO reminder_logs (id, customer_id, reminder_type, channel, message, sent_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateUUID(), customer_id, reminder_type, channel, message || null, req.user.id]
    );

    await logActivity(req.user.id, 'send_reminder', 'customer', customer_id, {
      channel,
      reminder_type,
    });

    res.json({
      success: true,
      message: `Reminder sent via ${channel}`,
      result,
    });
  } catch (error) {
    console.error(`Failed to send ${channel} reminder:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to send reminder: ${error.message}`,
    });
  }
}));

/**
 * POST /api/reminders/send-bulk
 * Send reminders to multiple customers
 */
router.post('/send-bulk', [
  body('customer_ids').isArray(),
  body('channel').isIn(['whatsapp', 'sms', 'email']),
  body('reminder_type').isIn(['3_days_before', '1_day_before', 'expiry_day', '3_days_overdue']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { customer_ids, channel, reminder_type } = req.body;

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const customerId of customer_ids) {
    try {
      // Recursive call to single send endpoint logic
      const customer = await queryOne(
        `SELECT c.*, p.name as package_name
         FROM customers c
         LEFT JOIN packages p ON c.package_id = p.id
         WHERE c.id = ?`,
        [customerId]
      );

      if (!customer) {
        results.failed++;
        results.errors.push({ customerId, error: 'Customer not found' });
        continue;
      }

      // Log the reminder even for bulk
      await query(
        `INSERT INTO reminder_logs (id, customer_id, reminder_type, channel, sent_by)
         VALUES (?, ?, ?, ?, ?)`,
        [generateUUID(), customerId, reminder_type, channel, req.user.id]
      );

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ customerId, error: error.message });
    }
  }

  res.json({
    message: `Sent ${results.success} reminders, ${results.failed} failed`,
    results,
  });
}));

/**
 * GET /api/reminders/logs
 * Get reminder logs
 */
router.get('/logs', asyncHandler(async (req, res) => {
  const { customer_id, channel, limit = 100 } = req.query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (customer_id) {
    whereClause += ' AND rl.customer_id = ?';
    params.push(customer_id);
  }

  if (channel) {
    whereClause += ' AND rl.channel = ?';
    params.push(channel);
  }

  const logs = await query(
    `SELECT rl.*, c.user_id as customer_user_id, c.full_name as customer_name,
            p.full_name as sent_by_name
     FROM reminder_logs rl
     JOIN customers c ON rl.customer_id = c.id
     LEFT JOIN profiles p ON rl.sent_by = p.user_id
     ${whereClause}
     ORDER BY rl.sent_at DESC
     LIMIT ?`,
    [...params, parseInt(limit)]
  );

  res.json({ logs });
}));

export default router;
