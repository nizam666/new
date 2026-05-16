import { getScratchAuth, supabase } from './supabaseEnv.js';

async function loginAndDelete() {
  if (process.env.ALLOW_DESTRUCTIVE_SCRATCH !== '1') {
    throw new Error('Set ALLOW_DESTRUCTIVE_SCRATCH=1 to run destructive scratch scripts.');
  }

  const { email, password } = getScratchAuth();
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
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
