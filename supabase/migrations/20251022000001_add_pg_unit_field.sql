/*
  # Add PG Unit field to Blasting Records

  1. Changes to `blasting_records` table
    - Add `pg_unit` (text) - PG unit (boxes or nos)
    - Default to 'boxes' for backward compatibility
*/

-- Add pg_unit column to blasting_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'pg_unit'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN pg_unit text DEFAULT 'boxes';
  END IF;
END $$;
