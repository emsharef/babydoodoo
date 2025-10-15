import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../../lib/supabaseServer';
import { limit, keyFor } from '../../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, context) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const params = await context.params;
  const IdSchema = z.string().uuid();
  const parsed = IdSchema.safeParse(params?.id);
  if (!parsed.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'DELETE', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'DELETE', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const __key = keyFor({ route: '/api/events/[id]', method: 'DELETE', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS)||60000, max: Number(process.env.RATE_MAX_WRITES_PER_USER)||60 });
  if (!__rl.ok) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'DELETE', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
  }
  const { error } = await supabase.from('events').delete().eq('id', parsed.data);
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'DELETE', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'DELETE', status: 204, ms: __ms, userId: user.id, ip: __ip });
  return new Response(null, { status: 204, headers: { 'X-Request-Id': __id } });
}

export async function PATCH(request, context) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const params = await context.params;
  const IdSchema = z.string().uuid();
  const BodySchema = z.object({
    meta: z.any(),
    occurred_at: z.string().datetime().optional(),
  });
  const id = IdSchema.safeParse(params?.id);
  if (!id.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const body = BodySchema.safeParse(await request.json().catch(()=>({})));
  if (!body.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const __key = keyFor({ route: '/api/events/[id]', method: 'PATCH', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS)||60000, max: Number(process.env.RATE_MAX_WRITES_PER_USER)||60 });
  if (!__rl.ok) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
  }
  const updatePayload = { meta: body.data.meta };
  if (body.data.occurred_at) updatePayload.occurred_at = body.data.occurred_at;
  const { data, error } = await supabase.from('events').update(updatePayload).eq('id', id.data).select('*').single();
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events/[id]', method: 'PATCH', status: 200, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ event: data }), { status: 200, headers: { 'content-type': 'application/json', 'X-Request-Id': __id } });
}
