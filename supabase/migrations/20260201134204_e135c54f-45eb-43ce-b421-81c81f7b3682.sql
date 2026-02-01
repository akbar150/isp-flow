-- Add metered product support to categories
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_metered BOOLEAN DEFAULT false;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'piece';

-- Add metered quantity tracking to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS metered_quantity NUMERIC DEFAULT 0;

-- Create cable/metered usage log table
CREATE TABLE IF NOT EXISTS metered_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quantity_used NUMERIC NOT NULL,
  color TEXT,
  core_count INTEGER,
  usage_type TEXT NOT NULL DEFAULT 'assignment',
  notes TEXT,
  technician_name TEXT,
  usage_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE metered_usage_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Admins can manage metered_usage_logs" ON metered_usage_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view metered_usage_logs" ON metered_usage_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert metered_usage_logs" ON metered_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update Fibre Cable category to be metered
UPDATE product_categories 
SET is_metered = true, unit_of_measure = 'meter'
WHERE name ILIKE '%fibre%' OR name ILIKE '%fiber%' OR name ILIKE '%cable%';