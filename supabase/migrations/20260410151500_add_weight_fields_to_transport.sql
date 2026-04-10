-- Add weight calculation fields to transport_records
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'empty_vehicle_weight') THEN
        ALTER TABLE public.transport_records ADD COLUMN empty_vehicle_weight numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'gross_weight') THEN
        ALTER TABLE public.transport_records ADD COLUMN gross_weight numeric DEFAULT 0;
    END IF;
END $$;
