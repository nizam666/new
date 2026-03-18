/*
  Fix RLS Policies for unauthenticated Self-Service Terminal
*/

-- 1. Allow unauthenticated terminal to Insert/Select/Update selfie_attendance
CREATE POLICY "Allow anon to insert attendance"
  ON selfie_attendance FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to select attendance"
  ON selfie_attendance FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to update attendance"
  ON selfie_attendance FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2. Allow unauthenticated terminal to upload photos
CREATE POLICY "Allow anon uploads to attendance photos"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'attendance-photos');

-- 3. Create RPC to verify employee ID across users and workers for the Terminal
CREATE OR REPLACE FUNCTION verify_employee_id(emp_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_source text;
BEGIN
  -- Check workers first
  SELECT name INTO v_name FROM workers WHERE employee_id = upper(emp_id) AND is_active = true limit 1;
  IF found THEN
    RETURN json_build_object('success', true, 'name', v_name, 'source', 'worker');
  END IF;

  -- Check users
  SELECT full_name INTO v_name FROM users WHERE employee_id = upper(emp_id) AND is_active = true limit 1;
  IF found THEN
    RETURN json_build_object('success', true, 'name', v_name, 'source', 'user');
  END IF;

  RETURN json_build_object('success', false, 'error', 'Employee ID not found or inactive');
END;
$$;
