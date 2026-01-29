-- Fix function search_path for generate_customer_user_id
CREATE OR REPLACE FUNCTION public.generate_customer_user_id()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.customers;
  new_id := 'ISP' || LPAD(counter::TEXT, 5, '0');
  RETURN new_id;
END;
$function$;

-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;