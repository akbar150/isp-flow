-- Add account_type and selling_price to metered_usage_logs for proper billing tracking
ALTER TABLE public.metered_usage_logs 
ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS selling_price numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.metered_usage_logs.account_type IS 'free or paid - determines if invoice is generated';
COMMENT ON COLUMN public.metered_usage_logs.selling_price IS 'Total selling price for the metered quantity assigned';