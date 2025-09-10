export function json(data, init = {}) {
  const body = JSON.stringify(data);
  return new Response(body, {
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    status: init.status || 200,
  });
}

export function errorJson(message, status = 400) {
  return json({ error: message }, { status });
}
