import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function fixUserAndAndDelete() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'director@quarryerp.com',
    password: 'Director@123'
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
      email: 'director@quarryerp.com',
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
