import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`
Missing extension env.

Expected:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// We define an auth listener to keep session state
supabase.auth.onAuthStateChange((event, session) => {
  // Can be used to broadcast auth changes to other parts of the extension
});
