import { supabase } from './scratch/supabaseEnv.js'

async function test() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}

test()
