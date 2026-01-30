import { supabase } from "@/integrations/supabase/client";
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
 * Process a payment and update customer billing
 */
export async function processPayment(
  customerId: string,
  amount: number,
  method: 'bkash' | 'cash' | 'bank_transfer' | 'due',
  transactionId?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get customer with package details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*, packages(*)')
      .eq('id', customerId)
      .single();
    
    if (customerError || !customer) {
      throw new Error('Customer not found');
    }
    
    const newDue = Math.max(0, customer.total_due - amount);
    const remainingDue = customer.total_due - amount;
    
    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        customer_id: customerId,
        amount,
        method,
        transaction_id: transactionId,
        notes,
        remaining_due: Math.max(0, remainingDue)
      });
    
    if (paymentError) throw paymentError;
    
    // If full payment made, extend expiry and update status
    const updates: Record<string, unknown> = {
      total_due: newDue
    };
    
    if (amount >= customer.total_due && customer.packages) {
      const newExpiry = calculateNewExpiry(
        new Date(customer.expiry_date),
        customer.packages.validity_days,
        true
      );
      updates.expiry_date = format(newExpiry, 'yyyy-MM-dd');
      updates.status = 'active';
    }
    
    const { error: updateError } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);
    
    if (updateError) throw updateError;
    
    return {
      success: true,
      message: `Payment of ৳${amount} processed successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Payment failed'
    };
  }
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

/**
 * Get WhatsApp click-to-send URL
 */
export function getWhatsAppUrl(phone: string, message: string): string {
  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  // Ensure it starts with country code
  const formattedPhone = cleanPhone.startsWith('+') 
    ? cleanPhone.slice(1) 
    : cleanPhone.startsWith('0') 
      ? '88' + cleanPhone.slice(1)
      : cleanPhone;
  
  // Sanitize message to fix URL parsing issues with emojis
  const sanitizedMessage = sanitizeForWhatsAppUrl(message);
  
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(sanitizedMessage)}`;
}
