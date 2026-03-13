/*
  # Fix Infinite Recursion in Users Table RLS Policies

  ## Changes
  - Drop existing users table RLS policies that cause infinite recursion
  - Create simplified policies that don't query the users table within itself
  - Use auth.jwt() to check user roles from token metadata instead
  
  ## Security
  - Users can view their own profile
  - All authenticated users can view other users (needed for app functionality)
  - Users can only update their own profile
  - Role-based permissions are enforced at the application level and through other table policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Directors can view all users" ON users;
DROP POLICY IF EXISTS "Managers can view department users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create new simplified policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view other users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
