import { requireUserFromBearer } from '../../../lib/supabaseServer';
import { newRequestId, getIp, logRequest } from '../../../lib/log';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/whoami', method: 'GET', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { user } = auth;
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/whoami', method: 'GET', status: 200, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ user, jwt_email: user.email }), { status: 200, headers: { 'content-type': 'application/json' } });
}
