const buckets = new Map();
function now() { return Date.now(); }
export function limit({ key, windowMs, max }) {
  const ts = now();
  const win = Math.floor(ts / windowMs) * windowMs;
  const e = buckets.get(key);
  if (!e || e.win !== win) {
    buckets.set(key, { win, count: 1 });
    return { ok: true, remaining: max - 1, reset: win + windowMs, limit: max };
  }
  if (e.count >= max) return { ok: false, remaining: 0, reset: win + windowMs, limit: max };
  e.count += 1;
  return { ok: true, remaining: max - e.count, reset: win + windowMs, limit: max };
}
export function keyFor({ route, method, userId, ip }) {
  const who = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  return `${who}:${method}:${route}`;
}
