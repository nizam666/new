
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local if exists
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('jcb_operations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching from jcb_operations:', error);
  } else {
    console.log('Successfully fetched sample record. Columns present:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log('Table is empty, trying to get error info for missing columns...');
      // Try to insert a dummy record to see what fails
      const { error: insertError } = await supabase
        .from('jcb_operations')
        .insert([{ dummy_col_test: 'test' }]);
      console.log('Insert attempt error:', insertError?.message);
    }
  }
}

checkSchema();
