'use strict';
/* ===========================================================================
 * router.js — in-memory navigation stack, role-based tab bars, screen
 * lifecycle, and global event delegation (data-action / data-submit / data-input).
 * ======================================================================== */

const Screens = {};   // name -> { roles?, tab?, skeleton?, render(params), mount?(params, root) }
const Actions = {};   // name -> (el, event) => void

/** Per-session UI state (filters, tabs, view modes). Not persisted. */
const UI = {
  explore: { q: '', scope: 'all', cat: 'All', avail: 'all', sort: 'popular', view: 'grid' },
  mybooks: 'borrowed',
  tx: { filter: 'all', q: '', limit: 40 },
  inventory: { q: '', filter: 'all' },
  users: { role: 'ALL', q: '' },
  members: { q: '' },
  fines: 'UNPAID',
  logs: { filter: 'ALL', limit: 60 },
  adminRange: '30d',
  reportRange: '6m',
  returnSession: [],
  visited: {},
};

const TABS = {
  STUDENT: [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'explore', icon: 'compass', label: 'Explore' },
    { id: 'scan', icon: 'scan-line', label: 'Scan', fab: true, action: 'studentScan' },
    { id: 'mybooks', icon: 'book-open', label: 'My Books' },
    { id: 'profile', icon: 'user', label: 'Profile' },
  ],
  LIBRARIAN: [
    { id: 'libDashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'transactions', icon: 'arrow-left-right', label: 'Transactions' },
    { id: 'scanHub', icon: 'scan-line', label: 'Scan', fab: true },
    { id: 'inventory', icon: 'library', label: 'Books' },
    { id: 'profile', icon: 'user', label: 'Profile' },
  ],
  ADMIN: [
    { id: 'adminDashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'inventory', icon: 'library', label: 'Inventory' },
    { id: 'scanHub', icon: 'scan-line', label: 'Scan', fab: true },
    { id: 'manage', icon: 'layout-grid', label: 'Manage' },
    { id: 'profile', icon: 'user', label: 'Profile' },
  ],
};
const HOME = { STUDENT: 'home', LIBRARIAN: 'libDashboard', ADMIN: 'adminDashboard' };

const Router = {
  stack: [],
  leaveHooks: [],
  current() { return this.stack[this.stack.length - 1]; },
  homeName() { return HOME[Auth.role()] || 'login'; },
  /** Register cleanup (timers, cameras) to run when the current screen is left. */
  onLeave(fn) { this.leaveHooks.push(fn); },

  reset(name = this.homeName(), params = {}) { UI.dirty = false; this.stack = [{ name, params }]; this.render('fade'); },
  go(name, params = {}) {
    this.rememberScroll();
    this.stack.push({ name, params });
    try { history.pushState({ depth: this.stack.length }, ''); } catch (e) { /* sandboxed */ }
    this.render('forward');
  },
  replace(name, params = {}) { this.stack[this.stack.length - 1] = { name, params }; this.render('forward'); },
  back() {
    if (Sheet.stack.length) { Sheet.close(); return; }
    this.guardLeave(() => {
      if (this.stack.length > 1) { this.stack.pop(); this.render('back'); }
      else if (this.current()?.name !== this.homeName()) this.reset();
    });
  },
  tab(name) { haptic(8); this.stack = [{ name, params: {} }]; this.render('fade'); },
  /** Save the list position so coming back lands where the user left off. */
  rememberScroll() { const cur = this.current(); const s = $('#view .scroll'); if (cur && s) cur.scroll = s.scrollTop; },
  /** Ask before discarding edits in a form marked data-guard. */
  guardLeave(proceed) {
    if (!UI.dirty) return proceed();
    Sheet.confirm({ title: 'Discard changes?', message: 'You have unsaved changes on this screen.', confirmText: 'Discard', cancelText: 'Keep editing', danger: true })
      .then(ok => { if (ok) { UI.dirty = false; proceed(); } });
  },
  /** Re-render the current screen in place (keeps scroll position). */
  refresh() { this.render('none'); },

  render(dir = 'fade') {
    this.leaveHooks.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    this.leaveHooks = [];
    Charts.destroyAll();
    Services.refreshStatuses();

    const entry = this.current();
    const view = $('#view');
    const user = Auth.current();
    const screen = Screens[entry.name];
    const params = entry.params || {};
    UI.dirty = false;
    const prevScroll = dir === 'none' ? ($('.scroll', view)?.scrollTop || 0) : dir === 'back' ? (entry.scroll || 0) : 0;

    // first visit of a data-heavy screen → brief skeleton for perceived performance
    if (screen && screen.skeleton && !UI.visited[entry.name] && dir !== 'none') {
      UI.visited[entry.name] = true;
      view.innerHTML = `<section class="screen anim-${dir}">${skeletonScreen(screen.skeleton)}</section>`;
      this.renderTabbar(screen, user);
      refreshIcons();
      setTimeout(() => { if (this.current() === entry) this.render('none'); }, 320);
      return;
    }

    let html;
    let ok = false;
    if (!screen) html = Screens.error.render({ code: 404 });
    else if (screen.roles && (!user || !screen.roles.includes(user.role))) html = Screens.error.render({ code: user ? 403 : 401 });
    else {
      try { html = screen.render(params); ok = true; }
      catch (err) { console.error(err); html = Screens.error.render({ code: 500, message: err.message }); }
    }
    view.innerHTML = `<section class="screen anim-${dir}" data-screen="${entry.name}">${html}</section>`;
    if (prevScroll) { const s = $('.scroll', view); if (s) s.scrollTop = prevScroll; }
    this.renderTabbar(ok ? screen : null, user);
    refreshIcons();
    if (ok && screen.mount) {
      try { screen.mount(params, view); refreshIcons(); } catch (err) { console.error(err); }
    }
    PullToRefresh.attach($('.scroll', view));
  },

  renderTabbar(screen, user) {
    const bar = $('#tabbar');
    const app = $('#app');
    const show = !!(screen && screen.tab && user && TABS[user.role]);
    bar.hidden = !show;
    app.classList.toggle('has-tabs', show);
    if (!show) return;
    const root = this.stack[0].name;
    bar.innerHTML = TABS[user.role].map(t => {
      const on = t.id === root;
      const act = t.action ? `data-action="${t.action}"` : `data-action="tab" data-to="${t.id}"`;
      if (t.fab) return `<button class="tab fab ${on ? 'on' : ''}" ${act} aria-label="${t.label}"><span class="fab-btn">${icon(t.icon)}</span><span class="tab-label">${t.label}</span></button>`;
      return `<button class="tab ${on ? 'on' : ''}" ${act} aria-label="${t.label}" ${on ? 'aria-current="page"' : ''}>${icon(t.icon)}<span class="tab-label">${t.label}</span></button>`;
    }).join('');
  },
};

window.addEventListener('popstate', () => {
  if (Scanner.isOpen()) { Scanner.close(); return; }
  if (Sheet.stack.length) { Sheet.close(); return; }
  if (Router.stack.length > 1) { Router.stack.pop(); Router.render('back'); }
});

/* ---------- pull-to-refresh on the main scroll container ---------- */
const PullToRefresh = {
  attach(scroller) {
    if (!scroller || scroller.dataset.ptr) return;
    scroller.dataset.ptr = '1';
    const ind = document.createElement('div');
    ind.className = 'ptr';
    ind.innerHTML = icon('refresh-cw');
    scroller.prepend(ind);
    refreshIcons();
    let y0 = null, dy = 0;
    scroller.addEventListener('touchstart', e => { if (scroller.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    scroller.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { ind.style.cssText = ''; return; }
      const d = Math.min(dy * 0.5, 70);
      ind.style.transform = `translate(-50%, ${d}px) rotate(${d * 4}deg)`;
      ind.style.opacity = Math.min(1, d / 50);
    }, { passive: true });
    scroller.addEventListener('touchend', () => {
      if (y0 == null) return;
      y0 = null;
      if (dy * 0.5 > 55) {
        ind.classList.add('spin');
        haptic(15);
        setTimeout(() => { Router.refresh(); Toast.show('Up to date', 'info', { duration: 1400 }); }, 650);
      } else ind.style.cssText = '';
    });
  },
};

/* ---------- global event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
  else console.warn('No action handler for', el.dataset.action);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (Scanner.isOpen()) Scanner.close();
    else if (Sheet.stack.length) Sheet.close();
    return;
  }
  // non-button elements with data-action behave like buttons for keyboard users
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action]:not(button):not(a):not(input):not(select)')) {
    e.preventDefault(); e.target.click();
  }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  UI.dirty = false; // submitting saves; showErrors() re-marks the form dirty if validation fails
  const fn = Actions[form.dataset.submit];
  if (fn) fn(form, e);
});
document.addEventListener('input', e => {
  if (e.target.closest('form[data-guard]')) UI.dirty = true;
  const el = e.target.closest('[data-input]');
  if (el && Actions[el.dataset.input]) Actions[el.dataset.input](el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && Actions[el.dataset.change]) Actions[el.dataset.change](el, e);
});

/* ---------- generic actions ---------- */
Object.assign(Actions, {
  back: () => Router.back(),
  // iOS convention: tapping the active tab pops to its root, or scrolls the root to the top.
  tab: el => {
    const to = el.dataset.to;
    Router.guardLeave(() => {
      if (Router.stack[0].name !== to) return Router.tab(to);
      if (Router.stack.length > 1) { Router.stack = [Router.stack[0]]; Router.render('back'); return; }
      $('#view .scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  },
  go: el => {
    const params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
    if (el.dataset.id) params.id = el.dataset.id;
    Sheet.closeAll();
    Router.go(el.dataset.to, params);
  },
  closeSheet: () => Sheet.close(),
  togglePassword: el => {
    const input = document.getElementById(el.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.innerHTML = icon(show ? 'eye-off' : 'eye');
    el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    refreshIcons();
  },
});

/* ---------- form helpers ---------- */
function formData(form) {
  const out = {};
  new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v : v; });
  form.querySelectorAll('input[type=checkbox][name]').forEach(cb => { out[cb.name] = cb.checked; });
  return out;
}
function showErrors(form, errors) {
  if (form.matches('[data-guard]') && Object.keys(errors || {}).length) UI.dirty = true;
  form.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
  form.querySelectorAll('[data-err]').forEach(e => { e.textContent = ''; });
  Object.entries(errors || {}).forEach(([k, msg]) => {
    const slot = form.querySelector(`[data-err="${k}"]`);
    if (slot) { slot.textContent = msg; slot.closest('.field')?.classList.add('invalid'); }
  });
  const first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea');
  if (first) { first.focus(); first.closest('.field').classList.add('shake'); setTimeout(() => first.closest('.field')?.classList.remove('shake'), 500); }
  if (Object.keys(errors || {}).length) haptic([30, 40, 30]);
}
async function withLoading(btn, fn, ms = 450) {
  if (!btn) return fn();
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('loading');
  btn.innerHTML = '<span class="spinner"></span>';
  await sleep(ms);
  try { return await fn(); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = html; refreshIcons(); } }
}
