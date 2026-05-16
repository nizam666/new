import { supabase } from './supabaseEnv.js';

async function checkUsersTable() {
  const { data: users, error } = await supabase
    .from('users')
    .select('*');
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('--- Users Table ---');
  console.table(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
}

checkUsersTable();
