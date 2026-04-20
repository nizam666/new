import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function loginAndDelete() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'director@quarryerp.com',
    password: 'Director@123'
  });

  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }

  console.log('Logged in as Director');

  // Now try to find pending bills in accounts
  const { data: bills, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('transaction_type', 'expense')
    .eq('status', 'pending');
  
  if (fetchError) {
    console.error('Fetch error:', fetchError.message);
    return;
  }

  console.log(`Found ${bills.length} pending bills.`);
  if (bills.length > 0) {
    console.table(bills.map(b => ({ id: b.id, inv: b.invoice_number, vendor: b.customer_name, amount: b.amount })));
    
    // Deleting the first 3 (or all if <= 3)
    const toDelete = bills.slice(0, 3);
    const ids = toDelete.map(b => b.id);
    
    const { error: delError } = await supabase
      .from('accounts')
      .delete()
      .in('id', ids);
    
    if (delError) {
      console.error('Delete error:', delError.message);
    } else {
      console.log(`Successfully deleted ${toDelete.length} pending bills.`);
    }
  }
}

loginAndDelete();
