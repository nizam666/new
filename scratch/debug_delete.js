import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function loginAndDelete() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'director@quarryerp.com',
    password: 'Director@123'
  });

  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }

  // Double check user session
  const { data: session } = await supabase.auth.getSession();
  console.log('Session active:', !!session.session);

  const { data: bills, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('status', 'pending');
  
  if (fetchError) {
    console.error('Fetch error:', fetchError.message);
    return;
  }

  if (bills.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const ids = bills.map(b => b.id);
  console.log('Attempting to delete IDs:', ids);

  const { error: delError, status, statusText } = await supabase
    .from('accounts')
    .delete()
    .in('id', ids);
  
  console.log('Delete Response:', { status, statusText, error: delError?.message });

  // Verify
  const { data: remaining } = await supabase.from('accounts').select('id').eq('status', 'pending');
  console.log('Pending bills remaining:', remaining?.length);
}

loginAndDelete();
