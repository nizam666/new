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

  console.log('Logged in as Director');

  // Now try to find pending bills in accounts
  const { data: bills, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('transaction_type', 'expense')
    .eq('status', 'pending');
  
  if (fetchError) {
    console.error('Fetch error:', fetchError.message);
    return;
  }

  console.log(`Found ${bills.length} pending bills.`);
  if (bills.length > 0) {
    console.table(bills.map(b => ({ id: b.id, inv: b.invoice_number, vendor: b.customer_name, amount: b.amount })));
    
    // Deleting the first 3 (or all if <= 3)
    const toDelete = bills.slice(0, 3);
    const ids = toDelete.map(b => b.id);
    
    const { error: delError } = await supabase
      .from('accounts')
      .delete()
      .in('id', ids);
    
    if (delError) {
      console.error('Delete error:', delError.message);
    } else {
      console.log(`Successfully deleted ${toDelete.length} pending bills.`);
    }
  }
}

loginAndDelete();
