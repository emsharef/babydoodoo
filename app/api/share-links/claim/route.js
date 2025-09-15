import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../../lib/supabaseServer';
import { getIp, logRequest, newRequestId } from '../../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  token: z.string().min(16),
});

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400 });
  }

  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status });
  }
  const { token, user } = auth;
  const supabase = createRlsClient(token);

  const hash = createHash('sha256').update(parsed.data.token).digest('hex');

  // Look up the link (parents can select; other users may not, but we'll select a single row by hash)
  const { data: link, error: linkErr } = await supabase
    .from('share_links')
    .select('id, baby_id, role, expires_at, used_at')
    .eq('token_hash', hash)
    .single();

  if (linkErr || !link) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: 404, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 404 });
  }

  if (link.used_at || new Date(link.expires_at).getTime() <= Date.now()) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: 410, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Token already used or expired' }), { status: 410 });
  }

  // Insert membership (RLS checks that invite_token_hash matches an active link with same baby & role)
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .insert([{ baby_id: link.baby_id, user_id: user.id, role: link.role, invite_token_hash: hash }])
    .select('*')
    .single();

  if (memErr) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: memErr.message }), { status: 400 });
  }

  // Mark share link as used
  await supabase.from('share_links').update({ used_at: new Date().toISOString() }).eq('id', link.id);

  const __ms = Date.now() - __start;
  logRequest({ id: __id, route: '/api/share-links/claim', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ membership }), { status: 201, headers: { 'content-type': 'application/json' } });
}
