import { supabase } from './supabaseEnv.js';

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
