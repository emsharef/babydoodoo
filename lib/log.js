import { createHash, randomUUID } from 'node:crypto';
export function getIp(request) {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const xr = request.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return '0.0.0.0';
}
export function hashIp(ip) { try { return createHash('sha256').update(ip).digest('hex').slice(0,16); } catch { return 'na'; } }
export function newRequestId() { try { return randomUUID(); } catch { return Math.random().toString(36).slice(2); } }
export function logRequest({ id, route, method, status, ms, userId, ip }) {
  const ipHash = hashIp(ip || '');
  const line = { t: new Date().toISOString(), id, method, route, status, ms, userId: userId || null, ipHash };
  console.log('[api]', JSON.stringify(line));
}
