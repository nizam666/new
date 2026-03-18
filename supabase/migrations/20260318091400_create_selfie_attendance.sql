/*
  # Create Selfie Attendance System

  1. New Tables
    - `selfie_attendance`
      - `id` (uuid, primary key)
      - `employee_id` (text, references workers)
      - `date` (date)
      - `check_in` (timestamptz)
      - `check_out` (timestamptz)
      - `check_in_photo` (text)
      - `check_out_photo` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create `attendance-photos` bucket
    - Enable public access for viewing photos

  3. Security
    - Enable RLS on `selfie_attendance` table
    - Add policies for public insertion and self-viewing
    - Add storage policies
*/

-- Create selfie_attendance table
CREATE TABLE IF NOT EXISTS selfie_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz NOT NULL DEFAULT now(),
  check_out timestamptz,
  check_in_photo text NOT NULL,
  check_out_photo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Prevent multiple active attendance records for same employee on same day
  CONSTRAINT unique_employee_daily_attendance UNIQUE (employee_id, date)
);

-- Enable RLS
ALTER TABLE selfie_attendance ENABLE ROW LEVEL SECURITY;

-- We want anyone (even unauthenticated, if it's a kiosk) to insert, 
-- but we might want to restrict it later. Assuming kiosk is somewhat public/shared.
-- Note: It's safer if kiosk is authenticated as a generic user, but we'll allow anon if needed.
-- For now, let's allow authenticated users to insert/update, assuming kiosk logs in as a manager or a specific kiosk user.
CREATE POLICY "Allow authenticated users to insert attendance"
  ON selfie_attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow updates (for check-out)
CREATE POLICY "Allow authenticated users to update attendance"
  ON selfie_attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow reading
CREATE POLICY "Allow authenticated users to view attendance"
  ON selfie_attendance FOR SELECT
  TO authenticated
  USING (true);

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
CREATE POLICY "Allow public viewing of attendance photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'attendance-photos');

CREATE POLICY "Allow authenticated uploads to attendance photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_selfie_attendance_date ON selfie_attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_selfie_attendance_employee ON selfie_attendance(employee_id);
