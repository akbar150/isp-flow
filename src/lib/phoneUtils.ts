/**
 * Bangladesh phone number utilities
 * Standard format: 880XXXXXXXXX (13 digits)
 */

/**
 * Normalize any BD phone format to 880XXXXXXXXX (13 digits)
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  
  // +8801... → 8801...
  if (digits.startsWith("880") && digits.length === 13) return digits;
  
  // 01... (local) → 8801...
  if (digits.startsWith("0") && digits.length === 11) return "88" + digits;
  
  // 1... (without leading 0) → 8801...
  if (digits.startsWith("1") && digits.length === 10) return "880" + digits;
  
  return digits;
}

/**
 * Validate normalized BD phone: must be 880[13-9]XXXXXXXX (13 digits)
 */
export function isValidBDPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^880[13-9]\d{8}$/.test(normalized);
}

/**
 * Format for display: +880 1XXX-XXXXXXX
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 13) return phone;
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 7)}-${normalized.slice(7)}`;
}
