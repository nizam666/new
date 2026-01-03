/*
  # Add Vehicle Used field to Loading Records

  1. Changes to `loading_records` table
    - Add `vehicle_used` (text) - Type of vehicle used (e.g., EX140, 120)
*/

-- Add vehicle_used column to loading_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'vehicle_used'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN vehicle_used text;
  END IF;
END $$;
