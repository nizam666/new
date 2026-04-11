-- Add comprehensive weighbridge schema columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_location text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vehicle_no text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS empty_weight decimal(10,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gross_weight decimal(10,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_weight decimal(10,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS material_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS material_rate decimal(10,2) DEFAULT 0;

-- Adjust constraints safely (due_date in old system might become strictly unnecessary)
ALTER TABLE invoices ALTER COLUMN due_date DROP NOT NULL;

-- Notify the backend schema parser to reload
NOTIFY pgrst, 'reload schema';
