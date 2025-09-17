export const dynamic = 'force-dynamic';
export async function GET() {
  const ok = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return new Response(JSON.stringify({ ok, timestamp: new Date().toISOString() }), { headers: { 'content-type':'application/json' } });
}
