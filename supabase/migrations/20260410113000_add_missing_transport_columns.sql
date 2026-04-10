-- Create transport_records table if it doesn't exist (defensive measure)
CREATE TABLE IF NOT EXISTS public.transport_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    vehicle_type text NOT NULL,
    from_location text NOT NULL,
    to_location text NOT NULL,
    fuel_consumed numeric DEFAULT 0,
    material_transported text NOT NULL,
    quantity numeric DEFAULT 0,
    notes text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

-- Add missing columns to transport_records
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'number_of_trips') THEN
        ALTER TABLE public.transport_records ADD COLUMN number_of_trips integer DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transport_records' AND COLUMN_NAME = 'vehicle_number') THEN
        ALTER TABLE public.transport_records ADD COLUMN vehicle_number text;
    END IF;
END $$;

-- Update RLS if needed (already handled in optimize_rls_policies, but let's be sure)
ALTER TABLE public.transport_records ENABLE ROW LEVEL SECURITY;
