import { supabase } from './supabaseEnv.js';

async function checkInvoices() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- Invoices Table ---');
  console.table(invoices.map(s => ({ id: s.id, inv: s.invoice_number, customer: s.customer_name, amount: s.total_amount, status: s.status })));
}

checkInvoices();
