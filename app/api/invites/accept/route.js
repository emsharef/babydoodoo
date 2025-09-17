import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ invite_id: z.string().uuid() });

export async function POST(request) {
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const auth = await requireUserFromBearer(request);
  if (auth.error) return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  const { token, user } = auth; const supabase = createRlsClient(token);

  const rpc1 = await supabase.rpc('accept_invite_tx', { p_invite_id: parsed.data.invite_id, p_user_id: user.id, p_email: user.email });
  if (rpc1.error) {
    return new Response(JSON.stringify({ step: 'accept_invite_tx', error: rpc1.error.message, code: rpc1.error.code, details: rpc1.error.details }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const babyId = Array.isArray(rpc1.data) && rpc1.data[0]?.baby_id ? rpc1.data[0].baby_id : rpc1.data?.baby_id || null;

  let membership = null;
  if (babyId) {
    const { data: mem } = await supabase.from('memberships').select('*').eq('baby_id', babyId).eq('user_id', user.id).maybeSingle();
    membership = mem || null;
  }
  if (!membership) {
    await supabase.rpc('ensure_membership_for_invite', { p_invite_id: parsed.data.invite_id });
    if (babyId) {
      const { data: mem2 } = await supabase.from('memberships').select('*').eq('baby_id', babyId).eq('user_id', user.id).maybeSingle();
      membership = mem2 || null;
    }
  }
  return new Response(JSON.stringify({ ok: true, baby_id: babyId, membership }), { status: 200, headers: { 'content-type': 'application/json' } });
}
