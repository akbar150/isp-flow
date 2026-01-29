-- Create permissions table for action-level access control
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  resource TEXT NOT NULL, -- e.g., 'customers', 'payments', 'packages', 'routers', 'settings'
  action TEXT NOT NULL, -- e.g., 'create', 'read', 'update', 'delete'
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, resource, action)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage permissions" 
  ON public.permissions FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view permissions (to check their own access)
CREATE POLICY "Authenticated users can view permissions" 
  ON public.permissions FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Insert default permissions for admin role (full access)
INSERT INTO public.permissions (role, resource, action, allowed) VALUES
  ('admin', 'customers', 'create', true),
  ('admin', 'customers', 'read', true),
  ('admin', 'customers', 'update', true),
  ('admin', 'customers', 'delete', true),
  ('admin', 'payments', 'create', true),
  ('admin', 'payments', 'read', true),
  ('admin', 'payments', 'update', true),
  ('admin', 'payments', 'delete', true),
  ('admin', 'packages', 'create', true),
  ('admin', 'packages', 'read', true),
  ('admin', 'packages', 'update', true),
  ('admin', 'packages', 'delete', true),
  ('admin', 'routers', 'create', true),
  ('admin', 'routers', 'read', true),
  ('admin', 'routers', 'update', true),
  ('admin', 'routers', 'delete', true),
  ('admin', 'settings', 'create', true),
  ('admin', 'settings', 'read', true),
  ('admin', 'settings', 'update', true),
  ('admin', 'settings', 'delete', true),
  ('admin', 'users', 'create', true),
  ('admin', 'users', 'read', true),
  ('admin', 'users', 'update', true),
  ('admin', 'users', 'delete', true),
  ('admin', 'call_records', 'create', true),
  ('admin', 'call_records', 'read', true),
  ('admin', 'call_records', 'update', true),
  ('admin', 'call_records', 'delete', true),
  ('admin', 'reminders', 'create', true),
  ('admin', 'reminders', 'read', true),
  ('admin', 'reminders', 'update', true),
  ('admin', 'reminders', 'delete', true),
  ('admin', 'areas', 'create', true),
  ('admin', 'areas', 'read', true),
  ('admin', 'areas', 'update', true),
  ('admin', 'areas', 'delete', true);

-- Insert default permissions for staff role (limited access)
INSERT INTO public.permissions (role, resource, action, allowed) VALUES
  ('staff', 'customers', 'create', true),
  ('staff', 'customers', 'read', true),
  ('staff', 'customers', 'update', false),
  ('staff', 'customers', 'delete', false),
  ('staff', 'payments', 'create', true),
  ('staff', 'payments', 'read', true),
  ('staff', 'payments', 'update', false),
  ('staff', 'payments', 'delete', false),
  ('staff', 'packages', 'create', false),
  ('staff', 'packages', 'read', true),
  ('staff', 'packages', 'update', false),
  ('staff', 'packages', 'delete', false),
  ('staff', 'routers', 'create', false),
  ('staff', 'routers', 'read', true),
  ('staff', 'routers', 'update', false),
  ('staff', 'routers', 'delete', false),
  ('staff', 'settings', 'create', false),
  ('staff', 'settings', 'read', false),
  ('staff', 'settings', 'update', false),
  ('staff', 'settings', 'delete', false),
  ('staff', 'users', 'create', false),
  ('staff', 'users', 'read', false),
  ('staff', 'users', 'update', false),
  ('staff', 'users', 'delete', false),
  ('staff', 'call_records', 'create', true),
  ('staff', 'call_records', 'read', true),
  ('staff', 'call_records', 'update', false),
  ('staff', 'call_records', 'delete', false),
  ('staff', 'reminders', 'create', true),
  ('staff', 'reminders', 'read', true),
  ('staff', 'reminders', 'update', false),
  ('staff', 'reminders', 'delete', false),
  ('staff', 'areas', 'create', false),
  ('staff', 'areas', 'read', true),
  ('staff', 'areas', 'update', false),
  ('staff', 'areas', 'delete', false);

-- Create function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _resource TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.permissions p ON ur.role = p.role
    WHERE ur.user_id = _user_id
      AND p.resource = _resource
      AND p.action = _action
      AND p.allowed = true
  )
$$;