/*
  # Add Stock Management Tables

  1. New Tables
    - `production_stock`
      - `id` (uuid, primary key) - Unique identifier
      - `material_type` (text) - Type of material produced
      - `quantity` (decimal) - Stock quantity
      - `unit` (text) - Unit of measurement
      - `stock_date` (date) - Date stock was added
      - `location` (text) - Storage location
      - `quality_grade` (text) - Quality/grade of material
      - `notes` (text) - Additional notes
      - `created_by` (uuid, foreign key) - User who created record
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

    - `purchase_requests`
      - `id` (uuid, primary key) - Unique identifier
      - `request_number` (text) - Request reference number
      - `material_name` (text) - Name of material requested
      - `quantity` (decimal) - Quantity requested
      - `unit` (text) - Unit of measurement
      - `purpose` (text) - Purpose/reason for request
      - `priority` (text) - Priority level (low, medium, high, urgent)
      - `required_by` (date) - Required delivery date
      - `estimated_cost` (decimal) - Estimated cost
      - `supplier_suggestion` (text) - Suggested supplier
      - `status` (text) - Status (pending, approved, ordered, received, rejected)
      - `approved_by` (uuid, foreign key) - User who approved
      - `approval_date` (timestamptz) - Date of approval
      - `notes` (text) - Additional notes
      - `created_by` (uuid, foreign key) - User who created request
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for role-based access
*/

-- Create production_stock table
CREATE TABLE IF NOT EXISTS production_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL,
  quantity decimal(12,2) NOT NULL,
  unit text NOT NULL DEFAULT 'tons',
  stock_date date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  quality_grade text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,
  material_name text NOT NULL,
  quantity decimal(12,2) NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  purpose text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  required_by date,
  estimated_cost decimal(12,2),
  supplier_suggestion text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id),
  approval_date timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE production_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Policies for production_stock table
CREATE POLICY "Authenticated users can view production stock"
  ON production_stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Crusher managers and managers can insert production stock"
  ON production_stock FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );

CREATE POLICY "Authorized users can update production stock"
  ON production_stock FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );

CREATE POLICY "Directors can delete production stock"
  ON production_stock FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Policies for purchase_requests table
CREATE POLICY "Authenticated users can view purchase requests"
  ON purchase_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert purchase requests"
  ON purchase_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'crusher_manager', 'director')
    )
  );

CREATE POLICY "Managers can update own purchase requests"
  ON purchase_requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'manager')
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'manager')
    )
  );

CREATE POLICY "Directors can delete purchase requests"
  ON purchase_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_production_stock_material ON production_stock(material_type);
CREATE INDEX IF NOT EXISTS idx_production_stock_date ON production_stock(stock_date);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_priority ON purchase_requests(priority);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_by ON purchase_requests(created_by);
