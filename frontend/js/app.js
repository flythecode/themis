/**
 * Themis — главный модуль, инициализация
 */
import { storage, setTgId } from './storage.js';
import { TR } from './i18n.js';
import { applyLang, t, esc, showToast, grow, setUILang } from './ui.js';
import {
  initChat, quickChat, loadHistChat, sendMsg, onKey, triggerAtt,
  onFile, clearImgPrev, toggleMic, doCopy, doStar, downloadDoc, downloadLastDoc,
  setLangChat, setCountryChat, updateCountryUI, restoreState, getMode, getLang, getCountry
} from './chat.js';

/* ── Telegram ── */
const tg = window.Telegram?.WebApp;
let tgUser = null;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#09090d');
  tg.setBackgroundColor('#09090d');
  tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    const name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    document.getElementById('p-name').textContent = name;
    const initials = (tgUser.first_name?.[0] || 'Θ').toUpperCase();
    document.getElementById('p-av').textContent = initials;
    // Set tgId for server sync
    setTgId(String(tgUser.id));
  }
}

/* ── State ── */
let histTab = 'all';
const { lang: initialLang, country: initialCountry } = restoreState();

/* ── Expose to HTML onclick handlers via window.themis ── */
window.themis = {
  clearImgPrev,
  doCopy,
  doStar,
  downloadDoc,
  downloadLastDoc,
  openEsc: () => document.getElementById('esc-modal').classList.add('on'),
};

/* ── Language ── */
function setLang(l, btn) {
  setLangChat(l);
  applyLang(l);
  refreshBadge();
  renderHistory();
  renderHomeRecent();
}
window.setLang = setLang;

function toggleLangP() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
}
window.toggleLangP = toggleLangP;

/* ── Country ── */
function askCountry() {
  const v = prompt(t('countryPrompt'), getCountry());
  if (v?.trim()) {
    setCountryChat(v.trim());
  }
}
window.askCountry = askCountry;

/* ── Onboarding ── */
function finishOb() {
  const c = document.getElementById('ob-country').value.trim() || 'Montenegro';
  setCountryChat(c);
  applyLang(getLang());
  storage.setOnboarded();
  document.getElementById('s-ob').classList.remove('on');
  document.getElementById('s-main').classList.add('on');
  renderHomeRecent();
  updateStats();
}
window.finishOb = finishOb;

/* ── Tabs ── */
function switchTab(name) {
  document.querySelectorAll('.tp').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ti').forEach(ti => ti.classList.remove('on'));
  document.getElementById('tp-' + name).classList.add('on');
  document.getElementById('ti-' + name).classList.add('on');
  if (name === 'history') renderHistory();
  if (name === 'home') renderHomeRecent();
}
window.switchTab = switchTab;
window.goHome = () => switchTab('home');

/* ── Quick Chat (mode rows) ── */
window.quickChat = function(el) {
  quickChat(el);
  switchTab('chat');
};

/* ── Chat actions ── */
window.sendMsg = sendMsg;
window.onKey = onKey;
window.triggerAtt = triggerAtt;
window.onFile = onFile;
window.toggleMic = toggleMic;
window.grow = grow;

/* ── Badge refresh ── */
function refreshBadge() {
  const b = document.getElementById('ch-badge');
  if (!b) return;
  const mode = getMode();
  b.innerHTML = t('badge_' + mode);
  b.className = 'cmpill ' + (mode === 'analyze' ? 'cm-a' : mode === 'generate' ? 'cm-g' : 'cm-s');
}

/* ── History ── */
function renderHistory() {
  const lang = getLang();
  const all = storage.getChats();
  let list = histTab === 'starred'
    ? storage.getSaved().map(s => ({
        id: s.id, mode: s.mode || 'advise',
        title: '⭐ ' + s.text.slice(0, 50),
        preview: s.text.slice(0, 120),
        msgCount: 1, date: s.date, starred: true, _saved: true
      }))
    : all;

  const q = (document.getElementById('hsearch-inp')?.value || '').toLowerCase();
  if (q) list = list.filter(c => (c.title + c.preview).toLowerCase().includes(q));

  const el = document.getElementById('hist-list');
  if (!list.length) {
    el.innerHTML = `<div class="hist-empty"><div class="hist-empty-ico">⚖️</div><div class="hist-empty-txt">${(histTab === 'starred' ? t('noSaved') : t('noHistory')).replace('\n', '<br>')}</div></div>`;
    return;
  }

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const groups = {};
  list.forEach(c => {
    const d = new Date(c.date);
    const lbl = d >= today ? (lang === 'ru' ? 'Сегодня' : 'Today')
      : d >= yest ? (lang === 'ru' ? 'Вчера' : 'Yesterday')
      : d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' });
    if (!groups[lbl]) groups[lbl] = [];
    groups[lbl].push(c);
  });

  el.innerHTML = '';
  Object.entries(groups).forEach(([day, chats]) => {
    const dl = document.createElement('div');
    dl.className = 'hdlabel';
    dl.textContent = day;
    el.appendChild(dl);
    chats.forEach(c => el.appendChild(buildHCard(c)));
  });
}

function buildHCard(c) {
  const lang = getLang();
  const d = document.createElement('div');
  const modeClass = c.mode === 'analyze' ? 'hc-a' : c.mode === 'generate' ? 'hc-g' : 'hc-s';
  const badgeClass = c.mode === 'analyze' ? 'hb-a' : c.mode === 'generate' ? 'hb-g' : 'hb-s';
  d.className = `hcard ${modeClass}`;
  if (!c._saved) d.onclick = () => { loadHistChat(c); switchTab('chat'); };
  const badge = t('badge_' + c.mode) || c.mode;
  const time = new Date(c.date).toLocaleTimeString(lang === 'ru' ? 'ru' : 'en', { hour: '2-digit', minute: '2-digit' });
  d.innerHTML = `
    <div class="hcard-top">
      <div class="hmbadge ${badgeClass}">${badge}</div>
      <div class="hcard-time">${time}</div>
      ${!c._saved ? `<div class="hcard-star ${c.starred ? 'on' : ''}" onclick="event.stopPropagation();window._toggleStar('${c.id}',this)">⭐</div>` : ''}
    </div>
    <div class="hcard-body">
      <div class="hcard-title">${esc(c.title || '')}</div>
      <div class="hcard-prev">${esc(c.preview || '')}</div>
      <div class="hcard-foot">
        <div class="hcard-cnt">${c.msgCount || 0} ${t('msgsTxt')}</div>
        ${!c._saved ? `<div class="hcard-del" onclick="event.stopPropagation();window._doDelChat('${c.id}')">${t('delTxt')}</div>` : ''}
        <div class="hcard-cont">${c._saved ? '' : t('contTxt')}</div>
      </div>
    </div>`;
  return d;
}

window._toggleStar = function(id, btn) {
  const all = storage.getChats();
  const c = all.find(x => x.id === id);
  if (!c) return;
  c.starred = !c.starred;
  btn.classList.toggle('on', c.starred);
  storage.saveChat(c);
};

window._doDelChat = function(id) {
  if (confirm(t('delConfirm'))) {
    storage.deleteChat(id);
    showToast(t('delDone'));
    renderHistory();
    updateStats();
    renderHomeRecent();
  }
};

window.showHTab = function(tab, btn) {
  histTab = tab;
  document.querySelectorAll('.htab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderHistory();
};

window.filterHist = function() { renderHistory(); };

/* ── Home recent ── */
function renderHomeRecent() {
  const lang = getLang();
  const el = document.getElementById('home-recent');
  if (!el) return;
  const chats = storage.getChats().slice(0, 3);
  if (!chats.length) {
    el.innerHTML = `<div class="r-empty">${t('noHistory').split('\n')[0]}</div>`;
    return;
  }
  el.innerHTML = '';
  const cols = { analyze: 'var(--gold)', generate: 'var(--teal)', advise: 'var(--amber)' };
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  chats.forEach(c => {
    const d = new Date(c.date);
    const lbl = d >= today ? (lang === 'ru' ? 'Сегодня' : 'Today')
      : d >= yest ? (lang === 'ru' ? 'Вчера' : 'Yesterday')
      : d.toLocaleDateString();
    const item = document.createElement('div');
    item.className = 'ritem';
    item.onclick = () => { if (c.conv) { loadHistChat(c); switchTab('chat'); } };
    item.innerHTML = `<div class="rdot" style="background:${cols[c.mode] || 'var(--gold)'}"></div><div class="rinfo"><div class="rtitle">${esc(c.title || '')}</div><div class="rsub">${c.msgCount} ${t('msgsTxt')}</div></div><div class="rtime">${lbl}</div>`;
    el.appendChild(item);
  });
}

/* ── Stats ── */
function updateStats() {
  const all = storage.getChats();
  document.getElementById('p-chats').textContent = all.length;
  document.getElementById('p-docs').textContent = all.filter(c => c.mode === 'generate').length;
}

/* ── Modal ── */
window.closeModal = function(e) {
  if (!e || e.target === document.getElementById('esc-modal') || e.currentTarget?.classList?.contains('modal-close')) {
    document.getElementById('esc-modal').classList.remove('on');
  }
};

/* ── Auth (non-Telegram) ── */
const isTelegram = !!tgUser;

function authLogin() {
  const name = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  if (!name) { document.getElementById('auth-name').focus(); return; }
  // Save user info locally
  const userId = 'web_' + Date.now();
  localStorage.setItem('th_web_user', JSON.stringify({ id: userId, name, email }));
  setTgId(userId);
  document.getElementById('p-name').textContent = name;
  document.getElementById('p-av').textContent = name[0].toUpperCase();
  finishAuth();
}
window.authLogin = authLogin;

function authSkip() {
  const userId = 'anon_' + Date.now();
  localStorage.setItem('th_web_user', JSON.stringify({ id: userId, name: 'Guest', email: '' }));
  setTgId(userId);
  document.getElementById('p-name').textContent = 'Guest';
  finishAuth();
}
window.authSkip = authSkip;

function finishAuth() {
  document.getElementById('s-auth').classList.remove('on');
  if (storage.isOnboarded()) {
    document.getElementById('s-main').classList.add('on');
  } else {
    document.getElementById('s-ob').classList.add('on');
  }
}

/* ── PWA Install ── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwa-install')?.classList.add('on');
});
window.pwaInstall = async function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('pwa-install')?.classList.remove('on');
};

/* ── Boot ── */
applyLang(initialLang);
updateCountryUI();
renderHomeRecent();
updateStats();
document.querySelectorAll('.ob-lbtn').forEach(b => b.classList.toggle('on', b.dataset.lang === initialLang));
document.querySelectorAll('.lopt').forEach(b => b.classList.toggle('on', b.dataset.lang === initialLang));

if (isTelegram) {
  // Telegram Mini App — пропускаем auth
  if (storage.isOnboarded()) {
    document.getElementById('s-ob').classList.remove('on');
    document.getElementById('s-main').classList.add('on');
  }
  // Серверная синхронизация
  storage.syncUser({
    firstName: tgUser.first_name || '',
    lastName: tgUser.last_name || '',
  }).then(() => {
    storage.checkProFromServer().then(status => {
      if (status?.is_pro) {
        document.querySelector('.pplan span').textContent = 'Pro';
      }
    });
    storage.syncFromServer().then(() => {
      renderHomeRecent();
      renderHistory();
      updateStats();
    });
  });
} else {
  // Не в Telegram — проверяем есть ли сохранённый пользователь
  const webUser = JSON.parse(localStorage.getItem('th_web_user') || 'null');
  if (webUser) {
    setTgId(webUser.id);
    document.getElementById('p-name').textContent = webUser.name;
    document.getElementById('p-av').textContent = (webUser.name?.[0] || 'G').toUpperCase();
    if (storage.isOnboarded()) {
      document.getElementById('s-ob').classList.remove('on');
      document.getElementById('s-main').classList.add('on');
    }
  } else {
    // Показываем auth экран
    document.getElementById('s-ob').classList.remove('on');
    document.getElementById('s-auth').classList.add('on');
  }
}
