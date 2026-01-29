-- Fix system_settings_public view to allow staff access
-- Remove security_invoker to allow staff to access whitelisted settings through the view
-- The WHERE clause limits exposure to only 'isp_name' and 'whatsapp_template' settings

DROP VIEW IF EXISTS public.system_settings_public;

CREATE OR REPLACE VIEW public.system_settings_public AS
SELECT key, value 
FROM public.system_settings
WHERE key IN ('isp_name', 'whatsapp_template');