-- Fix 1: Create employees_safe view to hide sensitive data
CREATE OR REPLACE VIEW public.employees_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  employee_code,
  full_name,
  department_id,
  designation_id,
  joining_date,
  termination_date,
  status,
  notes,
  user_id,
  created_at,
  updated_at
  -- Excluding: basic_salary, bank_account, phone, email, address, emergency_contact
FROM public.employees;

-- Grant access to the view
GRANT SELECT ON public.employees_safe TO authenticated;

-- Fix 2: Update employees RLS - restrict full table access to admins only
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;

-- Only admins and super_admins can see full employee data (including salary/bank)
CREATE POLICY "Admins can view all employee details"
ON public.employees FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Employees can see their own record
CREATE POLICY "Employees can view own record"
ON public.employees FOR SELECT
USING (user_id = auth.uid());

-- Fix 3: Restrict activity_logs INSERT to validated system logs
DROP POLICY IF EXISTS "Authenticated users can insert activity_logs" ON public.activity_logs;

-- Only allow system-generated logs (user_id must match the authenticated user)
CREATE POLICY "System can insert validated activity_logs"
ON public.activity_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- Fix 4: Create payroll_safe view for staff (hide sensitive payment details)
CREATE OR REPLACE VIEW public.payroll_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  employee_id,
  month,
  year,
  status,
  created_at,
  updated_at
  -- Excluding: basic_salary, allowances, deductions, bonus, commission, net_salary, paid_date, payment_method, notes
FROM public.payroll;

GRANT SELECT ON public.payroll_safe TO authenticated;