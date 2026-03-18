/**
 * Themis Chat — логика чата, режимы, голосовой ввод
 */
import { TR } from './i18n.js';
import { storage } from './storage.js';
import { callClaude } from './api.js';
import { t, esc, fmt, timeStr, showToast, grow, setUILang } from './ui.js';

let lang = 'ru', country = 'Черногория', mode = 'analyze';
let conv = [], busy = false, pendingImg = null;
let recording = false, recognizer = null;
let activeChatId = null;

const newId = () => 'c_' + Date.now();

/* ── Getters for app.js ── */
export function getMode() { return mode; }
export function getLang() { return lang; }
export function getCountry() { return country; }
export function getActiveChatId() { return activeChatId; }

/* ── Setters ── */
export function setLangChat(l) {
  lang = l;
  setUILang(l);
  storage.setLang(l);
  document.querySelectorAll('.ob-lbtn').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
  document.querySelectorAll('.lopt').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
}

export function setCountryChat(c) {
  country = c;
  storage.setCountry(c);
  updateCountryUI();
}

export function updateCountryUI() {
  ['country-lbl', 'ch-ctag', 'p-crow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = country;
  });
  const cc = document.getElementById('p-cc');
  if (cc) cc.textContent = country.slice(0, 3).toUpperCase();
}

/* ── Chat init ── */
export function initChat(fresh) {
  if (fresh) { conv = []; activeChatId = newId(); pendingImg = null; }
  initChatUI();
  if (fresh) {
    document.getElementById('msgs').innerHTML = '';
    clearImgPrev();
    addBubble('b', t('welcome_' + mode));
  }
}

function initChatUI() {
  refreshBadge();
  document.getElementById('ch-ctag').textContent = country;
  document.getElementById('inp').placeholder = t('inpPh');
  document.getElementById('att-btn').style.display = mode === 'analyze' ? 'flex' : 'none';
  const el = document.getElementById('ch-chips');
  el.innerHTML = '';
  (TR[lang]['chips_' + mode] || []).forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'qchip' + (i === 0 && mode === 'analyze' ? ' scan' : '');
    d.textContent = c;
    d.onclick = () => {
      if (i === 0 && mode === 'analyze') triggerAtt();
      else { document.getElementById('inp').value = c; grow(document.getElementById('inp')); }
    };
    el.appendChild(d);
  });
}

function refreshBadge() {
  const b = document.getElementById('ch-badge');
  if (!b) return;
  b.innerHTML = t('badge_' + mode);
  b.className = 'cmpill ' + (mode === 'analyze' ? 'cm-a' : mode === 'generate' ? 'cm-g' : 'cm-s');
}

export function setMode(m) {
  mode = m;
}

export function quickChat(el) {
  document.querySelectorAll('.mrow').forEach(r => r.classList.remove('sel'));
  el.classList.add('sel');
  mode = el.dataset.mode;
  initChat(true);
}

export function loadHistChat(chat) {
  mode = chat.mode || 'analyze';
  conv = chat.conv || [];
  activeChatId = chat.id;
  pendingImg = null;
  initChatUI();
  const msgsEl = document.getElementById('msgs');
  msgsEl.innerHTML = '';
  clearImgPrev();
  conv.forEach(m => {
    if (m.role === 'user') {
      if (m._img) addImgBubble(m._img);
      else addBubble('u', typeof m.content === 'string' ? m.content : (m.content?.find(x => x.type === 'text')?.text || ''), false, false);
    } else {
      addBubble('b', m.content || '', true, false);
    }
  });
}

/* ── Image ── */
export function triggerAtt() { document.getElementById('file-inp').click(); }

export function onFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = ev => {
    const dataUrl = ev.target.result;
    pendingImg = { base64: dataUrl.split(',')[1], dataUrl, type: f.type || 'image/jpeg' };
    showImgPrev(dataUrl);
  };
  r.readAsDataURL(f);
}

function showImgPrev(dataUrl) {
  document.getElementById('img-prev-area').innerHTML =
    `<div class="img-prev-wrap"><div class="img-prev"><img src="${dataUrl}"><div class="img-prev-rm" onclick="window.themis.clearImgPrev()">✕</div></div></div>`;
}

export function clearImgPrev() {
  document.getElementById('img-prev-area').innerHTML = '';
  pendingImg = null;
}

function addImgBubble(dataUrl) {
  const wrap = document.createElement('div');
  wrap.className = 'msg u';
  const img = document.createElement('img');
  img.className = 'msg-img';
  img.src = dataUrl;
  const tm = document.createElement('div');
  tm.className = 'mtime';
  tm.textContent = timeStr();
  wrap.appendChild(img);
  wrap.appendChild(tm);
  const m = document.getElementById('msgs');
  m.appendChild(wrap);
  m.scrollTop = m.scrollHeight;
}

/* ── Voice ── */
export function toggleMic() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast(t('micErr'));
    return;
  }
  recording ? stopMic() : startMic();
}

function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognizer = new SR();
  recognizer.lang = lang === 'ru' ? 'ru-RU' : 'en-US';
  recognizer.interimResults = false;
  recognizer.onresult = e => {
    const tx = e.results[0][0].transcript;
    const i = document.getElementById('inp');
    i.value = (i.value + ' ' + tx).trim();
    grow(i);
  };
  recognizer.onend = () => stopMic();
  recognizer.onerror = () => { stopMic(); showToast(t('micErr')); };
  recognizer.start();
  recording = true;
  document.getElementById('mic-btn').classList.add('rec');
  showToast(t('micStart'));
}

function stopMic() {
  try { recognizer?.stop(); } catch {}
  recording = false;
  document.getElementById('mic-btn').classList.remove('rec');
}

/* ── Bubbles ── */
export function addBubble(role, text, fmtFlag, save = true) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  const bub = document.createElement('div');
  bub.className = 'mbub';
  bub.innerHTML = fmtFlag ? fmt(text) : esc(text);
  const tm = document.createElement('div');
  tm.className = 'mtime';
  tm.textContent = timeStr();
  wrap.appendChild(bub);
  wrap.appendChild(tm);

  if (role === 'b') {
    const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[.*?\]/g, '').replace(/<[^>]+>/g, '');
    const acts = document.createElement('div');
    acts.className = 'msg-act-row';
    const showLawyer = mode === 'advise' || mode === 'analyze';
    const showDownload = mode === 'generate';
    acts.innerHTML =
      `<div class="mact" onclick="window.themis.doCopy(this,'${encodeURIComponent(plain)}')">${t('copyTxt')}</div>` +
      `<div class="mact" onclick="window.themis.doStar(this,'${encodeURIComponent(text)}')">${t('starTxt')}</div>` +
      (showDownload ? `<div class="mact" onclick="window.themis.downloadDoc('${encodeURIComponent(plain)}')">${t('downloadTxt')}</div>` : '') +
      (showLawyer ? `<div class="mact" onclick="window.themis.openEsc()">${t('lawyerTxt')}</div>` : '');
    wrap.appendChild(acts);
    let pressTimer;
    bub.addEventListener('touchstart', () => { pressTimer = setTimeout(() => { wrap.classList.add('show-acts'); }, 500); });
    bub.addEventListener('touchend', () => clearTimeout(pressTimer));
  }

  const msgsEl = document.getElementById('msgs');
  msgsEl.appendChild(wrap);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function showTyping() {
  const d = document.createElement('div');
  d.className = 'msg b typing-row';
  d.id = 'typ';
  d.innerHTML = '<div class="typing-bub"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>';
  const m = document.getElementById('msgs');
  m.appendChild(d);
  m.scrollTop = m.scrollHeight;
}

function hideTyping() { document.getElementById('typ')?.remove(); }

/* ── Send message ── */
export async function sendMsg() {
  if (busy) return;
  const inp = document.getElementById('inp');
  const txt = inp.value.trim();
  const hasImg = !!pendingImg;
  if (!txt && !hasImg) return;

  if (hasImg) {
    addImgBubble(pendingImg.dataUrl);
    if (txt) addBubble('u', txt, false, false);
  } else {
    addBubble('u', txt, false, false);
  }

  const userEntry = hasImg
    ? {
        role: 'user', _img: pendingImg.dataUrl,
        content: [
          { type: 'image', source: { type: 'base64', media_type: pendingImg.type, data: pendingImg.base64 } },
          { type: 'text', text: txt || (lang === 'ru' ? 'Проанализируй документ.' : 'Analyse this document.') }
        ]
      }
    : { role: 'user', content: txt };
  conv.push(userEntry);

  inp.value = '';
  grow(inp);
  clearImgPrev();
  busy = true;
  document.getElementById('sbtn').disabled = true;
  if (hasImg) showToast(t('imgSent'));
  showTyping();

  // Check rate limit (Phase 1: local)
  if (!storage.isPro()) {
    const usage = storage.bumpUsage();
    if (!usage.ok) {
      hideTyping();
      addBubble('b', lang === 'ru' ? 'Лимит исчерпан. Подождите час или перейдите на Pro.' : 'Rate limit reached. Wait an hour or upgrade to Pro.');
      busy = false;
      document.getElementById('sbtn').disabled = false;
      return;
    }
  }

  try {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'anon';
    const msgs = conv.map(m => {
      if (m._img) { const { _img, ...r } = m; return r; }
      return m;
    });

    const reply = await callClaude({
      system: TR[lang]['sys_' + mode](country),
      messages: msgs,
      userId,
      isPro: storage.isPro()
    });

    hideTyping();
    conv.push({ role: 'assistant', content: reply });
    addBubble('b', reply, true);

    if (mode === 'generate') {
      const st = storage.getState();
      st.docs = (st.docs || 0) + 1;
      storage.setState(st);
    }
    persistChat();
  } catch (err) {
    hideTyping();
    if (err.message === 'rate_limit') {
      addBubble('b', lang === 'ru' ? 'Слишком много запросов. Подождите или перейдите на Pro.' : 'Too many requests. Please wait or upgrade to Pro.');
    } else {
      addBubble('b', lang === 'ru' ? 'Ошибка соединения.' : 'Connection error.');
    }
  }
  busy = false;
  document.getElementById('sbtn').disabled = false;
  document.getElementById('msgs').scrollTop = 9999;
}

function persistChat() {
  if (!activeChatId) return;
  const userMsgs = conv.filter(m => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1];
  const lastTxt = typeof last?.content === 'string' ? last.content :
    (Array.isArray(last?.content) ? last.content.find(c => c.type === 'text')?.text || '📎' : '');
  const botLast = conv.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
  storage.saveChat({
    id: activeChatId, mode, country, lang, date: Date.now(), starred: false,
    title: lastTxt.slice(0, 60) || 'Чат',
    preview: botLast.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[.*?\]/g, '').slice(0, 120),
    msgCount: conv.length,
    conv: conv.map(m => { if (m._img) { const { _img, ...r } = m; return { ...r, _img }; } return m; })
  });
}

/* ── Actions on messages ── */
export function doCopy(btn, enc) {
  navigator.clipboard?.writeText(decodeURIComponent(enc)).then(() => showToast(t('copiedTxt'))).catch(() => {});
}

export function doStar(btn, enc) {
  const txt = decodeURIComponent(enc);
  const saved = storage.getSaved();
  const idx = saved.findIndex(s => s.text === txt);
  if (idx >= 0) {
    storage.removeSaved(saved[idx].id);
    btn.classList.remove('on');
    showToast(t('unstarTxt'));
  } else {
    storage.addSaved({ text: txt, mode, country, date: Date.now(), id: 's_' + Date.now() });
    btn.classList.add('on');
    showToast(t('starTxt'));
  }
}

/* ── Download document ── */
export function downloadDoc(enc) {
  const text = decodeURIComponent(enc);
  const filename = `themis_${lang === 'ru' ? 'документ' : 'document'}_${new Date().toISOString().slice(0, 10)}.txt`;

  // В Telegram WebView blob скачивание не работает — используем data URI
  const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Fallback: если скачивание не сработало (Telegram Mini App), копируем в буфер
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);

  // Всегда копируем текст в буфер как запасной вариант
  navigator.clipboard?.writeText(text).then(() => {
    showToast(lang === 'ru' ? 'Документ скопирован в буфер' : 'Document copied to clipboard');
  }).catch(() => {
    showToast(lang === 'ru' ? 'Документ скачан' : 'Document downloaded');
  });
}

/* ── Keyboard ── */
export function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

/* ── Restore state ── */
export function restoreState() {
  const sl = storage.getLang();
  if (sl) lang = sl;
  const sc = storage.getCountry();
  if (sc) country = sc;
  setUILang(lang);
  return { lang, country };
}
