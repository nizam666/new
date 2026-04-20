-- Add given_price to inventory_dispatch
ALTER TABLE IF EXISTS inventory_dispatch
ADD COLUMN IF NOT EXISTS given_price numeric;
