/*
  # Add Penalty Columns to EB Bill Records
  
  1. Add `md_penalty` and `pf_penalty` columns to the `eb_bill_records` table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eb_bill_records' AND column_name = 'md_penalty'
  ) THEN
    ALTER TABLE eb_bill_records ADD COLUMN md_penalty numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eb_bill_records' AND column_name = 'pf_penalty'
  ) THEN
    ALTER TABLE eb_bill_records ADD COLUMN pf_penalty numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
