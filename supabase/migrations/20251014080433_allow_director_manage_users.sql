/*
  # Allow directors to manage users

  1. Changes
    - Add policy to allow directors to update any user
    - Add policy to allow directors to delete any user
    - Add policy to allow directors to insert new users
    
  2. Security
    - Only users with 'director' role can manage other users
    - Directors can perform INSERT, UPDATE, and DELETE operations on users table
*/

-- Allow directors to insert new users
CREATE POLICY "Directors can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Allow directors to update any user
CREATE POLICY "Directors can update any user"
  ON users
  FOR UPDATE
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

-- Allow directors to delete any user
CREATE POLICY "Directors can delete any user"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );
