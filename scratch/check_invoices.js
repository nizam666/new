import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

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
