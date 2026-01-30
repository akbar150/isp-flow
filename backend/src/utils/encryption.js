/**
 * Encryption Utilities
 * 
 * Password hashing and AES encryption for sensitive data
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-byte-encryption-key!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Verify password against hash
 */
export const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Encrypt sensitive data using AES-256
 */
export const encrypt = (text) => {
  if (!text) return null;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt AES-256 encrypted data
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

/**
 * Generate random alphanumeric string
 */
export const generateRandomString = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  
  return result;
};

/**
 * Generate UUID v4
 */
export const generateUUID = () => {
  return crypto.randomUUID();
};

export default {
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  generateRandomString,
  generateUUID,
};
