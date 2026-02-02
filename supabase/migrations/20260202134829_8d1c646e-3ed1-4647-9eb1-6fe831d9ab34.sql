-- Fix 1: Update get_public_system_settings to remove google_maps_api_key from anon access
-- Google Maps API key should only be accessible to authenticated users via system_settings table
CREATE OR REPLACE FUNCTION public.get_public_system_settings()
 RETURNS TABLE(key text, value jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT s.key, s.value
  FROM public.system_settings s
  WHERE s.key IN (
    'isp_name',
    'whatsapp_template',
    'email_from_name',
    'email_from_address',
    'email_subject_reminder',
    'email_template_reminder',
    'sms_template',
    'sms_template_en',
    'smtp_server',
    'smtp_port',
    'smtp_username'
    -- Removed 'google_maps_api_key' - should only be accessible to authenticated users
  )
  ORDER BY s.key;
$$;

-- Revoke execute from anon role to prevent unauthenticated access
REVOKE EXECUTE ON FUNCTION public.get_public_system_settings() FROM anon;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_public_system_settings() TO authenticated;