import { differenceInDays, addDays, format } from "date-fns";

export type CustomerStatus = 'active' | 'expiring' | 'expired' | 'suspended';

export interface BillingCalculation {
  remainingDays: number;
  dueAmount: number;
  nextExpiryDate: Date;
  status: CustomerStatus;
  statusLabel: string;
}

/**
 * Calculate billing status based on expiry date
 */
export function calculateBillingStatus(
  expiryDate: Date,
  totalDue: number,
  currentStatus: CustomerStatus
): BillingCalculation {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const remainingDays = differenceInDays(expiry, today);
  
  let status: CustomerStatus = currentStatus;
  let statusLabel: string;
  
  if (currentStatus === 'suspended') {
    status = 'suspended';
    statusLabel = 'Suspended';
  } else if (remainingDays < 0) {
    const overdueDays = Math.abs(remainingDays);
    status = 'expired';
    if (overdueDays <= 30) {
      statusLabel = `Overdue ${overdueDays} days`;
    } else {
      statusLabel = 'Long Overdue';
    }
  } else if (remainingDays === 0) {
    status = 'expired';
    statusLabel = 'Expires Today';
  } else if (remainingDays <= 3) {
    status = 'expiring';
    statusLabel = `Expiring in ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  } else {
    status = 'active';
    statusLabel = `${remainingDays} days remaining`;
  }
  
  return {
    remainingDays,
    dueAmount: totalDue,
    nextExpiryDate: addDays(expiry, 30),
    status,
    statusLabel
  };
}

/**
 * Calculate new expiry date based on payment
 */
export function calculateNewExpiry(
  currentExpiry: Date,
  packageValidityDays: number,
  isAdvancePayment: boolean = false
): Date {
  const today = new Date();
  const expiry = new Date(currentExpiry);
  
  // If already expired, start from today
  // If advance payment, extend from current expiry
  const baseDate = expiry < today && !isAdvancePayment ? today : expiry;
  
  return addDays(baseDate, packageValidityDays);
}


/**
 * Generate WhatsApp message for reminder with Unicode/Bangla support
 */
export function generateWhatsAppMessage(
  customerName: string,
  userId: string,
  packageName: string,
  expiryDate: Date,
  amount: number,
  ispName: string = 'Smart ISP',
  pppoeUsername?: string,
  pppoePassword?: string
): string {
  const formattedDate = format(expiryDate, 'dd MMM yyyy');
  
  // WhatsApp supports Unicode natively - using bold (*text*) and monospace (```text```)
  let message = `🔔 *পেমেন্ট রিমাইন্ডার / Payment Reminder*

প্রিয় *${customerName}*,

📋 *অ্যাকাউন্ট তথ্য / Account Details:*
━━━━━━━━━━━━━━━━
👤 PPPoE Username: \`${pppoeUsername || userId}\``;

  if (pppoePassword) {
    message += `\n🔑 PPPoE Password: \`${pppoePassword}\``;
  }
  
  message += `
🆔 Customer ID: \`${userId}\`
📦 Package: *${packageName}*
📅 মেয়াদ উত্তীর্ণ / Expires: *${formattedDate}*
💰 বকেয়া / Due Amount: *৳${amount}*
━━━━━━━━━━━━━━━━

⚠️ সংযোগ বিচ্ছিন্ন এড়াতে অনুগ্রহ করে পেমেন্ট করুন।
Please pay to avoid disconnection.

ধন্যবাদ / Thank you
*${ispName}* 🌐`;

  return message;
}

/**
 * Sanitize message for WhatsApp URL - removes problematic Unicode characters
 * that can cause URL parsing issues (especially with emojis)
 */
function sanitizeForWhatsAppUrl(message: string): string {
  return message
    // Replace Unicode line separators with standard newlines
    .replace(/\u2028/g, '\n')  // Line Separator
    .replace(/\u2029/g, '\n')  // Paragraph Separator
    // Remove zero-width characters that can cause issues
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace non-breaking spaces with regular spaces
    .replace(/\u00A0/g, ' ')
    // Normalize multiple newlines
    .replace(/\n{3,}/g, '\n\n');
}

function formatWhatsAppPhone(phone: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  // Ensure it starts with country code, but without leading +
  const formattedPhone = cleanPhone.startsWith('+')
    ? cleanPhone.slice(1)
    : cleanPhone.startsWith('0')
      ? '88' + cleanPhone.slice(1)
      : cleanPhone;

  return formattedPhone;
}

/**
 * Get WhatsApp click-to-send URL
 */
export function getWhatsAppUrl(phone: string, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  
  // Sanitize message to fix URL parsing issues with emojis
  const sanitizedMessage = sanitizeForWhatsAppUrl(message);
  
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(sanitizedMessage)}`;
}

/**
 * Mobile deep-link that opens the native WhatsApp app directly.
 * This avoids WhatsApp Web re-parsing/re-encoding in some browsers.
 */
export function getWhatsAppDeepLink(phone: string, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const sanitizedMessage = sanitizeForWhatsAppUrl(message);

  return `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(sanitizedMessage)}`;
}
