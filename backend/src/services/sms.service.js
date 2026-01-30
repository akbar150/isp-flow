/**
 * SMS Service
 * 
 * Integration with RouteMobile or other SMS gateway
 */

import dotenv from 'dotenv';

dotenv.config();

const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

/**
 * Send SMS via RouteMobile
 */
const sendViaRouteMobile = async (phone, message) => {
  const url = process.env.ROUTEMOBILE_URL || 'https://api.routemobile.com/sms';
  const username = process.env.ROUTEMOBILE_USERNAME;
  const password = process.env.ROUTEMOBILE_PASSWORD;
  const senderId = process.env.ROUTEMOBILE_SENDER_ID || 'EasyLink';

  if (!username || !password) {
    throw new Error('RouteMobile credentials not configured');
  }

  // Format phone number (ensure it starts with country code)
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '88' + formattedPhone;
  } else if (!formattedPhone.startsWith('88')) {
    formattedPhone = '88' + formattedPhone;
  }

  const params = new URLSearchParams({
    username,
    password,
    to: formattedPhone,
    message,
    source: senderId,
    type: 0, // Text message
  });

  const response = await fetch(`${url}?${params}`, {
    method: 'GET',
  });

  const responseText = await response.text();
  
  // Parse RouteMobile response
  if (!response.ok || responseText.includes('error')) {
    throw new Error(`SMS API error: ${responseText}`);
  }

  console.log(`SMS sent to ${formattedPhone}: ${responseText}`);
  return { success: true, response: responseText };
};

/**
 * Send SMS (public function)
 */
export const sendSMS = async (phone, message) => {
  if (!SMS_ENABLED) {
    console.log(`SMS disabled. Would send to ${phone}: ${message}`);
    return { success: true, simulated: true };
  }

  try {
    return await sendViaRouteMobile(phone, message);
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw error;
  }
};

/**
 * Send billing reminder SMS
 */
export const sendBillingReminderSMS = async (options) => {
  const { phone, customerName, userId, dueAmount, expiryDate, ispName } = options;

  // Bangla SMS template
  const message = `প্রিয় ${customerName}, আপনার ${ispName || 'EasyLink'} ইন্টারনেট বিল ৳${dueAmount} বকেয়া আছে। মেয়াদ শেষ: ${expiryDate}। অনুগ্রহ করে দ্রুত পেমেন্ট করুন। ID: ${userId}`;

  return sendSMS(phone, message);
};

/**
 * Send payment confirmation SMS
 */
export const sendPaymentConfirmationSMS = async (options) => {
  const { phone, customerName, amount, newBalance, ispName } = options;

  const message = `${customerName}, আপনার ৳${amount} পেমেন্ট সফলভাবে গৃহীত হয়েছে। বর্তমান বকেয়া: ৳${newBalance}। ধন্যবাদ - ${ispName || 'EasyLink ISP'}`;

  return sendSMS(phone, message);
};

/**
 * Send expiry notification SMS
 */
export const sendExpiryNotificationSMS = async (options) => {
  const { phone, customerName, daysUntilExpiry, ispName } = options;

  let message;
  if (daysUntilExpiry > 0) {
    message = `প্রিয় ${customerName}, আপনার ইন্টারনেট ${daysUntilExpiry} দিন পরে মেয়াদ শেষ হবে। সেবা অব্যাহত রাখতে রিনিউ করুন। - ${ispName || 'EasyLink'}`;
  } else if (daysUntilExpiry === 0) {
    message = `প্রিয় ${customerName}, আপনার ইন্টারনেট আজ মেয়াদ শেষ হচ্ছে। অনুগ্রহ করে এখনই রিনিউ করুন। - ${ispName || 'EasyLink'}`;
  } else {
    message = `প্রিয় ${customerName}, আপনার ইন্টারনেট মেয়াদ শেষ হয়ে গেছে। সেবা পুনরায় চালু করতে এখনই পেমেন্ট করুন। - ${ispName || 'EasyLink'}`;
  }

  return sendSMS(phone, message);
};

export default {
  sendSMS,
  sendBillingReminderSMS,
  sendPaymentConfirmationSMS,
  sendExpiryNotificationSMS,
};
