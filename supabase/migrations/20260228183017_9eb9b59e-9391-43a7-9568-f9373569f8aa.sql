
-- Create outage status enum
CREATE TYPE public.outage_status AS ENUM ('active', 'resolved');

-- Network outages table
CREATE TABLE public.network_outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.outage_status NOT NULL DEFAULT 'active',
  area_ids UUID[] NOT NULL DEFAULT '{}',
  estimated_restore TIMESTAMP WITH TIME ZONE,
  actual_restore TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.network_outages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins and super_admins can manage network_outages"
ON public.network_outages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view network_outages"
ON public.network_outages FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create network_outages"
ON public.network_outages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Public read for active outages (customer portal needs this)
CREATE POLICY "Anyone can view active network_outages"
ON public.network_outages FOR SELECT
USING (status = 'active');

-- Updated_at trigger
CREATE TRIGGER update_network_outages_updated_at
  BEFORE UPDATE ON public.network_outages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.network_outages;
