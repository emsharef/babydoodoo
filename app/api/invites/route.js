import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
import { limit, keyFor } from '../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  baby_id: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  role: z.enum(['parent','caregiver']),
});

export async function POST(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const __key = keyFor({ route: '/api/invites', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS)||60000, max: Number(process.env.RATE_MAX_WRITES_PER_USER)||60 });
  if (!__rl.ok) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
  }
  const { data, error } = await supabase.from('invites').insert([{
    baby_id: parsed.data.baby_id, email: parsed.data.email, role: parsed.data.role, invited_by: user.id
  }]).select('*').single();
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  try {
    const url = new URL(request.url);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    await anon.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: true, emailRedirectTo: `${url.origin}${process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback'}` }
    });
  } catch {}
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ invite: data, email_sent: true }), { status: 201, headers: { 'content-type': 'application/json', 'X-Request-Id': __id } });
}
