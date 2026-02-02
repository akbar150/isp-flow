-- Update get_public_system_settings to include google_maps_api_key for authenticated users only
CREATE OR REPLACE FUNCTION public.get_public_system_settings()
 RETURNS TABLE(key text, value jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  )
  OR (
    -- Only include google_maps_api_key for authenticated users
    s.key = 'google_maps_api_key' AND auth.uid() IS NOT NULL
  )
  ORDER BY s.key;
$function$;