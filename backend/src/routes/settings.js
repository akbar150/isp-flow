/**
 * Settings Routes
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { generateUUID, encrypt, decrypt } from '../utils/encryption.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

// Public settings (no auth required)
const PUBLIC_SETTINGS = ['isp_name', 'whatsapp_template', 'email_from_name'];

/**
 * GET /api/settings/public
 * Get public settings (for login page branding etc.)
 */
router.get('/public', asyncHandler(async (req, res) => {
  const settings = await query(
    `SELECT \`key\`, value FROM system_settings WHERE \`key\` IN (?)`,
    [PUBLIC_SETTINGS]
  );

  const result = {};
  for (const s of settings) {
    try {
      result[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
    } catch {
      result[s.key] = s.value;
    }
  }

  res.json({ settings: result });
}));

/**
 * GET /api/settings
 * Get all settings (admin only)
 */
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const settings = await query(`SELECT \`key\`, value, updated_at FROM system_settings ORDER BY \`key\``);

  const result = {};
  for (const s of settings) {
    try {
      // Decrypt sensitive settings
      if (s.key === 'smtp_password' && s.value) {
        result[s.key] = '••••••••'; // Don't expose passwords
      } else {
        result[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
      }
    } catch {
      result[s.key] = s.value;
    }
  }

  res.json({ settings: result });
}));

/**
 * GET /api/settings/:key
 * Get specific setting
 */
router.get('/:key', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { key } = req.params;

  const setting = await queryOne(
    `SELECT \`key\`, value, updated_at FROM system_settings WHERE \`key\` = ?`,
    [key]
  );

  if (!setting) {
    return res.status(404).json({ error: 'Setting not found' });
  }

  // Hide sensitive values
  if (key === 'smtp_password') {
    setting.value = '••••••••';
  }

  res.json({ setting });
}));

/**
 * PUT /api/settings/:key
 * Update single setting
 */
router.put('/:key', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Value is required' });
  }

  // Encrypt sensitive settings
  let storedValue = value;
  if (key === 'smtp_password' && value && value !== '••••••••') {
    storedValue = encrypt(value);
  } else if (key === 'smtp_password' && value === '••••••••') {
    // Skip updating if placeholder value
    return res.json({ message: 'Setting unchanged' });
  }

  const jsonValue = JSON.stringify(storedValue);

  // Upsert setting
  await query(
    `INSERT INTO system_settings (id, \`key\`, value, updated_at) 
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
    [generateUUID(), key, jsonValue, jsonValue]
  );

  await logActivity(req.user.id, 'update_setting', 'setting', key, { key });

  res.json({ message: 'Setting updated successfully' });
}));

/**
 * PUT /api/settings
 * Update multiple settings at once
 */
router.put('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const settings = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  const updates = [];
  for (const [key, value] of Object.entries(settings)) {
    let storedValue = value;

    // Skip placeholder passwords
    if (key === 'smtp_password' && value === '••••••••') {
      continue;
    }

    // Encrypt sensitive settings
    if (key === 'smtp_password' && value) {
      storedValue = encrypt(value);
    }

    const jsonValue = JSON.stringify(storedValue);

    await query(
      `INSERT INTO system_settings (id, \`key\`, value, updated_at) 
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
      [generateUUID(), key, jsonValue, jsonValue]
    );

    updates.push(key);
  }

  await logActivity(req.user.id, 'update_settings', 'setting', null, { keys: updates });

  res.json({ 
    message: 'Settings updated successfully',
    updated: updates,
  });
}));

/**
 * GET /api/settings/permissions/all
 * Get all permission settings
 */
router.get('/permissions/all', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const permissions = await query(
    `SELECT id, role, resource, action, allowed, created_at FROM permissions ORDER BY role, resource, action`
  );

  // Group by role
  const grouped = {};
  for (const p of permissions) {
    if (!grouped[p.role]) grouped[p.role] = [];
    grouped[p.role].push(p);
  }

  res.json({ permissions, grouped });
}));

/**
 * PUT /api/settings/permissions
 * Update permission
 */
router.put('/permissions/:id', authenticate, requireSuperAdmin, [
  body('allowed').isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { allowed } = req.body;

  const permission = await queryOne(`SELECT * FROM permissions WHERE id = ?`, [id]);
  if (!permission) {
    return res.status(404).json({ error: 'Permission not found' });
  }

  await query(
    `UPDATE permissions SET allowed = ? WHERE id = ?`,
    [allowed, id]
  );

  await logActivity(req.user.id, 'update_permission', 'permission', id, {
    role: permission.role,
    resource: permission.resource,
    action: permission.action,
    allowed,
  });

  res.json({ message: 'Permission updated successfully' });
}));

export default router;
