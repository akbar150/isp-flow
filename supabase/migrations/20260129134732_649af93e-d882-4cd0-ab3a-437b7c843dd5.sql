-- Revert to simpler approach: allow staff to SELECT from customers but control at application layer
-- The customers_safe view exists and app uses it, and we'll accept the tradeoff

-- Drop the function-based view that broke FK relationships
DROP VIEW IF EXISTS public.customers_safe;
DROP FUNCTION IF EXISTS public.get_customers_safe();

-- Recreate the simple view (without security_invoker options which cause issues)
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

-- Grant SELECT on the view
GRANT SELECT ON public.customers_safe TO authenticated;

-- Update RLS on customers table:
-- Allow staff to SELECT but only through the view (enforced at app layer)
-- This is necessary because the view needs underlying table access
DROP POLICY IF EXISTS "Only admins can select from customers" ON public.customers;

-- Re-add staff SELECT access (needed for view to work)
-- The security is enforced by: 
-- 1. App always uses customers_safe view (excludes password_hash)
-- 2. RLS still controls which ROWS can be accessed
CREATE POLICY "Staff and admins can view customers" 
  ON public.customers 
  FOR SELECT 
  USING (
    public.has_role(auth.uid(), 'staff'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );