import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data, error } = await supabase
    .from('eb_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(3)
  
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}

test()
