-- Create transport_diesel_records table
CREATE TABLE IF NOT EXISTS transport_diesel_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  vehicle_number TEXT NOT NULL,
  diesel_liters NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transport_diesel_records ENABLE ROW LEVEL SECURITY;

-- Policy: contractors can insert their own records
CREATE POLICY "Contractors can insert own diesel records"
  ON transport_diesel_records FOR INSERT
  WITH CHECK (auth.uid() = contractor_id);

-- Policy: view own records (contractors) or all records (managers/directors)
CREATE POLICY "Users can view diesel records"
  ON transport_diesel_records FOR SELECT
  USING (
    auth.uid() = contractor_id
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'manager')
    )
  );

-- Index for fast lookup by date and contractor
CREATE INDEX IF NOT EXISTS idx_transport_diesel_records_contractor_date
  ON transport_diesel_records (contractor_id, date DESC);
