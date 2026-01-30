/**
 * Utility Helper Functions
 */

import { query } from '../config/database.js';

/**
 * Generate sequential customer user ID (ISP00001 format)
 */
export const generateCustomerUserId = async () => {
  // Get current max ID
  const result = await query(
    `SELECT MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)) as max_num 
     FROM customers 
     WHERE user_id LIKE 'ISP%'`
  );
  
  const nextNum = (result[0]?.max_num || 0) + 1;
  return `ISP${String(nextNum).padStart(5, '0')}`;
};

/**
 * Format phone number for WhatsApp
 */
export const formatPhoneForWhatsApp = (phone) => {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Bangladesh numbers
  if (cleaned.startsWith('0')) {
    cleaned = '88' + cleaned;
  } else if (!cleaned.startsWith('88')) {
    cleaned = '88' + cleaned;
  }
  
  return cleaned;
};

/**
 * Format currency (BDT)
 */
export const formatCurrency = (amount) => {
  return `৳${Number(amount).toLocaleString('en-BD')}`;
};

/**
 * Calculate days between dates
 */
export const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format date for MySQL
 */
export const formatDateForMySQL = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

/**
 * Format datetime for MySQL
 */
export const formatDateTimeForMySQL = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Sanitize object - remove undefined values
 */
export const sanitizeObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
};

/**
 * Paginate query results
 */
export const paginate = (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return { limit: Math.min(limit, 100), offset };
};

/**
 * Build pagination response
 */
export const paginationResponse = (data, total, page, limit) => {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
};

/**
 * Validate Bangladesh phone number
 */
export const isValidBDPhone = (phone) => {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+?880)?[0-9]{10,11}$/.test(cleaned);
};

/**
 * Log activity
 */
export const logActivity = async (userId, action, entityType, entityId, details = {}) => {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

export default {
  generateCustomerUserId,
  formatPhoneForWhatsApp,
  formatCurrency,
  daysBetween,
  formatDateForMySQL,
  formatDateTimeForMySQL,
  sanitizeObject,
  paginate,
  paginationResponse,
  isValidBDPhone,
  logActivity,
};
