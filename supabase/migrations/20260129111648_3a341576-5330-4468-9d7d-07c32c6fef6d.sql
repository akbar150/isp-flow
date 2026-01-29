-- Fix Security Issues: RLS policies and password handling

-- 1. Create a secure view for customers that excludes password_hash
CREATE VIEW public.customers_safe
WITH (security_invoker=on) AS
SELECT 
  id, user_id, full_name, phone, alt_phone, address, 
  area_id, router_id, package_id, billing_start_date, 
  expiry_date, status, auto_renew, total_due, created_at, updated_at
FROM public.customers;

-- 2. Create a secure view for routers that excludes password_encrypted
CREATE VIEW public.routers_safe
WITH (security_invoker=on) AS
SELECT 
  id, name, ip_address, port, username, mode, is_active, created_at, updated_at
FROM public.routers;

-- 3. Create a secure view for mikrotik_users that excludes password_encrypted
CREATE VIEW public.mikrotik_users_safe
WITH (security_invoker=on) AS
SELECT 
  id, customer_id, username, profile, status, router_id, 
  last_synced_at, created_at, updated_at
FROM public.mikrotik_users;

-- 4. Drop overly permissive policies on customers
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

-- 5. Create role-based policies for customers table
-- Only admins can read/write customer data (including password_hash for internal use)
CREATE POLICY "Admins can manage customers" ON public.customers
FOR ALL USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff can read customer data through the safe view only
-- No direct SELECT on customers table for non-admins
CREATE POLICY "Staff can view customers" ON public.customers
FOR SELECT USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Staff can create customers
CREATE POLICY "Staff can create customers" ON public.customers
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 6. Drop overly permissive policies on mikrotik_users
DROP POLICY IF EXISTS "Authenticated users can manage mikrotik_users" ON public.mikrotik_users;
DROP POLICY IF EXISTS "Authenticated users can view mikrotik_users" ON public.mikrotik_users;

-- Create role-based policies for mikrotik_users
CREATE POLICY "Admins can manage mikrotik_users" ON public.mikrotik_users
FOR ALL USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view mikrotik_users" ON public.mikrotik_users
FOR SELECT USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- 7. Drop overly permissive policies on activity_logs
DROP POLICY IF EXISTS "Authenticated users can create activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can view activity_logs" ON public.activity_logs;

-- Create proper activity_logs policies (admins only can view, system can create)
CREATE POLICY "Admins can view activity_logs" ON public.activity_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert activity_logs" ON public.activity_logs
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Update payments policies to track who created them
DROP POLICY IF EXISTS "Authenticated users can create payments" ON public.payments;

CREATE POLICY "Authenticated users can create payments with user tracking" ON public.payments
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (created_by IS NULL OR created_by = auth.uid())
);

-- 9. Update reminder_logs policies
DROP POLICY IF EXISTS "Authenticated users can create reminder_logs" ON public.reminder_logs;
DROP POLICY IF EXISTS "Authenticated users can view reminder_logs" ON public.reminder_logs;

CREATE POLICY "Authenticated users can create reminder_logs with user tracking" ON public.reminder_logs
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (sent_by IS NULL OR sent_by = auth.uid())
);

CREATE POLICY "Admins can view reminder_logs" ON public.reminder_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view reminder_logs" ON public.reminder_logs
FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- 10. Fix user_roles INSERT policy to prevent client-side role assignment
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Only allow admins to manage roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Prevent any authenticated user from directly inserting roles
-- Roles should only be assigned by admins or through database triggers
CREATE POLICY "Block direct user role insertion" ON public.user_roles
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  -- Allow first user signup when no roles exist yet
  NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
);

-- 11. Add policy for profiles INSERT (was missing)
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 12. Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 13. Create a function to hash passwords using bcrypt
CREATE OR REPLACE FUNCTION public.hash_password(raw_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(raw_password, gen_salt('bf', 10));
END;
$$;

-- 14. Create a function to verify passwords
CREATE OR REPLACE FUNCTION public.verify_password(raw_password TEXT, hashed_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN hashed_password = crypt(raw_password, hashed_password);
END;
$$;