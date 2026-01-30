/**
 * Authentication Middleware
 * 
 * JWT token verification and user extraction
 */

import { verifyToken } from '../config/auth.js';
import { queryOne } from '../config/database.js';

/**
 * Authenticate user via JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

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

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Authenticate customer (separate from admin/staff)
 */
export const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded.type !== 'customer') {
      return res.status(401).json({ error: 'Invalid customer token' });
    }

    // Verify customer still exists
    const customer = await queryOne(
      `SELECT id, user_id, full_name, status 
       FROM customers 
       WHERE id = ? AND status != 'suspended'`,
      [decoded.customerId]
    );

    if (!customer) {
      return res.status(401).json({ error: 'Customer not found or suspended' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error('Customer authentication error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional authentication - attaches user if token present
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      const user = await queryOne(
        `SELECT u.id, u.email, ur.role 
         FROM users u 
         JOIN user_roles ur ON u.id = ur.user_id 
         WHERE u.id = ?`,
        [decoded.userId]
      );

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
  
  next();
};

/**
 * Authenticate cron job requests
 */
export const authenticateCron = (req, res, next) => {
  const cronSecret = req.headers['x-cron-secret'] || req.query.cronSecret;
  
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET_KEY) {
    return res.status(403).json({ error: 'Invalid cron authentication' });
  }
  
  next();
};

export default {
  authenticate,
  authenticateCustomer,
  optionalAuth,
  authenticateCron,
};
