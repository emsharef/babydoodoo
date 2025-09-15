import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
import { getIp, logRequest, newRequestId } from '../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/memberships', method: 'GET', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const { searchParams } = new URL(request.url); const baby_id = searchParams.get('baby_id');
  let query = supabase.from('memberships').select('id,baby_id,user_id,role,email,created_at');
  if (baby_id) query = query.eq('baby_id', baby_id);
  const { data, error } = await query;
  if (error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/memberships', method: 'GET', status: 400, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/memberships', method: 'GET', status: 200, ms: __ms, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ memberships: data }), { status: 200, headers: { 'content-type': 'application/json', 'X-Request-Id': __id } });
}
