import { supabase } from './supabaseEnv.js';

async function checkAll() {
  const { data: bills, error } = await supabase
    .from('accounts')
    .select('*')
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- All Records in Accounts ---');
  console.table(bills.map(b => ({ id: b.id, type: b.transaction_type, status: b.status, vendor: b.customer_name, amount: b.amount })));
}

checkAll();
