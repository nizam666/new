import { supabase } from './scratch/supabaseEnv.js';

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
