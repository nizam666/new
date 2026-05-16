import { getScratchAuth, supabase } from './supabaseEnv.js';

async function listPending() {
  const { email, password } = getScratchAuth();
  await supabase.auth.signInWithPassword({
    email,
    password
  });

  const { data: bills, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('status', 'pending');
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('--- Current Pending Bills ---');
  if (bills.length === 0) {
    console.log('No pending bills found.');
  } else {
    console.table(bills.map(b => ({ id: b.id, ref: b.invoice_number, vendor: b.customer_name, amount: b.amount })));
  }
}

listPending();
