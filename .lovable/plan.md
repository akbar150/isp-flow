

# Enforce 880 Phone Format (International Bangladesh Format)

## Overview
Standardize all phone numbers to use the `880` prefix format (e.g., `8801701377315`) -- 13 digits total. Currently the system accepts mixed formats (`01XXXXXXXXX`, `+880XXXXXXXXX`, etc.) and stores them inconsistently.

## Changes

### 1. Create a shared phone utility (`src/lib/phoneUtils.ts`)
- `normalizePhone(phone: string): string` -- strips spaces/dashes, converts any format to `880XXXXXXXXXX` (13 digits)
  - `01712345678` -> `8801712345678`
  - `+8801712345678` -> `8801712345678`
  - `8801712345678` -> `8801712345678` (no change)
- `isValidBDPhone(phone: string): boolean` -- validates the normalized result matches `/^880[13-9]\d{8}$/` (13 digits)
- `formatPhoneDisplay(phone: string): string` -- returns `+880 1XXX-XXXXXX` for display

### 2. Update AddCustomerDialog.tsx
- Import `normalizePhone` and `isValidBDPhone` from phoneUtils
- Change validation regex to use `isValidBDPhone`
- Normalize phone before saving: `phone: normalizePhone(formData.phone)`
- Same for `alt_phone`
- Update placeholder to `8801XXXXXXXXX`
- Show error: "Phone must start with 880 (e.g., 8801701377315)"

### 3. Update Customers.tsx (Edit dialog)
- Same validation and normalization changes as AddCustomerDialog
- Normalize phone on save

### 4. Update BulkCustomerUpload.tsx
- Use `isValidBDPhone` for validation
- Use `normalizePhone` before sending to backend

### 5. Update import-customers-bulk edge function
- Change normalization logic: instead of stripping `880` prefix, ensure it stays as `880XXXXXXXXXX`
- Current code strips `880` and adds `0` -- reverse this to keep `880` format

### 6. Update customer-auth edge function
- Change register validation from `^01[3-9]\d{8}$` to accept `880` format: `^880[13-9]\d{8}$`
- Normalize input phone to `880` format before storing
- Update error message: "Use: 8801XXXXXXXXX"
- Update profile update validation similarly

### 7. Update existing customer phones in database
- Run a data migration to convert all existing phones from `01XXXXXXXXX` format to `8801XXXXXXXXX`
- `UPDATE customers SET phone = '88' || phone WHERE phone LIKE '01%' AND length(phone) = 11`
- Same for `alt_phone`

### 8. Update WhatsApp/SMS phone formatting
- `formatWhatsAppPhone` in billingService.ts already handles conversion, but with `880` stored natively it becomes simpler
- `send-sms-routemobile` edge function already converts to `88` prefix -- will work seamlessly with `880` format

## Files to Create/Modify
- **Create**: `src/lib/phoneUtils.ts`
- **Modify**: `src/components/AddCustomerDialog.tsx`
- **Modify**: `src/pages/Customers.tsx`
- **Modify**: `src/components/BulkCustomerUpload.tsx`
- **Modify**: `supabase/functions/import-customers-bulk/index.ts`
- **Modify**: `supabase/functions/customer-auth/index.ts`
- **Database**: Data update for existing phone numbers

