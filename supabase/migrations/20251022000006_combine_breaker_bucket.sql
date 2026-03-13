/*
  # Combine Breaker and Bucket into single field

  1. Changes to `loading_records` table
    - Add `breaker_bucket` (text) - Combined breaker and bucket field
    - Remove `breaker` column
    - Remove `bucket` column
*/

-- Add breaker_bucket column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'breaker_bucket'
  ) THEN
    ALTER TABLE loading_records ADD COLUMN breaker_bucket text;
  END IF;

  -- Drop breaker column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'breaker'
  ) THEN
    ALTER TABLE loading_records DROP COLUMN breaker;
  END IF;

  -- Drop bucket column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loading_records' AND column_name = 'bucket'
  ) THEN
    ALTER TABLE loading_records DROP COLUMN bucket;
  END IF;
END $$;
