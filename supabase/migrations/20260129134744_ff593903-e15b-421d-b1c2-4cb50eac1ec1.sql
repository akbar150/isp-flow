-- Fix the Security Definer View linter warning by adding security_invoker = on
-- This makes views respect the caller's RLS policies instead of bypassing them

-- Recreate customers_safe view with security_invoker = on
DROP VIEW IF EXISTS public.customers_safe;

CREATE VIEW public.customers_safe 
WITH (security_invoker = on) AS
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

-- Recreate mikrotik_users_safe view with security_invoker = on
DROP VIEW IF EXISTS public.mikrotik_users_safe;

CREATE VIEW public.mikrotik_users_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  customer_id,
  username,
  profile,
  status,
  router_id,
  last_synced_at,
  created_at,
  updated_at
FROM public.mikrotik_users;

-- Recreate routers_safe view with security_invoker = on
DROP VIEW IF EXISTS public.routers_safe;

CREATE VIEW public.routers_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  ip_address,
  port,
  username,
  mode,
  is_active,
  created_at,
  updated_at
FROM public.routers;