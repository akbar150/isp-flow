-- Step 1: Drop duplicate trigger
DROP TRIGGER IF EXISTS payment_update_customer_due ON public.payments;

-- Step 2: Update trigger function to handle active-but-expired state
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

  IF new_due = 0 AND customer_record.validity_days IS NOT NULL AND (
    customer_record.status IN ('expired', 'suspended')
    OR (customer_record.status = 'active' AND customer_record.expiry_date::date <= CURRENT_DATE)
  ) THEN
    new_expiry := CURRENT_DATE + customer_record.validity_days;
    
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