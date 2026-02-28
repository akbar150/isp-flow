
-- Create enum for package change request status
CREATE TYPE public.package_change_status AS ENUM ('pending', 'approved', 'rejected');

-- Create package_change_requests table
CREATE TABLE public.package_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  current_package_id UUID NOT NULL REFERENCES public.packages(id),
  requested_package_id UUID NOT NULL REFERENCES public.packages(id),
  status public.package_change_status NOT NULL DEFAULT 'pending',
  prorated_credit NUMERIC NOT NULL DEFAULT 0,
  prorated_charge NUMERIC NOT NULL DEFAULT 0,
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.package_change_requests ENABLE ROW LEVEL SECURITY;

-- Admins and super_admins can manage all requests
CREATE POLICY "Admins and super_admins can manage package_change_requests"
  ON public.package_change_requests
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Staff can view requests
CREATE POLICY "Staff can view package_change_requests"
  ON public.package_change_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Anyone can view (for customer portal edge function usage)
CREATE POLICY "Anyone can view own package_change_requests"
  ON public.package_change_requests
  FOR SELECT
  USING (true);

-- Anyone can insert (for customer portal edge function usage)
CREATE POLICY "Anyone can create package_change_requests"
  ON public.package_change_requests
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_package_change_requests_updated_at
  BEFORE UPDATE ON public.package_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
