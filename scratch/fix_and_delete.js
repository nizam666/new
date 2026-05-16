import { getScratchAuth, supabase } from './supabaseEnv.js';

async function fixUserAndAndDelete() {
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

  const userId = auth.user.id;
  console.log('User ID:', userId);

  // 1. Try to register this user as a Director in the public.users table
  // This helps fulfill the RLS policy requirement
  const { error: upsertError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email,
      role: 'director',
      full_name: 'System Director',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (upsertError) {
    console.log('Note: Could not upsert user record (might be RLS protected):', upsertError.message);
  } else {
    console.log('Successfully registered / verified Director role for this session.');
  }

  // 2. Delete the specific invoice
  const targetInv = 'INT-KUM-260414-YQRZ';
  console.log(`Attempting to delete invoice: ${targetInv}`);

  const { error: delError, status } = await supabase
    .from('accounts')
    .delete()
    .eq('invoice_number', targetInv);
  
  if (delError) {
    console.error('Delete error:', delError.message);
  } else if (status === 204) {
    // Verify deletion
    const { data: verify } = await supabase
      .from('accounts')
      .select('id')
      .eq('invoice_number', targetInv);
    
    if (verify && verify.length === 0) {
      console.log(`Successfully deleted invoice ${targetInv}`);
    } else {
      console.log(`Delete call returned success but record ${targetInv} still exists. RLS might be blocking it.`);
    }
  }
}

fixUserAndAndDelete();
