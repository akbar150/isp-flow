-- First, assign admin role to the existing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('e2263cef-2144-4a6d-827a-1652e9890755', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create call_records table for customer follow-up tracking
CREATE TABLE public.call_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  call_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT NOT NULL,
  called_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_call_records_customer_id ON public.call_records(customer_id);
CREATE INDEX idx_call_records_call_date ON public.call_records(call_date DESC);

-- Enable RLS
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;

-- Staff and admins can view all call records
CREATE POLICY "Staff and admins can view call_records"
  ON public.call_records FOR SELECT
  USING (
    public.has_role(auth.uid(), 'staff'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Authenticated users can create call records with user tracking
CREATE POLICY "Authenticated users can create call_records"
  ON public.call_records FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (called_by IS NULL OR called_by = auth.uid())
  );

-- Admins can manage all call records
CREATE POLICY "Admins can manage call_records"
  ON public.call_records FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add comment for documentation
COMMENT ON TABLE public.call_records IS 'Stores customer follow-up call records made by agents';