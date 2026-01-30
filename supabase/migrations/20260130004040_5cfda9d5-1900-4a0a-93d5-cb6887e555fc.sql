-- Drop the restrictive admin-only update policy
DROP POLICY IF EXISTS "Only admins can update customers" ON public.customers;

-- Create new policy that uses the permissions table for granular control
-- This allows staff to update customers if they have customers:update permission
CREATE POLICY "Users with update permission can update customers" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_permission(auth.uid(), 'customers', 'update')
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_permission(auth.uid(), 'customers', 'update')
);