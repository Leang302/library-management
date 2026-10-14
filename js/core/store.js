'use strict';
/* ===========================================================================
 * store.js — DATA ACCESS LAYER
 *
 * Every read/write of persistent data goes through `Store`. No UI module
 * touches localStorage directly.
 *
 * Migrating to a backend: re-implement the methods below (all / get / find /
 * filter / insert / update / remove / settings / saveSettings) with fetch()
 * calls against a REST API. They would become async, so callers in
 * services.js would `await` them — services.js is the only module that
 * mutates data, which keeps that migration contained.
 * ======================================================================== */

/**
 * Product feature switches (build-time, not admin settings).
 * fines: MVP ships without money. Overdue tracking, reminders and return
 * receipts still work; no fines, fees, payments or balances are created or shown.
 * Set to true to bring back late fines, damage fees, payments and payment receipts.
 */
const FEATURES = { fines: false };

const DEFAULT_SETTINGS = {
  libraryName: 'Greenleaf Library',
  campus: 'Central Campus',
  openingHours: 'Mon–Fri 8:00–22:00 · Sat–Sun 10:00–18:00',
  contactEmail: 'help@greenleaf.edu',
  currency: '$',
  // ---- borrowing policy (configurable by admin) ----
  maxBorrow: 3,             // max active borrowed books per student
  loanDays: 14,             // borrowing duration
  requestExpiryMin: 10,     // pending checkout QR validity
  blockOnOverdue: true,     // students with overdue books cannot borrow
  requireHandoverScan: true, // librarian must scan every book before approving a checkout
  maxUnpaidFines: 10,       // block borrowing above this unpaid amount
  reservationHoldDays: 3,   // how long a READY reservation is held
  dueSoonDays: 3,           // "due soon" reminder window
  // ---- fine policy ----
  finePerDay: 0.5,
  maxFinePerItem: 20,
  damagedFee: 5,
  lostFee: 25,
  // ---- app ----
  dueReminders: true,
  copySeq: 0,               // sequence for BOOKCOPY-###### identifiers
};

const COLLECTIONS = [
  'users', 'members', 'books', 'bookCopies', 'borrowRequests', 'borrowRequestItems',
  'borrowTransactions', 'reservations', 'fines', 'receipts', 'notifications', 'auditLogs',
];

const Store = (() => {
  const NS = 'lms.v1.';
  const ID_PREFIX = {
    users: 'usr', members: 'mem', books: 'bk', bookCopies: 'cpy', borrowRequests: 'req',
    borrowRequestItems: 'rqi', borrowTransactions: 'tx', reservations: 'rsv', fines: 'fin', receipts: 'rct',
    notifications: 'ntf', auditLogs: 'log',
  };
  let cache = {};
  let settingsCache = null;
  const memory = {}; // fallback when localStorage is unavailable (e.g. some private modes)

  const raw = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return memory[k] ?? null; } },
    set(k, v) {
      try { localStorage.setItem(k, v); }
      catch (e) { memory[k] = v; console.warn('[Store] localStorage write failed; keeping data in memory.', e.name); }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } delete memory[k]; },
  };

  function load(name) {
    if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection "${name}"`);
    if (!cache[name]) {
      try { cache[name] = JSON.parse(raw.get(NS + name)) || []; } catch (e) { cache[name] = []; }
    }
    return cache[name];
  }
  function persist(name) { raw.set(NS + name, JSON.stringify(cache[name])); }

  // Another tab changed data -> drop caches so this tab sees fresh state.
  window.addEventListener('storage', e => {
    if (e.key && e.key.startsWith(NS)) {
      cache = {}; settingsCache = null;
      if (typeof Store.onExternalChange === 'function') Store.onExternalChange(e.key);
    }
  });

  return {
    /** Returns a shallow copy of the collection. Treat records as read-only; use update(). */
    all(name) { return load(name).slice(); },
    get(name, id) { return load(name).find(r => r.id === id) || null; },
    find(name, pred) { return load(name).find(pred) || null; },
    filter(name, pred) { return load(name).filter(pred); },
    count(name, pred) { return pred ? load(name).filter(pred).length : load(name).length; },

    insert(name, record) {
      const t = iso();
      const rec = { id: uid(ID_PREFIX[name] || 'id'), createdAt: t, ...record };
      rec.updatedAt = rec.createdAt;
      load(name).push(rec);
      persist(name);
      return rec;
    },
    update(name, id, patch) {
      const list = load(name);
      const i = list.findIndex(r => r.id === id);
      if (i < 0) return null;
      list[i] = { ...list[i], ...patch, updatedAt: iso() };
      persist(name);
      return list[i];
    },
    remove(name, id) {
      const list = load(name);
      const i = list.findIndex(r => r.id === id);
      if (i < 0) return false;
      list.splice(i, 1);
      persist(name);
      return true;
    },
    replaceAll(name, list) { cache[name] = list; persist(name); },

    settings() {
      if (!settingsCache) {
        let s = {};
        try { s = JSON.parse(raw.get(NS + 'settings')) || {}; } catch (e) { s = {}; }
        settingsCache = { ...DEFAULT_SETTINGS, ...s };
      }
      return settingsCache;
    },
    saveSettings(patch) {
      settingsCache = { ...this.settings(), ...patch };
      raw.set(NS + 'settings', JSON.stringify(settingsCache));
      return settingsCache;
    },
    /** Allocates the next physical-copy identifier, e.g. BOOKCOPY-000053. */
    nextCopyId() {
      let n = (this.settings().copySeq || 0) + 1;
      while (this.get('bookCopies', copyIdFor(n))) n++;
      this.saveSettings({ copySeq: n });
      return copyIdFor(n);
    },

    /* ---- session (demo auth) ---- */
    getSession() {
      try { return JSON.parse(raw.get(NS + 'session') || sessionStorage.getItem(NS + 'session')); } catch (e) { return null; }
    },
    setSession(sess, remember) {
      const v = JSON.stringify(sess);
      this.clearSession();
      if (remember) raw.set(NS + 'session', v);
      else { try { sessionStorage.setItem(NS + 'session', v); } catch (e) { raw.set(NS + 'session', v); } }
    },
    clearSession() {
      raw.del(NS + 'session');
      try { sessionStorage.removeItem(NS + 'session'); } catch (e) { /* ignore */ }
    },

    isSeeded() { return raw.get(NS + 'seeded') === '1'; },
    markSeeded() { raw.set(NS + 'seeded', '1'); },
    /** Wipes every collection (keeps nothing) — used by "Reset demo data". */
    wipe() {
      COLLECTIONS.forEach(c => raw.del(NS + c));
      raw.del(NS + 'settings'); raw.del(NS + 'seeded');
      cache = {}; settingsCache = null;
    },
    usageBytes() {
      let n = 0;
      [...COLLECTIONS, 'settings'].forEach(c => { n += (raw.get(NS + c) || '').length * 2; });
      return n;
    },
    exportAll() {
      const out = { exportedAt: iso(), settings: this.settings() };
      COLLECTIONS.forEach(c => { out[c] = load(c); });
      return out;
    },
  };
})();

function copyIdFor(n) { return 'BOOKCOPY-' + String(n).padStart(6, '0'); }
