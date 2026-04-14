-- Add partial return tracking and separate storage pool
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS returned_qty numeric DEFAULT 0;

ALTER TABLE inventory_dispatch
ADD COLUMN IF NOT EXISTS quantity_returned numeric DEFAULT 0;

-- Update existing records set quantity_returned based on returned status (if full return was already recorded)
UPDATE inventory_dispatch
SET quantity_returned = quantity_dispatched
WHERE returned = true AND quantity_returned = 0;
