/*
  # Add Starting and Ending Hours to Loading Records

  1. Changes to `loading_records` table
    - Add `starting_hours` (time) - Starting time of loading operation
    - Add `ending_hours` (time) - Ending time of loading operation
*/

-- Add starting_hours and ending_hours columns to loading_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'starting_hours'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN starting_hours time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'ending_hours'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN ending_hours time;
  END IF;
END $$;
