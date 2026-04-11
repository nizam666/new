-- Add party_name to transport_records
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'party_name') THEN
        ALTER TABLE public.transport_records ADD COLUMN party_name text;
    END IF;
END $$;
