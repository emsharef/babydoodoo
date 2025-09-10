import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function clientFromToken(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function getBearerToken(request) {
  const h = request.headers.get('authorization') || '';
  if (!h.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7);
}

export async function requireUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: new Response(JSON.stringify({ error: 'Missing bearer token' }), { status: 401 }), user: null, token: null, supabase: null };
  }
  const supabase = clientFromToken(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { error: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }), user: null, token: null, supabase: null };
  }
  return { error: null, user: data.user, token, supabase };
}

export function serverClientFromToken(token) {
  return clientFromToken(token);
}
