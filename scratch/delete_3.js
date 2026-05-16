import { supabase } from './supabaseEnv.js';

async function listAndDelete() {
  if (process.env.ALLOW_DESTRUCTIVE_SCRATCH !== '1') {
    throw new Error('Set ALLOW_DESTRUCTIVE_SCRATCH=1 to run destructive scratch scripts.');
  }

  const { data: bills, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('transaction_type', 'expense')
    .eq('status', 'pending')
    .limit(3);
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found 3 pending bills:');
  console.table(bills.map(b => ({ id: b.id, inv: b.invoice_number, vendor: b.customer_name })));

  if (bills.length > 0) {
    const ids = bills.map(b => b.id);
    const { error: delError } = await supabase
      .from('accounts')
      .delete()
      .in('id', ids);
    
    if (delError) {
      console.error('Delete error:', delError);
    } else {
      console.log('Successfully deleted 3 bills.');
    }
  } else {
    console.log('No pending bills found.');
  }
}

listAndDelete();
