import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../../lib/supabaseServer';
import { limit, keyFor } from '../../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AllowedEvents = z.enum([
  'DooDoo','PeePee','Diaper','YumYum',
  'SleepStart','SleepEnd',
  'Puke','Sick','Temperature','Medicine','Doctor',
  'BabyMood','MyMood','Play','Milestone','Note',
  'KickMe','Contraction','Heartbeat',
  'CryCry','BlahBlah','Measure'
]);

const EventSchema = z.object({
  event_type: AllowedEvents,
  occurred_at: z.string().datetime(),
  meta: z.any().optional(),
});

const BodySchema = z.object({
  baby_id: z.string().uuid(),
  events: z.array(EventSchema).min(1).max(500),
});

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);

  if (!parsed.success) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/events/bulk', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/events/bulk', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), {
      status: auth.error.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { token, user } = auth;
  const supabase = createRlsClient(token);

  // Rate limit check (more restrictive for bulk operations)
  const __key = keyFor({ route: '/api/events/bulk', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS) || 60000, max: 10 });
  if (!__rl.ok) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/events/bulk', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { baby_id, events } = parsed.data;

  // Prepare events for insertion
  const insertData = events.map(e => ({
    baby_id,
    user_id: user.id,
    event_type: e.event_type,
    occurred_at: e.occurred_at,
    meta: e.meta || {},
  }));

  // Bulk insert
  const { data, error } = await supabase
    .from('events')
    .insert(insertData)
    .select('id');

  if (error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/events/bulk', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message, code: error.code }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const __ms = Date.now() - __start;
  logRequest({ id: __id, route: '/api/events/bulk', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });

  return new Response(JSON.stringify({ imported: data.length }), {
    status: 201,
    headers: { 'content-type': 'application/json', 'X-Request-Id': __id }
  });
}
