/*
  # Add Material Type to Blasting Records

  1. Changes to `blasting_records` table
    - Add `material_type` column (text) - to store selected material type
    - Options: GOOD, BBOLDER, WETROCKS, SOIL
    - Keep `rock_volume` column for quantity

  2. Notes
    - Material type will be stored as text
    - Existing records will have null material_type initially
*/

-- Add material_type column to blasting_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'material_type'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN material_type text;
  END IF;
END $$;
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