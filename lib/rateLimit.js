const buckets = new Map();

function now() { return Date.now(); }

/**
 * Simple fixed-window limiter: counts requests per key within a window.
 * @param {Object} p
 * @param {string} p.key
 * @param {number} p.windowMs
 * @param {number} p.max
 * @returns {{ok: boolean, remaining: number, reset: number, limit: number}}
 */
export function limit({ key, windowMs, max }) {
  const ts = now();
  const winStart = Math.floor(ts / windowMs) * windowMs;
  const entry = buckets.get(key);
  if (!entry || entry.winStart !== winStart) {
    buckets.set(key, { winStart, count: 1 });
    return { ok: true, remaining: max - 1, reset: winStart + windowMs, limit: max };
  }
  if (entry.count >= max) {
    return { ok: false, remaining: 0, reset: winStart + windowMs, limit: max };
  }
  entry.count += 1;
  return { ok: true, remaining: max - entry.count, reset: winStart + windowMs, limit: max };
}

/**
 * Compose a key from available identity info.
 * Prefer user id if present; fall back to IP.
 */
export function keyFor({ route, method, userId, ip }) {
  const who = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  return `${who}:${method}:${route}`;
}
