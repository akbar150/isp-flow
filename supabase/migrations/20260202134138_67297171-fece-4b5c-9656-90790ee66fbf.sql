-- Add new notification types to the enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_customer';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'billing_generated';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'asset_assigned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'hrm_update';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'accounting_update';

-- Update RLS policy for admin_notifications to allow all authenticated users to view
DROP POLICY IF EXISTS "Admins and super_admins can view admin_notifications" ON public.admin_notifications;

CREATE POLICY "Authenticated users can view admin_notifications"
ON public.admin_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Update insert policy to allow system inserts
DROP POLICY IF EXISTS "System can insert admin_notifications" ON public.admin_notifications;

CREATE POLICY "Authenticated users can insert admin_notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Keep update policy for marking as read
DROP POLICY IF EXISTS "Admins can update admin_notifications" ON public.admin_notifications;

CREATE POLICY "Authenticated users can update admin_notifications"
ON public.admin_notifications
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add target_role column to filter notifications by role (nullable means all roles)
ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS target_role public.app_role NULL;