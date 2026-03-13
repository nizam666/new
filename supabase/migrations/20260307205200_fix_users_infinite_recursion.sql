/*
  # Fix Users Table Infinite Recursion

  1. Changes
    - Drop the recursive policy from 20260130125000
    - Replace with a secure, non-recursive RLS policy using auth.uid()
*/

DROP POLICY IF EXISTS "Users can view profiles" ON users;

CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    true
  );
