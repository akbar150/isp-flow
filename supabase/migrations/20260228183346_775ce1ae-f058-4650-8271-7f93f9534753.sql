
-- Enhanced auto-reactivate trigger: when payment clears due, reactivate customer and extend expiry
CREATE OR REPLACE FUNCTION public.update_customer_due_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_record RECORD;
  pkg_record RECORD;
  new_due numeric;
  new_expiry date;
BEGIN
  -- Calculate new due
  new_due := GREATEST(0, (SELECT total_due FROM public.customers WHERE id = NEW.customer_id) - NEW.amount);

  -- Get customer and package info
  SELECT c.*, p.validity_days, p.monthly_price
  INTO customer_record
  FROM public.customers c
  LEFT JOIN public.packages p ON c.package_id = p.id
  WHERE c.id = NEW.customer_id;

  IF customer_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- If payment clears the due (or brings to 0) and customer was expired/suspended, reactivate
  IF new_due = 0 AND customer_record.status IN ('expired', 'suspended') AND customer_record.validity_days IS NOT NULL THEN
    -- Extend expiry from today (since they were expired/suspended)
    new_expiry := CURRENT_DATE + customer_record.validity_days;
    
    UPDATE public.customers
    SET total_due = new_due,
        status = 'active',
        expiry_date = new_expiry
    WHERE id = NEW.customer_id;
  ELSE
    -- Just update the due amount
    UPDATE public.customers
    SET total_due = new_due
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists (drop and recreate to be safe)
DROP TRIGGER IF EXISTS trg_update_customer_due_on_payment ON public.payments;
CREATE TRIGGER trg_update_customer_due_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_due_on_payment();
