import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
import { limit, keyFor } from '../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/babies', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/babies', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const __key = keyFor({ route: '/api/babies', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS)||60000, max: Number(process.env.RATE_MAX_WRITES_PER_USER)||60 });
  if (!__rl.ok) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/babies', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
  }
  const { data, error } = await supabase.rpc('create_baby', { p_name: parsed.data.name });
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/babies', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error.details }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const baby = Array.isArray(data) ? data[0] : data;
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/babies', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ baby }), { status: 201, headers: { 'content-type':'application/json', 'X-Request-Id': __id } });
}
