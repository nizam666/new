/*
  # Add NONEL 3m and 4m fields to Blasting Records

  1. Changes to `blasting_records` table
    - Add `nonel_3m_nos` (numeric) - NONEL 3m in nos
    - Add `nonel_4m_nos` (numeric) - NONEL 4m in nos
*/

-- Add new columns to blasting_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'nonel_3m_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN nonel_3m_nos numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blasting_records' AND column_name = 'nonel_4m_nos'
  ) THEN
    ALTER TABLE blasting_records ADD COLUMN nonel_4m_nos numeric DEFAULT 0;
  END IF;
END $$;
