/*
  # Update Blasting Records Schema

  1. Changes to `blasting_records` table
    - Remove `explosive_used` column
    - Remove `detonators_used` column
    - Add `ed_nos` (numeric) - ED in nos
    - Add `edet_nos` (numeric) - EDET in nos
    - Add `nonel_nos` (numeric) - NONEL in nos
    - Add `pg_nos` (numeric) - PG in nos

  2. Notes
    - All new columns are numeric fields to store quantities
    - Existing data will be preserved where possible
*/

-- Add new columns to blasting_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'ed_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN ed_nos numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'edet_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN edet_nos numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'nonel_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN nonel_nos numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'pg_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN pg_nos numeric DEFAULT 0;
  END IF;
END $$;

-- Drop old columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'explosive_used'
  ) THEN
    ALTER TABLE blasting_records DROP COLUMN explosive_used;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'detonators_used'
  ) THEN
    ALTER TABLE blasting_records DROP COLUMN detonators_used;
  END IF;
END $$;
