
CREATE OR REPLACE FUNCTION public.update_customer_due_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_record RECORD;
  new_due numeric;
  new_expiry date;
  should_renew boolean := false;
  months_paid integer;
  base_date date;
BEGIN
  SELECT c.*, p.validity_days, p.monthly_price
  INTO customer_record
  FROM public.customers c
  LEFT JOIN public.packages p ON c.package_id = p.id
  WHERE c.id = NEW.customer_id;

  IF customer_record IS NULL THEN
    RETURN NEW;
  END IF;

  new_due := GREATEST(0, customer_record.total_due - NEW.amount);

  -- Calculate how many months this payment covers
  months_paid := 1;
  IF customer_record.monthly_price IS NOT NULL AND customer_record.monthly_price > 0 THEN
    months_paid := GREATEST(1, FLOOR(NEW.amount / customer_record.monthly_price)::integer);
  END IF;

  -- Determine if we should renew (extend expiry + set active)
  IF customer_record.monthly_price IS NOT NULL THEN
    IF new_due = 0 AND (
      customer_record.status IN ('expired', 'suspended')
      OR (customer_record.status = 'active' AND customer_record.expiry_date::date <= CURRENT_DATE)
    ) THEN
      should_renew := true;
    ELSIF customer_record.status IN ('expired', 'suspended')
      AND NEW.amount >= customer_record.monthly_price THEN
      should_renew := true;
    ELSIF customer_record.status = 'active'
      AND customer_record.expiry_date::date > CURRENT_DATE
      AND NEW.amount >= customer_record.monthly_price THEN
      -- Active customer paying advance
      should_renew := true;
    END IF;
  END IF;

  IF should_renew THEN
    -- Determine base date for expiry extension
    IF customer_record.expiry_date::date > CURRENT_DATE THEN
      base_date := customer_record.expiry_date::date;
    ELSE
      base_date := CURRENT_DATE;
    END IF;

    -- Use calendar-month intervals instead of fixed days
    -- e.g. Feb 21 + 1 month = Mar 21, Jan 31 + 1 month = Feb 28
    new_expiry := base_date + (months_paid * INTERVAL '1 month');
    
    UPDATE public.customers
    SET total_due = new_due,
        status = 'active',
        expiry_date = new_expiry
    WHERE id = NEW.customer_id;
  ELSE
    UPDATE public.customers
    SET total_due = new_due
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$function$;
