-- 1. Add tracking flags to product_categories
ALTER TABLE product_categories 
  ADD COLUMN IF NOT EXISTS requires_serial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_mac BOOLEAN DEFAULT false;

-- 2. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies for suppliers
CREATE POLICY "Admins and super_admins can manage suppliers" ON public.suppliers FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- 3. Add supplier and cable fields to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS core_count INTEGER,
  ADD COLUMN IF NOT EXISTS cable_color TEXT,
  ADD COLUMN IF NOT EXISTS cable_length_m NUMERIC;

-- 4. Add condition fields to asset_assignments if not exists
ALTER TABLE public.asset_assignments
  ADD COLUMN IF NOT EXISTS item_condition TEXT DEFAULT 'new';

-- Create trigger for suppliers updated_at
CREATE OR REPLACE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();