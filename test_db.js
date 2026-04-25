import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://exuiwldxpsezihvcoety.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
