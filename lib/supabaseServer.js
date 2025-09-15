import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function invariant(cond, msg) { if (!cond) throw new Error(msg); }
export function createRlsClient(accessToken) {
  invariant(supabaseUrl, 'Missing NEXT_PUBLIC_SUPABASE_URL');
  invariant(anonKey, 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  invariant(accessToken, 'Missing access token');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
export async function requireUserFromBearer(request) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return { error: { status: 401, message: 'Missing bearer token' } };
  try {
    const supabase = createRlsClient(token);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return { error: { status: 401, message: 'Invalid or expired token' } };
    return { token, user: data.user, supabase };
  } catch { return { error: { status: 401, message: 'Invalid or expired token' } }; }
}
