import { supabase } from './scratch/supabaseEnv.js';

async function checkLoginState() {
  console.log("--- Checking RPC with 'EMP001' ---");
  const { data: rpc1, error: r1 } = await supabase.rpc('get_user_email_by_employee_id', { emp_id: 'EMP001' });
  console.log('Result for EMP001:', rpc1, r1);

  console.log("--- Checking RPC with 'EMP' ---");
  const { data: rpc2, error: r2 } = await supabase.rpc('get_user_email_by_employee_id', { emp_id: 'EMP' });
  console.log('Result for EMP:', rpc2, r2);

  // Use verify_employee_id as it bypasses RLS safely and gets the name
  console.log("--- Checking verify_employee_id RPC for 'EMP001' ---");
  const { data: v1, error: ve1 } = await supabase.rpc('verify_employee_id', { emp_id: 'EMP001' });
  console.log('Result v1:', v1, ve1);
}

checkLoginState();
