/*
  # Update Loading Records - Hours and Add Breaker/Bucket

  1. Changes to `loading_records` table
    - Modify `starting_hours` to numeric (for hour digits)
    - Modify `ending_hours` to numeric (for hour digits)
    - Add `breaker` (text) - Breaker availability (Yes/No)
    - Add `bucket` (text) - Bucket type (Rock/Soil)
*/

-- Modify starting_hours and ending_hours to numeric type
DO $$
BEGIN
  -- Drop and recreate starting_hours as numeric
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'starting_hours'
  ) THEN
    ALTER TABLE loading_records ALTER COLUMN starting_hours TYPE numeric USING starting_hours::text::numeric;
  END IF;

  -- Drop and recreate ending_hours as numeric
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'ending_hours'
  ) THEN
    ALTER TABLE loading_records ALTER COLUMN ending_hours TYPE numeric USING ending_hours::text::numeric;
  END IF;

  -- Add breaker column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'breaker'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN breaker text;
  END IF;

  -- Add bucket column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'bucket'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN bucket text;
  END IF;
END $$;
