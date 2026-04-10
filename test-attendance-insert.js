import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://exuiwldxpsezihvcoety.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWl3bGR4cHNlemlodmNvZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDk3NDYsImV4cCI6MjA3NTYyNTc0Nn0.qh9fmfTIrCrWtfS8lzqhW7Gv1X2rhfgwOiAV-CdYu2s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAttendanceInsert() {
  const empId = 'EMP001';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  console.log("Attempting to insert dummy record...");
  const { data, error } = await supabase
    .from('selfie_attendance')
    .insert({
      employee_id: empId,
      date: today,
      check_in: now,
      check_in_photo: 'https://example.com/photo.jpg',
      work_area: 'general'
    });

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded!", data);
  }
}

testAttendanceInsert();
