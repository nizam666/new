
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

async function check() {
  const { data: blasting } = await supabase.from('blasting_records').select('*').limit(5);
  console.log('Blasting Records:', JSON.stringify(blasting, null, 2));

  const { data: dispatch } = await supabase.from('inventory_dispatch').select('*').eq('department', 'Quarry Operations').limit(5);
  console.log('Dispatch Records:', JSON.stringify(dispatch, null, 2));
}

check();
