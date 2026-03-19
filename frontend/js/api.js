/**
 * Themis API — единая точка входа для всех запросов.
 */

const WORKER_URL = 'https://themis-proxy.flythecode.workers.dev';

export async function callClaude({ system, messages, userId, isPro = false, plan = 'free', mode = 'analyze' }) {
  const useSearch = plan !== 'free' && (mode === 'analyze' || mode === 'advise');

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system,
    messages,
    _userId: userId,
    _isPro: isPro,
    _plan: plan,
    _route: 'chat'
  };

  if (useSearch) {
    body.tools = [{ type: 'web_search_20250305' }];
  }

  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (resp.status === 429) {
    const err = new Error('rate_limit');
    err.data = await resp.json().catch(() => ({}));
    throw err;
  }
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);

  const data = await resp.json();
  // Web search может вернуть несколько content блоков — собираем текст
  if (Array.isArray(data.content)) {
    return data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n') || '';
  }
  return data.content?.[0]?.text || '';
}

export async function analyzePDF({ pdfBase64, country, language, userId }) {
  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdf_base64: pdfBase64, country, language, userId,
      _route: 'pdf'
    })
  });
  if (!resp.ok) throw new Error(`PDF error: ${resp.status}`);
  const data = await resp.json();
  return data.analysis;
}

/* ── Phase 2: Server sync API ── */

export async function syncUser({ tgId, firstName, lastName, country, lang }) {
  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _route: 'users', _path: '/users/sync',
      tg_id: tgId, first_name: firstName, last_name: lastName,
      country, lang
    })
  });
  if (!resp.ok) return null;
  return resp.json();
}

export async function getProStatus(tgId) {
  try {
    const resp = await fetch(`${WORKER_URL}/users/${tgId}/status`);
    if (!resp.ok) return null;
    return resp.json();
  } catch { return null; }
}

export async function getServerChats(tgId) {
  try {
    const resp = await fetch(`${WORKER_URL}/chats/${tgId}`);
    if (!resp.ok) return null;
    return resp.json();
  } catch { return null; }
}

export async function saveServerChat(chat) {
  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _route: 'chats', _path: '/chats/save', ...chat })
    });
    return resp.ok;
  } catch { return false; }
}

export async function deleteServerChat(tgId, chatId) {
  try {
    const resp = await fetch(`${WORKER_URL}/chats/${tgId}/${chatId}`, { method: 'DELETE' });
    return resp.ok;
  } catch { return false; }
}

export async function sendDocumentPDF({ tgId, text, title, mode }) {
  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _route: 'documents',
        _path: '/documents/send-pdf',
        tg_id: tgId,
        text,
        title,
        mode
      })
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.status === 'ok';
  } catch { return false; }
}
