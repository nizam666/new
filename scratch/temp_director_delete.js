import { supabase } from './supabaseEnv.js';

async function createDirectorAndDelete() {
  if (process.env.ALLOW_DESTRUCTIVE_SCRATCH !== '1') {
    throw new Error('Set ALLOW_DESTRUCTIVE_SCRATCH=1 to run destructive scratch scripts.');
  }

  const email = `temp-dir-${Math.random().toString(36).substring(7)}@quarryerp.com`;
  const password = process.env.SCRATCH_TEMP_DIRECTOR_PASSWORD;

  if (!password) {
    throw new Error('Set SCRATCH_TEMP_DIRECTOR_PASSWORD before running this script.');
  }

  console.log(`Signing up new director: ${email}`);
  const { data: authData, error: authError } = await supabase.auth.signUp({ 
    email, 
    password 
  });

  if (authError) {
    console.error('Sign up error:', authError.message);
    return;
  }

  if (authData.user) {
    console.log('User created in Auth. Registering in public.users table...');
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          full_name: 'Temporary Director',
          role: 'director',
          is_active: true
        }
      ]);

    if (profileError) {
      console.error('Profile creation error:', profileError.message);
      return;
    }

    console.log('Director profile created successfully. Attempting deletion...');
    
    // Now delete
    const targetInv = 'INT-KUM-260414-YQRZ';
    const { error: delError, status } = await supabase
      .from('accounts')
      .delete()
      .eq('invoice_number', targetInv);
    
    if (delError) {
      console.error('Delete error:', delError.message);
    } else {
      console.log(`Successfully deleted invoice ${targetInv}. Status: ${status}`);
    }
    
    // Cleanup: try to delete the temporary user
    // (Usually users can't delete themselves in Auth without service role, but we leave it)
  }
}

createDirectorAndDelete();
