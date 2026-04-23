-- Add avg_weight field to transport_records
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'avg_weight') THEN
        ALTER TABLE public.transport_records ADD COLUMN avg_weight numeric DEFAULT 0;
    END IF;
END $$;
