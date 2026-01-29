-- Create billing_records table to track each billing cycle
CREATE TABLE public.billing_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  package_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- Policies for billing_records
CREATE POLICY "Admins and super_admins can manage billing_records"
ON public.billing_records
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view billing_records"
ON public.billing_records
FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create billing_records"
ON public.billing_records
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_billing_records_customer_id ON public.billing_records(customer_id);
CREATE INDEX idx_billing_records_billing_date ON public.billing_records(billing_date);
CREATE INDEX idx_billing_records_status ON public.billing_records(status);

-- Add email column to customers table if not exists
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_billing_records_updated_at
BEFORE UPDATE ON public.billing_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();