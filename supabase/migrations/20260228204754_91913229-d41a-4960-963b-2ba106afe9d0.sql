
-- Create stock_movements table for audit trail
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  movement_type text NOT NULL DEFAULT 'status_change',
  quantity numeric NOT NULL DEFAULT 1,
  performed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS: Admins/super_admins full access
CREATE POLICY "Admins can manage stock_movements"
  ON public.stock_movements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS: Staff can view
CREATE POLICY "Staff can view stock_movements"
  ON public.stock_movements FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- RLS: Staff can insert
CREATE POLICY "Staff can insert stock_movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Auto-log trigger on inventory_items status change
CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.stock_movements 
      (inventory_item_id, from_status, to_status, movement_type)
    VALUES 
      (NEW.id, OLD.status::text, NEW.status::text, 'status_change');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_stock_movement
  AFTER UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();
