-- Create a secure function to allow login form to resolve an employee's email by their employee ID
CREATE OR REPLACE FUNCTION get_user_email_by_employee_id(emp_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_email text;
BEGIN
  SELECT email INTO found_email FROM users WHERE employee_id = upper(emp_id);
  RETURN found_email;
END;
$$;
