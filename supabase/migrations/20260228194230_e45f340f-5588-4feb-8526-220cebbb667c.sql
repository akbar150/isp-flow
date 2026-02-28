
-- Create referral status enum
CREATE TYPE public.referral_status AS ENUM ('pending', 'credited', 'expired');

-- Referral codes table (one per customer)
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_customer_code UNIQUE (customer_id)
);

-- Referrals table (tracks each referral)
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referred_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  referred_phone TEXT,
  status public.referral_status NOT NULL DEFAULT 'pending',
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS for referral_codes
CREATE POLICY "Anyone can view referral_codes"
  ON public.referral_codes FOR SELECT USING (true);

CREATE POLICY "Anyone can insert referral_codes"
  ON public.referral_codes FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage referral_codes"
  ON public.referral_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS for referrals
CREATE POLICY "Anyone can view referrals"
  ON public.referrals FOR SELECT USING (true);

CREATE POLICY "Anyone can insert referrals"
  ON public.referrals FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Add referral_credit column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referral_credit NUMERIC NOT NULL DEFAULT 0;
