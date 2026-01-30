/**
 * Activity Log Routes
 */

import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/error.js';
import { paginate, paginationResponse } from '../utils/helpers.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/activity
 * List activity logs
 */
router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    user_id, 
    action, 
    entity_type,
    start_date,
    end_date,
  } = req.query;
  
  const { limit: pageLimit, offset } = paginate(parseInt(page), parseInt(limit));

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user_id) {
    whereClause += ' AND al.user_id = ?';
    params.push(user_id);
  }

  if (action) {
    whereClause += ' AND al.action LIKE ?';
    params.push(`%${action}%`);
  }

  if (entity_type) {
    whereClause += ' AND al.entity_type = ?';
    params.push(entity_type);
  }

  if (start_date) {
    whereClause += ' AND al.created_at >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND al.created_at <= ?';
    params.push(end_date + ' 23:59:59');
  }

  // Get total count
  const [countResult] = await query(
    `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Get logs with user info
  const logs = await query(
    `SELECT al.*, p.full_name as user_name, u.email as user_email
     FROM activity_logs al
     LEFT JOIN users u ON al.user_id = u.id
     LEFT JOIN profiles p ON al.user_id = p.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageLimit, offset]
  );

  res.json(paginationResponse(logs, total, parseInt(page), pageLimit));
}));

/**
 * GET /api/activity/actions
 * Get list of unique actions for filtering
 */
router.get('/actions', asyncHandler(async (req, res) => {
  const actions = await query(
    `SELECT DISTINCT action FROM activity_logs ORDER BY action`
  );

  res.json({ actions: actions.map(a => a.action) });
}));

/**
 * GET /api/activity/entity-types
 * Get list of unique entity types for filtering
 */
router.get('/entity-types', asyncHandler(async (req, res) => {
  const entityTypes = await query(
    `SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type`
  );

  res.json({ entityTypes: entityTypes.map(e => e.entity_type) });
}));

export default router;
