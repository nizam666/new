/*
  # Add Crusher Time Columns

  ## Overview
  Adds `machine_start_time` and `machine_end_time` columns to the `production_records` table
  to allow recording exact machine operating hours.

  ## Changes
  - Add `machine_start_time` (time)
  - Add `machine_end_time` (time)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'machine_start_time'
  ) THEN
    ALTER TABLE production_records ADD COLUMN machine_start_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'machine_end_time'
  ) THEN
    ALTER TABLE production_records ADD COLUMN machine_end_time time;
  END IF;
END $$;
