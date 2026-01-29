
# Bug Fix Plan: Email, User Management, WhatsApp & ISP Name

## Issues Identified

### 1. Email Sending Failure
**Root Cause**: The edge function is trying to use Brevo SMTP key (`xsmtpsib-...`) with Brevo's HTTP API, but the HTTP API requires a different **API key** (not SMTP key). 

**Edge Functions cannot use raw SMTP** (ports 25, 465, 587 are blocked), so we must use HTTP APIs only.

**Solution**: 
- Clarify in the UI that Brevo **API key** is required, not SMTP key
- Rename the Settings UI from "SMTP Password" to "Brevo API Key"
- Update the edge function to properly use the stored API key
- User needs to generate an API key from Brevo dashboard (SMTP & API → API Keys), not the SMTP key

### 2. User Management "Connection Error"  
**Root Cause**: The edge function is returning 400 status codes when there's an error, but the frontend treats any error as "Connection Error" and falls back to local data.

**Observation**: Edge function logs show only "shutdown" entries, meaning the function isn't being reached - likely a CORS or network issue from the browser.

**Solution**:
- Improve frontend error handling to show specific error messages
- Ensure the user is logged in as admin/super_admin when accessing this page
- Add better logging to identify where the failure occurs

### 3. WhatsApp Emojis Not Displaying on Mobile
**Root Cause**: The WhatsApp template is stored correctly with emojis in the database. The issue is likely that when the message is encoded via `encodeURIComponent()`, some characters may not display correctly on certain mobile devices.

**Observation**: The user sees `""` (empty box) instead of emojis. This can happen when:
- The phone doesn't support certain emoji characters
- The encoding is corrupted during storage/retrieval
- The URL encoding is too long and gets truncated

**Solution**:
- Verify the template is being read correctly from the database
- Ensure emojis are preserved through the encode/decode pipeline
- Test with simpler emojis to isolate the issue
- Add a "Preview" button to show exactly what will be sent

### 4. ISP Name Shows "Smart ISP" Instead of "EasyLink BD"
**Root Cause**: The default value "Smart ISP" is used as fallback in multiple places. The settings are loaded asynchronously, so during initial render, the default shows before the actual value loads.

**Locations with hardcoded "Smart ISP"**:
- `src/hooks/useIspSettings.tsx` (default context value)
- `src/pages/Settings.tsx` (default form state)
- `src/services/billing/billingService.ts` (function default parameter)

**Solution**:
- Keep "Smart ISP" as fallback defaults (necessary for initial state)
- Ensure components wait for `loading: false` before rendering ISP name
- Add loading states to show placeholder instead of incorrect default

---

## Technical Implementation

### Phase 1: Fix Email Configuration

**Update Settings UI** (`EmailTemplates.tsx`):
- Change labels from "SMTP Password" to "Brevo API Key"
- Update instructions to specify user needs API key, not SMTP key
- Add note: "Get your API key from Brevo > SMTP & API > API Keys"
- Change storage key from `smtp_password_encrypted` to store API key

**Update Edge Function** (`send-email-brevo/index.ts`):
- Simplify to just use the stored API key directly
- Remove the SMTP-style logic that doesn't work with HTTP API
- Clear error messages when API key is invalid

### Phase 2: Fix User Management

**Update Frontend** (`UserManagement.tsx`):
- Better distinguish between network errors vs API errors
- Show specific error messages from the edge function
- Improve loading states

**Update Edge Function** (`manage-user/index.ts`):
- Add more console logging for debugging
- Ensure CORS headers are correct

### Phase 3: Fix WhatsApp Template

**Update WhatsApp Flow**:
- Ensure `decodeSettingValue()` properly handles emoji characters
- Add console logging to verify template content before sending
- The database already has the correct template with emojis

### Phase 4: ISP Name Loading Fix

**Add loading state awareness**:
- Components should show loading placeholder while `settings.loading` is true
- Once loaded, the correct ISP name will display

---

## Files to Modify

1. `src/components/settings/EmailTemplates.tsx` - Update labels and instructions for Brevo API key
2. `supabase/functions/send-email-brevo/index.ts` - Simplify to use API key directly
3. `src/components/settings/UserManagement.tsx` - Improve error handling
4. `src/components/WhatsAppButton.tsx` - Add logging for template debugging
5. `src/hooks/useIspSettings.tsx` - No changes needed (defaults are correct)

---

## User Action Required

**To fix email sending**, you need to:
1. Go to [Brevo Dashboard](https://app.brevo.com/)
2. Navigate to **SMTP & API** → **API Keys**
3. Generate a new **API Key** (not SMTP key!)
4. Go to Settings → Email in your app
5. Enter the API key in the "Brevo API Key" field
6. Save and test

**Note**: The SMTP key (`xsmtpsib-...`) you currently have configured **cannot be used with the HTTP API**. You need to generate a separate API key that starts with `xkeysib-...`.

---

## Testing Checklist

After implementation:
- [ ] Generate Brevo API key and enter in Settings → Email
- [ ] Send test email - should succeed
- [ ] Go to Settings → Users - should load without "Connection Error"
- [ ] Edit a user's name - should save successfully
- [ ] Send WhatsApp reminder - emojis should display on mobile
- [ ] Verify ISP name shows "EasyLink BD" throughout the app

---

## Edge Functions to Deploy

- `send-email-brevo` 
- `manage-user`
