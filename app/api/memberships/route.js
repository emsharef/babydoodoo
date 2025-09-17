import { createRlsClient, requireUserFromBearer } from '../../../lib/supabaseServer';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireUserFromBearer(request);
  if (auth.error) return new Response(JSON.stringify({ error: auth.error.message }), { status: auth.error.status, headers: { 'content-type': 'application/json' } });
  const supabase = createRlsClient(auth.token);
  const { searchParams } = new URL(request.url); const baby_id = searchParams.get('baby_id');
  let q = supabase.from('memberships').select('id,baby_id,user_id,role,email,created_at');
  if (baby_id) q = q.eq('baby_id', baby_id);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ memberships: data }), { headers: { 'content-type': 'application/json' } });
}
