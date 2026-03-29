/*
  # Add JSONB Columns for EB Readings
  
  1. Add missing fields: starting_reading (jsonb), ending_reading (jsonb)
*/

-- Add JSONB columns to eb_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eb_reports' AND column_name = 'starting_reading'
  ) THEN
    ALTER TABLE eb_reports ADD COLUMN starting_reading jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eb_reports' AND column_name = 'ending_reading'
  ) THEN
    ALTER TABLE eb_reports ADD COLUMN ending_reading jsonb;
  END IF;
END $$;
