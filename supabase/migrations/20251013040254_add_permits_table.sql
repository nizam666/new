/*
  # Add Permits Management Tables

  1. New Tables
    - `permits`
      - `id` (uuid, primary key) - Unique identifier
      - `permit_number` (text) - Permit identification number
      - `permit_type` (text) - Type of permit (mining, environmental, safety, etc.)
      - `approval_date` (date) - Date when permit was approved
      - `expiry_date` (date) - Date when permit expires
      - `issuing_authority` (text) - Authority that issued the permit
      - `status` (text) - Current status (active, expired, pending_renewal)
      - `description` (text) - Details about the permit
      - `document_url` (text) - URL to permit document
      - `created_by` (uuid, foreign key) - User who created the record
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

    - `permit_renewals`
      - `id` (uuid, primary key) - Unique identifier
      - `permit_id` (uuid, foreign key) - Reference to original permit
      - `renewal_date` (date) - Date of renewal application
      - `new_expiry_date` (date) - New expiry date after renewal
      - `renewal_status` (text) - Status (pending, approved, rejected)
      - `renewal_fee` (decimal) - Fee paid for renewal
      - `notes` (text) - Additional notes
      - `created_by` (uuid, foreign key) - User who created the record
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage permits
*/

-- Create permits table
CREATE TABLE IF NOT EXISTS permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_number text NOT NULL,
  permit_type text NOT NULL,
  approval_date date NOT NULL,
  expiry_date date NOT NULL,
  issuing_authority text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  description text,
  document_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create permit_renewals table
CREATE TABLE IF NOT EXISTS permit_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid REFERENCES permits(id) ON DELETE CASCADE,
  renewal_date date NOT NULL,
  new_expiry_date date NOT NULL,
  renewal_status text NOT NULL DEFAULT 'pending',
  renewal_fee decimal(10,2),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_renewals ENABLE ROW LEVEL SECURITY;

-- Policies for permits table
CREATE POLICY "Authenticated users can view permits"
  ON permits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors can insert permits"
  ON permits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

CREATE POLICY "Directors can update permits"
  ON permits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

CREATE POLICY "Directors can delete permits"
  ON permits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Policies for permit_renewals table
CREATE POLICY "Authenticated users can view permit renewals"
  ON permit_renewals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors can insert permit renewals"
  ON permit_renewals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

CREATE POLICY "Directors can update permit renewals"
  ON permit_renewals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

CREATE POLICY "Directors can delete permit renewals"
  ON permit_renewals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
CREATE INDEX IF NOT EXISTS idx_permits_expiry_date ON permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_permit_renewals_permit_id ON permit_renewals(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_renewals_status ON permit_renewals(renewal_status);
