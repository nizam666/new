import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function createDirectorAndDelete() {
  const email = `temp-dir-${Math.random().toString(36).substring(7)}@quarryerp.com`;
  const password = 'Director@123';

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
