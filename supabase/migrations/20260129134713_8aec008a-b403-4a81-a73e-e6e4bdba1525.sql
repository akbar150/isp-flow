-- Fix the security definer view issue
-- The problem: security_invoker = off bypasses RLS (bad)
-- The solution: Use security_invoker = on, but the view will work because 
-- we've granted SELECT on the view and staff can access via view owner's context

-- Drop and recreate the view with security_invoker = on (the secure default)
DROP VIEW IF EXISTS public.customers_safe;

-- Create the view with security_invoker = on (which is actually the default)
-- The key insight: With proper view ownership by postgres/superuser and 
-- RLS protecting the base table, the view can still work IF we structure it correctly
CREATE VIEW public.customers_safe AS
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

-- The issue is that with security_invoker=on, staff can't query the view
-- because RLS on customers table blocks them.
-- 
-- Solution: We need to allow staff to SELECT from customers BUT only through the view
-- This requires a different approach: use a SECURITY DEFINER function instead

-- Actually, the cleanest solution for Supabase is to:
-- 1. Keep the current RLS (admins only for direct SELECT)
-- 2. Create a SECURITY DEFINER function that returns customer data without password_hash
-- 3. Grant EXECUTE on that function to authenticated users

-- Let's drop the problematic view and use a function instead
DROP VIEW IF EXISTS public.customers_safe;

-- Create a table-returning function that hides password_hash
CREATE OR REPLACE FUNCTION public.get_customers_safe()
RETURNS TABLE (
  id uuid,
  user_id text,
  full_name text,
  phone text,
  alt_phone text,
  address text,
  area_id uuid,
  router_id uuid,
  package_id uuid,
  billing_start_date date,
  expiry_date date,
  status customer_status,
  auto_renew boolean,
  total_due numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM public.customers
  WHERE public.has_role(auth.uid(), 'staff'::app_role) 
     OR public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customers_safe() TO authenticated;

-- Now recreate the view using this function
-- This makes it work seamlessly with existing code that uses customers_safe
CREATE VIEW public.customers_safe AS
SELECT * FROM public.get_customers_safe();

-- Grant SELECT on the view
GRANT SELECT ON public.customers_safe TO authenticated;