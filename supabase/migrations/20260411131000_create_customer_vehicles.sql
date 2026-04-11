-- Create Customer Vehicles table
CREATE TABLE IF NOT EXISTS customer_vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vehicle_number text NOT NULL UNIQUE,
    vehicle_type text NOT NULL CHECK (vehicle_type IN ('tractor', '2 unit tipper', '4 unit tipper', '10 wheeler tipper', '12 wheeler tipper', '14 wheeler tipper', 'other')),
    tare_weight numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES users(id),
    updated_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "View customer vehicles"
    ON customer_vehicles FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy
CREATE POLICY "Insert customer vehicles"
    ON customer_vehicles FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Update policy
CREATE POLICY "Update customer vehicles"
    ON customer_vehicles FOR UPDATE
    TO authenticated
    USING (true);

-- Delete policy
CREATE POLICY "Delete customer vehicles"
    ON customer_vehicles FOR DELETE
    TO authenticated
    USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_customer_id ON customer_vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_number ON customer_vehicles(vehicle_number);
