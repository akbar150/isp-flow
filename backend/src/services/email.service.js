/**
 * Email Service
 * 
 * Primary: cPanel SMTP via Nodemailer
 * Fallback: Brevo HTTP API
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create SMTP transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.easylinkbd.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send email via SMTP
 */
const sendViaSMTP = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'EasyLink ISP',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@easylinkbd.com',
    },
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent via SMTP:', info.messageId);
  return { success: true, messageId: info.messageId };
};

/**
 * Send email via Brevo API
 */
const sendViaBrevo = async ({ to, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    throw new Error('BREVO_API_KEY not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'EasyLink ISP',
        email: process.env.EMAIL_FROM_ADDRESS || 'noreply@easylinkbd.com',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log('Email sent via Brevo:', result.messageId);
  return { success: true, messageId: result.messageId };
};

/**
 * Send email with automatic fallback
 */
export const sendEmail = async (options) => {
  const { to, subject, html, text } = options;

  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html');
  }

  // Try SMTP first
  try {
    return await sendViaSMTP({ to, subject, html, text });
  } catch (smtpError) {
    console.warn('SMTP failed, trying Brevo:', smtpError.message);
    
    // Try Brevo as fallback
    try {
      return await sendViaBrevo({ to, subject, html, text });
    } catch (brevoError) {
      console.error('Both email methods failed');
      throw new Error(`Email delivery failed: SMTP (${smtpError.message}), Brevo (${brevoError.message})`);
    }
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, resetUrl, userName, ispName) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">${ispName || 'EasyLink ISP'}</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
    <p>Hello${userName ? ` ${userName}` : ''},</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>
    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} ${ispName || 'EasyLink ISP'}. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html,
  });
};

/**
 * Send billing reminder email
 */
export const sendBillingReminderEmail = async (options) => {
  const { to, customerName, userId, dueAmount, expiryDate, packageName, ispName } = options;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">${ispName || 'EasyLink ISP'}</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Billing Reminder 💳</h2>
    <p>প্রিয় ${customerName},</p>
    <p>আপনার ইন্টারনেট বিলের পেমেন্ট রিমাইন্ডার:</p>
    <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>গ্রাহক আইডি:</strong> ${userId}</p>
      <p><strong>প্যাকেজ:</strong> ${packageName}</p>
      <p><strong>বকেয়া পরিমাণ:</strong> ৳${dueAmount}</p>
      <p><strong>মেয়াদ শেষ:</strong> ${expiryDate}</p>
    </div>
    <p>অনুগ্রহ করে সময়মতো পেমেন্ট করুন যাতে আপনার সেবা অব্যাহত থাকে।</p>
    <p style="color: #666; font-size: 14px;">ধন্যবাদ।</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} ${ispName || 'EasyLink ISP'}
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: `Billing Reminder - ${ispName || 'EasyLink ISP'}`,
    html,
  });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendBillingReminderEmail,
};
