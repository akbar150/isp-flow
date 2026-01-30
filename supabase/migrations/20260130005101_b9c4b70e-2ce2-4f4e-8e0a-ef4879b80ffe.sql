-- Drop existing overly permissive policies for packages
DROP POLICY IF EXISTS "Admins and super_admins can manage packages" ON public.packages;

-- Create granular permission-based policies for packages

-- INSERT: Only users with packages create permission (INSERT uses only WITH CHECK)
CREATE POLICY "Users with create permission can insert packages" 
ON public.packages 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'packages'::text, 'create'::text)
);

-- UPDATE: Only users with packages update permission
CREATE POLICY "Users with update permission can update packages" 
ON public.packages 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'packages'::text, 'update'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'packages'::text, 'update'::text)
);

-- DELETE: Only users with packages delete permission
CREATE POLICY "Users with delete permission can delete packages" 
ON public.packages 
FOR DELETE 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'packages'::text, 'delete'::text)
);