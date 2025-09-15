import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
import { getIp, logRequest, newRequestId } from '../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  baby_id: z.string().uuid(),
  role: z.enum(['caregiver']).default('caregiver'),
  expires_in_days: z.number().int().min(1).max(60).optional(),
});

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400 });
  }

  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status });
  }

  const { token, user } = auth;
  const supabase = createRlsClient(token);

  // Generate random token and hash
  const raw = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');

  const expDays = parsed.data.expires_in_days ?? 7;
  const expires_at = new Date(Date.now() + expDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from('share_links')
    .insert([{
      baby_id: parsed.data.baby_id,
      role: parsed.data.role,
      token_hash: hash,
      created_by: user.id,
      expires_at,
    }])
    .select('id, baby_id, role, expires_at')
    .single();

  if (error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/share-links', method: 'POST', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window === 'undefined' ? '' : window.location.origin);
  const acceptUrl = baseUrl ? `${baseUrl}/share/accept?token=${raw}` : `/share/accept?token=${raw}`;

  const __ms = Date.now() - __start;
  logRequest({ id: __id, route: '/api/share-links', method: 'POST', status: 201, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ link: { id: data.id, baby_id: data.baby_id, role: data.role, expires_at: data.expires_at, token: raw, accept_url: acceptUrl } }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}
