-- Add account_type field to asset_assignments for Free/Paid tracking
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'free' CHECK (account_type IN ('free', 'paid'));

-- Add selling_price field to track price at time of assignment for profit calculation
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0;

-- Add purchase_price field to track cost at time of assignment
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS purchase_price_at_assign NUMERIC DEFAULT 0;

-- Add invoice_id to link paid assignments to invoices
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_asset_assignments_account_type ON asset_assignments(account_type);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_invoice_id ON asset_assignments(invoice_id);