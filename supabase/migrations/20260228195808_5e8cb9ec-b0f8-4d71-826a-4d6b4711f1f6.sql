
-- Reseller status enum
CREATE TYPE public.reseller_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.commission_status AS ENUM ('pending', 'paid', 'cancelled');

-- Resellers table
CREATE TABLE public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  commission_rate numeric NOT NULL DEFAULT 10,
  status public.reseller_status NOT NULL DEFAULT 'active',
  password_hash text NOT NULL,
  reseller_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link resellers to customers they manage
CREATE TABLE public.reseller_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, customer_id)
);

-- Commission tracking
CREATE TABLE public.reseller_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  status public.commission_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reseller code sequence
CREATE SEQUENCE IF NOT EXISTS public.reseller_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_reseller_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('public.reseller_code_seq');
  RETURN 'RSL' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Enable RLS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resellers
CREATE POLICY "Admins can manage resellers" ON public.resellers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can view resellers" ON public.resellers FOR SELECT
  USING (true);

-- RLS for reseller_customers
CREATE POLICY "Admins can manage reseller_customers" ON public.reseller_customers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can view reseller_customers" ON public.reseller_customers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert reseller_customers" ON public.reseller_customers FOR INSERT
  WITH CHECK (true);

-- RLS for reseller_commissions
CREATE POLICY "Admins can manage reseller_commissions" ON public.reseller_commissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can view reseller_commissions" ON public.reseller_commissions FOR SELECT
  USING (true);

-- Auto-commission trigger: when a payment is made for a reseller's customer, create commission
CREATE OR REPLACE FUNCTION public.auto_create_reseller_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rc RECORD;
  reseller RECORD;
  commission_amount numeric;
BEGIN
  -- Check if this customer belongs to a reseller
  SELECT rc2.reseller_id INTO rc
  FROM public.reseller_customers rc2
  WHERE rc2.customer_id = NEW.customer_id
  LIMIT 1;

  IF rc IS NOT NULL THEN
    -- Get reseller commission rate
    SELECT r.commission_rate INTO reseller
    FROM public.resellers r
    WHERE r.id = rc.reseller_id AND r.status = 'active';

    IF reseller IS NOT NULL THEN
      commission_amount := ROUND(NEW.amount * reseller.commission_rate / 100, 2);
      
      INSERT INTO public.reseller_commissions (reseller_id, customer_id, payment_id, amount, status)
      VALUES (rc.reseller_id, NEW.customer_id, NEW.id, commission_amount, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reseller_commission
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_reseller_commission();

-- Updated_at triggers
CREATE TRIGGER update_resellers_updated_at
  BEFORE UPDATE ON public.resellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reseller_commissions_updated_at
  BEFORE UPDATE ON public.reseller_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
