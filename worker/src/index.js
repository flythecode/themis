const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
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

    const { _userId, _isPro, _route, ...payload } = body;
    const userId = _userId || 'anon';

    // Rate limiting
    const rlKey = `rl:${userId}`;
    const current = parseInt(await env.KV.get(rlKey) || '0');
    const limit = _isPro ? 1000 : 10;

    if (current >= limit) {
      return new Response(
        JSON.stringify({ error: 'rate_limit', limit, upgrade_url: env.UPGRADE_URL }),
        { status: 429, headers: corsHeaders(allowed) }
      );
    }

    await env.KV.put(rlKey, String(current + 1), { expirationTtl: 3600 });

    // Route: PDF и тяжёлые задачи → FastAPI
    if (_route === 'pdf' || _route === 'docx') {
      const resp = await fetch(`${env.BACKEND_URL}/${_route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_TOKEN
        },
        body: JSON.stringify({ ...payload, userId })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: corsHeaders(allowed)
      });
    }

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

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
});
