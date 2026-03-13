/*
  # Add Vehicle Owner Name field to Loading Records

  1. Changes to `loading_records` table
    - Add `vehicle_owner_name` (text) - Name of the vehicle owner
*/

-- Add vehicle_owner_name column to loading_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'vehicle_owner_name'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN vehicle_owner_name text;
  END IF;
END $$;
