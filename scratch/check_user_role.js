import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function checkUser() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'director@quarryerp.com',
    password: 'Director@123'
  });

  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .single();
  
  if (userError) {
    console.error('User record fetch error:', userError.message);
    return;
  }

  console.log('User Role:', userRecord.role);
}

checkUser();
