
-- Create online_payments table
CREATE TABLE public.online_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'bkash',
  payment_id TEXT,
  trx_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;

-- Anyone can view (for customer portal)
CREATE POLICY "Anyone can view online_payments"
  ON public.online_payments FOR SELECT USING (true);

-- Anyone can insert (edge function with service role handles actual insert)
CREATE POLICY "Anyone can insert online_payments"
  ON public.online_payments FOR INSERT WITH CHECK (true);

-- Admins can manage
CREATE POLICY "Admins can manage online_payments"
  ON public.online_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update trigger
CREATE TRIGGER update_online_payments_updated_at
  BEFORE UPDATE ON public.online_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
