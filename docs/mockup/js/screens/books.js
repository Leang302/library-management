'use strict';
/* ===========================================================================
 * books.js — Book & copy management (librarian + admin): inventory list,
 * title management with per-copy QR codes, add/edit form with cover upload,
 * printable QR labels.
 * ======================================================================== */

/* ---------------- Inventory ---------------- */
function inventoryList() {
  const f = UI.inventory;
  const q = f.q.trim().toLowerCase();
  return Store.all('books').filter(b => {
    if (f.filter === 'archived') { if (!b.archived) return false; }
    else if (b.archived) return false;
    if (f.filter === 'available' && !Services.availability(b.id).isAvailable) return false;
    if (f.filter === 'unavailable' && Services.availability(b.id).isAvailable) return false;
    if (f.filter === 'attention' && !Services.copiesOf(b.id).some(c => ['MAINTENANCE', 'LOST'].includes(c.status))) return false;
    if (q && ![b.title, b.author, b.isbn, b.category, b.shelf].some(v => String(v).toLowerCase().includes(q))
      && !Services.copiesOf(b.id).some(c => c.id.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => a.title.localeCompare(b.title));
}
function renderInventoryList() {
  const list = inventoryList();
  if (!list.length) return emptyState({ icon: 'library', title: 'No books match', text: 'Try another search or filter.', action: `<button class="btn primary" data-action="go" data-to="bookForm">${icon('plus')} Add a book</button>` });
  return `<p class="result-count">${plural(list.length, 'title')}</p>` + list.map(b => {
    const a = Services.availability(b.id);
    const pct = a.total ? (a.available / a.total) * 100 : 0;
    return `<button class="inv-row" data-action="go" data-to="bookManage" data-id="${b.id}">
      ${cover(b, 'sm')}
      <div class="lc-body"><b class="clamp1">${esc(b.title)}</b><small class="clamp1">${esc(b.author)} · <span class="mono">${esc(b.isbn)}</span></small>
        <div class="row gap6 mt4"><span class="tag">${icon('map-pin')} ${esc(b.shelf)}</span>${a.maintenance ? `<span class="badge amber">${a.maintenance} maint.</span>` : ''}${a.lost ? `<span class="badge red">${a.lost} lost</span>` : ''}${b.archived ? '<span class="badge gray">Archived</span>' : ''}</div>
        <div class="avail-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="col end"><b>${a.available}/${a.total}</b><small class="muted">avail.</small></div></button>`;
  }).join('');
}
Screens.inventory = {
  roles: STAFF, tab: true, skeleton: 'Inventory',
  render() {
    const copies = Store.all('bookCopies');
    const by = s => copies.filter(c => c.status === s).length;
    const f = UI.inventory;
    return `${Header({ title: Auth.is('ADMIN') ? 'Inventory' : 'Books', subtitle: `${Store.count('books', b => !b.archived)} titles · ${copies.length - by('LOST')} copies`, large: true, actions: [{ icon: 'compass', action: 'go', attrs: 'data-to="explore"', label: 'Browse catalogue' }, { icon: 'plus', action: 'go', attrs: 'data-to="bookForm"', label: 'Add book' }] })}
      <div class="sticky-tools">
        <div class="search-bar">${icon('search')}<input value="${esc(f.q)}" placeholder="Title, author, ISBN, shelf or copy ID" aria-label="Search inventory" data-input="invSearch" autocomplete="off"></div>
        ${chips([['all', 'All'], ['available', 'Available'], ['unavailable', 'Unavailable'], ['attention', 'Needs attention'], ['archived', 'Archived']], f.filter, 'invFilter')}
      </div>
      <div class="scroll"><div class="pad">
        <div class="inv-stats scroll-x">
          <div><b>${by('AVAILABLE')}</b><small><i class="dot green"></i>Available</small></div>
          <div><b>${by('BORROWED')}</b><small><i class="dot blue"></i>Borrowed</small></div>
          <div><b>${by('RESERVED')}</b><small><i class="dot amber"></i>Reserved</small></div>
          <div><b>${by('MAINTENANCE')}</b><small><i class="dot amber"></i>Maintenance</small></div>
          <div><b>${by('LOST')}</b><small><i class="dot red"></i>Lost</small></div>
        </div>
        <div id="inv-list">${renderInventoryList()}</div>
      </div></div>
      <button class="fab-float" data-action="go" data-to="bookForm" aria-label="Add book">${icon('plus')}</button>`;
  },
};
Object.assign(Actions, {
  invSearch: debounce(el => { UI.inventory.q = el.value; const box = $('#inv-list'); if (box) { box.innerHTML = renderInventoryList(); refreshIcons(); } }, 150),
  invFilter: el => { UI.inventory.filter = el.dataset.value; Router.refresh(); },
});

/* ---------------- Title management (copies) ---------------- */
Screens.bookManage = {
  roles: STAFF,
  render({ id }) {
    const b = Services.book(id);
    if (!b) return Screens.error.render({ code: 404 });
    const a = Services.availability(b.id);
    const copies = Services.copiesOf(b.id);
    const txs = Store.filter('borrowTransactions', t => t.bookId === b.id).sort((x, y) => toMs(y.borrowedAt) - toMs(x.borrowedAt));
    const queue = Services.queueFor(b.id);
    const seg = (n, cls) => (n ? `<span class="${cls}" style="flex:${n}"></span>` : '');
    return `${Header({ title: 'Manage title', back: true, actions: [{ icon: 'pencil', action: 'go', attrs: `data-to="bookForm" data-id="${b.id}"`, label: 'Edit book' }] })}
      <div class="scroll"><div class="pad">
        <div class="manage-head">${cover(b, 'md')}
          <div class="grow"><b class="h3 m0">${esc(b.title)}</b><small class="muted block">${esc(b.author)}</small>
            <small class="mono block mt4">ISBN ${esc(b.isbn)}</small>
            <div class="row gap6 mt8 wrap"><span class="tag">${esc(b.category)}</span><span class="tag">${icon('map-pin')} ${esc(b.shelf)}</span>${b.archived ? badge('EXPIRED', 'Archived') : ''}</div></div>
        </div>
        <div class="card">
          <div class="row-between"><b>Copy status</b><small class="muted">${a.total} in circulation · ${Services.popularity(b.id)} loans</small></div>
          <div class="seg-bar">${seg(a.available, 'green')}${seg(a.borrowed, 'blue')}${seg(a.reserved + a.maintenance, 'amber')}${seg(a.lost, 'red')}</div>
          <div class="legend wrap"><span><i class="dot green"></i>${a.available} available</span><span><i class="dot blue"></i>${a.borrowed} borrowed</span><span><i class="dot amber"></i>${a.reserved + a.maintenance} held/maint.</span><span><i class="dot red"></i>${a.lost} lost</span></div>
        </div>
        <div class="action-grid">
          <button data-action="addCopiesSheet" data-id="${b.id}">${icon('copy-plus')}<span>Add copies</span></button>
          <button data-action="go" data-to="labels" data-id="${b.id}">${icon('printer')}<span>Print labels</span></button>
          <button data-action="toggleArchive" data-id="${b.id}">${icon(b.archived ? 'archive-restore' : 'archive')}<span>${b.archived ? 'Restore' : 'Archive'}</span></button>
          <button class="danger" data-action="deleteBook" data-id="${b.id}">${icon('trash-2')}<span>Delete</span></button>
        </div>
        ${sectionTitle(`Physical copies (${copies.length})`)}
        <div class="stack8">${copies.map(c => {
          const tx = c.status === 'BORROWED' ? Services.activeTxForCopy(c.id) : null;
          const held = c.status === 'RESERVED' ? Store.find('reservations', r => r.copyId === c.id && r.status === 'READY') : null;
          return `<button class="copy-row" data-action="copySheet" data-id="${c.id}">
            <span class="copy-qr">${icon('qr-code')}</span>
            <div class="lc-body"><b class="mono">${c.id}</b><small class="clamp1">${tx ? `${esc(Services.memberName(tx.memberId))} · ${dueLabel(tx.dueAt)}` : held ? `Held for ${esc(Services.memberName(held.memberId))}` : c.note ? esc(c.note) : `Added ${fmtDate(c.acquiredAt)}`}</small></div>
            ${badge(c.status)}</button>`;
        }).join('')}</div>
        ${queue.length ? `${sectionTitle(`Reservation queue (${queue.length})`)}<ol class="queue card">${queue.map((r, i) => `<li><span class="q-pos">${i + 1}</span><div class="grow"><b>${esc(Services.memberName(r.memberId))}</b><small>Since ${fmtShort(r.createdAt)}</small></div></li>`).join('')}</ol>` : ''}
        ${sectionTitle('Recent loans')}
        ${txs.slice(0, 5).map(t => `<button class="tx-row" data-action="txDetail" data-id="${t.id}"><span class="tx-ic ${t.status === 'RETURNED' ? 'blue' : 'green'}">${icon(t.status === 'RETURNED' ? 'arrow-down-left' : 'arrow-up-right')}</span><div class="lc-body"><b>${esc(Services.memberName(t.memberId))}</b><small class="mono">${t.copyId}</small></div><div class="col end">${badge(t.status)}<small class="muted">${fmtShort(t.borrowedAt)}</small></div></button>`).join('') || `<div class="empty-inline">${icon('history')} Never borrowed</div>`}
      </div></div>`;
  },
};

/** Bottom sheet for one physical copy: QR, status, borrower, actions. */
function openCopySheet(copyId) {
  const c = Services.copy(copyId);
  if (!c) return Toast.show('Copy not found', 'error');
  const b = Services.book(c.bookId);
  const tx = Services.activeTxForCopy(c.id);
  const statusBtn = (s, ic, label) => `<button class="opt-btn ${c.status === s ? 'on' : ''}" data-action="setCopyStatus" data-id="${c.id}" data-status="${s}" ${c.status === s ? 'disabled' : ''}>${icon(ic)}<span>${label}</span></button>`;
  Sheet.open({
    title: c.id,
    body: `<div class="row gap12 mb12">${cover(b, 'xs')}<div class="grow"><b class="clamp1">${esc(b.title)}</b><small class="muted">Shelf ${esc(b.shelf)} · added ${fmtDate(c.acquiredAt)}</small></div>${badge(c.status)}</div>
      <div class="qr-label"><div id="copy-qr"></div><b class="mono">${c.id}</b><small>${esc(truncate(b.title, 34))}</small></div>
      ${tx ? `<div class="callout blue">${icon('user')}<div><b>On loan to ${esc(Services.memberName(tx.memberId))}</b><p>Borrowed ${fmtDate(tx.borrowedAt)} · ${dueLabel(tx.dueAt)}</p></div></div>` : ''}
      ${c.note ? `<div class="callout amber">${icon('sticky-note')}<div><b>Note</b><p>${esc(c.note)}</p></div></div>` : ''}
      ${c.status === 'BORROWED' ? '' : `<h4 class="group-label">Change status</h4><div class="opt-grid">
        ${statusBtn('AVAILABLE', 'check-circle-2', 'Available')}${statusBtn('MAINTENANCE', 'wrench', 'Maintenance')}
        <button class="opt-btn" data-action="setCopyStatus" data-id="${c.id}" data-status="MAINTENANCE" data-note="Damaged">${icon('book-x')}<span>Damaged</span></button>
        ${statusBtn('LOST', 'search-x', 'Lost')}</div>`}`,
    footer: `<button class="btn ghost" data-action="downloadLabel" data-id="${c.id}">${icon('download')} PNG</button>${tx ? `<button class="btn primary grow" data-action="go" data-to="returnReview" data-id="${c.id}">${icon('undo-2')} Process return</button>` : `<button class="btn primary grow" data-action="printLabels" data-ids="${c.id}">${icon('printer')} Print label</button>`}`,
    onMount: el => renderQR(el.querySelector('#copy-qr'), c.id, 168),
  });
}
Object.assign(Actions, {
  copySheet: el => openCopySheet(el.dataset.id),
  setCopyStatus: async el => {
    const { id, status } = el.dataset;
    let note = el.dataset.note || '';
    if (status === 'LOST') {
      const ok = await Sheet.confirm({ title: `Mark ${id} as lost?`, message: 'It will be removed from available inventory and counted as missing.', confirmText: 'Mark lost', danger: true, icon: 'search-x' });
      if (!ok) return;
      note = 'Reported lost';
    }
    if (status === 'MAINTENANCE' && !note) note = 'In maintenance';
    const r = Services.setCopyStatus(id, status, note, Auth.current().id);
    Sheet.closeAll();
    Toast.show(r.ok ? `${id} → ${status.toLowerCase()}` : r.error, r.ok ? 'success' : 'error');
    Router.refresh();
  },
  downloadLabel: el => {
    const c = Services.copy(el.dataset.id);
    const png = labelPNG(c, Services.book(c.bookId));
    if (!png) return Toast.show('QR library unavailable offline', 'error');
    downloadDataURL(`${c.id}.png`, png);
    Toast.show(`${c.id}.png downloaded`);
  },
  addCopiesSheet: el => {
    const b = Services.book(el.dataset.id);
    Sheet.open({
      title: 'Add physical copies',
      body: `<p class="muted">Each new copy gets a unique ID and QR label for “${esc(b.title)}”.</p>
        <form id="copies-form" data-submit="confirmAddCopies" data-id="${b.id}">
          <div class="stepper big"><button type="button" data-step="-1" aria-label="Fewer">${icon('minus')}</button><input name="n" type="number" min="1" max="20" value="1" aria-label="Number of copies" inputmode="numeric"><button type="button" data-step="1" aria-label="More">${icon('plus')}</button></div>
        </form>`,
      footer: `<button class="btn primary block" type="submit" form="copies-form">${icon('copy-plus')} Add copies</button>`,
      onMount: wireSteppers,
    });
  },
  confirmAddCopies: form => {
    const n = clamp(parseInt(form.n.value, 10) || 0, 1, 20);
    const r = Services.addCopies(form.dataset.id, n, Auth.current().id);
    Sheet.close();
    Toast.show(`${plural(n, 'copy', 'copies')} added: ${r.copies.map(c => c.id).join(', ')}`, 'success', { title: 'Copies created', duration: 3600 });
    Router.go('labels', { id: form.dataset.id, ids: r.copies.map(c => c.id) });
  },
  toggleArchive: async el => {
    const b = Services.book(el.dataset.id);
    const ok = await Sheet.confirm({ title: b.archived ? 'Restore this title?' : 'Archive this title?', message: b.archived ? 'It will reappear in the catalogue.' : 'It will be hidden from the catalogue. Loans and history are kept.', confirmText: b.archived ? 'Restore' : 'Archive', icon: b.archived ? 'archive-restore' : 'archive' });
    if (!ok) return;
    Services.setArchived(b.id, !b.archived, Auth.current().id);
    Toast.show(b.archived ? 'Title restored' : 'Title archived', 'info');
    Router.refresh();
  },
  deleteBook: async el => {
    const chk = Services.canDeleteBook(el.dataset.id);
    if (!chk.ok) {
      return Sheet.open({ title: 'Cannot delete', body: `<div class="callout amber">${icon('shield-alert')}<div><b>Deletion blocked by policy</b><p>${esc(chk.reason)}</p></div></div>`, footer: `<button class="btn ghost" data-action="closeSheet">Close</button><button class="btn primary grow" data-action="archiveFromSheet" data-id="${el.dataset.id}">${icon('archive')} Archive instead</button>` });
    }
    const ok = await Sheet.confirm({ title: 'Delete permanently?', message: 'This title and all its copies will be removed. This cannot be undone.', confirmText: 'Delete', danger: true, icon: 'trash-2' });
    if (!ok) return;
    const r = Services.deleteBook(el.dataset.id, Auth.current().id);
    Toast.show(r.ok ? 'Title deleted' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) Router.back();
  },
  archiveFromSheet: el => { Services.setArchived(el.dataset.id, true, Auth.current().id); Sheet.close(); Toast.show('Title archived', 'info'); Router.refresh(); },
});
function wireSteppers(root) {
  root.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const v = clamp((parseInt(input.value, 10) || 0) + +btn.dataset.step, +input.min || 1, +input.max || 50);
    input.value = v; haptic(6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }));
}

/* ---------------- Add / edit book ---------------- */
let pendingCover; // undefined = unchanged, null = removed, string = new data URL
Screens.bookForm = {
  roles: STAFF,
  render({ id }) {
    const b = id ? Services.book(id) : null;
    if (id && !b) return Screens.error.render({ code: 404 });
    pendingCover = undefined;
    const v = (k, d = '') => esc(b ? (b[k] ?? d) : d);
    const field = (name, label, input, hint = '') => `<div class="field"><label for="bf-${name}">${label}</label>${input}${hint ? `<small class="hint">${hint}</small>` : ''}<div class="field-error" data-err="${name}"></div></div>`;
    return `${Header({ title: b ? 'Edit book' : 'Add book', subtitle: b ? b.title : 'New title & copies', back: true })}
      <div class="scroll has-footer"><div class="pad">
        <form id="book-form" class="form" data-guard data-submit="saveBook" data-id="${b ? b.id : ''}" novalidate>
          <div class="cover-upload">
            <div class="cover-preview" id="cover-preview">${b ? cover(b, 'md') : `<div class="cover-empty">${icon('image-plus')}<small>No cover</small></div>`}</div>
            <div class="grow stack8">
              <b>Book cover</b><small class="muted">JPG or PNG, max 5 MB. Compressed automatically.</small>
              <label class="btn ghost sm">${icon('upload')} Upload photo<input type="file" accept="image/*" class="sr-only" data-change="coverFile"></label>
              <label class="btn ghost sm">${icon('camera')} Take photo<input type="file" accept="image/*" capture="environment" class="sr-only" data-change="coverFile"></label>
              ${b && b.coverData ? `<button type="button" class="link danger" data-action="removeCover">Remove custom cover</button>` : ''}
            </div>
          </div>
          <div class="field-error center" data-err="cover"></div>
          ${field('title', 'Book title *', `<input id="bf-title" name="title" value="${v('title')}" placeholder="e.g. Atomic Habits" required>`)}
          ${field('author', 'Author *', `<input id="bf-author" name="author" value="${v('author')}" placeholder="e.g. James Clear" required>`)}
          ${field('isbn', 'ISBN-10 / ISBN-13 *', `<div class="input-wrap">${icon('barcode')}<input id="bf-isbn" name="isbn" value="${v('isbn')}" inputmode="numeric" placeholder="9780735211292" data-input="isbnCheck" required><span class="isbn-state" id="isbn-state"></span></div>`,
            `<button type="button" class="link" data-action="isbnLookup">${icon('globe')} Look up metadata</button> · external lookup is a future integration`)}
          <div class="grid2">
            ${field('publisher', 'Publisher', `<input id="bf-publisher" name="publisher" value="${v('publisher')}" placeholder="Publisher">`)}
            ${field('year', 'Publication year', `<input id="bf-year" name="year" type="number" inputmode="numeric" min="1450" max="${new Date().getFullYear() + 1}" value="${v('year')}" placeholder="2018">`)}
          </div>
          <div class="grid2">
            ${field('category', 'Category *', `<select id="bf-category" name="category" required><option value="">Choose…</option>${CATEGORIES.map(c => `<option ${b && b.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
            ${field('language', 'Language', `<select id="bf-language" name="language">${LANGUAGES.map(l => `<option ${(b ? b.language : 'English') === l ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
          </div>
          <div class="grid2">
            ${field('shelf', 'Shelf location', `<input id="bf-shelf" name="shelf" value="${v('shelf')}" placeholder="e.g. A-03">`)}
            ${field('pages', 'Pages', `<input id="bf-pages" name="pages" type="number" inputmode="numeric" min="1" value="${v('pages')}" placeholder="320">`)}
          </div>
          ${field('acquiredAt', 'Acquired on', `<input id="bf-acquiredAt" name="acquiredAt" type="date" value="${b && b.acquiredAt ? new Date(b.acquiredAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}">`)}
          ${field('description', 'Description', `<textarea id="bf-description" name="description" rows="4" placeholder="Short summary shown to students">${v('description')}</textarea>`)}
          ${b ? `<div class="callout gray">${icon('copy')}<div><b>${plural(Services.copiesOf(b.id).length, 'physical copy', 'physical copies')}</b><p>Add copies or change their status from the title’s management screen.</p></div></div>`
            : field('copies', 'Number of physical copies *', `<div class="stepper"><button type="button" data-step="-1" aria-label="Fewer copies">${icon('minus')}</button><input id="bf-copies" name="copies" type="number" min="1" max="50" value="1" inputmode="numeric"><button type="button" data-step="1" aria-label="More copies">${icon('plus')}</button></div>`, 'A unique QR code is generated for every copy.')}
        </form>
      </div></div>
      <div class="sticky-footer"><button class="btn primary block lg" type="submit" form="book-form">${icon('check')} ${b ? 'Save changes' : 'Create book & QR codes'}</button></div>`;
  },
  mount() { wireSteppers($('#book-form')); Actions.isbnCheck($('#bf-isbn')); },
};
Object.assign(Actions, {
  coverFile: async input => {
    const f = input.files && input.files[0];
    const form = $('#book-form');
    showErrors(form, {});
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { input.value = ''; return showErrors(form, { cover: 'Please choose a JPG, PNG, WebP or GIF image.' }); }
    if (f.size > 5 * 1024 * 1024) { input.value = ''; return showErrors(form, { cover: 'Image is larger than 5 MB.' }); }
    try {
      pendingCover = await compressImage(f, 360, 0.82);
      const d = formData(form);
      $('#cover-preview').innerHTML = cover({ title: d.title || 'New book', author: d.author || '', isbn: '', coverData: pendingCover }, 'md');
      Toast.show('Cover ready — save to keep it', 'info');
    } catch (e) { showErrors(form, { cover: e.message }); }
  },
  removeCover: el => { pendingCover = null; $('#cover-preview').innerHTML = `<div class="cover-empty">${icon('image-plus')}<small>Default cover</small></div>`; el.remove(); refreshIcons(); },
  isbnCheck: input => {
    const s = $('#isbn-state');
    if (!s || !input) return;
    const raw = normalizeISBN(input.value);
    if (!raw) { s.className = 'isbn-state'; s.textContent = ''; return; }
    const ok = isValidISBN(raw);
    s.className = `isbn-state ${ok ? 'ok' : 'bad'}`;
    s.textContent = ok ? `ISBN-${raw.length} ✓` : raw.length === 10 || raw.length === 13 ? 'Checksum ✗' : `${raw.length}/13`;
  },
  isbnLookup: () => Toast.show('Metadata lookup (e.g. Open Library API) is planned. Enter details manually — everything works offline.', 'info', { title: 'Future integration', duration: 4200 }),
  saveBook: form => {
    const d = formData(form);
    const id = form.dataset.id;
    if (pendingCover !== undefined) d.coverData = pendingCover;
    if (d.acquiredAt) d.acquiredAt = iso(new Date(d.acquiredAt + 'T12:00:00').getTime());
    withLoading($('[form="book-form"]'), () => {
      const r = id ? Services.updateBook(id, d, Auth.current().id) : Services.createBook(d, Auth.current().id);
      if (!r.ok) { showErrors(form, r.errors); Toast.show('Please fix the highlighted fields', 'error'); return; }
      if (id) { Toast.show('Book updated'); Router.back(); }
      else {
        Toast.show(`${plural(r.copies.length, 'copy', 'copies')} with unique QR codes created`, 'success', { title: `“${r.book.title}” added` });
        Router.replace('labels', { id: r.book.id, fresh: true });
      }
    }, 500);
  },
});

/* ---------------- QR labels (print / download) ---------------- */
Screens.labels = {
  roles: STAFF,
  render({ id, ids, fresh }) {
    const b = Services.book(id);
    if (!b) return Screens.error.render({ code: 404 });
    const copies = Services.copiesOf(b.id).filter(c => !ids || ids.includes(c.id));
    return `${Header({ title: 'QR labels', subtitle: `${plural(copies.length, 'label')} · ${b.title}`, back: true })}
      <div class="scroll has-footer"><div class="pad">
        ${fresh ? `<div class="callout green">${icon('check-circle-2')}<div><b>Book created</b><p>Print these labels and stick one inside the front cover of each physical copy.</p></div></div>` : ''}
        <div class="label-grid">${copies.map(c => `<div class="qr-label">
          <div class="label-qr" data-qr="${c.id}"></div>
          <b class="mono">${c.id}</b><small>${esc(truncate(b.title, 28))}</small><small class="muted">Shelf ${esc(b.shelf)}</small>
          <button class="btn ghost sm" data-action="downloadLabel" data-id="${c.id}">${icon('download')} PNG</button></div>`).join('')}</div>
      </div></div>
      <div class="sticky-footer"><button class="btn ghost lg" data-action="go" data-to="bookManage" data-id="${b.id}">Manage</button><button class="btn primary lg grow" data-action="printLabels" data-ids="${copies.map(c => c.id).join(',')}">${icon('printer')} Print all</button></div>`;
  },
  mount() { $$('[data-qr]').forEach(el => renderQR(el, el.dataset.qr, 132)); },
};
/** Builds a print-only sheet of labels and opens the browser's print dialog. */
Actions.printLabels = el => {
  const ids = el.dataset.ids.split(',').filter(Boolean);
  const html = ids.map(id => {
    const c = Services.copy(id);
    const b = Services.book(c.bookId);
    const tmp = document.createElement('div');
    renderQR(tmp, c.id, 220);
    const src = qrDataURL(tmp);
    return `<div class="print-label">${src ? `<img src="${src}" alt="">` : ''}<b>${c.id}</b><span>${esc(truncate(b.title, 34))}</span><small>${esc(Store.settings().libraryName)} · Shelf ${esc(b.shelf)}</small></div>`;
  }).join('');
  $('#print-root').innerHTML = `<div class="print-sheet">${html}</div>`;
  setTimeout(() => {
    window.print();
    setTimeout(() => { $('#print-root').innerHTML = ''; }, 800);
  }, 150);
};
