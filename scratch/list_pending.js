import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listPendingBills() {
  const { data: bills, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('transaction_type', 'expense')
    .eq('status', 'pending');
  
  if (error) {
    console.error('Error fetching pending bills:', error);
    return;
  }

  console.log('--- Pending Bills (Accounts Table) ---');
  console.table(bills.map(b => ({ id: b.id, invoice: b.invoice_number, customer: b.customer_name, amount: b.amount, date: b.transaction_date })));
}

listPendingBills();
