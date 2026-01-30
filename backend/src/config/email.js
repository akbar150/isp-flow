/**
 * Email Configuration
 * 
 * Primary: cPanel SMTP
 * Fallback: Brevo HTTP API
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// cPanel SMTP Transporter
export const createSmtpTransport = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.easylinkbd.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Allow self-signed certs on cPanel
    },
  });
};

// Email defaults
export const emailDefaults = {
  from: {
    name: process.env.EMAIL_FROM_NAME || 'EasyLink ISP',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@easylinkbd.com',
  },
};

// Brevo API configuration
export const brevoConfig = {
  apiKey: process.env.BREVO_API_KEY,
  apiUrl: 'https://api.brevo.com/v3/smtp/email',
};

export default {
  createSmtpTransport,
  emailDefaults,
  brevoConfig,
};
