import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function listPending() {
  await supabase.auth.signInWithPassword({
    email: 'director@quarryerp.com',
    password: 'Director@123'
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
