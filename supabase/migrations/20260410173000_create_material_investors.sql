
-- Create material_investors table
CREATE TABLE IF NOT EXISTS material_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name text NOT NULL,
  contact_number text NOT NULL,
  email text,
  investment_amount numeric NOT NULL DEFAULT 0,
  material_type text NOT NULL, -- e.g., Aggregate, Sand, GSB
  investment_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE material_investors ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users can view all material investors"
  ON material_investors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert material investors"
  ON material_investors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own material investors"
  ON material_investors FOR UPDATE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE material_investors;
