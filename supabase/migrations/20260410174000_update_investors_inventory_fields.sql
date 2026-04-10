-- Update material_investors table with inventory fields
ALTER TABLE material_investors 
ADD COLUMN IF NOT EXISTS product_type text,
ADD COLUMN IF NOT EXISTS quantity_mt numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_per_mt numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount_with_gst numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS quality_grade text;

-- Sync existing data if any
UPDATE material_investors 
SET product_type = material_type 
WHERE product_type IS NULL;
