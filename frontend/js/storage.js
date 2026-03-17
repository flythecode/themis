/**
 * Themis Storage — абстракция хранения.
 * Phase 1: localStorage. Phase 2: заменить тела функций на API-вызовы.
 */
const PREFIX = 'th_';

const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(PREFIX + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {} },
  del: k => { try { localStorage.removeItem(PREFIX + k); } catch {} },
};

export const storage = {
  // Чаты
  getChats: () => ls.get('chats') || [],
  saveChat: chat => {
    const all = storage.getChats();
    const i = all.findIndex(c => c.id === chat.id);
    if (i >= 0) all[i] = chat; else all.unshift(chat);
    ls.set('chats', all.slice(0, 60));
  },
  deleteChat: id => ls.set('chats', storage.getChats().filter(c => c.id !== id)),

  // Настройки
  getLang: () => ls.get('lang') || 'ru',
  setLang: lang => ls.set('lang', lang),
  getCountry: () => ls.get('country') || 'Черногория',
  setCountry: c => ls.set('country', c),

  // Pro-статус (Phase 1: local, Phase 2: сервер)
  isPro: () => ls.get('pro') === true,
  setPro: val => ls.set('pro', val),

  // Счётчик запросов (Free план)
  getUsage: () => ls.get('usage') || { count: 0, resetAt: 0 },
  bumpUsage: () => {
    const u = storage.getUsage();
    const now = Date.now();
    if (now > u.resetAt) {
      ls.set('usage', { count: 1, resetAt: now + 3600000 });
      return { ok: true, remaining: 9 };
    }
    if (u.count >= 10) return { ok: false, remaining: 0 };
    ls.set('usage', { ...u, count: u.count + 1 });
    return { ok: true, remaining: 9 - u.count };
  },

  // Сохранённые сообщения
  getSaved: () => ls.get('saved') || [],
  addSaved: item => {
    const all = storage.getSaved();
    ls.set('saved', [item, ...all].slice(0, 200));
  },
  removeSaved: id => {
    ls.set('saved', storage.getSaved().filter(s => s.id !== id));
  },

  // State (docs count etc.)
  getState: () => ls.get('state') || {},
  setState: s => ls.set('state', s),
};
