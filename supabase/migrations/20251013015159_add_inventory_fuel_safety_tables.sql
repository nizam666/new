/*
  # Add Inventory, Fuel Management, and Safety Tables

  1. New Tables
    - `inventory_items`
      - `id` (uuid, primary key)
      - `item_name` (text)
      - `item_code` (text, unique)
      - `category` (text) - Equipment, Tools, Spare Parts, Explosives, Safety Gear, etc.
      - `quantity` (numeric)
      - `unit` (text) - pieces, kg, liters, etc.
      - `minimum_quantity` (numeric) - alert threshold
      - `location` (text)
      - `supplier` (text)
      - `last_restock_date` (date)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to inventory_items)
      - `user_id` (uuid, foreign key to users)
      - `transaction_type` (text) - in, out, adjustment
      - `quantity` (numeric)
      - `date` (date)
      - `purpose` (text)
      - `notes` (text)
      - `created_at` (timestamptz)

    - `fuel_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `date` (date)
      - `vehicle_number` (text)
      - `vehicle_type` (text)
      - `fuel_type` (text) - Diesel, Petrol, etc.
      - `quantity_liters` (numeric)
      - `cost_per_liter` (numeric)
      - `total_cost` (numeric)
      - `odometer_reading` (numeric)
      - `supplier` (text)
      - `receipt_number` (text)
      - `notes` (text)
      - `status` (text) - pending, approved, rejected
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `safety_incidents`
      - `id` (uuid, primary key)
      - `reported_by` (uuid, foreign key to users)
      - `date` (date)
      - `time` (time)
      - `location` (text)
      - `incident_type` (text) - Near Miss, Minor Injury, Major Injury, Equipment Damage, Environmental, etc.
      - `severity` (text) - Low, Medium, High, Critical
      - `description` (text)
      - `people_involved` (text)
      - `witnesses` (text)
      - `immediate_action` (text)
      - `corrective_action` (text)
      - `status` (text) - reported, investigating, resolved, closed
      - `investigation_notes` (text)
      - `resolved_date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage records
    - Add policies for managers and directors to view all records
*/

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_code text UNIQUE NOT NULL,
  category text NOT NULL,
  quantity numeric DEFAULT 0,
  unit text NOT NULL,
  minimum_quantity numeric DEFAULT 0,
  location text,
  supplier text,
  last_restock_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage inventory"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment')),
  quantity numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  purpose text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can create inventory transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can manage all transactions"
  ON inventory_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

-- Create fuel_records table
CREATE TABLE IF NOT EXISTS fuel_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number text NOT NULL,
  vehicle_type text NOT NULL,
  fuel_type text NOT NULL,
  quantity_liters numeric NOT NULL,
  cost_per_liter numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  odometer_reading numeric,
  supplier text,
  receipt_number text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fuel records"
  ON fuel_records FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can insert own fuel records"
  ON fuel_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fuel records"
  ON fuel_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can manage fuel records"
  ON fuel_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

-- Create safety_incidents table
CREATE TABLE IF NOT EXISTS safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid REFERENCES auth.users(id) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  time time NOT NULL,
  location text NOT NULL,
  incident_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  description text NOT NULL,
  people_involved text,
  witnesses text,
  immediate_action text,
  corrective_action text,
  status text DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
  investigation_notes text,
  resolved_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own safety incidents"
  ON safety_incidents FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reported_by OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can report safety incidents"
  ON safety_incidents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can update own incidents"
  ON safety_incidents FOR UPDATE
  TO authenticated
  USING (auth.uid() = reported_by)
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Managers can manage all incidents"
  ON safety_incidents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inv_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_transactions_user ON inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_user ON fuel_records(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_records(date);
CREATE INDEX IF NOT EXISTS idx_safety_reported_by ON safety_incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_safety_severity ON safety_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_safety_status ON safety_incidents(status);
