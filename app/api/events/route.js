import { z } from 'zod';
import { limit, keyFor } from '../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../lib/log';
import { requireUser } from '../../../lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  baby_id: z.string().uuid(),
  event_type: z.enum(['DooDoo']),
  occurred_at: z.string().datetime().optional(),
});

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  const { error, user, supabase } = await requireUser(request);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400 });
  }

  const insertObj = {
    baby_id: parsed.data.baby_id,
    user_id: user.id,
    event_type: parsed.data.event_type,
    ...(parsed.data.occurred_at ? { occurred_at: parsed.data.occurred_at } : {}),
  };

  const { data, error: dbErr } = await supabase
    .from('events')
    .insert([insertObj])
    .select('*')
    .single();

  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ event: data }), { status: 201, headers: { 'content-type': 'application/json' } });
}
