import { supabase } from './src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase.from('inventory_items').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data?.[0], null, 2));
  }
}

checkSchema();
