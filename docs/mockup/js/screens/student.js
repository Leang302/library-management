'use strict';
/* ===========================================================================
 * student.js — Student / Member app: home, explore, book details, scan,
 * borrow cart, checkout QR, my books, membership card, fines.
 * ======================================================================== */

const STUDENT = ['STUDENT'];

function cartButton(m) {
  const n = Services.cart(m.id).length;
  return { icon: 'shopping-bag', action: 'go', attrs: 'data-to="cart"', label: `Borrow cart (${n})`, badge: n };
}
function bookCard(b, mode = 'grid') {
  const a = Services.availability(b.id);
  const avail = a.isAvailable ? badge('AVAILABLE', `${a.available} available`) : badge('UNAVAILABLE');
  if (mode === 'list') {
    return `<button class="list-card book-li" data-action="go" data-to="bookDetail" data-id="${b.id}">
      ${cover(b, 'sm')}
      <div class="lc-body"><b class="clamp2">${esc(b.title)}</b><small class="clamp1">${esc(b.author)}</small>
      <div class="row gap6 wrap"><span class="tag">${icon(CATEGORY_ICONS[b.category] || 'tag')} ${esc(b.category)}</span>${avail}</div></div></button>`;
  }
  return `<button class="book-card" data-action="go" data-to="bookDetail" data-id="${b.id}">
    ${cover(b)}
    <div class="bc-body"><b class="clamp2">${esc(b.title)}</b><small class="clamp1">${esc(b.author)}</small>
    <div class="bc-meta"><span class="muted">${esc(b.category)}</span><span class="avail-dot ${a.isAvailable ? 'on' : ''}">${a.isAvailable ? `${a.available} of ${a.total} available` : 'All out'}</span></div></div></button>`;
}
function shelfRow(books) {
  return `<div class="shelf scroll-x">${books.map(b => `<button class="shelf-item" data-action="go" data-to="bookDetail" data-id="${b.id}">${cover(b)}<b class="clamp2">${esc(b.title)}</b><small class="clamp1">${esc(b.author)}</small></button>`).join('')}</div>`;
}

/* ---------------- Home ---------------- */
Screens.home = {
  roles: STUDENT, tab: true, skeleton: 'Home',
  render() {
    const u = Auth.current(), m = Auth.member(), p = Store.settings();
    const loans = Services.activeLoans(m.id).sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt));
    const dueSoon = loans.filter(t => daysUntil(t.dueAt) <= p.dueSoonDays);
    const owed = Services.outstanding(m.id);
    const pending = Services.pendingRequestOf(m.id);
    const ready = Store.filter('reservations', r => r.memberId === m.id && r.status === 'READY');
    const books = Services.catalog();
    const popular = books.slice().sort((a, b) => Services.popularity(b.id) - Services.popularity(a.id)).slice(0, 8);
    const recent = books.slice().sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 8);
    const featured = books.filter(b => b.featured);
    const unread = Services.unreadCount(u.id);
    const cartN = Services.cart(m.id).length;
    return `<header class="home-header">
        <button class="home-user" data-action="tab" data-to="profile">${avatar(u, 44)}<div><small>${greeting()},</small><b>${esc(u.name.split(' ')[0])}</b></div></button>
        <div class="hdr-actions">
          <button class="icon-btn" data-action="go" data-to="cart" aria-label="Borrow cart">${icon('shopping-bag')}${cartN ? `<span class="dot-badge">${cartN}</span>` : ''}</button>
          <button class="icon-btn" data-action="go" data-to="notifications" aria-label="Notifications">${icon('bell')}${unread ? `<span class="dot-badge">${unread}</span>` : ''}</button>
        </div>
      </header>
      <div class="scroll"><div class="pad">
        <form class="search-bar" data-submit="homeSearch" role="search">${icon('search')}<input name="q" placeholder="Search title, author or ISBN" aria-label="Search books" enterkeyhint="search"><button type="button" class="icon-btn sm" data-action="studentScan" aria-label="Scan a book">${icon('scan-line')}</button></form>

        <button class="member-card-mini" data-action="go" data-to="memberCard">
          <span class="mcm-qr">${icon('qr-code')}</span>
          <span class="mcm-body"><b>Library card</b><small>${esc(m.studentId)} · valid until ${fmtDate(m.expiresAt, { month: 'short', year: 'numeric' })}</small></span>
          <span class="mcm-status ${Services.isMembershipValid(m) ? '' : 'off'}">${Services.isMembershipValid(m) ? 'Active' : 'Inactive'}</span>
        </button>

        <div class="stat-strip">
          <button data-action="tab" data-to="mybooks"><b>${loans.length}<small> / ${p.maxBorrow}</small></b><span>Borrowed</span></button>
          <button data-action="tab" data-to="mybooks"><b class="${dueSoon.length ? 'text-amber' : ''}">${dueSoon.length}</b><span>Due soon</span></button>
          ${FEATURES.fines
            ? `<button data-action="go" data-to="fines"><b class="${owed.total ? 'text-red' : ''}">${money(owed.total)}</b><span>Fines</span></button>`
            : `<button data-action="profileMyBooks" data-value="reservations"><b>${Store.count('reservations', r => r.memberId === m.id && ['WAITING', 'READY'].includes(r.status))}</b><span>Holds</span></button>`}
        </div>

        ${pending ? `<button class="banner green" data-action="go" data-to="checkoutQR" data-id="${pending.id}">${icon('qr-code')}<div><b>Checkout QR ready</b><small>${plural(Services.requestItems(pending.id).length, 'book')} · show it at the counter</small></div>${icon('chevron-right')}</button>` : ''}
        ${ready.map(r => `<button class="banner amber" data-action="go" data-to="bookDetail" data-id="${r.bookId}">${icon('bookmark-check')}<div><b>Reservation ready!</b><small>“${esc(Services.book(r.bookId)?.title)}” held until ${fmtShort(r.holdUntil)}</small></div>${icon('chevron-right')}</button>`).join('')}

        ${loans.length ? `${sectionTitle('Currently borrowed', { label: 'My books', action: 'tab', attrs: 'data-to="mybooks"' })}
          <div class="loan-strip scroll-x">${loans.map(t => {
            const b = Services.book(t.bookId), d = daysUntil(t.dueAt);
            const pct = clamp(100 - (d / p.loanDays) * 100, 4, 100);
            const tone = d < 0 ? 'red' : d <= p.dueSoonDays ? 'amber' : 'green';
            return `<button class="loan-chip" data-action="loanDetail" data-id="${t.id}">${cover(b, 'xs')}<div class="grow"><b class="clamp1">${esc(b.title)}</b><small class="text-${tone}">${dueLabel(t.dueAt)}</small><div class="progress ${tone}"><span style="width:${pct}%"></span></div></div></button>`;
          }).join('')}</div>` : ''}

        ${sectionTitle('Browse by category')}
        <div class="chips scroll-x bleed">${CATEGORIES.map(c => `<button class="chip" data-action="exploreCategory" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>

        ${sectionTitle('Staff picks')}
        <div class="shelf lg scroll-x">${featured.map(b => {
          const a = Services.availability(b.id);
          return `<button class="shelf-item" data-action="go" data-to="bookDetail" data-id="${b.id}">${cover(b)}<b class="clamp2">${esc(b.title)}</b>
            <small class="${a.isAvailable ? '' : 'text-red'}">${a.isAvailable ? `${a.available} available` : 'All copies out'}</small></button>`;
        }).join('')}</div>

        ${sectionTitle('Popular this month', { label: 'See all', action: 'exploreSort', attrs: 'data-value="popular"' })}
        ${shelfRow(popular)}
        ${sectionTitle('Recently added', { label: 'See all', action: 'exploreSort', attrs: 'data-value="newest"' })}
        ${shelfRow(recent)}
      </div></div>`;
  },
};
Object.assign(Actions, {
  homeSearch: form => { UI.explore.q = form.q.value.trim(); Router.tab('explore'); },
  exploreCategory: el => { UI.explore.cat = el.dataset.value; UI.explore.q = ''; Router.tab('explore'); },
  exploreSort: el => { UI.explore.sort = el.dataset.value; UI.explore.cat = 'All'; Router.tab('explore'); },
});

/* ---------------- Explore ---------------- */
function exploreResults() {
  const f = UI.explore;
  const q = f.q.trim().toLowerCase();
  const qIsbn = normalizeISBN(q);
  let list = Services.catalog().filter(b => {
    if (f.cat !== 'All' && b.category !== f.cat) return false;
    if (q) {
      const hit = {
        all: [b.title, b.author, b.category, b.isbn].some(v => String(v).toLowerCase().includes(q)) || (qIsbn.length >= 3 && b.isbn.includes(qIsbn)),
        title: b.title.toLowerCase().includes(q),
        author: b.author.toLowerCase().includes(q),
        isbn: qIsbn.length > 0 && b.isbn.includes(qIsbn),
      }[f.scope];
      if (!hit) return false;
    }
    if (f.avail !== 'all') {
      const a = Services.availability(b.id).isAvailable;
      if ((f.avail === 'available') !== a) return false;
    }
    return true;
  });
  const sorters = {
    popular: (a, b) => Services.popularity(b.id) - Services.popularity(a.id),
    title: (a, b) => a.title.localeCompare(b.title),
    newest: (a, b) => toMs(b.createdAt) - toMs(a.createdAt),
  };
  return list.sort(sorters[f.sort]);
}
function renderExploreResults() {
  const list = exploreResults();
  const f = UI.explore;
  const html = list.length
    ? `<p class="result-count">${plural(list.length, 'book')}${f.q ? ` for “${esc(f.q)}”` : ''}</p><div class="${f.view === 'grid' ? 'book-grid' : 'book-list'}">${list.map(b => bookCard(b, f.view)).join('')}</div>`
    : emptyState({ icon: 'search-x', title: 'No books found', text: 'Try a different keyword, category or availability filter.', action: `<button class="btn ghost" data-action="exploreClear">Clear filters</button>` });
  return html;
}
Screens.explore = {
  roles: ['STUDENT', 'LIBRARIAN', 'ADMIN'], tab: true, skeleton: 'Explore',
  render() {
    const f = UI.explore;
    const isStudent = Auth.is('STUDENT');
    return `${Header({ title: 'Explore', large: true, back: !isStudent, actions: [{ icon: f.view === 'grid' ? 'list' : 'layout-grid', action: 'exploreView', label: 'Toggle grid or list view' }, ...(isStudent ? [cartButton(Auth.member())] : [])] })}
      <div class="sticky-tools">
        <div class="search-bar" role="search">${icon('search')}
          <input id="explore-q" value="${esc(f.q)}" placeholder="${{ all: 'Title, author, category or ISBN', title: 'Search by title', author: 'Search by author', isbn: 'Search by ISBN' }[f.scope]}" aria-label="Search the catalogue" data-input="exploreInput" autocomplete="off" enterkeyhint="search">
          ${f.q ? `<button class="icon-btn sm" data-action="exploreClearQ" aria-label="Clear search">${icon('x')}</button>` : ''}
          <div class="suggest" id="explore-suggest" hidden></div>
        </div>
        <div class="row gap8 tools-row">
          ${segmented('scope', [['all', 'All'], ['title', 'Title'], ['author', 'Author'], ['isbn', 'ISBN']], f.scope, 'exploreScope')}
          <button class="icon-btn outline" data-action="exploreFilters" aria-label="Sort and filter">${icon('sliders-horizontal')}${f.avail !== 'all' || f.sort !== 'popular' ? '<span class="dot-badge dot"></span>' : ''}</button>
        </div>
        ${chips([['All', 'All'], ...CATEGORIES.map(c => [c, c])], f.cat, 'exploreCat')}
      </div>
      <div class="scroll"><div class="pad" id="explore-results">${renderExploreResults()}</div></div>`;
  },
};
const updateExplore = debounce(() => {
  const box = $('#explore-results');
  if (box) { box.innerHTML = renderExploreResults(); refreshIcons(); }
}, 120);
Object.assign(Actions, {
  exploreInput: input => {
    UI.explore.q = input.value;
    updateExplore();
    // search suggestions (titles & authors)
    const q = input.value.trim().toLowerCase();
    const box = $('#explore-suggest');
    if (!box) return;
    if (q.length < 2) { box.hidden = true; return; }
    const seen = new Set();
    const sugg = [];
    Services.catalog().forEach(b => {
      if (b.title.toLowerCase().includes(q) && !seen.has(b.title)) { seen.add(b.title); sugg.push(['book', b.title, b.id]); }
      if (b.author.toLowerCase().includes(q) && !seen.has(b.author)) { seen.add(b.author); sugg.push(['user', b.author, null]); }
    });
    box.innerHTML = sugg.slice(0, 5).map(([ic, txt, id]) => `<button data-action="${id ? 'go' : 'exploreSuggest'}" ${id ? `data-to="bookDetail" data-id="${id}"` : ''} data-value="${esc(txt)}">${icon(ic)}<span>${esc(txt)}</span></button>`).join('');
    box.hidden = !sugg.length;
    refreshIcons();
  },
  exploreSuggest: el => { UI.explore.q = el.dataset.value; UI.explore.scope = 'author'; Router.refresh(); },
  exploreClearQ: () => { UI.explore.q = ''; Router.refresh(); },
  exploreClear: () => { Object.assign(UI.explore, { q: '', cat: 'All', avail: 'all', scope: 'all' }); Router.refresh(); },
  exploreScope: el => { UI.explore.scope = el.dataset.value; Router.refresh(); },
  exploreCat: el => { UI.explore.cat = el.dataset.value; Router.refresh(); },
  exploreView: () => { UI.explore.view = UI.explore.view === 'grid' ? 'list' : 'grid'; haptic(8); Router.refresh(); },
  exploreFilters: () => {
    const f = UI.explore;
    const radio = (name, val, label, cur) => `<label class="radio-row"><input type="radio" name="${name}" value="${val}" ${val === cur ? 'checked' : ''}><span>${label}</span><i class="radio-dot"></i></label>`;
    Sheet.open({
      title: 'Sort & filter',
      body: `<form id="filter-form" data-submit="applyFilters">
        <h4 class="group-label">Sort by</h4>
        ${radio('sort', 'popular', 'Most popular', f.sort)}${radio('sort', 'title', 'Title (A–Z)', f.sort)}${radio('sort', 'newest', 'Newest arrivals', f.sort)}
        <h4 class="group-label">Availability</h4>
        ${radio('avail', 'all', 'All books', f.avail)}${radio('avail', 'available', 'Available now', f.avail)}${radio('avail', 'unavailable', 'Currently unavailable', f.avail)}
      </form>`,
      footer: `<button class="btn ghost" data-action="resetFilters">Reset</button><button class="btn primary" type="submit" form="filter-form">Apply</button>`,
    });
  },
  applyFilters: form => { UI.explore.sort = form.sort.value; UI.explore.avail = form.avail.value; Sheet.close(); Router.refresh(); },
  resetFilters: () => { UI.explore.sort = 'popular'; UI.explore.avail = 'all'; Sheet.close(); Router.refresh(); },
});

/* ---------------- Book details ---------------- */
Screens.bookDetail = {
  roles: ['STUDENT', 'LIBRARIAN', 'ADMIN'],
  render({ id }) {
    const b = Services.book(id);
    if (!b) return Screens.error.render({ code: 404 });
    const a = Services.availability(b.id);
    const p = Store.settings();
    const isStudent = Auth.is('STUDENT');
    const m = isStudent ? Auth.member() : null;
    let footer = '';
    if (isStudent) {
      const cart = Services.cart(m.id);
      const inCart = cart.some(cid => Services.copy(cid)?.bookId === b.id);
      const loan = Services.activeLoans(m.id).find(t => t.bookId === b.id);
      const rsv = Store.find('reservations', r => r.memberId === m.id && r.bookId === b.id && ['WAITING', 'READY'].includes(r.status));
      if (b.archived) footer = `<button class="btn block lg" disabled>Not in circulation</button>`;
      else if (loan) footer = `<div class="foot-note">${icon('book-open')} You’re borrowing this · ${dueLabel(loan.dueAt)}</div>`;
      else if (inCart) footer = `<button class="btn ghost lg grow" data-action="go" data-to="cart">${icon('shopping-bag')} In your cart — view</button>`;
      else if (rsv && rsv.status === 'READY') footer = `<button class="btn primary block lg" data-action="addBookToCart" data-id="${b.id}">${icon('bookmark-check')} Reserved for you — add to cart</button>`;
      else if (rsv) footer = `<button class="btn ghost lg grow" data-action="cancelReservation" data-id="${rsv.id}">Leave queue</button><div class="foot-note small">#${Services.queuePosition(rsv)} in queue</div>`;
      else if (a.isAvailable) footer = `<button class="btn ghost lg icon-only" data-action="studentScan" aria-label="Scan the book's QR">${icon('scan-line')}</button><button class="btn primary lg grow" data-action="addBookToCart" data-id="${b.id}">${icon('plus')} Add to Borrow Cart</button>`;
      else footer = `<button class="btn amber block lg" data-action="reserveBook" data-id="${b.id}">${icon('bookmark-plus')} Reserve — ${Services.queueFor(b.id).length} waiting</button>`;
    } else {
      footer = `<button class="btn primary block lg" data-action="go" data-to="bookManage" data-id="${b.id}">${icon('settings-2')} Manage copies</button>`;
    }
    return `${Header({ title: '', back: true, cls: 'transparent', actions: [{ icon: 'share-2', action: 'shareBook', attrs: `data-id="${b.id}"`, label: 'Share' }] })}
      <div class="scroll has-footer">
        <div class="detail-hero" style="--c:${colorFor(b.title)}">
          ${cover(b, 'lg')}
        </div>
        <div class="pad detail-body">
          <div class="center">
            <span class="tag">${icon(CATEGORY_ICONS[b.category] || 'tag')} ${esc(b.category)}</span>
            <h1 class="detail-title">${esc(b.title)}</h1>
            <p class="muted">by ${esc(b.author)}</p>
            <div class="row-center gap8 mt8">${a.isAvailable ? '' : badge('UNAVAILABLE', 'All copies out')}${b.archived ? badge('EXPIRED', 'Archived') : ''}</div>
          </div>
          <div class="metric-row">
            <div><b>${a.total}</b><small>Total copies</small></div>
            <div><b class="text-green">${a.available}</b><small>Available</small></div>
            <div><b>${p.loanDays}d</b><small>Loan period</small></div>
            <div><b>${esc(b.shelf)}</b><small>Shelf</small></div>
          </div>
          <h3 class="h3">About this book</h3>
          <p class="desc">${esc(b.description || 'No description available.')}</p>
          <div class="card info-list">
            ${infoRow('ISBN', `<span class="mono">${esc(b.isbn)}</span>`, 'barcode')}
            ${infoRow('Publisher', esc(b.publisher || '—'), 'building-2')}
            ${infoRow('Published', esc(b.year || '—'), 'calendar')}
            ${infoRow('Language', esc(b.language || '—'), 'languages')}
            ${b.pages ? infoRow('Pages', esc(b.pages), 'file-text') : ''}
            ${infoRow('Location', `Shelf ${esc(b.shelf)}`, 'map-pin')}
          </div>
          ${!a.isAvailable && isStudent ? `<div class="callout amber">${icon('info')}<div><b>All copies are out.</b><p>Reserve to join the queue — we’ll hold the next returned copy for you for ${plural(p.reservationHoldDays, 'day')}.</p></div></div>` : ''}
          ${isStudent && a.isAvailable ? `<div class="callout green">${icon('scan-line')}<div><b>Borrowing tip</b><p>Take a copy from shelf ${esc(b.shelf)} and scan the QR label inside the cover — or tap “Add to Borrow Cart”.</p></div></div>` : ''}
        </div>
      </div>
      <div class="sticky-footer">${footer}</div>`;
  },
};
Object.assign(Actions, {
  addBookToCart: el => {
    const m = Auth.member();
    const r = Services.addBookToCart(m.id, el.dataset.id);
    if (!r.ok) return Toast.show(r.error, 'error', { title: 'Cannot add to cart' });
    Toast.show(`Take any copy from shelf ${r.book.shelf} — the librarian scans it at the counter`, 'success', { title: 'Added to borrow cart' });
    Router.refresh();
  },
  reserveBook: async el => {
    const b = Services.book(el.dataset.id);
    const ok = await Sheet.confirm({ title: `Reserve “${b.title}”?`, message: `You’ll join a queue of ${Services.queueFor(b.id).length}. We’ll notify you when a copy is held for you.`, confirmText: 'Reserve', icon: 'bookmark-plus' });
    if (!ok) return;
    const r = Services.reserveBook(Auth.member().id, b.id);
    Toast.show(r.ok ? `You’re #${r.position} in the queue` : r.error, r.ok ? 'success' : 'error', { title: r.ok ? 'Reserved' : '' });
    Router.refresh();
  },
  cancelReservation: async el => {
    const ok = await Sheet.confirm({ title: 'Cancel this reservation?', message: 'You will lose your place in the queue.', confirmText: 'Cancel reservation', cancelText: 'Keep', danger: true, icon: 'bookmark-x' });
    if (!ok) return;
    const r = Services.cancelReservation(el.dataset.id, Auth.current().id);
    Toast.show(r.ok ? 'Reservation cancelled' : r.error, r.ok ? 'info' : 'error');
    Router.refresh();
  },
  shareBook: async el => {
    const b = Services.book(el.dataset.id);
    const text = `${b.title} by ${b.author} — ISBN ${b.isbn}`;
    try {
      if (navigator.share) await navigator.share({ title: b.title, text });
      else { await navigator.clipboard.writeText(text); Toast.show('Book details copied', 'info'); }
    } catch (e) { /* user cancelled share */ }
  },
});

/* ---------------- Student scanner ---------------- */
Actions.studentScan = () => {
  const m = Auth.member();
  if (!m) return;
  const samples = Store.filter('bookCopies', c => c.status === 'AVAILABLE')
    .filter(c => !Services.book(c.bookId)?.archived)
    .slice(0, 8)
    .map(c => ({ value: c.id, label: c.id, sub: truncate(Services.book(c.bookId).title, 22) }));
  const borrowed = Store.find('bookCopies', c => c.status === 'BORROWED');
  if (borrowed) samples.push({ value: borrowed.id, label: borrowed.id, sub: 'Borrowed (error demo)' });
  Scanner.open({
    title: 'Scan book QR',
    subtitle: 'Find the QR label inside the front cover',
    placeholder: 'Copy ID, e.g. BOOKCOPY-000004',
    samples,
    onResult: text => {
      const q = QR.parse(text);
      if (q.type !== 'COPY') return { ok: false, title: 'Not a book QR code', message: 'Scan the QR label on a library book copy.' };
      const r = Services.addToCart(m.id, q.id);
      if (!r.ok) return { ok: false, title: r.book ? r.book.title : 'Copy not found', message: r.error, book: r.book };
      return { ok: true, title: r.book.title, message: `${r.copy.id} added to your cart`, book: r.book };
    },
    footer: () => {
      const n = Services.cart(m.id).length;
      return `<button class="btn primary block lg" data-scan-cart ${n ? '' : 'disabled'}>${icon('shopping-bag')} View cart${n ? ` (${n})` : ''}</button>`;
    },
  });
  Scanner.el.addEventListener('click', e => { if (e.target.closest('[data-scan-cart]')) { Scanner.close(); Router.go('cart'); } });
};

/* ---------------- Borrow cart ---------------- */
Screens.cart = {
  roles: STUDENT,
  render() {
    const m = Auth.member(), p = Store.settings();
    const v = Services.validateCart(m.id);
    const el = v.eligibility;
    const pending = Services.pendingRequestOf(m.id);
    const body = v.items.length ? `
      <div class="cart-summary">
        <div><b>${v.items.length}</b><small>in cart</small></div>
        <div><b>${el.activeCount}</b><small>borrowed</small></div>
        <div><b>${p.maxBorrow}</b><small>limit</small></div>
        <div><b>${p.loanDays}d</b><small>loan</small></div>
      </div>
      <div class="cart-list">${v.items.map(i => `
        <div class="cart-item ${i.ok ? '' : 'bad'}">
          ${cover(i.book, 'sm')}
          <div class="grow"><b class="clamp2">${esc(i.book?.title || 'Unknown')}</b><small class="mono">${esc(i.id)}</small>
            ${i.ok ? `<small class="text-green">${icon('check')} Available · shelf ${esc(i.book.shelf)}</small>` : `<small class="text-red">${icon('alert-circle')} ${esc(i.error)}</small>`}</div>
          <button class="icon-btn sm danger" data-action="removeFromCart" data-id="${esc(i.id)}" aria-label="Remove ${esc(i.book?.title)}">${icon('trash-2')}</button>
        </div>`).join('')}</div>
      <button class="btn ghost block" data-action="studentScan">${icon('scan-line')} Scan another book</button>
      ${sectionTitle('Borrowing checks')}
      <ul class="checks card">${el.checks.map(checkRow).join('')}${checkRow({ label: 'Copies available', ok: v.items.every(i => i.ok), detail: v.items.every(i => i.ok) ? 'All copies can be checked out' : 'Remove unavailable copies' })}</ul>
      <div class="callout gray">${icon('calendar-clock')}<div><b>Expected due date: ${fmtDate(endOfDay(Date.now() + p.loanDays * DAY_MS))}</b><p>The final due date is set when the librarian approves your checkout.</p></div></div>`
      : emptyState({ icon: 'shopping-bag', title: 'Your borrow cart is empty', text: 'Scan the QR label inside a book, or add one from its details page.', action: `<div class="row-center gap8"><button class="btn primary" data-action="studentScan">${icon('scan-line')} Scan a book</button><button class="btn ghost" data-action="tab" data-to="explore">Explore</button></div>` });
    return `${Header({ title: 'Borrow cart', subtitle: `${v.items.length} of ${el.remaining ?? p.maxBorrow} slots used`, back: true })}
      <div class="scroll ${v.items.length ? 'has-footer' : ''}"><div class="pad">
        ${pending ? `<button class="banner green" data-action="go" data-to="checkoutQR" data-id="${pending.id}">${icon('qr-code')}<div><b>You have a pending checkout</b><small>Generating a new QR replaces ${pending.code}</small></div>${icon('chevron-right')}</button>` : ''}
        ${body}
      </div></div>
      ${v.items.length ? `<div class="sticky-footer col">
        ${!v.ok ? `<small class="text-red center">${icon('alert-circle')} ${esc(v.errors[0])}</small>` : ''}
        <button class="btn primary block lg" data-action="generateCheckout" ${v.ok ? '' : 'disabled'}>${icon('qr-code')} Generate Checkout QR</button></div>` : ''}`;
  },
};
Object.assign(Actions, {
  removeFromCart: el => {
    const memberId = Auth.member().id, copyId = el.dataset.id;
    const title = Services.book(Services.copy(copyId)?.bookId)?.title || copyId;
    Services.removeFromCart(memberId, copyId);
    haptic(8);
    Router.refresh();
    // Undo re-adds through the normal validation, in case the copy was taken meanwhile.
    Toast.show(`“${title}” removed`, 'info', { action: { label: 'Undo', onClick: () => {
      const r = Services.addToCart(memberId, copyId);
      if (!r.ok) Toast.show(r.error, 'error');
      if (Router.current()?.name === 'cart') Router.refresh();
    } } });
  },
  generateCheckout: el => withLoading(el, () => {
    const r = Services.createCheckoutRequest(Auth.member().id);
    if (!r.ok) return Toast.show(r.error, 'error', { title: 'Cannot create checkout' });
    haptic([15, 30, 15]);
    Router.replace('checkoutQR', { id: r.request.id });
  }, 700),
});

/* ---------------- Checkout QR pass ---------------- */
Screens.checkoutQR = {
  roles: STUDENT,
  render({ id }) {
    const r = Store.get('borrowRequests', id);
    const m = Auth.member();
    if (!r || r.memberId !== m.id) return Screens.error.render({ code: 404 });
    const items = Services.requestItems(r.id).map(i => ({ ...i, book: Services.book(i.bookId) }));
    const p = Store.settings();
    let main;
    if (r.status === REQ_STATUS.PENDING) {
      main = `<div class="qr-pass">
          <div class="qr-pass-head"><span class="pulse-dot"></span> Waiting for approval</div>
          <div class="qr-box" id="checkout-qr" aria-label="Checkout QR code"></div>
          <div class="qr-code-txt mono">${r.code}</div>
          <p class="qr-live">Stays valid while this screen is open</p>
        </div>
        <p class="qr-instr">Show this QR code to the librarian at the checkout counter.</p>
        <p class="qr-tip">Turn your screen brightness up if the scanner can’t read it. The code holds no personal data and refreshes itself, so screenshots won’t work.</p>`;
    } else if (r.status === REQ_STATUS.APPROVED) {
      const txs = Store.filter('borrowTransactions', t => t.requestId === r.id);
      main = `<div class="result-card">${successMark()}<h2>Checkout approved</h2><p class="muted">Approved ${fmtDateTime(r.processedAt)}</p>
        <div class="due-big">Due ${fmtDate(txs[0]?.dueAt)}</div></div>`;
    } else {
      const msg = { REJECTED: ['Checkout rejected', r.rejectReason || 'Please speak to the librarian.'], EXPIRED: ['QR code expired', `Checkout QRs are valid for ${p.requestExpiryMin} minutes. Generate a new one at the counter.`], CANCELLED: ['Request cancelled', 'This checkout request is no longer valid.'] }[r.status];
      main = `<div class="result-card">${errorMark()}<h2>${msg[0]}</h2><p class="muted">${esc(msg[1])}</p></div>`;
    }
    const foot = r.status === REQ_STATUS.PENDING
      ? `<button class="btn ghost lg" data-action="cancelCheckout" data-id="${r.id}">Cancel</button><button class="btn primary lg grow" data-action="tab" data-to="home">Done</button>`
      : r.status === REQ_STATUS.APPROVED
        ? `<button class="btn primary block lg" data-action="tab" data-to="mybooks">${icon('book-open')} View my books</button>`
        : `<button class="btn primary block lg" data-action="go" data-to="cart">${icon('refresh-cw')} Back to cart</button>`;
    return `<div class="qr-screen">
      ${Header({ title: 'Checkout pass', subtitle: `${plural(items.length, 'book')} · ${r.code}`, back: true })}
      <div class="scroll has-footer"><div class="pad">
        ${main}
        <div class="card qr-books">
          <h4 class="group-label">Books in this checkout</h4>
          ${items.map(i => `<div class="row gap12 qr-book">${cover(i.book, 'xs')}<div class="grow"><b class="clamp1">${esc(i.book?.title)}</b><small class="mono muted">${i.copyId}</small></div></div>`).join('')}
        </div>
      </div></div>
      <div class="sticky-footer">${foot}</div></div>`;
  },
  mount({ id }) {
    const r = Store.get('borrowRequests', id);
    if (!r || r.status !== REQ_STATUS.PENDING) return;
    renderQR($('#checkout-qr'), QR.request(r.token), 232);
    const tick = () => {
      const cur = Store.get('borrowRequests', id);
      if (!cur || cur.status !== REQ_STATUS.PENDING || toMs(cur.expiresAt) <= Date.now()) {
        clearInterval(timer);
        if (cur?.status === REQ_STATUS.APPROVED) { haptic([20, 40, 20]); Toast.show('Your books are checked out!', 'success', { title: 'Approved' }); }
        Router.refresh();
        return;
      }
      // While the pass is visible, renew it shortly before it lapses (new token, new expiry).
      // If the student leaves the screen or locks the phone, it expires normally.
      if (toMs(cur.expiresAt) - Date.now() < 30000 && document.visibilityState === 'visible') {
        const res = Services.refreshCheckoutRequest(id);
        if (res.ok) renderQR($('#checkout-qr'), QR.request(res.request.token), 232);
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    Router.onLeave(() => clearInterval(timer));
  },
};
Actions.cancelCheckout = async el => {
  const ok = await Sheet.confirm({ title: 'Cancel this checkout?', message: 'The QR code will stop working. Your cart is kept.', confirmText: 'Cancel checkout', cancelText: 'Keep', danger: true, icon: 'x-circle' });
  if (!ok) return;
  Services.cancelRequest(el.dataset.id, Auth.current().id);
  Toast.show('Checkout cancelled', 'info');
  Router.replace('cart');
};

/* ---------------- My Books ---------------- */
Screens.mybooks = {
  roles: STUDENT, tab: true, skeleton: 'My Books',
  render() {
    const m = Auth.member();
    const p = Store.settings();
    const loans = Services.activeLoans(m.id).sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt));
    const reqs = Store.filter('borrowRequests', r => r.memberId === m.id).sort((a, b) => toMs(b.requestedAt) - toMs(a.requestedAt));
    const pendingReqs = reqs.filter(r => r.status === REQ_STATUS.PENDING);
    const rsv = Store.filter('reservations', r => r.memberId === m.id).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const hist = Store.filter('borrowTransactions', t => t.memberId === m.id && t.status === 'RETURNED').sort((a, b) => toMs(b.returnedAt) - toMs(a.returnedAt));
    const tab = UI.mybooks;
    let content = '';
    if (tab === 'borrowed') {
      content = loans.length ? loans.map(t => {
        const b = Services.book(t.bookId), d = daysUntil(t.dueAt);
        const tone = d < 0 ? 'red' : d <= p.dueSoonDays ? 'amber' : 'green';
        const pct = clamp(100 - (d / p.loanDays) * 100, 4, 100);
        const fine = Services.calcFine(t);
        return `<button class="loan-card" data-action="loanDetail" data-id="${t.id}">
          ${cover(b, 'sm')}
          <div class="grow">
            <div class="row-between"><b class="clamp1">${esc(b.title)}</b>${badge(t.status)}</div>
            <small class="muted">Borrowed ${fmtShort(t.borrowedAt)} · Due ${fmtShort(t.dueAt)}</small>
            <div class="progress ${tone}"><span style="width:${pct}%"></span></div>
            <div class="row-between"><small class="text-${tone} strong">${dueLabel(t.dueAt)}</small>${fine.amount ? `<small class="text-red strong">Fine ${money(fine.amount)}</small>` : ''}</div>
          </div></button>`;
      }).join('') : emptyState({ icon: 'book-open', title: 'No borrowed books', text: 'Books you check out at the counter show up here.', action: `<button class="btn primary" data-action="tab" data-to="explore">Find a book</button>` });
    } else if (tab === 'pending') {
      const cartN = Services.cart(m.id).length;
      content = (cartN ? `<button class="banner gray" data-action="go" data-to="cart">${icon('shopping-bag')}<div><b>${plural(cartN, 'book')} in your cart</b><small>Generate a checkout QR when you’re ready</small></div>${icon('chevron-right')}</button>` : '')
        + (reqs.length ? reqs.slice(0, 15).map(r => {
          const items = Services.requestItems(r.id);
          return `<button class="list-card" data-action="${r.status === REQ_STATUS.PENDING ? 'go' : 'requestInfo'}" data-to="checkoutQR" data-id="${r.id}">
            <span class="lc-ic ${r.status === REQ_STATUS.PENDING ? 'green' : 'gray'}">${icon('qr-code')}</span>
            <div class="lc-body"><b>${r.code} · ${plural(items.length, 'book')}</b><small>${fmtDateTime(r.requestedAt)}</small></div>${badge(r.status)}</button>`;
        }).join('') : emptyState({ icon: 'qr-code', title: 'No checkout requests', text: 'Add books to your cart and generate a checkout QR.' }));
    } else if (tab === 'reservations') {
      content = rsv.length ? rsv.map(r => {
        const b = Services.book(r.bookId);
        const live = ['WAITING', 'READY'].includes(r.status);
        const sub = r.status === 'WAITING' ? `#${Services.queuePosition(r)} in queue · since ${fmtShort(r.createdAt)}` : r.status === 'READY' ? `Pick up by ${fmtDate(r.holdUntil)} · ${r.copyId}` : `Updated ${fmtShort(r.updatedAt)}`;
        return `<div class="list-card static">${cover(b, 'xs')}<div class="lc-body"><b class="clamp1">${esc(b?.title)}</b><small>${sub}</small><div class="row gap6 mt4">${badge(r.status)}</div></div>
          ${live ? `<div class="col gap6">${r.status === 'READY' ? `<button class="btn primary sm" data-action="addBookToCart" data-id="${r.bookId}">Add</button>` : ''}<button class="btn ghost sm" data-action="cancelReservation" data-id="${r.id}">Cancel</button></div>` : ''}</div>`;
      }).join('') : emptyState({ icon: 'bookmark', title: 'No reservations', text: 'Reserve a book that’s out on loan and we’ll hold the next copy for you.' });
    } else {
      content = hist.length ? hist.map(t => {
        const b = Services.book(t.bookId);
        const late = toMs(t.returnedAt) > toMs(t.dueAt);
        return `<button class="list-card" data-action="openTxReceipt" data-id="${t.id}">${cover(b, 'xs')}<div class="lc-body"><b class="clamp1">${esc(b?.title)}</b><small>${fmtShort(t.borrowedAt)} → ${fmtShort(t.returnedAt)}</small></div>
          ${late ? `<span class="badge red">${t.fineAmount ? `Late · ${money(t.fineAmount)}` : 'Returned late'}</span>` : badge('RETURNED', 'On time')}</button>`;
      }).join('') : emptyState({ icon: 'history', title: 'No history yet', text: 'Returned books will be listed here.' });
    }
    const tabs = [['borrowed', `Borrowed <span class="count">${loans.length}</span>`], ['pending', `Pending <span class="count">${pendingReqs.length}</span>`], ['reservations', `Holds <span class="count">${rsv.filter(r => ['WAITING', 'READY'].includes(r.status)).length}</span>`], ['history', 'History']];
    return `${Header({ title: 'My Books', large: true, actions: [cartButton(m), bellAction()] })}
      <div class="sticky-tools">${segmented('mb', tabs, tab, 'myBooksTab')}</div>
      <div class="scroll"><div class="pad stack10">${content}
        ${tab === 'borrowed' && loans.length ? `<div class="callout gray">${icon('undo-2')}<div><b>How to return</b><p>Return each book any time before its own due date — you don’t need to bring them back together. At the counter the librarian scans the book’s label and a return receipt appears in your app.</p></div></div>` : ''}
      </div></div>`;
  },
};
Object.assign(Actions, {
  myBooksTab: el => { UI.mybooks = el.dataset.value; haptic(6); Router.refresh(); },
  requestInfo: el => {
    const r = Store.get('borrowRequests', el.dataset.id);
    const items = Services.requestItems(r.id);
    Sheet.open({
      title: `Checkout ${r.code}`,
      body: `<div class="row-between mb12">${badge(r.status)}<small class="muted">${fmtDateTime(r.requestedAt)}</small></div>
        ${r.rejectReason ? `<div class="callout red">${icon('x-circle')}<div><b>Reason</b><p>${esc(r.rejectReason)}</p></div></div>` : ''}
        ${items.map(i => bookRow(Services.book(i.bookId), { sub: `<span class="mono">${i.copyId}</span>`, action: 'go', attrs: `data-to="bookDetail" data-id="${i.bookId}"` })).join('')}`,
    });
  },
  loanDetail: el => {
    const t = Store.get('borrowTransactions', el.dataset.id);
    const b = Services.book(t.bookId);
    const fine = Services.calcFine(t);
    const p = Store.settings();
    const returned = t.status === 'RETURNED';
    Sheet.open({
      title: 'Loan details',
      body: `<div class="row gap12 mb12">${cover(b, 'sm')}<div><b>${esc(b.title)}</b><small class="muted block">${esc(b.author)}</small><div class="mt4">${badge(t.status)}</div></div></div>
        <div class="card info-list">
          ${infoRow('Copy ID', `<span class="mono">${t.copyId}</span>`, 'qr-code')}
          ${infoRow('Borrowed', fmtDateTime(t.borrowedAt), 'calendar')}
          ${infoRow('Due date', fmtDate(t.dueAt), 'calendar-clock')}
          ${returned ? infoRow('Returned', fmtDateTime(t.returnedAt), 'undo-2') : infoRow('Status', dueLabel(t.dueAt), 'clock')}
          ${fine.amount || t.fineAmount ? infoRow('Fine', `<span class="text-red">${money(returned ? t.fineAmount : fine.amount)}</span>`, 'wallet') : ''}
        </div>
        ${returned ? '' : `<div class="callout ${t.status === 'OVERDUE' ? 'red' : 'gray'}">${icon('undo-2')}<div><b>Return instructions</b><p>Return this book at any library counter during opening hours (${esc(p.openingHours)}).${FEATURES.fines ? ` Late returns are charged ${money(p.finePerDay)} per day, up to ${money(p.maxFinePerItem)}.` : ' Please bring it back by the due date so others can borrow it.'}</p></div></div>`}`,
      footer: `<button class="btn ghost ${returned && Services.receiptForTx(t.id) ? '' : 'block'}" data-action="go" data-to="bookDetail" data-id="${b.id}">View book</button>${returned && Services.receiptForTx(t.id) ? `<button class="btn primary grow" data-action="openTxReceipt" data-id="${t.id}">${icon('receipt')} Return receipt</button>` : ''}`,
    });
  },
});

/* ---------------- Digital membership card ---------------- */
Screens.memberCard = {
  roles: STUDENT,
  render() {
    const u = Auth.current(), m = Auth.member(), s = Store.settings();
    const valid = Services.isMembershipValid(m);
    return `${Header({ title: 'Membership card', back: true })}
      <div class="scroll"><div class="pad">
        <div class="id-card ${valid ? '' : 'inactive'}">
          <div class="id-top"><span class="id-logo">${icon('library')}</span><div><b>${esc(s.libraryName)}</b><small>${esc(s.campus)} · Library Card</small></div></div>
          <div class="id-main">
            ${avatar(u, 72)}
            <div><small>Member name</small><b class="id-name">${esc(u.name)}</b><small>${esc(m.program)} · Year ${m.year}</small></div>
          </div>
          <div class="id-grid">
            <div><small>Student ID</small><b class="mono">${esc(m.studentId)}</b></div>
            <div><small>Status</small><b>${valid ? 'Active' : m.status === 'SUSPENDED' ? 'Suspended' : 'Expired'}</b></div>
            <div><small>Member since</small><b>${fmtDate(m.joinedAt, { month: 'short', year: 'numeric' })}</b></div>
            <div><small>Expires</small><b>${fmtDate(m.expiresAt)}</b></div>
          </div>
        </div>
        <div class="qr-pass compact">
          <div class="qr-box" id="member-qr"></div>
          <small class="muted">Membership token · rotates if your card is reported lost</small>
        </div>
        <p class="qr-instr">${icon('store')} Show this card at the library counter to identify yourself.</p>
        ${valid ? '' : `<div class="callout red">${icon('alert-circle')}<div><b>Membership inactive</b><p>You can’t borrow books until your membership is renewed. Please visit the library desk.</p></div></div>`}
      </div></div>`;
  },
  mount() { renderQR($('#member-qr'), QR.member(Auth.member().memberToken), 200); },
};

/* ---------------- Student fines ---------------- */
// Only registered when fines are enabled (MVP ships without money).
if (FEATURES.fines) Screens.fines = {
  roles: STUDENT,
  render() {
    const m = Auth.member(), p = Store.settings();
    const owed = Services.outstanding(m.id);
    const fines = Store.filter('fines', f => f.memberId === m.id).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const accruing = Services.overdueLoans(m.id);
    return `${Header({ title: 'Fines & fees', back: true })}
      <div class="scroll"><div class="pad">
        <div class="balance-card ${owed.total ? 'red' : 'green'}">
          <small>Outstanding balance</small><b>${money(owed.total)}</b>
          <span>${owed.accruing ? `${money(owed.unpaid)} unpaid + ${money(owed.accruing)} accruing` : owed.total ? 'Pay at the library counter' : 'You’re all clear 🎉'}</span>
        </div>
        ${accruing.length ? `${sectionTitle('Accruing on overdue books')}${accruing.map(t => {
          const b = Services.book(t.bookId), f = Services.calcFine(t);
          return bookRow(b, { sub: `${f.days} days × ${money(p.finePerDay)}`, right: `<b class="text-red">${money(f.amount)}</b>`, action: 'loanDetail', attrs: `data-id="${t.id}"` });
        }).join('')}` : ''}
        ${sectionTitle('Fine history', { label: 'Receipts', attrs: 'data-to="receipts"' })}
        ${fines.length ? fines.map(f => {
          const settled = f.status !== 'UNPAID';
          const inner = `<span class="lc-ic ${settled ? 'gray' : 'red'}">${icon(f.reason === 'DAMAGED' ? 'book-x' : 'clock')}</span>
            <div class="lc-body"><b class="clamp1">${esc(Services.book(f.bookId)?.title || 'Library fee')}</b><small>${f.reason === 'DAMAGED' ? 'Damage fee' : 'Overdue'} · ${esc(f.note || '')} · ${fmtShort(f.createdAt)}</small></div>
            <div class="col end"><b>${money(f.amount)}</b>${badge(f.status)}</div>`;
          // Settled fines open their payment / waiver receipt.
          return settled ? `<button class="list-card" data-action="openFineReceipt" data-id="${f.id}">${inner}</button>` : `<div class="list-card static">${inner}</div>`;
        }).join('')
          : emptyState({ icon: 'wallet', title: 'No fines', text: 'Return books on time to keep it that way.' })}
        <div class="callout gray">${icon('info')}<div><b>Fine policy</b><p>${money(p.finePerDay)} per overdue day, capped at ${money(p.maxFinePerItem)} per book. Borrowing is paused above ${money(p.maxUnpaidFines)} unpaid.</p></div></div>
      </div></div>`;
  },
};
