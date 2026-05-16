import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running scratch scripts.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getScratchAuth() {
  const email = process.env.SCRATCH_SUPABASE_EMAIL;
  const password = process.env.SCRATCH_SUPABASE_PASSWORD;

  if (!email || !password) {
    throw new Error('Set SCRATCH_SUPABASE_EMAIL and SCRATCH_SUPABASE_PASSWORD before running this script.');
  }

  return { email, password };
}
