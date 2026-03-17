/**
 * Themis UI — DOM helpers, рендер сообщений, toast
 */
import { TR } from './i18n.js';

let _lang = 'ru';
export function setUILang(l) { _lang = l; }
export const t = k => TR[_lang]?.[k] || TR.ru[k] || k;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmt(txt) {
  txt = esc(txt);
  const hr = _lang === 'ru' ? 'Высокий риск' : 'High risk';
  const mr = _lang === 'ru' ? 'Средний риск' : 'Medium risk';
  txt = txt.replace(/\[ВЫСОКИЙ\]|\[HIGH\]/g,   `<span class="rtag rth">▲ ${hr}</span>`);
  txt = txt.replace(/\[СРЕДНИЙ\]|\[MEDIUM\]/g,  `<span class="rtag rtm">◆ ${mr}</span>`);
  txt = txt.replace(/\[ОК\]|\[OK\]/g,           `<span class="rtag rtok">✓ OK</span>`);
  txt = txt.replace(/\*\*(.+?)\*\*/g,           '<strong>$1</strong>');
  txt = txt.replace(/\n/g,                      '<br>');
  return txt;
}

export function timeStr() {
  return new Date().toLocaleTimeString(_lang === 'ru' ? 'ru' : 'en', { hour: '2-digit', minute: '2-digit' });
}

export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

export function grow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

export function applyLang(lang) {
  _lang = lang;
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = TR[lang]?.[el.dataset.k];
    if (v !== undefined) el.textContent = v;
  });
  const oc = document.getElementById('ob-country');
  if (oc) oc.placeholder = lang === 'ru' ? 'Укажите страну...' : 'Enter your country...';
  const inp = document.getElementById('inp');
  if (inp) inp.placeholder = t('inpPh');
  const hs = document.getElementById('hsearch-inp');
  if (hs) hs.placeholder = t('searchPh');
  const langLbl = document.getElementById('p-lang-lbl');
  if (langLbl) langLbl.textContent = lang === 'ru' ? 'Русский' : 'English';
}
