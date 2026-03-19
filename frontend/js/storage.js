/**
 * Themis Storage — гибридное хранение.
 * Читает/пишет в localStorage мгновенно, синхронизирует с сервером в фоне.
 */
import { syncUser, getProStatus, getServerChats, saveServerChat, deleteServerChat } from './api.js';

const PREFIX = 'th_';

const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(PREFIX + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {} },
  del: k => { try { localStorage.removeItem(PREFIX + k); } catch {} },
};

// Telegram user ID — устанавливается из app.js
let _tgId = null;
export function setTgId(id) { _tgId = id; }
export function getTgId() { return _tgId; }

export const storage = {
  // ── Чаты ──
  getChats: () => ls.get('chats') || [],

  saveChat: (chat) => {
    const all = storage.getChats();
    const i = all.findIndex(c => c.id === chat.id);
    if (i >= 0) all[i] = chat; else all.unshift(chat);
    ls.set('chats', all.slice(0, 60));
    // Sync to server in background
    if (_tgId) {
      saveServerChat({
        id: chat.id, user_tg_id: _tgId, mode: chat.mode,
        country: chat.country || '', lang: chat.lang || 'ru',
        title: chat.title || '', preview: chat.preview || '',
        msg_count: chat.msgCount || 0, starred: chat.starred || false,
        conv: chat.conv || []
      }).catch(() => {});
    }
  },

  deleteChat: (id) => {
    ls.set('chats', storage.getChats().filter(c => c.id !== id));
    if (_tgId) deleteServerChat(_tgId, id).catch(() => {});
  },

  // ── Синхронизация с сервером ──
  syncFromServer: async () => {
    if (!_tgId) return;
    try {
      const serverChats = await getServerChats(_tgId);
      if (serverChats && Array.isArray(serverChats) && serverChats.length > 0) {
        // Мержим: серверные чаты имеют приоритет
        const localChats = storage.getChats();
        const merged = [...serverChats];
        // Добавляем локальные чаты которых нет на сервере
        localChats.forEach(lc => {
          if (!merged.find(sc => sc.id === lc.id)) {
            merged.push(lc);
            // Синхронизируем на сервер
            saveServerChat({
              id: lc.id, user_tg_id: _tgId, mode: lc.mode,
              country: lc.country || '', lang: lc.lang || 'ru',
              title: lc.title || '', preview: lc.preview || '',
              msg_count: lc.msgCount || 0, starred: lc.starred || false,
              conv: lc.conv || []
            }).catch(() => {});
          }
        });
        ls.set('chats', merged.slice(0, 60));
      }
    } catch {}
  },

  // ── Настройки ──
  getLang: () => ls.get('lang') || 'ru',
  setLang: lang => ls.set('lang', lang),
  getCountry: () => ls.get('country') || 'Черногория',
  setCountry: c => ls.set('country', c),

  // ── План и Pro-статус ──
  getPlan: () => ls.get('plan') || 'free', // free | pro | business
  setPlan: p => ls.set('plan', p),
  isPro: () => {
    const p = ls.get('plan') || 'free';
    return p === 'pro' || p === 'business';
  },
  setPro: val => ls.set('pro', val),

  checkProFromServer: async () => {
    if (!_tgId) return;
    try {
      const status = await getProStatus(_tgId);
      if (status) {
        ls.set('pro', status.is_pro);
        if (status.plan) ls.set('plan', status.plan);
        return status;
      }
    } catch {}
    return null;
  },

  // ── Счётчик запросов по планам ──
  // Free: 10/день, Pro: 50/день, Business: 200/день
  getUsage: () => ls.get('usage') || { count: 0, resetAt: 0 },
  getDailyLimit: () => {
    const plan = storage.getPlan();
    if (plan === 'business') return 200;
    if (plan === 'pro') return 50;
    return 10;
  },
  bumpUsage: () => {
    const limit = storage.getDailyLimit();
    const u = storage.getUsage();
    const now = Date.now();
    // Сброс каждые 24 часа
    if (now > u.resetAt) {
      ls.set('usage', { count: 1, resetAt: now + 86400000 });
      return { ok: true, remaining: limit - 1 };
    }
    if (u.count >= limit) return { ok: false, remaining: 0 };
    ls.set('usage', { ...u, count: u.count + 1 });
    return { ok: true, remaining: limit - u.count - 1 };
  },

  // ── Сохранённые сообщения ──
  getSaved: () => ls.get('saved') || [],
  addSaved: item => {
    const all = storage.getSaved();
    ls.set('saved', [item, ...all].slice(0, 200));
  },
  removeSaved: id => {
    ls.set('saved', storage.getSaved().filter(s => s.id !== id));
  },

  // ── Onboarding ──
  isOnboarded: () => ls.get('onboarded') === true,
  setOnboarded: () => ls.set('onboarded', true),

  // ── State ──
  getState: () => ls.get('state') || {},
  setState: s => ls.set('state', s),

  // ── Sync user profile ──
  syncUser: async (userData) => {
    if (!_tgId) return;
    try {
      const result = await syncUser({
        tgId: _tgId,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        country: storage.getCountry(),
        lang: storage.getLang()
      });
      if (result?.is_pro !== undefined) {
        ls.set('pro', result.is_pro);
      }
      return result;
    } catch { return null; }
  },
};
