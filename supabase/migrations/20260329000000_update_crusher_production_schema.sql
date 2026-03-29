/*
  # Update Crusher Production Schema
  
  1. Add missing fields: shift, crusher_type, material_source, maintenance_hours
  2. Relax constraint on product_type
  3. Expand constraint on status to include 'completed', 'in_progress', 'maintenance', 'breakdown'
*/

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'shift'
  ) THEN
    ALTER TABLE production_records ADD COLUMN shift text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'crusher_type'
  ) THEN
    ALTER TABLE production_records ADD COLUMN crusher_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'material_source'
  ) THEN
    ALTER TABLE production_records ADD COLUMN material_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'maintenance_hours'
  ) THEN
    ALTER TABLE production_records ADD COLUMN maintenance_hours numeric DEFAULT 0;
  END IF;
END $$;

-- Make product_type optional since the new form doesn't collect it
ALTER TABLE production_records ALTER COLUMN product_type DROP NOT NULL;

-- Update the status check constraint
ALTER TABLE production_records DROP CONSTRAINT IF EXISTS production_records_status_check;
ALTER TABLE production_records ADD CONSTRAINT production_records_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'in_progress', 'maintenance', 'breakdown'));
