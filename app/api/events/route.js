import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
import { limit, keyFor } from '../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AllowedEvents = z.enum([
  'DooDoo','PeePee','YumYum','KickMe','Contraction',
  'MyMood','BabyMood','SleepStart','SleepEnd','BlahBlah','CryCry',
  'Temperature','Measure','Sick','Puke'
]);

const BodySchema = z.object({
  baby_id: z.string().uuid(),
  event_type: AllowedEvents,
  occurred_at: z.string().datetime().optional(),
});

export async function POST(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);

  const __key = keyFor({ route: '/api/events', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS)||60000, max: Number(process.env.RATE_MAX_WRITES_PER_USER)||60 });
  if (!__rl.ok) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
  }

  const insertObj = { baby_id: parsed.data.baby_id, user_id: user.id, event_type: parsed.data.event_type };
  if (parsed.data.occurred_at) insertObj.occurred_at = parsed.data.occurred_at;

  const { data, error } = await supabase.from('events').insert([insertObj]).select('*').single();
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error.details }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/events', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ event: data }), { status: 201, headers: { 'content-type': 'application/json', 'X-Request-Id': __id } });
}
