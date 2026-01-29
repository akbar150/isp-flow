-- Fix: Restrict system_settings SELECT to admins only
-- Staff currently can see all settings which may include sensitive configs

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view system_settings" ON public.system_settings;

-- Create admin-only SELECT policy
CREATE POLICY "Admins can view system_settings" 
  ON public.system_settings 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a public view for non-sensitive settings that staff need
-- This includes isp_name and whatsapp_template which are needed for reminders
CREATE OR REPLACE VIEW public.system_settings_public 
WITH (security_invoker = on) AS
SELECT key, value
FROM public.system_settings
WHERE key IN ('isp_name', 'whatsapp_template');

-- Grant select on the public view to authenticated users
GRANT SELECT ON public.system_settings_public TO authenticated;