import { z } from 'zod';
import { limit, keyFor } from '../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../lib/log';
import { requireUser, serverClientFromToken } from '../../../lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  const { error, user, token, supabase } = await requireUser(request);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400 });
  }

  // Insert via the user's RLS-scoped client
  const { data, error: dbErr } = await supabase
    .from('babies')
    .insert([{ name: parsed.data.name, user_id: user.id }])
    .select('*')
    .single();

  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ baby: data }), { status: 201, headers: { 'content-type': 'application/json' } });
}
