import { getScratchAuth, supabase } from './supabaseEnv.js';

async function checkUser() {
  const { email, password } = getScratchAuth();
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
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
