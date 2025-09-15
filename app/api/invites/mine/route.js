import { createRlsClient, requireUserFromBearer } from '../../../../lib/supabaseServer';
import { newRequestId, getIp, logRequest } from '../../../../lib/log';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const __start = Date.now(); const __id = newRequestId(); const __ip = getIp(request);
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites/mine', method: 'GET', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  }
  const { token, user } = auth; const supabase = createRlsClient(token);
  const { data, error } = await supabase.from('invites').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  const __ms = Date.now()-__start; logRequest({ id: __id, route: '/api/invites/mine', method: 'GET', status: error?400:200, ms: __ms, userId: user.id, ip: __ip });
  if (error) return new Response(JSON.stringify({ error: error.message, code: error.code, details: error.details }), { status: 400, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ invites: data }), { status: 200, headers: { 'content-type': 'application/json' } });
}
