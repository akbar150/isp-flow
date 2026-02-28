
-- Create ticket category enum
CREATE TYPE public.ticket_category AS ENUM ('connection_issue', 'billing_dispute', 'slow_speed', 'disconnection', 'new_connection', 'package_change', 'other');

-- Create ticket priority enum
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ticket comments table
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequence for ticket numbers
CREATE SEQUENCE public.ticket_number_seq START 1;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_number INTEGER;
  ticket_num TEXT;
BEGIN
  new_number := nextval('public.ticket_number_seq');
  ticket_num := 'TKT-' || LPAD(new_number::TEXT, 5, '0');
  RETURN ticket_num;
END;
$$;

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
CREATE POLICY "Admins and super_admins can manage support_tickets"
ON public.support_tickets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view support_tickets"
ON public.support_tickets FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create support_tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can update assigned tickets"
ON public.support_tickets FOR UPDATE
USING (has_role(auth.uid(), 'staff'::app_role) AND assigned_to = auth.uid());

-- RLS policies for ticket_comments
CREATE POLICY "Admins and super_admins can manage ticket_comments"
ON public.ticket_comments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view non-internal ticket_comments"
ON public.ticket_comments FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role) AND (is_internal = false OR created_by = auth.uid()));

CREATE POLICY "Authenticated users can create ticket_comments"
ON public.ticket_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (created_by IS NULL OR created_by = auth.uid()));

-- Updated_at trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
