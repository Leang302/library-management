'use strict';
/* ===========================================================================
 * components.js — reusable, stateless render helpers + overlay services
 * (toasts, bottom sheets, charts, QR rendering). Render helpers return HTML
 * strings; all dynamic values are escaped with esc().
 * ======================================================================== */

/* ---------- icons (Lucide) ---------- */
const icon = (name, cls = '') => `<i data-lucide="${name}" class="ic ${cls}" aria-hidden="true"></i>`;
function refreshIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons({ attrs: { 'stroke-width': 2 } }); } catch (e) { /* icon set unavailable */ }
  }
}

/* ---------- status vocabulary (consistent colors everywhere) ---------- */
const STATUS_META = {
  AVAILABLE: ['Available', 'green'], BORROWED: ['Borrowed', 'blue'], RESERVED: ['Reserved', 'amber'], MAINTENANCE: ['Maintenance', 'amber'], LOST: ['Lost', 'red'],
  PENDING_APPROVAL: ['Pending', 'amber'], APPROVED: ['Approved', 'green'], REJECTED: ['Rejected', 'red'], EXPIRED: ['Expired', 'gray'], CANCELLED: ['Cancelled', 'gray'],
  ACTIVE: ['Active', 'green'], RETURNED: ['Returned', 'gray'], OVERDUE: ['Overdue', 'red'],
  WAITING: ['In queue', 'blue'], READY: ['Ready for pickup', 'green'], FULFILLED: ['Fulfilled', 'gray'],
  UNPAID: ['Unpaid', 'red'], PAID: ['Paid', 'green'], WAIVED: ['Waived', 'gray'],
  SUSPENDED: ['Suspended', 'red'], UNAVAILABLE: ['Unavailable', 'red'],
  ADMIN: ['Admin', 'purple'], LIBRARIAN: ['Librarian', 'blue'], STUDENT: ['Student', 'green'],
  GOOD: ['Good', 'green'], DAMAGED: ['Damaged', 'red'],
};
function badge(status, label) {
  const [txt, tone] = STATUS_META[status] || [status, 'gray'];
  return `<span class="badge ${tone}">${esc(label || txt)}</span>`;
}

const CATEGORY_ICONS = {
  'Fiction': 'feather', 'Science Fiction': 'rocket', 'Fantasy': 'sparkles', 'Technology': 'cpu', 'Science': 'atom',
  'Business': 'briefcase', 'Self-Help': 'target', 'Psychology': 'brain', 'History': 'landmark', 'Biography': 'user-round',
};

/* ---------- book cover: real cover image over a generated placeholder ---------- */
function cover(book, cls = '') {
  if (!book) return `<div class="cover ${cls}"></div>`;
  const c = colorFor(book.title);
  const img = book.coverData
    ? `<img src="${book.coverData}" alt="" loading="lazy">`
    // Open Library answers unknown ISBNs with a 1×1 pixel image (not a 404), so the
    // generated placeholder underneath stays visible and no console error is logged.
    : book.isbn ? `<img src="https://covers.openlibrary.org/b/isbn/${esc(book.isbn)}-M.jpg" alt="" loading="lazy" onload="if(this.naturalWidth<20)this.remove()" onerror="this.remove()">` : '';
  return `<div class="cover ${cls}" style="--c:${c}" aria-label="Cover of ${esc(book.title)}" role="img">
    <div class="cover-ph"><span class="cover-ph-title">${esc(truncate(book.title, 42))}</span><span class="cover-ph-author">${esc(book.author.split(/[,&]/)[0])}</span></div>
    ${img}</div>`;
}

function avatar(user, size = 40) {
  if (!user) return `<span class="avatar" style="width:${size}px;height:${size}px"></span>`;
  const inner = user.photo ? `<img src="${user.photo}" alt="">` : esc(initials(user.name));
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;--c:${colorFor(user.name)}">${inner}</span>`;
}

/* ---------- layout pieces ---------- */
function Header({ title, subtitle = '', back = false, actions = [], large = false, cls = '' }) {
  return `<header class="app-header ${large ? 'large' : ''} ${cls}">
    ${back ? `<button class="icon-btn" data-action="back" aria-label="Go back">${icon('chevron-left')}</button>` : ''}
    <div class="hdr-titles"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
    <div class="hdr-actions">${actions.map(a => `<button class="icon-btn" data-action="${a.action}" ${a.attrs || ''} aria-label="${esc(a.label)}">${icon(a.icon)}${a.badge ? `<span class="dot-badge">${a.badge > 9 ? '9+' : a.badge}</span>` : ''}</button>`).join('')}</div>
  </header>`;
}
function bellAction() {
  const u = Auth.current();
  return { icon: 'bell', action: 'go', attrs: 'data-to="notifications"', label: 'Notifications', badge: u ? Services.unreadCount(u.id) : 0 };
}
function sectionTitle(title, link = null) {
  return `<div class="section-title"><h2>${esc(title)}</h2>${link ? `<button class="link" data-action="${link.action || 'go'}" ${link.attrs || ''}>${esc(link.label || 'See all')}</button>` : ''}</div>`;
}
function emptyState({ icon: ic = 'inbox', title, text = '', action = '' }) {
  return `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}
/**
 * One cell of a metrics grid (wrap cells in <div class="metrics c2|c3">).
 * `warn` colours the value red when it is non-zero — e.g. overdue counts, unpaid fees.
 */
function statCard({ label, value, warn = false, sub = '', delta = null, action = '', attrs = '' }) {
  const nonZero = !/^\D*0(\.0+)?$/.test(String(value));
  const d = delta == null ? '' : `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)}%</span> vs prev.`;
  const meta = [d, esc(sub)].filter(Boolean).join(' · ');
  const tag = action ? 'button' : 'div';
  return `<${tag} class="metric" ${action ? `data-action="${action}" ${attrs}` : ''}>
    <span class="metric-label">${esc(label)}</span>
    <span class="metric-value ${warn && nonZero ? 'warn' : ''}">${esc(value)}</span>
    ${meta ? `<span class="metric-sub">${meta}</span>` : ''}
  </${tag}>`;
}
function checkRow(c) {
  // 'waiting' = a step still in progress (not a failure), e.g. books not scanned yet
  const state = c.ok ? 'ok' : c.waiting ? 'wait' : 'bad';
  return `<li class="check-row ${state}"><span class="check-ic">${icon(c.ok ? 'check' : c.waiting ? 'more-horizontal' : 'x')}</span><div><b>${esc(c.label)}</b><small>${esc(c.detail || '')}</small></div></li>`;
}
function infoRow(label, value, ic) {
  return `<div class="info-row">${ic ? icon(ic) : ''}<span>${esc(label)}</span><b>${value}</b></div>`;
}
function skeletonList(n = 4) {
  return Array.from({ length: n }, () => `<div class="sk-row"><div class="sk sk-cover"></div><div class="sk-lines"><div class="sk sk-line w70"></div><div class="sk sk-line w40"></div><div class="sk sk-line w55"></div></div></div>`).join('');
}
function skeletonScreen(title) {
  return `${Header({ title })}<div class="scroll"><div class="pad">
    <div class="sk sk-block"></div>
    <div class="grid2"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div>
    ${skeletonList(4)}</div></div>`;
}
function bookRow(book, { right = '', sub = '', action = 'go', attrs = '' } = {}) {
  return `<button class="list-card" data-action="${action}" ${attrs}>
    ${cover(book, 'xs')}
    <div class="lc-body"><b class="clamp1">${esc(book?.title || 'Unknown book')}</b><small class="clamp1">${sub || esc(book?.author || '')}</small></div>
    ${right}</button>`;
}
function segmented(name, options, value, action) {
  return `<div class="segmented" role="tablist">${options.map(([v, l]) =>
    `<button role="tab" aria-selected="${v === value}" class="${v === value ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}">${l}</button>`).join('')}</div>`;
}
function chips(options, value, action, extra = '') {
  return `<div class="chips scroll-x">${options.map(([v, l]) =>
    `<button class="chip ${v === value ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}" ${extra}>${l}</button>`).join('')}</div>`;
}
function successMark(tone = 'green') {
  return `<div class="success-mark ${tone}"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>`;
}
function errorMark() {
  return `<div class="success-mark red"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M18 18l16 16M34 18L18 34"/></svg></div>`;
}

/* ---------- Toasts ---------- */
const Toast = {
  /** action: { label, onClick } adds a button (e.g. Undo) and keeps the toast up a little longer. */
  show(message, type = 'success', { title = '', duration = 2800, action = null } = {}) {
    const root = $('#toast-root');
    if (!root) return;
    const ic = { success: 'check-circle-2', error: 'alert-circle', warn: 'alert-triangle', info: 'info' }[type] || 'info';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(ic)}<div>${title ? `<b>${esc(title)}</b>` : ''}<span>${esc(message)}</span></div>${action ? `<button class="toast-action" type="button">${esc(action.label)}</button>` : ''}`;
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    refreshIcons();
    requestAnimationFrame(() => el.classList.add('in'));
    if (type === 'error') haptic([30, 40, 30]); else haptic(10);
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, action ? Math.max(duration, 4500) : duration);
    if (action) el.querySelector('.toast-action').addEventListener('click', e => { e.stopPropagation(); el.remove(); action.onClick(); });
    el.addEventListener('click', () => el.remove());
  },
};

/* ---------- Bottom sheets (replace desktop modals) ---------- */
const Sheet = {
  stack: [],
  open({ title = '', body = '', footer = '', onMount, onClose, size = '' }) {
    const layer = document.createElement('div');
    layer.className = 'sheet-layer';
    layer.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
      <div class="sheet ${size}" role="dialog" aria-modal="true" aria-label="${esc(title || 'Dialog')}">
        <div class="sheet-grabber" aria-hidden="true"></div>
        ${title ? `<div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn sm" data-sheet-close aria-label="Close">${icon('x')}</button></div>` : ''}
        <div class="sheet-body">${body}</div>
        ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
      </div>`;
    $('#overlay-root').appendChild(layer);
    const api = { el: layer, onClose, close: () => Sheet.close(api) };
    layer.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) api.close(); });
    this.attachSwipe(layer.querySelector('.sheet'), api);
    this.stack.push(api);
    refreshIcons();
    requestAnimationFrame(() => layer.classList.add('open'));
    if (onMount) onMount(layer, api);
    setTimeout(() => { const f = layer.querySelector('[autofocus], input, select, textarea'); if (f && !('ontouchstart' in window)) f.focus(); }, 280);
    return api;
  },
  close(api = this.stack[this.stack.length - 1]) {
    if (!api) return;
    const i = this.stack.indexOf(api);
    if (i < 0) return;
    this.stack.splice(i, 1);
    api.el.classList.remove('open');
    setTimeout(() => api.el.remove(), 280);
    if (api.onClose) api.onClose();
  },
  closeAll() { [...this.stack].forEach(s => this.close(s)); },
  /** Swipe the sheet down to dismiss. */
  attachSwipe(sheet, api) {
    let y0 = null, dy = 0;
    const start = e => {
      if (!e.target.closest('.sheet-grabber, .sheet-head')) return;
      y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none';
    };
    sheet.addEventListener('touchstart', start, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (y0 == null) return;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) api.close();
      y0 = null;
    });
  },
  /** Promise-based confirmation bottom sheet. */
  confirm({ title, message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, icon: ic = null }) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; resolve(v); };
      const s = this.open({
        body: `<div class="confirm">${ic ? `<div class="confirm-ic ${danger ? 'red' : 'green'}">${icon(ic)}</div>` : ''}<h3>${esc(title)}</h3>${message ? `<p>${message}</p>` : ''}</div>`,
        footer: `<button class="btn ghost" data-confirm="0">${esc(cancelText)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-confirm="1">${esc(confirmText)}</button>`,
        onClose: () => finish(false),
        onMount: el => el.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', () => { finish(b.dataset.confirm === '1'); s.close(); })),
      });
    });
  },
};

/* ---------- Charts ---------- */
// Restrained chart palette: brand green for the primary series, slate for comparison.
const CHART = {
  borrowed: '#3D8B4D', returned: '#A9B4BF', grid: '#EEF0EE',
  series: ['#3D8B4D', '#7DBF8A', '#B9DDC0', '#5B7896', '#9AABBC', '#C4A063', '#B86B63', '#8574A8', '#5F9A93', '#D3D9DE'],
};
const Charts = {
  list: [],
  ready: false,
  setup() {
    if (this.ready || typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#6B716D';
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1F2937';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.animation.duration = 600;
    this.ready = true;
  },
  make(canvas, config) {
    if (!canvas) return null;
    if (typeof Chart === 'undefined') {
      canvas.outerHTML = `<div class="chart-fallback">${icon('bar-chart-3')}<span>Charts need an internet connection (Chart.js CDN).</span></div>`;
      refreshIcons();
      return null;
    }
    this.setup();
    const c = new Chart(canvas, config);
    this.list.push(c);
    return c;
  },
  destroyAll() { this.list.forEach(c => { try { c.destroy(); } catch (e) { /* ignore */ } }); this.list = []; },
  gradient(ctx, color, h = 180) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
    return g;
  },
  axes(stacked = false) {
    return {
      x: { grid: { display: false }, border: { display: false }, stacked, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
      y: { grid: { color: CHART.grid }, border: { display: false }, beginAtZero: true, stacked, ticks: { precision: 0, maxTicksLimit: 5 } },
    };
  },
};

/* ---------- QR codes ---------- */
function renderQR(el, text, size = 200) {
  if (!el) return false;
  el.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    el.innerHTML = `<div class="qr-fallback">${icon('qr-code')}<code>${esc(text)}</code><small>QR library offline — use the code above.</small></div>`;
    refreshIcons();
    return false;
  }
  new QRCode(el, { text, width: size, height: size, colorDark: '#1F2937', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  el.setAttribute('title', '');
  return true;
}
function qrDataURL(el) {
  const c = el && el.querySelector('canvas');
  if (c) return c.toDataURL('image/png');
  const img = el && el.querySelector('img');
  return img ? img.src : null;
}
/** Builds a printable PNG label (QR + copy ID + title) for a physical copy. */
function labelPNG(copy, book) {
  const tmp = document.createElement('div');
  if (!renderQR(tmp, copy.id, 300)) return null;
  const qr = tmp.querySelector('canvas');
  const c = document.createElement('canvas');
  c.width = 360; c.height = 470;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#E7ECE9'; g.lineWidth = 4; g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.drawImage(qr, 30, 24, 300, 300);
  g.fillStyle = '#1F2937'; g.textAlign = 'center';
  g.font = 'bold 26px monospace'; g.fillText(copy.id, 180, 362);
  g.font = '600 18px Inter, sans-serif'; g.fillText(truncate(book.title, 30), 180, 396);
  g.fillStyle = '#8B929D'; g.font = '15px Inter, sans-serif';
  g.fillText(`${Store.settings().libraryName} · Shelf ${book.shelf || '—'}`, 180, 426);
  g.fillStyle = '#65B874'; g.fillRect(0, c.height - 14, c.width, 14);
  return c.toDataURL('image/png');
}
