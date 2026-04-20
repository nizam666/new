import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://exuiwldxpsezihvcoety.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s');

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // If they have a custom RPC
  if (error) {
    // If no RPC, try querying some common tables
    const tables = ['accounts', 'invoices', 'sales_orders', 'inventory_transactions', 'fuel_records', 'vendors', 'customers'];
    for (const table of tables) {
      const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true });
      console.log(`Table ${table}: ${countError ? 'Error (' + countError.message + ')' : count + ' records'}`);
    }
  } else {
    console.log(data);
  }
}

listTables();
