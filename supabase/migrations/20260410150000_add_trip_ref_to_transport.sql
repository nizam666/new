-- Add trip_ref column to transport_records
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'trip_ref') THEN
        ALTER TABLE public.transport_records ADD COLUMN trip_ref text UNIQUE;
    END IF;
END $$;
