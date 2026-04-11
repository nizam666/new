-- Create Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_no text NOT NULL UNIQUE,
    driver_name text NOT NULL,
    license_expiry date,
    mobile_number text,
    status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_by uuid REFERENCES users(id),
    updated_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Active Safety Restrictions
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Base Policies allowing all actions natively inside the client dashboard
CREATE POLICY "View drivers" ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert drivers" ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update drivers" ON drivers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete drivers" ON drivers FOR DELETE TO authenticated USING (true);

-- Indexing for lookup velocity scaling
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_no);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
