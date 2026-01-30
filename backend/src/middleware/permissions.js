/**
 * Permission Middleware
 * 
 * Role-based access control mirroring Supabase RLS policies
 */

import { queryOne, query } from '../config/database.js';

/**
 * Check if user has a specific role
 */
export const hasRole = async (userId, role) => {
  const result = await queryOne(
    `SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?`,
    [userId, role]
  );
  return !!result;
};

/**
 * Check if user has permission for resource/action
 */
export const hasPermission = async (userId, resource, action) => {
  // Super admin has all permissions
  const isSuperAdmin = await hasRole(userId, 'super_admin');
  if (isSuperAdmin) return true;

  const result = await queryOne(
    `SELECT 1 FROM user_roles ur
     JOIN permissions p ON ur.role = p.role
     WHERE ur.user_id = ?
     AND p.resource = ?
     AND p.action = ?
     AND p.allowed = true`,
    [userId, resource, action]
  );
  
  return !!result;
};

/**
 * Middleware: Require specific role
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin always passes
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

/**
 * Middleware: Require specific permission
 */
export const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowed = await hasPermission(req.user.id, resource, action);
    
    if (!allowed) {
      return res.status(403).json({ 
        error: 'Permission denied',
        resource,
        action,
      });
    }

    next();
  };
};

/**
 * Middleware: Require admin or super_admin role
 */
export const requireAdmin = requireRole('admin', 'super_admin');

/**
 * Middleware: Require super_admin role
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Get all permissions for a user
 */
export const getUserPermissions = async (userId) => {
  const permissions = await query(
    `SELECT p.resource, p.action, p.allowed
     FROM user_roles ur
     JOIN permissions p ON ur.role = p.role
     WHERE ur.user_id = ?`,
    [userId]
  );
  
  return permissions;
};

export default {
  hasRole,
  hasPermission,
  requireRole,
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  getUserPermissions,
};
