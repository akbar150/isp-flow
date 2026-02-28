
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS category_type text NOT NULL DEFAULT 'expense';
