-- 1. Add explicit UPDATE policy to restrict staff from updating customers
CREATE POLICY "Only admins can update customers" ON public.customers
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Create trigger to automatically update customer due on payment insert
CREATE OR REPLACE FUNCTION public.update_customer_due_on_payment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET total_due = GREATEST(0, total_due - NEW.amount)
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_update_customer_due
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_due_on_payment();

-- 3. Fix customer ID generation race condition using database sequence
CREATE SEQUENCE IF NOT EXISTS public.customer_id_seq START 1;

-- Update to next available number based on existing customers
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_id FROM 4) AS INTEGER)), 0) + 1
  INTO max_num
  FROM public.customers
  WHERE user_id ~ '^ISP[0-9]+$';
  
  EXECUTE 'ALTER SEQUENCE public.customer_id_seq RESTART WITH ' || max_num;
END $$;

-- Update generate_customer_user_id to use sequence (atomic, no race condition)
CREATE OR REPLACE FUNCTION public.generate_customer_user_id()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  next_num INTEGER;
BEGIN
  next_num := nextval('public.customer_id_seq');
  new_id := 'ISP' || LPAD(next_num::TEXT, 5, '0');
  RETURN new_id;
END;
$$;

-- 4. Add database constraints for input validation (defense-in-depth)
ALTER TABLE public.packages
  ADD CONSTRAINT check_speed_positive CHECK (speed_mbps > 0),
  ADD CONSTRAINT check_price_positive CHECK (monthly_price > 0),
  ADD CONSTRAINT check_validity_positive CHECK (validity_days > 0);

ALTER TABLE public.payments
  ADD CONSTRAINT check_amount_positive CHECK (amount > 0);

ALTER TABLE public.routers
  ADD CONSTRAINT check_port_range CHECK (port BETWEEN 1 AND 65535);

ALTER TABLE public.customers
  ADD CONSTRAINT check_total_due_non_negative CHECK (total_due >= 0);