-- Add average_price and item_reference_number to inventory_items
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS average_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_reference_number text;

-- Update RLS if needed (already set to ALL for managers)
