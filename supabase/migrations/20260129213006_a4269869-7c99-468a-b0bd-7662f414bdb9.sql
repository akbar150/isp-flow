-- 1) Ensure upserts work: key must be unique
ALTER TABLE public.system_settings
ADD CONSTRAINT system_settings_key_unique UNIQUE (key);

-- 2) Safe read of non-sensitive settings for the app (templates/branding only)
CREATE OR REPLACE FUNCTION public.get_public_system_settings()
RETURNS TABLE(key text, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    'sms_template_en'
  )
  ORDER BY s.key;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_system_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_system_settings() TO authenticated;