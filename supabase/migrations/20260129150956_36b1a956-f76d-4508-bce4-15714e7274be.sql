-- Insert super_admin permissions (full access to everything including user management)
INSERT INTO public.permissions (role, resource, action, allowed)
SELECT 'super_admin'::app_role, resource, action, true
FROM (
  SELECT DISTINCT resource, action FROM public.permissions WHERE role = 'admin'
) AS existing_permissions
ON CONFLICT (role, resource, action) DO NOTHING;

-- Add super admin specific permissions for managing other admins
INSERT INTO public.permissions (role, resource, action, allowed)
VALUES 
  ('super_admin', 'super_admin', 'create', true),
  ('super_admin', 'super_admin', 'read', true),
  ('super_admin', 'super_admin', 'update', true),
  ('super_admin', 'super_admin', 'delete', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- Create a function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Update RLS policies to allow super_admin same access as admin
-- For user_roles table - super_admin can manage all roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins and super_admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- For profiles table - super_admin can manage all profiles  
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins and super_admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super_admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- For permissions table - super_admin can manage
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;
CREATE POLICY "Admins and super_admins can manage permissions"
ON public.permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update customer table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Admins and super_admins can manage customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update payments table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
CREATE POLICY "Admins and super_admins can manage payments"
ON public.payments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update packages table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;
CREATE POLICY "Admins and super_admins can manage packages"
ON public.packages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update routers table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage routers" ON public.routers;
CREATE POLICY "Admins and super_admins can manage routers"
ON public.routers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update areas table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage areas" ON public.areas;
CREATE POLICY "Admins and super_admins can manage areas"
ON public.areas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update system_settings table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage system_settings" ON public.system_settings;
CREATE POLICY "Admins and super_admins can manage system_settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can view system_settings" ON public.system_settings;
CREATE POLICY "Admins and super_admins can view system_settings"
ON public.system_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update call_records table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage call_records" ON public.call_records;
CREATE POLICY "Admins and super_admins can manage call_records"
ON public.call_records
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update mikrotik_users table policies for super_admin
DROP POLICY IF EXISTS "Admins can manage mikrotik_users" ON public.mikrotik_users;
CREATE POLICY "Admins and super_admins can manage mikrotik_users"
ON public.mikrotik_users
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update activity_logs table policies for super_admin
DROP POLICY IF EXISTS "Admins can view activity_logs" ON public.activity_logs;
CREATE POLICY "Admins and super_admins can view activity_logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update reminder_logs table policies for super_admin
DROP POLICY IF EXISTS "Admins can view reminder_logs" ON public.reminder_logs;
CREATE POLICY "Admins and super_admins can view reminder_logs"
ON public.reminder_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));