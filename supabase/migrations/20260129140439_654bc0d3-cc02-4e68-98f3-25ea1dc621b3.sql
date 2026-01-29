-- Add database-level validation constraints for defense-in-depth
-- These match the client-side validation rules

-- Customer table constraints
ALTER TABLE public.customers
  ADD CONSTRAINT check_full_name_length 
    CHECK (length(trim(full_name)) BETWEEN 3 AND 100);

ALTER TABLE public.customers
  ADD CONSTRAINT check_phone_length 
    CHECK (length(phone) BETWEEN 10 AND 15);

ALTER TABLE public.customers
  ADD CONSTRAINT check_address_length 
    CHECK (length(trim(address)) >= 10 AND length(address) <= 500);

-- Phone format validation (Bangladesh format or international)
ALTER TABLE public.customers
  ADD CONSTRAINT check_phone_format 
    CHECK (phone ~ '^(\+?880)?[0-9]{10,11}$');

-- Package table constraints
ALTER TABLE public.packages
  ADD CONSTRAINT check_name_not_empty 
    CHECK (length(trim(name)) > 0);

-- Router table constraints
ALTER TABLE public.routers
  ADD CONSTRAINT check_router_name_length 
    CHECK (length(trim(name)) BETWEEN 1 AND 100);

-- IP address format validation (allow NULL for dummy mode)
ALTER TABLE public.routers
  ADD CONSTRAINT check_ip_format 
    CHECK (ip_address IS NULL OR ip_address ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$');

-- Area table constraints
ALTER TABLE public.areas
  ADD CONSTRAINT check_area_name_length 
    CHECK (length(trim(name)) BETWEEN 1 AND 100);