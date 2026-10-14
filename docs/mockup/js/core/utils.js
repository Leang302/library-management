'use strict';
/* ===========================================================================
 * utils.js — framework-free helpers shared by every module.
 * Contains NO business rules (see services.js) and NO persistence (see store.js).
 * ======================================================================== */

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MIN_MS = 60000;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** HTML-escape any value before interpolating it into a template string. */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Cryptographically random, unambiguous token (used for opaque QR payloads). */
function randomToken(len = 16, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  const buf = new Uint32Array(len);
  window.crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${randomToken(5, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
}

/* ---------- dates (stored as ISO strings, computed as ms) ---------- */
const iso = (t = Date.now()) => new Date(t).toISOString();
const toMs = v => (v == null ? NaN : typeof v === 'number' ? v : new Date(v).getTime());
function startOfDay(t = Date.now()) { const d = new Date(toMs(t)); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfDay(t = Date.now()) { const d = new Date(toMs(t)); d.setHours(23, 59, 0, 0); return d.getTime(); }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS); }
function daysUntil(v) { return daysBetween(Date.now(), v); }
function isToday(v) { return !!v && startOfDay(v) === startOfDay(); }
function fmtDate(v, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!v) return '—';
  return new Date(toMs(v)).toLocaleDateString('en-US', opts);
}
const fmtShort = v => fmtDate(v, { month: 'short', day: 'numeric' });
const fmtTime = v => (v ? new Date(toMs(v)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');
const fmtDateTime = v => (v ? `${fmtDate(v)} · ${fmtTime(v)}` : '—');
function relTime(v) {
  const diff = Date.now() - toMs(v);
  const abs = Math.abs(diff), future = diff < 0;
  const s = Math.round(abs / 1000), m = Math.round(s / 60), h = Math.round(m / 60), d = Math.round(h / 24);
  let txt;
  if (s < 45) return future ? 'in a moment' : 'just now';
  if (m < 60) txt = `${m}m`; else if (h < 24) txt = `${h}h`; else if (d < 7) txt = `${d}d`; else return fmtDate(v);
  return future ? `in ${txt}` : `${txt} ago`;
}
function dueLabel(dueAt) {
  const d = daysUntil(dueAt);
  if (d < 0) return `${-d} ${-d === 1 ? 'day' : 'days'} overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `${d} days left`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* ---------- formatting ---------- */
function money(n) {
  const cur = (typeof Store !== 'undefined' && Store.settings().currency) || '$';
  return cur + (Number(n) || 0).toFixed(2);
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
}
function plural(n, word, many) { return `${n} ${n === 1 ? word : (many || word + 's')}`; }
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

const PALETTE = ['#65B874', '#5B8DEF', '#F4B860', '#EF6666', '#9B7BEA', '#3FB8AF', '#F08A5D', '#4A90A4', '#C77DBA', '#7A9E3F'];
function colorFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ---------- misc ---------- */
/** Vibrate where the browser supports it (Android Chrome). Silently no-ops elsewhere. */
function haptic(pattern = 12) {
  try {
    // Browsers only allow vibration after the user has interacted with the page.
    const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && active) navigator.vibrate(pattern);
  } catch (e) { /* unsupported */ }
}
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalizeStudentId(raw) { return String(raw || '').trim().toUpperCase().replace(/\s+/g, ''); }
function normalizeISBN(raw) { return String(raw || '').replace(/[-\s]/g, '').toUpperCase(); }
/** Validates ISBN-10 / ISBN-13 checksums. */
function isValidISBN(raw) {
  const s = normalizeISBN(raw);
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : +s[i]) * (10 - i);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += +s[i] * (i % 2 ? 3 : 1);
    return sum % 10 === 0;
  }
  return false;
}

/** Deterministic PRNG so seeded demo data looks the same on every reset. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function downloadFile(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function downloadDataURL(filename, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
function toCSV(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

/** Resize an uploaded image to keep localStorage small. Resolves to a JPEG data URL. */
function compressImage(file, maxW = 360, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('The file is not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
