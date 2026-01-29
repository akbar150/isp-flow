CREATE OR REPLACE VIEW public.system_settings_public
WITH (security_invoker = true)
AS
  SELECT key, value
  FROM public.system_settings
  WHERE key = ANY (ARRAY['isp_name'::text, 'whatsapp_template'::text]);