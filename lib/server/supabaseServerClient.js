import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Build a Supabase client that runs on the server under the caller's auth token.
// RLS will enforce row ownership based on that token.
export function createServerSupabaseClientFromToken(accessToken) {
  if (!accessToken) {
    throw new Error('Missing access token');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// Helper to fetch user id from the token (via GoTrue) when needed for inserts
export async function getUserIdFromToken(accessToken) {
  const client = createServerSupabaseClientFromToken(accessToken);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unable to get user from token');
  }
  return data.user.id;
}
