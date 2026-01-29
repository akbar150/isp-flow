-- Fix: Prevent staff from directly accessing password_hash in customers table
-- The application already uses customers_safe view, but direct table access is still possible

-- Step 1: Drop the current overly permissive SELECT policy for staff
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;

-- Step 2: Create a restrictive policy that only allows admins to SELECT from customers table
-- This is necessary for admin operations that need password_hash (like customer creation validation)
CREATE POLICY "Only admins can select from customers" 
  ON public.customers 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Step 3: Grant SELECT on customers_safe view to authenticated users
-- The view already excludes password_hash column
-- Note: Views inherit permissions from the base table unless security_invoker is enabled
-- We need to ensure the view is accessible via RLS

-- First, let's recreate the customers_safe view with security_invoker
-- to ensure it respects the caller's permissions and allows staff access
DROP VIEW IF EXISTS public.customers_safe;

CREATE VIEW public.customers_safe 
WITH (security_invoker = off) AS
SELECT 
  id,
  user_id,
  full_name,
  phone,
  alt_phone,
  address,
  area_id,
  router_id,
  package_id,
  billing_start_date,
  expiry_date,
  status,
  auto_renew,
  total_due,
  created_at,
  updated_at
FROM public.customers;

-- Grant SELECT on the view to authenticated users
-- With security_invoker = off, the view runs with owner (postgres) privileges
-- This allows staff to access customer data through the view without password_hash
GRANT SELECT ON public.customers_safe TO authenticated;

-- Note: The customers table still allows:
-- - INSERT by staff (for creating customers with password_hash)
-- - UPDATE by admins only (existing policy)
-- - SELECT by admins only (new policy above)
-- Staff must use customers_safe view for reading customer data