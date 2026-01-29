

# Bug Fix Plan: Email, User Management, Templates & ISP Name

## Overview

This plan addresses four persistent bugs:

1. **Email Sending Failure** - Implement Brevo SMTP with configurable settings
2. **User Management Errors** - Fix edge function authentication and role updates
3. **Template Not Updating** - Fix template fetching and variable replacement
4. **{ISP Name} Not Dynamic** - Replace all hardcoded "Smart ISP" with dynamic values

---

## Bug Analysis Summary

| Bug | Root Cause | Solution |
|-----|------------|----------|
| Email fails | Resend requires verified domain; Brevo API blocks unrecognized IPs | Add Brevo SMTP support using HTTP API relay |
| Users connection error | Edge function works but frontend shows error on empty response | Improve error handling and ensure proper response parsing |
| Templates not updating | WhatsApp button initializes message once at mount; doesn't re-render when templates load | Use useEffect to update message when template changes |
| {ISP Name} hardcoded | Multiple components have "Smart ISP" fallback; variable format mismatch ({ISP Name} vs {ISPName}) | Standardize to {ISPName} and replace all hardcoded values |

---

## Implementation Details

### 1. Email System: Brevo SMTP Settings

**New Settings UI** (Settings > Email tab)

Add SMTP configuration fields to `EmailTemplates.tsx`:
- SMTP Server (e.g., `smtp-relay.brevo.com`)
- SMTP Port (e.g., `587`)
- SMTP Username (e.g., `login@email.com`)
- SMTP Password (encrypted storage)

**Database Storage**

Store SMTP credentials in `system_settings` table:
- `smtp_server` (plaintext)
- `smtp_port` (plaintext)
- `smtp_username` (plaintext)
- `smtp_password_encrypted` (encrypted via pgcrypto)

**Edge Function Update**

Modify `send-email-brevo/index.ts` to:
1. First try fetching SMTP settings from database
2. Use Brevo HTTP API (not raw SMTP due to port restrictions)
3. Fall back to Resend if Brevo fails
4. Provide clear error messages

**Important Note**: Supabase Edge Functions block outbound SMTP ports (25, 465, 587). We'll use Brevo's HTTP API with the SMTP key as authentication, which works around this limitation.

---

### 2. User Management Fix

**Files to modify**: `UserManagement.tsx`, `manage-user/index.ts`

**Issue**: The frontend shows "Connection Error" even when the edge function works properly.

**Fixes**:
- Add better error logging in the edge function
- Ensure the edge function always returns a valid JSON response
- Fix frontend to properly parse responses and show specific errors
- Verify RLS policies allow admins to update profiles

---

### 3. Template Persistence Fix

**Files to modify**: `WhatsAppButton.tsx`, `EmailButton.tsx`, `useIspSettings.tsx`

**Issue**: Template variable `{ISP Name}` doesn't match code expectation `{ISPName}`

**Fixes**:

1. Standardize variable names:
   - Change template default from `{ISP Name}` to `{ISPName}` in Settings.tsx
   - Update documentation in Settings page

2. Update WhatsAppButton.tsx:
   - Move message state initialization into useEffect
   - Recalculate message when `whatsappTemplate` from context changes

3. Update EmailButton.tsx:
   - Same pattern - recalculate when template changes

4. Fix useIspSettings.tsx:
   - Ensure JSON string values are properly parsed (remove extra quotes)

---

### 4. Dynamic ISP Name Replacement

**Files with hardcoded "Smart ISP"**:

| File | Line | Change |
|------|------|--------|
| `src/hooks/useIspSettings.tsx` | 52, 54, 66, 68 | Keep as fallback defaults (OK) |
| `src/pages/Settings.tsx` | 25, 60 | Keep as fallback (OK) |
| `src/components/settings/EmailTemplates.tsx` | 15 | Use dynamic ispName |
| `src/pages/CustomerPortal.tsx` | 201 | Use `useIspSettings()` hook |
| `src/services/billing/billingService.ts` | 164 | Already parameterized (OK) |
| `supabase/functions/manage-user/index.ts` | 383, 385, 389 | Fetch ISP name from system_settings |

---

## Technical Implementation

### Phase 1: Database Updates

Add encrypted SMTP password storage:

```sql
-- Add function to encrypt SMTP password
CREATE OR REPLACE FUNCTION public.encrypt_smtp_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN encode(encrypt(plain_password::bytea, 'smtp_secret_key'::bytea, 'aes'), 'base64');
END;
$$;

-- Add function to decrypt SMTP password (only callable by edge functions via service key)
CREATE OR REPLACE FUNCTION public.decrypt_smtp_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN convert_from(decrypt(decode(encrypted_password, 'base64'), 'smtp_secret_key'::bytea, 'aes'), 'utf8');
END;
$$;
```

### Phase 2: Settings UI Updates

Update `EmailTemplates.tsx` to include:
- SMTP configuration section with Server, Port, Username, Password fields
- Test connection button
- Clear instructions about Brevo SMTP relay

### Phase 3: Edge Function Updates

**send-email-brevo/index.ts**:
- Fetch SMTP credentials from database
- Use Brevo HTTP API with SMTP key
- Better error messages

**manage-user/index.ts**:
- Fetch ISP name from system_settings for password reset emails
- Ensure all responses are valid JSON

### Phase 4: Frontend Template Fixes

**WhatsAppButton.tsx**:
```typescript
// Use useEffect to update message when template changes
useEffect(() => {
  const newMessage = applyTemplateVars(whatsappTemplate, templateVars);
  setMessage(newMessage);
}, [whatsappTemplate, ispName, customerName, userId, ...]);
```

**CustomerPortal.tsx**:
- Add `useIspSettings()` hook
- Replace hardcoded "Smart ISP" with `ispName`

### Phase 5: Variable Standardization

Update default WhatsApp template in `Settings.tsx`:
- Change `{ISP Name}` to `{ISPName}` (no space)
- Update variable documentation in the UI

---

## Testing Checklist

After implementation:

- [ ] Go to Settings > Email, enter Brevo SMTP credentials, save
- [ ] Send a test email to a customer - verify it works
- [ ] Go to Settings > Users, verify user list loads without errors
- [ ] Edit a user's name and role - verify changes save
- [ ] Go to Settings > WhatsApp, update template, save
- [ ] Send WhatsApp reminder - verify new template appears
- [ ] Change ISP Name in General Settings
- [ ] Verify ISP Name updates on login page, customer portal, and messages

---

## Files to Create

None (all changes are modifications to existing files)

## Files to Modify

1. `src/components/settings/EmailTemplates.tsx` - Add SMTP configuration UI
2. `src/hooks/useIspSettings.tsx` - Improve value parsing
3. `src/components/WhatsAppButton.tsx` - Fix template reactivity
4. `src/components/EmailButton.tsx` - Fix template reactivity
5. `src/pages/Settings.tsx` - Standardize template variables
6. `src/pages/CustomerPortal.tsx` - Use dynamic ISP name
7. `supabase/functions/send-email-brevo/index.ts` - Add Brevo SMTP support
8. `supabase/functions/manage-user/index.ts` - Dynamic ISP name in emails
9. Database migration for SMTP encryption functions

## Edge Functions to Deploy

- `send-email-brevo`
- `manage-user`

