import { supabase } from './supabaseEnv.js';

async function checkSales() {
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- Sales Invoices ---');
  console.table(sales.map(s => ({ id: s.id, inv: s.invoice_number, customer: s.customer_name, status: s.status })));
}

checkSales();
