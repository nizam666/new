/*
  # Add Workers Table and Update Attendance

  1. New Tables
    - `workers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `employee_id` (text, unique)
      - `role` (text)
      - `phone` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Update `attendance_records`
      - Add `worker_ids` (text array) - IDs of workers who attended
      - Add `number_of_workers` (integer) - count of workers
      - Add `worker_names` (text array) - names of workers for quick reference

  3. Security
    - Enable RLS on workers table
    - Add policies for managing workers
*/

-- Create workers table
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  employee_id text UNIQUE,
  role text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view workers"
  ON workers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add workers"
  ON workers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update workers"
  ON workers FOR UPDATE
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

-- Add new columns to attendance_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'worker_ids'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN worker_ids text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'number_of_workers'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN number_of_workers integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'worker_names'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN worker_names text[];
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(is_active);
CREATE INDEX IF NOT EXISTS idx_workers_name ON workers(name);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_ids ON attendance_records USING GIN(worker_ids);
