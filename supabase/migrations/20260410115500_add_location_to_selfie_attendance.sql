-- Add location columns to selfie_attendance
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'selfie_attendance' AND column_name = 'location_in') THEN
    ALTER TABLE selfie_attendance ADD COLUMN location_in text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'selfie_attendance' AND column_name = 'location_out') THEN
    ALTER TABLE selfie_attendance ADD COLUMN location_out text;
  END IF;
END $$;
