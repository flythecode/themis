/**
 * Themis API — единая точка входа для всех запросов.
 * Все запросы идут через Cloudflare Worker proxy.
 */

const WORKER_URL = 'https://themis-proxy.flythecode.workers.dev'; // Заменить на реальный URL Worker при деплое

export async function callClaude({ system, messages, userId, isPro = false }) {
  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system,
      messages,
      _userId: userId,
      _isPro: isPro,
      _route: 'chat'
    })
  });

  if (resp.status === 429) {
    const data = await resp.json().catch(() => ({}));
    const err = new Error('rate_limit');
    err.data = data;
    throw err;
  }

  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

export async function analyzePDF({ pdfBase64, country, language, userId }) {
  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdf_base64: pdfBase64,
      country,
      language,
      userId,
      _route: 'pdf'
    })
  });

  if (!resp.ok) {
    throw new Error(`PDF analysis error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.analysis;
}

export async function checkProStatus(userId) {
  // Phase 1: localStorage
  return localStorage.getItem('th_pro') === 'true';
  // Phase 2: return (await fetch(`${WORKER_URL}/users/${userId}/status`)).json();
}
