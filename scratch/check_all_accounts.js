import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

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
