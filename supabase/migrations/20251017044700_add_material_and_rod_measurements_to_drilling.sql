-- Add material_type and rod measurements columns to drilling_records table

-- Add material_type column
ALTER TABLE drilling_records 
ADD COLUMN IF NOT EXISTS material_type text;

-- Add rod_measurements column (JSONB to store Set 1 measurements)
ALTER TABLE drilling_records 
ADD COLUMN IF NOT EXISTS rod_measurements jsonb DEFAULT '{}'::jsonb;

-- Add rod_measurements_set2 column (JSONB to store Set 2 measurements)
ALTER TABLE drilling_records 
ADD COLUMN IF NOT EXISTS rod_measurements_set2 jsonb DEFAULT '{}'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN drilling_records.material_type IS 'Type of material being drilled: Good Boulders, Weathered Rocks, or Soil';
COMMENT ON COLUMN drilling_records.rod_measurements IS 'JSON object storing rod measurements for Set 1 (rod10 through rod1)';
COMMENT ON COLUMN drilling_records.rod_measurements_set2 IS 'JSON object storing rod measurements for Set 2 (rod10_set2 through rod1_set2)';
