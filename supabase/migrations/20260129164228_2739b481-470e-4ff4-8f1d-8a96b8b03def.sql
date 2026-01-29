-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for complete financial tracking
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL, -- cash, bkash, bank_transfer
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT,
  reference_id TEXT, -- For linking to payments or other records
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_categories
CREATE POLICY "Admins and super_admins can manage expense_categories"
ON public.expense_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view expense_categories"
ON public.expense_categories FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS policies for transactions
CREATE POLICY "Admins and super_admins can manage transactions"
ON public.transactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Staff can view transactions"
ON public.transactions FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) AND (created_by IS NULL OR created_by = auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description) VALUES
('Staff Salary', 'Monthly staff salary payments'),
('ISP Bill', 'Internet service provider charges'),
('Office Maintenance', 'Office maintenance and repairs'),
('Office Rent', 'Monthly office rent'),
('Entertainment', 'Entertainment and refreshments'),
('Utilities', 'Electricity, water, and other utilities'),
('Equipment', 'Hardware and equipment purchases'),
('Marketing', 'Advertising and marketing expenses'),
('Other', 'Miscellaneous expenses');