import { requireUser } from '../../../../lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request, ctx) {
  const { error, supabase } = await requireUser(request);
  if (error) return error;

  // Next 15.5.x: params may be async; await defensively
  const awaited = ctx?.params && (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params);
  const id = awaited?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400 });
  }

  const { error: dbErr } = await supabase.from('events').delete().eq('id', id);
  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 400 });
  }
  return new Response(null, { status: 204 });
}
