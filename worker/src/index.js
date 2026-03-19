const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      env.ALLOWED_ORIGIN,
      'https://localhost',
      'capacitor://localhost',
      'http://localhost',
      'http://localhost:8080',
    ];
    const allowed = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
    }

    // GET routes → proxy to backend
    if (request.method === 'GET') {
      const path = url.pathname;
      // /users/{tg_id}/status, /chats/{tg_id}
      if (path.startsWith('/users/') || path.startsWith('/chats/')) {
        return proxyToBackend(env, request, path);
      }
      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders(allowed) });
      }
      return new Response('Not found', { status: 404 });
    }

    // DELETE routes → proxy to backend
    if (request.method === 'DELETE') {
      const path = url.pathname;
      if (path.startsWith('/chats/')) {
        return proxyToBackend(env, request, path);
      }
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { _userId, _isPro, _route, _plan, ...payload } = body;
    const userId = _userId || 'anon';

    // Backend routes: proxy POST to FastAPI
    if (['pdf', 'docx', 'users', 'chats', 'documents'].includes(_route)) {
      let path = `/${_route}`;
      if (_route === 'users') path = body._path || '/users/sync';
      if (_route === 'chats') path = body._path || '/chats/save';
      if (_route === 'documents') path = body._path || '/documents/send-pdf';

      const { _path, _route: _, _userId: __, _isPro: ___, ...cleanPayload } = body;
      const resp = await fetch(`${env.BACKEND_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_TOKEN
        },
        body: JSON.stringify({ ...cleanPayload, userId })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: corsHeaders(allowed)
      });
    }

    // Rate limiting (only for chat requests)
    const plan = _plan || 'free';
    const rlKey = `rl:${userId}`;
    const current = parseInt(await env.KV.get(rlKey) || '0');
    const limit = plan === 'business' ? 200 : plan === 'pro' ? 50 : 10;

    if (current >= limit) {
      return new Response(
        JSON.stringify({ error: 'rate_limit', limit, upgrade_url: env.UPGRADE_URL }),
        { status: 429, headers: corsHeaders(allowed) }
      );
    }

    await env.KV.put(rlKey, String(current + 1), { expirationTtl: 86400 });

    // Default: чат → Anthropic напрямую
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: corsHeaders(allowed)
    });
  }
};

async function proxyToBackend(env, request, path) {
  const resp = await fetch(`${env.BACKEND_URL}${path}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': env.INTERNAL_TOKEN
    }
  });
  const data = await resp.json();
  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: corsHeaders(env.ALLOWED_ORIGIN)
  });
}

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
});
