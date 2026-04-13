import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAttendance() {
  const { data, count, error } = await supabase
    .from('selfie_attendance')
    .select('*', { count: 'exact', head: true })
  
  console.log('Total selfie_attendance records:', count)
  if (error) console.error('Error:', error)

  const { data: viewData, count: viewCount, error: viewError } = await supabase
    .from('attendance_details_view')
    .select('*', { count: 'exact', head: true })
    
  console.log('Total attendance_details_view records:', viewCount)
  if (viewError) console.error('View Error:', viewError)
}

checkAttendance()
