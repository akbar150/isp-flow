
-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create backup_logs table
CREATE TABLE public.backup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint DEFAULT 0,
  record_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can view
CREATE POLICY "Admins can view backup_logs"
  ON public.backup_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Only super_admins can manage (insert/update/delete)
CREATE POLICY "Super admins can manage backup_logs"
  ON public.backup_logs FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-backups', 'customer-backups', false);

-- Storage RLS: admins can read
CREATE POLICY "Admins can read backup files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-backups' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  ));
