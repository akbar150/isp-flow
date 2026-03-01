
-- Drop the view first so we can alter columns
DROP VIEW IF EXISTS public.customers_safe;

-- Change expiry_date and billing_start_date from date to timestamptz
ALTER TABLE public.customers
  ALTER COLUMN expiry_date TYPE timestamptz USING (expiry_date::date::timestamptz),
  ALTER COLUMN billing_start_date TYPE timestamptz USING (billing_start_date::date::timestamptz);

-- Recreate customers_safe view
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
    latitude,
    longitude,
    connection_type,
    billing_cycle,
    created_at,
    updated_at
  FROM public.customers;
