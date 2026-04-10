
-- Create jcb_operations table
CREATE TABLE IF NOT EXISTS jcb_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  operator_name text NOT NULL, -- Stores Work Type from the form
  vehicle_number text NOT NULL, -- Stores Driver Name from the form
  location text NOT NULL,
  start_time text NOT NULL, -- Machine hours start
  end_time text NOT NULL, -- Machine hours end
  total_hours decimal(10,2) DEFAULT 0,
  fuel_consumed decimal(10,2) DEFAULT 0,
  licence_number text,
  work_description text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  work_area text CHECK (work_area IN ('quarry', 'crusher')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jcb_operations ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users can view own jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "Users can insert own jcb operations"
  ON jcb_operations FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Directors can view all jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'director'
    )
  );

CREATE POLICY "Managers can view all jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'manager'
    )
  );
