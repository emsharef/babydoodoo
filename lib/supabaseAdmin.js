import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || (!serviceKey && !anonKey)) {
  // Avoid crashing in dev; warn instead.
  // eslint-disable-next-line no-console
  console.warn('[supabaseAdmin] Missing env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
}

// Fallback to anon key if service key isn't provided (no elevated privileges, but avoids runtime errors)
export const supabaseAdmin = createClient(
  supabaseUrl || 'http://localhost:54321', 
  serviceKey || anonKey || 'invalid-key',
  {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  }
);
