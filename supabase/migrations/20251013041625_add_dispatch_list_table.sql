/*
  # Add Dispatch List Management Table

  1. New Tables
    - `dispatch_list`
      - `id` (uuid, primary key) - Unique identifier
      - `dispatch_number` (text) - Dispatch reference number
      - `material_type` (text) - Type of material being dispatched
      - `quantity_dispatched` (decimal) - Amount of material dispatched
      - `quantity_received` (decimal) - Amount of material received
      - `balance_quantity` (decimal) - Remaining balance (auto-calculated)
      - `unit` (text) - Unit of measurement (tons, cubic meters, etc.)
      - `transportation_mode` (text) - Mode of transport (truck, rail, etc.)
      - `vehicle_number` (text) - Vehicle/transport identification
      - `driver_name` (text) - Name of driver
      - `driver_contact` (text) - Driver contact number
      - `destination` (text) - Delivery destination
      - `customer_name` (text) - Customer receiving the material
      - `dispatch_date` (date) - Date of dispatch
      - `expected_delivery_date` (date) - Expected delivery date
      - `delivery_status` (text) - Status (dispatched, in_transit, delivered, cancelled)
      - `notes` (text) - Additional notes
      - `created_by` (uuid, foreign key) - User who created the record
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on dispatch_list table
    - Add policies for authenticated users to manage dispatches
*/

-- Create dispatch_list table
CREATE TABLE IF NOT EXISTS dispatch_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text NOT NULL,
  material_type text NOT NULL,
  quantity_dispatched decimal(12,2) NOT NULL,
  quantity_received decimal(12,2) DEFAULT 0,
  balance_quantity decimal(12,2) GENERATED ALWAYS AS (quantity_dispatched - COALESCE(quantity_received, 0)) STORED,
  unit text NOT NULL DEFAULT 'tons',
  transportation_mode text NOT NULL,
  vehicle_number text,
  driver_name text,
  driver_contact text,
  destination text NOT NULL,
  customer_name text NOT NULL,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  delivery_status text NOT NULL DEFAULT 'dispatched',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE dispatch_list ENABLE ROW LEVEL SECURITY;

-- Policies for dispatch_list table
CREATE POLICY "Authenticated users can view dispatch list"
  ON dispatch_list FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert dispatch records"
  ON dispatch_list FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager', 'site_manager')
    )
  );

CREATE POLICY "Authorized users can update dispatch records"
  ON dispatch_list FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager', 'site_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager', 'site_manager')
    )
  );

CREATE POLICY "Directors can delete dispatch records"
  ON dispatch_list FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dispatch_list_status ON dispatch_list(delivery_status);
CREATE INDEX IF NOT EXISTS idx_dispatch_list_dispatch_date ON dispatch_list(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_list_customer ON dispatch_list(customer_name);
CREATE INDEX IF NOT EXISTS idx_dispatch_list_material ON dispatch_list(material_type);
