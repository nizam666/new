import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkStatus() {
  const employeeId = 'EMP002';
  const today = new Date().toLocaleDateString('en-CA');

  console.log(`Checking status for ${employeeId} on ${today}...`);

  const { data: attendance, error: attError } = await supabase
    .from('selfie_attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today);

  if (attError) console.error('Attendance Error:', attError);
  else console.log('Attendance Records:', attendance);

  const { data: workflows, error: wfError } = await supabase
    .from('approval_workflows')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (wfError) console.error('Workflow Error:', wfError);
  else console.log('Recent Workflows:', workflows.slice(0, 5));
}

checkStatus();
