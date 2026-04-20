import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function listAndDelete() {
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
