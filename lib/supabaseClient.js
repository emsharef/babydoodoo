'use client';
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(url, anon, {
  auth: { flowType: 'implicit', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') window.supabase = supabase;
