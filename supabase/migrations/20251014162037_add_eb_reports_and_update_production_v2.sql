/*
  # Add EB Reports Table and Update Production Records

  1. New Tables
    - `eb_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `report_date` (date) - Date of the EB report
      - `meter_reading_start` (numeric) - Starting meter reading
      - `meter_reading_end` (numeric) - Ending meter reading
      - `units_consumed` (numeric) - Total units consumed (calculated)
      - `cost_per_unit` (numeric) - Cost per electricity unit
      - `total_cost` (numeric) - Total electricity cost
      - `power_cuts` (text) - Power cut details
      - `equipment_status` (text) - Equipment operational status
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz)
      
  2. Updates to existing tables
    - Update `production_records` table to add more crusher production fields
    
  3. Security
    - Enable RLS on `eb_reports` table
    - Add policies for crusher_manager role to manage EB reports
*/

-- Create EB Reports table
CREATE TABLE IF NOT EXISTS eb_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  meter_reading_start numeric NOT NULL DEFAULT 0,
  meter_reading_end numeric NOT NULL DEFAULT 0,
  units_consumed numeric GENERATED ALWAYS AS (meter_reading_end - meter_reading_start) STORED,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS ((meter_reading_end - meter_reading_start) * cost_per_unit) STORED,
  power_cuts text,
  equipment_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add additional fields to production_records if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_records' AND column_name = 'output_20mm'
  ) THEN
    ALTER TABLE production_records 
      ADD COLUMN output_20mm numeric DEFAULT 0,
      ADD COLUMN output_40mm numeric DEFAULT 0,
      ADD COLUMN output_dust numeric DEFAULT 0,
      ADD COLUMN total_output numeric GENERATED ALWAYS AS (COALESCE(output_20mm, 0) + COALESCE(output_40mm, 0) + COALESCE(output_dust, 0)) STORED,
      ADD COLUMN downtime_hours numeric DEFAULT 0,
      ADD COLUMN maintenance_notes text,
      ADD COLUMN notes text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE eb_reports ENABLE ROW LEVEL SECURITY;

-- Policies for eb_reports

-- Crusher managers can view their own EB reports
CREATE POLICY "Crusher managers can view own EB reports"
  ON eb_reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'crusher_manager'
    )
  );

-- Crusher managers can create their own EB reports
CREATE POLICY "Crusher managers can create EB reports"
  ON eb_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'crusher_manager'
    )
  );

-- Crusher managers can update their own EB reports
CREATE POLICY "Crusher managers can update own EB reports"
  ON eb_reports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'crusher_manager'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'crusher_manager'
    )
  );

-- Directors and managers can view all EB reports
CREATE POLICY "Directors and managers can view all EB reports"
  ON eb_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'manager')
    )
  );