/*
  # Add Diesel Consumed Field to Loading Records

  1. Changes to `loading_records` table
    - Add `diesel_consumed` (decimal) - Amount of diesel consumed/refilled during loading operations
    - Add `notes` (text) - Additional notes for loading operations
*/

-- Add diesel_consumed and notes columns to loading_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'diesel_consumed'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN diesel_consumed decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'notes'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN notes text;
  END IF;
END $$;