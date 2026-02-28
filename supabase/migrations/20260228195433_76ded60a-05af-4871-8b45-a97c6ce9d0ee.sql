
-- Service task type and status enums
CREATE TYPE public.service_task_type AS ENUM ('installation', 'repair', 'maintenance', 'inspection');
CREATE TYPE public.service_task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.service_task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Service tasks table
CREATE TABLE public.service_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id),
  task_type public.service_task_type NOT NULL DEFAULT 'repair',
  status public.service_task_status NOT NULL DEFAULT 'pending',
  priority public.service_task_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  notes TEXT,
  photos TEXT[] DEFAULT '{}',
  customer_signature TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_tasks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage service_tasks" ON public.service_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Staff can view all tasks
CREATE POLICY "Staff can view service_tasks" ON public.service_tasks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Assigned users can update their own tasks
CREATE POLICY "Assigned users can update own tasks" ON public.service_tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Staff can create tasks
CREATE POLICY "Staff can create service_tasks" ON public.service_tasks
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_service_tasks_updated_at BEFORE UPDATE ON public.service_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for task photos
INSERT INTO storage.buckets (id, name, public) VALUES ('task-photos', 'task-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload task photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-photos');

CREATE POLICY "Anyone can view task photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-photos');

CREATE POLICY "Admins can delete task photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-photos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
