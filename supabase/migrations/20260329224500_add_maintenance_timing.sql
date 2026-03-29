-- Add timing columns to machine_maintenance table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'machine_maintenance' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE machine_maintenance ADD COLUMN start_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'machine_maintenance' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE machine_maintenance ADD COLUMN end_time time;
  END IF;
END $$;
