'use strict';
/* ===========================================================================
 * librarian.js — Librarian desk: dashboard, scanner hub (checkout / return /
 * membership / copy lookup), checkout review & approval, return processing,
 * transactions, members, overdue, reservations, fines desk.
 * Admins can use every librarian screen too.
 * ======================================================================== */

const STAFF = ['LIBRARIAN', 'ADMIN'];
/** Right-hand label for an overdue loan: its fine, or — with fines switched off — how late it is. */
const overdueLabel = t => {
  const f = Services.calcFine(t);
  return FEATURES.fines ? `<b class="text-red">${money(f.amount)}</b>` : `<span class="badge red">${f.days}d late</span>`;
};
const returnedLate = t => !!(t && t.returnedAt && toMs(t.returnedAt) > toMs(t.dueAt));

/* ---------------- Dashboard ---------------- */
Screens.libDashboard = {
  roles: STAFF, tab: true, skeleton: 'Dashboard',
  render() {
    const u = Auth.current();
    const s = Stats.librarian();
    const pending = Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING).sort((a, b) => toMs(a.requestedAt) - toMs(b.requestedAt));
    const overdue = Store.filter('borrowTransactions', t => t.status === 'OVERDUE').sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt));
    const recent = Store.filter('borrowTransactions', () => true).sort((a, b) => toMs(b.borrowedAt) - toMs(a.borrowedAt)).slice(0, 4);
    return `<header class="home-header">
        <button class="home-user" data-action="tab" data-to="profile">${avatar(u, 44)}<div><small>${greeting()},</small><b>${esc(u.name.split(' ')[0])}</b></div></button>
        <div class="hdr-actions"><button class="icon-btn" data-action="go" data-to="explore" aria-label="Search catalogue">${icon('search')}</button>
        <button class="icon-btn" data-action="go" data-to="notifications" aria-label="Notifications">${icon('bell')}${Services.unreadCount(u.id) ? `<span class="dot-badge">${Services.unreadCount(u.id)}</span>` : ''}</button></div>
      </header>
      <div class="scroll"><div class="pad">
        <div class="primary-actions">
          <button class="btn primary lg block" data-action="libScan" data-mode="checkout">${icon('scan-line')} Scan checkout QR</button>
          <div class="row gap8">
            <button class="btn ghost grow" data-action="libScan" data-mode="return">${icon('undo-2')} Process return</button>
            <button class="btn ghost grow" data-action="go" data-to="bookForm">${icon('plus')} Add book</button>
          </div>
        </div>
        <div class="metrics c3">
          ${statCard({ label: 'Borrowed today', value: s.borrowedToday, action: 'txFilter', attrs: 'data-value="borrowed"' })}
          ${statCard({ label: 'Returned today', value: s.returnedToday, action: 'txFilter', attrs: 'data-value="returned"' })}
          ${statCard({ label: 'Pending', value: s.pending, action: 'txFilter', attrs: 'data-value="pending"' })}
          ${statCard({ label: 'Overdue', value: s.overdue, warn: true, action: 'go', attrs: 'data-to="overdue"' })}
          ${statCard({ label: 'Active members', value: s.activeMembers, action: 'go', attrs: 'data-to="members"' })}
          ${statCard({ label: 'Available', value: s.availableCopies, action: 'tab', attrs: 'data-to="inventory"' })}
        </div>
        <div class="chart-card">
          <div class="chart-head"><div><h3>Checkouts this week</h3><small>Borrowed vs returned</small></div>
          <div class="legend"><span><i style="background:${CHART.borrowed}"></i>Borrowed</span><span><i style="background:${CHART.returned}"></i>Returned</span></div></div>
          <div class="chart-box sm"><canvas id="lib-chart" aria-label="Checkout statistics chart" role="img"></canvas></div>
        </div>
        ${sectionTitle(`Pending approvals (${pending.length})`, pending.length ? { action: 'txFilter', attrs: 'data-value="pending"' } : null)}
        ${pending.length ? pending.slice(0, 3).map(r => {
          const items = Services.requestItems(r.id);
          const mins = Math.max(0, Math.ceil((toMs(r.expiresAt) - Date.now()) / MIN_MS));
          return `<button class="list-card" data-action="go" data-to="requestReview" data-id="${r.id}">${avatar(Services.memberUser(r.memberId), 40)}
            <div class="lc-body"><b>${esc(Services.memberName(r.memberId))}</b><small>${r.code} · ${plural(items.length, 'book')} · ${relTime(r.requestedAt)}</small></div>
            <span class="badge amber">${mins}m left</span></button>`;
        }).join('') : `<div class="empty-inline">${icon('check-circle-2')} No checkouts waiting</div>`}
        ${s.dueToday.length ? `${sectionTitle(`Due today (${s.dueToday.length})`)}${s.dueToday.map(t => bookRow(Services.book(t.bookId), { sub: esc(Services.memberName(t.memberId)), right: '<span class="badge amber">Today</span>', action: 'txDetail', attrs: `data-id="${t.id}"` })).join('')}` : ''}
        ${sectionTitle('Overdue alerts', overdue.length ? { action: 'go', attrs: 'data-to="overdue"' } : null)}
        ${overdue.length ? overdue.slice(0, 3).map(t => bookRow(Services.book(t.bookId), { sub: `${esc(Services.memberName(t.memberId))} · ${dueLabel(t.dueAt)}`, right: overdueLabel(t), action: 'txDetail', attrs: `data-id="${t.id}"` })).join('') : `<div class="empty-inline">${icon('party-popper')} Nothing overdue</div>`}
        ${sectionTitle('Recent checkouts', { action: 'txFilter', attrs: 'data-value="borrowed"' })}
        ${recent.map(t => bookRow(Services.book(t.bookId), { sub: `${esc(Services.memberName(t.memberId))} · ${relTime(t.borrowedAt)}`, right: badge(t.status), action: 'txDetail', attrs: `data-id="${t.id}"` })).join('')}
      </div></div>`;
  },
  mount() {
    const s = Stats.librarian();
    Charts.make($('#lib-chart'), {
      type: 'bar',
      data: {
        labels: s.last7.map(d => d.label),
        datasets: [
          { label: 'Borrowed', data: s.last7.map(d => d.borrowed), backgroundColor: CHART.borrowed, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.55 },
          { label: 'Returned', data: s.last7.map(d => d.returned), backgroundColor: CHART.returned, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.55 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: Charts.axes() },
    });
  },
};
Actions.txFilter = el => { UI.tx.filter = el.dataset.value; UI.tx.q = ''; Router.go('transactions'); };

/* ---------------- Scanner hub ---------------- */
const SCAN_MODES = {
  checkout: { title: 'Scan checkout QR', sub: 'Student’s checkout pass', icon: 'qr-code', desc: 'Review and approve a student’s borrow request.' },
  return: { title: 'Scan book return', sub: 'QR label inside the book', icon: 'undo-2', desc: 'Check a returned book back in and issue a receipt.' },
  member: { title: 'Scan membership card', sub: 'Student’s digital ID', icon: 'contact', desc: 'Open a member’s record and current loans.' },
  copy: { title: 'Scan book copy', sub: 'Any physical copy label', icon: 'book-copy', desc: 'Look up a copy’s status, borrower and history.' },
  receipt: { title: 'Verify receipt', sub: 'QR on a student’s receipt', icon: 'receipt', desc: 'Confirm a return or payment receipt is genuine.' },
};
Screens.scanHub = {
  roles: STAFF, tab: true,
  render() {
    const pending = Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING);
    return `${Header({ title: 'Scanner', subtitle: 'Choose what to scan', large: true, actions: [bellAction()] })}
      <div class="scroll"><div class="pad">
        <div class="mode-list">
          ${Object.entries(SCAN_MODES).map(([k, m], i) => `<button class="mode-row ${i === 0 ? 'primary' : ''}" data-action="libScan" data-mode="${k}">
            <span class="mode-ic">${icon(m.icon)}</span>
            <span class="grow"><b>${m.title}</b><small>${m.desc}</small></span>
            ${i === 0 && pending.length ? `<span class="badge amber">${pending.length} waiting</span>` : ''}${icon('chevron-right', 'muted')}</button>`).join('')}
        </div>
        ${UI.returnSession.length ? `<button class="banner blue" data-action="go" data-to="returnSession">${icon('undo-2')}<div><b>Return session in progress</b><small>${plural(UI.returnSession.length, 'book')} returned</small></div>${icon('chevron-right')}</button>` : ''}
        ${sectionTitle('Waiting at the counter')}
        ${pending.length ? pending.map(r => `<button class="list-card" data-action="go" data-to="requestReview" data-id="${r.id}">${avatar(Services.memberUser(r.memberId), 40)}
          <div class="lc-body"><b>${esc(Services.memberName(r.memberId))}</b><small>${r.code} · ${plural(Services.requestItems(r.id).length, 'book')} · expires ${fmtTime(r.expiresAt)}</small></div>${icon('chevron-right', 'muted')}</button>`).join('')
          : `<div class="empty-inline">${icon('check-circle-2')} No pending checkout requests</div>`}
        <div class="callout gray">${icon('keyboard')}<div><b>No camera?</b><p>Every scanner accepts typed codes and offers one-tap simulated scans.</p></div></div>
      </div></div>`;
  },
};

/** Opens the scanner overlay in one of the four librarian modes. */
Actions.libScan = el => {
  const mode = el.dataset ? el.dataset.mode : el;
  const m = SCAN_MODES[mode];
  let samples = [];
  if (mode === 'checkout') samples = Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING).map(r => ({ value: QR.request(r.token), label: r.code, sub: Services.memberName(r.memberId) }));
  if (mode === 'return') samples = Store.filter('borrowTransactions', t => t.status !== 'RETURNED').slice(0, 10).map(t => ({ value: t.copyId, label: t.copyId, sub: `${truncate(Services.book(t.bookId)?.title, 16)}${t.status === 'OVERDUE' ? ' · overdue' : ''}` }));
  if (mode === 'member') samples = Store.all('members').slice(0, 10).map(x => ({ value: QR.member(x.memberToken), label: Services.memberName(x.id), sub: x.studentId }));
  if (mode === 'receipt') samples = Store.all('receipts').sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)).slice(0, 8).map(r => ({ value: QR.receipt(r.token), label: r.number, sub: Services.memberName(r.memberId) })).concat([{ value: 'LMS-RCT:FORGEDRECEIPT0000', label: 'Edited receipt', sub: 'forgery demo' }]);
  if (mode === 'copy') samples = Store.all('bookCopies').filter((c, i) => i % 4 === 0).slice(0, 10).map(c => ({ value: c.id, label: c.id, sub: c.status.toLowerCase() }));
  Scanner.open({
    title: m.title, subtitle: m.sub, samples,
    placeholder: { checkout: 'Request code, e.g. CR-8F3K2A', return: 'Copy ID, e.g. BOOKCOPY-000004', member: 'Student ID, e.g. STU-10231', copy: 'Copy ID, e.g. BOOKCOPY-000004', receipt: 'Receipt no., e.g. RT-8K2M4Q' }[mode],
    onResult: text => {
      const q = QR.parse(text);
      if (mode === 'checkout') {
        const r = Services.findRequestByScan(text);
        if (!r) return { ok: false, title: 'Unknown checkout QR', message: q.type === 'COPY' ? 'That’s a book label. Switch to Return or Copy mode.' : 'No checkout request matches this code.' };
        Scanner.close(); Router.go('requestReview', { id: r.id });
        return { close: true };
      }
      if (mode === 'return') {
        if (q.type !== 'COPY') return { ok: false, title: 'Not a book label', message: 'Scan the QR label inside the returned book.' };
        const pv = Services.previewReturn(q.id);
        if (!pv.ok) return { ok: false, title: pv.book ? pv.book.title : 'Copy not found', message: pv.error, book: pv.book };
        Scanner.close(); Router.go('returnReview', { id: q.id });
        return { close: true };
      }
      if (mode === 'receipt') {
        const r = Services.findReceiptByScan(text);
        if (!r) return { ok: false, title: 'Receipt not recognised', message: 'No receipt with this code exists. It may have been edited or come from another library.' };
        Scanner.close(); Router.go('receipt', { id: r.id, verified: true });
        return { close: true };
      }
      if (mode === 'member') {
        let mem = null;
        if (q.type === 'MEMBER') mem = Store.find('members', x => x.memberToken === q.token);
        if (q.type === 'STUDENT_ID') mem = Store.find('members', x => x.studentId === q.id);
        if (!mem) return { ok: false, title: 'Member not found', message: 'This QR is not a valid membership card.' };
        Scanner.close(); Router.go('memberDetail', { id: mem.id });
        return { close: true };
      }
      if (q.type !== 'COPY' || !Services.copy(q.id)) return { ok: false, title: 'Copy not found', message: 'No physical copy matches this code.' };
      Scanner.close(); openCopySheet(q.id);
      return { close: true };
    },
  });
};

/* ---------------- Checkout review & approval ---------------- */
Screens.requestReview = {
  roles: STAFF,
  render({ id }) {
    const rv = Services.reviewRequest(id);
    if (!rv) return Screens.error.render({ code: 404 });
    const { request: r, user, member, items, checks } = rv;
    const p = Store.settings();
    const pending = r.status === REQ_STATUS.PENDING;
    const owed = member ? Services.outstanding(member.id) : { total: 0 };
    const failed = checks.filter(c => !c.ok && c.key !== 'handover').length;
    const scanLeft = rv.needScan && pending ? items.length - rv.scanned : 0;
    const strip = !pending ? ['gray', 'info', `Request ${r.status.replace('_', ' ').toLowerCase()}`]
      : failed ? ['red', 'shield-alert', `${plural(failed, 'check')} failed`]
        : scanLeft ? ['gray', 'scan-line', `Checks passed · scan ${plural(scanLeft, 'book')} to finish`]
          : ['green', 'shield-check', 'Ready to approve'];
    return `${Header({ title: 'Review checkout', subtitle: r.code, back: true })}
      <div class="scroll has-footer"><div class="pad">
        <div class="status-strip ${strip[0]}">
          ${icon(strip[1])}
          <div><b>${strip[2]}</b>
          <small>${pending ? `Requested ${relTime(r.requestedAt)} · expires ${fmtTime(r.expiresAt)}` : `Processed ${fmtDateTime(r.processedAt)}${r.processedBy ? ' by ' + esc(Services.user(r.processedBy)?.name) : ''}`}</small></div>
        </div>
        ${sectionTitle('Student')}
        <button class="member-row card" data-action="go" data-to="memberDetail" data-id="${member?.id}">
          ${avatar(user, 52)}
          <div class="grow"><b>${esc(user?.name)}</b><small class="muted block">${esc(member?.studentId)} · ${esc(member?.program)}</small>
            <div class="row gap6 mt4">${badge(Services.isMembershipValid(member) ? 'ACTIVE' : 'SUSPENDED', Services.isMembershipValid(member) ? 'Active member' : 'Inactive')}<span class="badge gray">${rv.eligibility.activeCount} on loan</span>${owed.total ? `<span class="badge red">${money(owed.total)} owed</span>` : ''}</div></div>
          ${icon('chevron-right', 'muted')}
        </button>
        ${sectionTitle(`Books to hand over (${items.length})`)}
        ${pending && rv.needScan ? `<p class="hint">Scan the label on each book as you hand it over. Any copy of the requested title works — the loan is recorded against the copy you scan.</p>` : ''}
        <div class="stack8">${items.map(i => {
          const state = !pending || !rv.needScan ? ''
            : i.verifiedAt ? `<small class="text-green">${icon('check')} Scanned${i.swappedFrom ? ` · switched from ${esc(i.swappedFrom)}` : ''}</small>`
              : '<small class="muted">Not scanned yet</small>';
          return `<div class="cart-item handover ${i.ok || !pending ? '' : 'bad'} ${i.verifiedAt ? 'done' : ''}">${cover(i.book, 'sm')}
            <div class="grow"><b class="clamp2">${esc(i.book?.title)}</b><small class="mono">${i.copyId}</small><small class="muted">Shelf ${esc(i.book?.shelf)}</small>
            ${pending && !i.ok ? `<small class="text-red">${esc(i.issue)}</small>` : state}</div>
            ${pending && rv.needScan ? `<span class="scan-tick ${i.verifiedAt ? 'on' : ''}">${icon(i.verifiedAt ? 'check' : 'scan-line')}</span>` : badge(i.copy?.status || 'LOST')}</div>`;
        }).join('')}</div>
        ${sectionTitle('Policy validation')}
        <ul class="checks card">${checks.map(checkRow).join('')}</ul>
        ${pending ? `<div class="callout gray">${icon('calendar-clock')}<div><b>If approved now: due ${fmtDate(endOfDay(Date.now() + p.loanDays * DAY_MS))}</b><p>${p.loanDays}-day loan${FEATURES.fines ? ` · ${money(p.finePerDay)}/day late fee` : ' · reminder before the due date'}</p></div></div>` : ''}
      </div></div>
      <div class="sticky-footer">${pending
        ? `<button class="btn danger-ghost lg" data-action="rejectRequest" data-id="${r.id}">${icon('x')} Reject</button>
           ${scanLeft && !failed
             ? `<button class="btn primary lg grow" data-action="handoverScan" data-id="${r.id}">${icon('scan-line')} Scan books (${rv.scanned}/${items.length})</button>`
             : `<button class="btn primary lg grow" data-action="approveRequest" data-id="${r.id}" ${rv.ok ? '' : 'disabled'}>${icon('check')} Approve checkout</button>`}`
        : r.status === REQ_STATUS.APPROVED ? `<button class="btn primary block lg" data-action="go" data-to="checkoutReceipt" data-id="${r.id}">${icon('receipt')} View receipt</button>`
          : `<button class="btn ghost block lg" data-action="back">Back</button>`}</div>`;
  },
};
Object.assign(Actions, {
  /** Opens the scanner so the librarian scans each physical book being handed over. */
  handoverScan: el => {
    const id = el.dataset.id;
    const rv = Services.reviewRequest(id);
    // Simulation chips: the requested copies, a different copy of the same title, and a wrong book.
    const samples = rv.items.map(i => ({ value: i.copyId, label: i.copyId, sub: truncate(i.book?.title, 18) }));
    const alt = rv.items.map(i => Services.copiesOf(i.bookId).find(c => c.id !== i.copyId && Services.copyCheck(c.id, rv.member.id, id).ok)).find(Boolean);
    if (alt) samples.push({ value: alt.id, label: alt.id, sub: 'Other copy · same title' });
    const wrong = Store.find('bookCopies', c => c.status === 'AVAILABLE' && !rv.items.some(i => i.bookId === c.bookId));
    if (wrong) samples.push({ value: wrong.id, label: wrong.id, sub: 'Wrong book (demo)' });
    Scanner.open({
      title: 'Scan books to hand over',
      subtitle: `${rv.user.name} · ${plural(rv.items.length, 'book')}`,
      placeholder: 'Copy ID, e.g. BOOKCOPY-000004',
      samples,
      onResult: text => {
        const q = QR.parse(text);
        if (q.type !== 'COPY') return { ok: false, title: 'Not a book label', message: 'Scan the QR label on the book.' };
        const res = Services.handoverScan(id, q.id, Auth.current().id);
        if (!res.ok) return { ok: false, title: res.book?.title || 'Copy not found', message: res.error, book: res.book };
        const left = Services.reviewRequest(id);
        if (left.scanned === left.items.length) setTimeout(() => { if (Scanner.isOpen()) Scanner.close(); }, 700); // onClose refreshes the review
        return { ok: true, title: res.book.title, message: res.swapped ? `Recorded as ${res.copyId} (instead of ${res.from})` : `${res.copyId} confirmed`, book: res.book };
      },
      footer: () => {
        const r2 = Services.reviewRequest(id);
        return `<button class="btn primary block lg" data-scan-done>${r2.scanned === r2.items.length ? `${icon('check')} All books scanned` : `Done · ${r2.scanned} of ${r2.items.length} scanned`}</button>`;
      },
      onClose: () => Router.refresh(),
    });
    Scanner.el.addEventListener('click', e => { if (e.target.closest('[data-scan-done]')) Scanner.close(); });
  },
  /** Scanning the books is the deliberate step, so approval needs no extra confirmation. */
  approveRequest: el => {
    withLoading(el, () => {
      const res = Services.approveRequest(el.dataset.id, Auth.current().id);
      if (!res.ok) { Toast.show(res.error, 'error', { title: 'Checkout not approved' }); Router.refresh(); return; }
      haptic([20, 40, 20]);
      Router.replace('checkoutReceipt', { id: el.dataset.id, fresh: true });
    }, 400);
  },
  rejectRequest: el => {
    const reasons = ['Student did not present a valid ID', 'Book copy damaged at counter', 'Wrong copy brought to counter', ...(FEATURES.fines ? ['Outstanding fines must be paid first'] : [])];
    Sheet.open({
      title: 'Reject checkout',
      body: `<form id="reject-form" class="form" data-submit="confirmReject" data-id="${el.dataset.id}">
        <p class="muted">Choose a reason. The student will be notified.</p>
        ${reasons.map((r, i) => `<label class="radio-row"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span><i class="radio-dot"></i></label>`).join('')}
        <label class="radio-row"><input type="radio" name="reason" value="other"><span>Other</span><i class="radio-dot"></i></label>
        <div class="field"><label for="rj-note">Note (optional)</label><textarea id="rj-note" name="note" rows="2" placeholder="Add details for the student"></textarea></div>
      </form>`,
      footer: `<button class="btn ghost" data-action="closeSheet">Cancel</button><button class="btn danger" type="submit" form="reject-form">Reject request</button>`,
    });
  },
  confirmReject: form => {
    const d = formData(form);
    const reason = d.reason === 'other' ? (d.note.trim() || 'Rejected at counter') : d.reason + (d.note.trim() ? ` — ${d.note.trim()}` : '');
    const r = Services.rejectRequest(form.dataset.id, Auth.current().id, reason);
    Sheet.close();
    Toast.show(r.ok ? 'The student has been notified' : r.error, r.ok ? 'info' : 'error', { title: r.ok ? 'Checkout rejected' : '' });
    Router.refresh();
  },
});

/* ---------------- Checkout receipt ---------------- */
Screens.checkoutReceipt = {
  roles: STAFF,
  render({ id, fresh }) {
    const r = Store.get('borrowRequests', id);
    if (!r || r.status !== REQ_STATUS.APPROVED) return Screens.error.render({ code: 404 });
    const txs = Store.filter('borrowTransactions', t => t.requestId === id);
    const user = Services.memberUser(r.memberId), member = Services.member(r.memberId);
    return `${Header({ title: 'Checkout receipt', back: true })}
      <div class="scroll has-footer"><div class="pad">
        <div class="result-head">${successMark()}<h2 class="mt8">Checkout complete</h2><p class="muted">${plural(txs.length, 'book')} lent to ${esc(user?.name)}</p></div>
        <div class="receipt">
          <div class="receipt-head"><b>${esc(Store.settings().libraryName)}</b><small>Loan receipt · ${r.code}</small></div>
          ${infoRow('Member', `${esc(user?.name)} <small class="muted">${esc(member?.studentId)}</small>`)}
          ${infoRow('Approved', fmtDateTime(r.processedAt))}
          ${infoRow('Librarian', esc(Services.user(r.processedBy)?.name || '—'))}
          <div class="receipt-items">${txs.map(t => { const b = Services.book(t.bookId); return `<div class="receipt-item"><div><b>${esc(b?.title)}</b><small class="mono">${t.copyId}</small></div><span>Due ${fmtShort(t.dueAt)}</span></div>`; }).join('')}</div>
          <div class="receipt-total"><span>Total books</span><b>${txs.length}</b></div>
          <div class="receipt-total"><span>Due date</span><b>${fmtDate(txs[0]?.dueAt)}</b></div>
        </div>
      </div></div>
      <div class="sticky-footer"><button class="btn ghost lg" data-action="goHome">Done</button><button class="btn primary lg grow" data-action="libScan" data-mode="checkout">${icon('scan-line')} Scan next</button></div>`;
  },
};

/* ---------------- Return review ---------------- */
Screens.returnReview = {
  roles: STAFF,
  render({ id }) {
    const pv = Services.previewReturn(id);
    if (!pv.ok) {
      return `${Header({ title: 'Process return', back: true })}<div class="scroll"><div class="pad">
        ${emptyState({ icon: 'circle-slash', title: 'Cannot process this return', text: pv.error, action: `<button class="btn primary" data-action="libScan" data-mode="return">${icon('scan-line')} Scan another book</button>` })}</div></div>`;
    }
    const { book, copy, tx, user, member, fine } = pv;
    const p = Store.settings();
    const late = fine.days > 0;
    return `${Header({ title: 'Process return', subtitle: copy.id, back: true })}
      <div class="scroll has-footer"><div class="pad">
        <div class="return-book card">${cover(book, 'md')}<div><b>${esc(book.title)}</b><small class="muted block">${esc(book.author)}</small><small class="mono block mt4">${copy.id}</small><div class="mt8">${badge(tx.status)}</div></div></div>
        ${sectionTitle('Borrower')}
        <button class="member-row card" data-action="go" data-to="memberDetail" data-id="${member.id}">${avatar(user, 44)}<div class="grow"><b>${esc(user.name)}</b><small class="muted block">${esc(member.studentId)}</small></div>${icon('chevron-right', 'muted')}</button>
        ${sectionTitle('Loan')}
        <div class="card info-list">
          ${infoRow('Borrowed', fmtDate(tx.borrowedAt), 'calendar')}
          ${infoRow('Due', fmtDate(tx.dueAt), 'calendar-clock')}
          ${infoRow('Returned', 'Today', 'undo-2')}
          ${infoRow('Status', late ? `<span class="text-red">${plural(fine.days, 'day')} overdue</span>` : '<span class="text-green">On time</span>', 'clock')}
        </div>
        ${FEATURES.fines ? `<div class="fine-box ${late ? 'red' : 'green'}">
          <div><small>Overdue fine</small><b>${money(fine.amount)}</b></div>
          <small>${late ? `${fine.days} × ${money(p.finePerDay)}${fine.amount >= p.maxFinePerItem ? ' (capped)' : ''}` : 'No fine — returned on time'}</small>
        </div>` : ''}
        ${sectionTitle('Condition')}
        <form id="return-form" data-submit="confirmReturn" data-id="${copy.id}">
          <div class="cond-grid">
            <label class="cond"><input type="radio" name="condition" value="GOOD" checked><span>${icon('badge-check')}<b>Good</b><small>Back on the shelf</small></span></label>
            <label class="cond"><input type="radio" name="condition" value="DAMAGED"><span>${icon('book-x')}<b>Damaged</b><small>To maintenance${FEATURES.fines ? ` · +${money(p.damagedFee)}` : ''}</small></span></label>
          </div>
          <div class="field mt12"><label for="ret-note">Condition note (optional)</label><input id="ret-note" name="note" placeholder="e.g. torn page 45"></div>
        </form>
        ${Services.queueFor(book.id).length ? `<div class="callout amber">${icon('bookmark')}<div><b>Reservation queue</b><p>This copy will be held for ${esc(Services.memberName(Services.queueFor(book.id)[0].memberId))}.</p></div></div>` : ''}
      </div></div>
      <div class="sticky-footer"><button class="btn primary block lg" type="submit" form="return-form">${icon('check')} Confirm return</button></div>`;
  },
};
Actions.confirmReturn = form => {
  const d = formData(form);
  // Books a student hands over in the same visit go on one receipt.
  const pv = Services.previewReturn(form.dataset.id);
  const open = pv.ok ? UI.returnSession.find(x => x.memberId === pv.tx.memberId) : null;
  withLoading(form.ownerDocument.querySelector('[form="return-form"]'), () => {
    const r = Services.processReturn(form.dataset.id, { condition: d.condition, note: d.note.trim(), staffUserId: Auth.current().id, receiptId: open?.receiptId });
    if (!r.ok) { Toast.show(r.error, 'error', { title: 'Return failed' }); return Router.refresh(); }
    UI.returnSession.unshift({ txId: r.tx.id, copyId: r.copy.id, memberId: r.member.id, receiptId: r.receipt.id, at: iso(), fine: r.fines.reduce((s, f) => s + f.amount, 0), status: r.copyStatus, heldFor: r.heldFor?.id || null });
    haptic([20, 40, 20]);
    Router.replace('returnSession', { last: r.tx.id });
  }, 450);
};

/* ---------------- Return session (multiple returns, grouped per student receipt) ---------------- */
Screens.returnSession = {
  roles: STAFF,
  render({ last }) {
    const list = UI.returnSession;
    const lastTx = last ? Store.get('borrowTransactions', last) : null;
    const lastReceipt = lastTx ? Services.receiptForTx(lastTx.id) : null;
    const total = list.reduce((s, x) => s + x.fine, 0);
    const groups = [];
    list.forEach(x => { let g = groups.find(y => y.receiptId === x.receiptId); if (!g) groups.push(g = { receiptId: x.receiptId, memberId: x.memberId, items: [] }); g.items.push(x); });
    return `${Header({ title: 'Return session', subtitle: `${plural(list.length, 'book')} · ${plural(groups.length, 'receipt')}`, back: true })}
      <div class="scroll has-footer"><div class="pad">
        ${lastTx ? `<div class="result-head">${successMark()}<h2>Return confirmed</h2><p class="muted">“${esc(Services.book(lastTx.bookId)?.title)}” · ${esc(Services.memberName(lastTx.memberId))}</p>
          ${lastReceipt ? `<p class="small muted">Receipt <span class="mono">${esc(lastReceipt.number)}</span> sent to the student’s app</p>` : ''}</div>` : ''}
        <div class="cart-summary"><div><b>${list.length}</b><small>returned</small></div>${FEATURES.fines
          ? `<div><b>${list.filter(x => x.fine > 0).length}</b><small>with fines</small></div><div><b>${money(total)}</b><small>fines added</small></div>`
          : `<div><b>${list.filter(x => returnedLate(Store.get('borrowTransactions', x.txId))).length}</b><small>returned late</small></div><div><b>${groups.length}</b><small>${groups.length === 1 ? 'receipt' : 'receipts'}</small></div>`}</div>
        ${groups.length ? groups.map(g => {
          const rc = Store.get('receipts', g.receiptId);
          return `<section class="session-group">
            <div class="session-head">${avatar(Services.memberUser(g.memberId), 28)}<b class="grow clamp1">${esc(Services.memberName(g.memberId))}</b>
              ${rc ? `<button class="link" data-action="go" data-to="receipt" data-id="${rc.id}">${icon('receipt')} ${esc(rc.number)}</button>` : ''}</div>
            ${g.items.map(x => {
              const t = Store.get('borrowTransactions', x.txId), b = Services.book(t?.bookId);
              return `<div class="list-card">${cover(b, 'xs')}<div class="lc-body"><b class="clamp1">${esc(b?.title)}</b><small>${x.copyId} · ${fmtTime(x.at)}</small>
                <div class="row gap6 mt4">${badge(x.status)}${FEATURES.fines ? (x.fine ? `<span class="badge red">${money(x.fine)}</span>` : '<span class="badge green">No fine</span>') : (returnedLate(t) ? '<span class="badge red">Returned late</span>' : '')}${x.heldFor ? `<span class="badge amber">Held for ${esc(Services.memberName(x.heldFor).split(' ')[0])}</span>` : ''}</div></div></div>`;
            }).join('')}
          </section>`;
        }).join('') : emptyState({ icon: 'undo-2', title: 'No returns yet', text: 'Scan a book’s QR label to start.' })}
      </div></div>
      <div class="sticky-footer"><button class="btn ghost lg" data-action="finishReturns">Finish</button><button class="btn primary lg grow" data-action="libScan" data-mode="return">${icon('scan-line')} Scan next book</button></div>`;
  },
};
Object.assign(Actions, {
  finishReturns: () => { const n = UI.returnSession.length; UI.returnSession = []; if (n) Toast.show(`${plural(n, 'return')} processed`, 'success', { title: 'Session complete' }); Router.reset(); },
});

/* ---------------- Transactions (librarian & admin) ---------------- */
function txItems() {
  const loans = Store.all('borrowTransactions').map(t => ({ kind: 'loan', id: t.id, at: t.returnedAt || t.borrowedAt, status: t.status, rec: t }));
  const reqs = Store.filter('borrowRequests', r => r.status !== REQ_STATUS.APPROVED).map(r => ({ kind: 'req', id: r.id, at: r.processedAt || r.requestedAt, status: r.status, rec: r }));
  const f = UI.tx;
  let list = [...loans, ...reqs];
  const match = {
    all: () => true,
    borrowed: x => x.kind === 'loan' && x.status !== 'RETURNED',
    returned: x => x.kind === 'loan' && x.status === 'RETURNED',
    overdue: x => x.kind === 'loan' && (x.status === 'OVERDUE' || returnedLate(x.rec)),
    pending: x => x.kind === 'req' && x.status === REQ_STATUS.PENDING,
    rejected: x => x.kind === 'req' && x.status === REQ_STATUS.REJECTED,
    expired: x => x.kind === 'req' && (x.status === REQ_STATUS.EXPIRED || x.status === REQ_STATUS.CANCELLED),
  }[f.filter] || (() => true);
  list = list.filter(match);
  const q = f.q.trim().toLowerCase();
  if (q) {
    list = list.filter(x => {
      const name = Services.memberName(x.rec.memberId).toLowerCase();
      if (name.includes(q)) return true;
      if (x.kind === 'loan') {
        const b = Services.book(x.rec.bookId);
        return x.rec.copyId.toLowerCase().includes(q) || (b && b.title.toLowerCase().includes(q));
      }
      return x.rec.code.toLowerCase().includes(q);
    });
  }
  return list.sort((a, b) => toMs(b.at) - toMs(a.at));
}
function txRow(x) {
  if (x.kind === 'loan') {
    const t = x.rec, b = Services.book(t.bookId);
    const returned = t.status === 'RETURNED';
    return `<button class="tx-row" data-action="txDetail" data-id="${t.id}">
      <span class="tx-ic ${returned ? 'blue' : t.status === 'OVERDUE' ? 'red' : 'green'}">${icon(returned ? 'arrow-down-left' : 'arrow-up-right')}</span>
      <div class="lc-body"><b class="clamp1">${esc(b?.title)}</b><small class="clamp1">${esc(Services.memberName(t.memberId))} · <span class="mono">${t.copyId}</span></small></div>
      <div class="col end">${badge(t.status)}<small class="muted">${fmtShort(x.at)}</small></div></button>`;
  }
  const r = x.rec;
  return `<button class="tx-row" data-action="${r.status === REQ_STATUS.PENDING ? 'go' : 'reqDetail'}" data-to="requestReview" data-id="${r.id}">
    <span class="tx-ic ${r.status === REQ_STATUS.PENDING ? 'amber' : 'gray'}">${icon('qr-code')}</span>
    <div class="lc-body"><b>${r.code} · ${plural(Services.requestItems(r.id).length, 'book')}</b><small class="clamp1">${esc(Services.memberName(r.memberId))}${r.rejectReason ? ' · ' + esc(r.rejectReason) : ''}</small></div>
    <div class="col end">${badge(r.status)}<small class="muted">${fmtShort(x.at)}</small></div></button>`;
}
Screens.transactions = {
  roles: STAFF, tab: true, skeleton: 'Transactions',
  render() {
    const f = UI.tx;
    const list = txItems();
    const isTab = Router.stack[0].name === 'transactions';
    return `${Header({ title: 'Transactions', subtitle: `${list.length} records`, large: isTab, back: !isTab, actions: [{ icon: 'download', action: 'exportTx', label: 'Export CSV' }] })}
      <div class="sticky-tools">
        <div class="search-bar">${icon('search')}<input id="tx-q" value="${esc(f.q)}" placeholder="Member, book, copy or request code" aria-label="Search transactions" data-input="txSearch" autocomplete="off"></div>
        ${chips([['all', 'All'], ['borrowed', 'Borrowed'], ['returned', 'Returned'], ['pending', 'Pending'], ['overdue', 'Overdue'], ['rejected', 'Rejected'], ['expired', 'Expired']], f.filter, 'txChip')}
      </div>
      <div class="scroll"><div class="pad" id="tx-list">${renderTxList(list)}</div></div>`;
  },
};
function renderTxList(list = txItems()) {
  if (!list.length) return emptyState({ icon: 'search-x', title: 'No transactions', text: 'Try another filter or search term.' });
  const shown = list.slice(0, UI.tx.limit);
  let html = '', lastDay = '';
  shown.forEach(x => {
    const d = fmtDate(x.at, { weekday: 'short', month: 'short', day: 'numeric' });
    if (d !== lastDay) { html += `<h4 class="group-label">${isToday(x.at) ? 'Today' : d}</h4>`; lastDay = d; }
    html += txRow(x);
  });
  if (list.length > shown.length) html += `<button class="btn ghost block mt12" data-action="txMore">Load more (${list.length - shown.length})</button>`;
  return html;
}
Object.assign(Actions, {
  txChip: el => { UI.tx.filter = el.dataset.value; UI.tx.limit = 40; Router.refresh(); },
  txSearch: debounce(el => { UI.tx.q = el.value; const box = $('#tx-list'); if (box) { box.innerHTML = renderTxList(); refreshIcons(); } }, 150),
  txMore: () => { UI.tx.limit += 40; const box = $('#tx-list'); box.innerHTML = renderTxList(); refreshIcons(); },
  exportTx: () => {
    const rows = [['Transaction', 'Member', 'Student ID', 'Book', 'Copy', 'Borrowed', 'Due', 'Returned', 'Status', FEATURES.fines ? 'Fine' : 'Returned late']];
    Store.all('borrowTransactions').forEach(t => rows.push([t.id, Services.memberName(t.memberId), Services.member(t.memberId)?.studentId, Services.book(t.bookId)?.title, t.copyId, t.borrowedAt, t.dueAt, t.returnedAt || '', t.status, FEATURES.fines ? t.fineAmount || 0 : (returnedLate(t) ? 'yes' : '')]));
    downloadFile('transactions.csv', toCSV(rows), 'text/csv');
    Toast.show('Transactions exported', 'success');
  },
  txDetail: el => {
    const t = Store.get('borrowTransactions', el.dataset.id);
    const b = Services.book(t.bookId), u = Services.memberUser(t.memberId);
    const fine = t.status === 'RETURNED' ? { amount: t.fineAmount, days: 0 } : Services.calcFine(t);
    Sheet.open({
      title: 'Transaction',
      body: `<div class="row gap12 mb12">${cover(b, 'sm')}<div class="grow"><b>${esc(b?.title)}</b><small class="muted block">${esc(b?.author)}</small><div class="mt4">${badge(t.status)}</div></div></div>
        <div class="card info-list">
          ${infoRow('Member', esc(u?.name), 'user')}
          ${infoRow('Copy', `<span class="mono">${t.copyId}</span>`, 'qr-code')}
          ${infoRow('Borrowed', fmtDateTime(t.borrowedAt), 'calendar')}
          ${infoRow('Due', fmtDate(t.dueAt), 'calendar-clock')}
          ${t.returnedAt ? infoRow('Returned', fmtDateTime(t.returnedAt), 'undo-2') : infoRow('Status', dueLabel(t.dueAt), 'clock')}
          ${infoRow('Approved by', esc(Services.user(t.approvedBy)?.name || '—'), 'user-check')}
          ${t.returnedTo ? infoRow('Received by', esc(Services.user(t.returnedTo)?.name || '—'), 'user-check') : ''}
          ${fine.amount ? infoRow('Fine', `<span class="text-red">${money(fine.amount)}</span>`, 'wallet') : ''}
        </div>`,
      footer: t.status !== 'RETURNED'
        ? `<button class="btn ghost" data-action="sendReminder" data-id="${t.id}">${icon('bell-ring')} Remind</button><button class="btn primary grow" data-action="go" data-to="returnReview" data-id="${t.copyId}">${icon('undo-2')} Process return</button>`
        : `<button class="btn ghost" data-action="go" data-to="memberDetail" data-id="${t.memberId}">View member</button>${Services.receiptForTx(t.id) ? `<button class="btn primary grow" data-action="openTxReceipt" data-id="${t.id}">${icon('receipt')} Return receipt</button>` : ''}`,
    });
  },
  reqDetail: el => Actions.requestInfo(el),
  sendReminder: el => {
    const t = Store.get('borrowTransactions', el.dataset.id);
    const b = Services.book(t.bookId), u = Services.memberUser(t.memberId);
    Services.notify(u.id, t.status === 'OVERDUE' ? 'OVERDUE' : 'DUE_SOON', t.status === 'OVERDUE' ? 'Please return your book' : 'Return reminder', `“${b.title}” ${t.status === 'OVERDUE' ? `is ${dueLabel(t.dueAt)}.${FEATURES.fines ? ` Fine so far: ${money(Services.calcFine(t).amount)}.` : ' Please bring it back as soon as you can.'}` : `is due ${fmtDate(t.dueAt)}.`}`, { to: 'mybooks' });
    Services.log('REMINDER_SENT', `Reminder sent to ${u.name} for “${b.title}”`, t.id);
    Sheet.closeAll();
    Toast.show(`Reminder sent to ${u.name}`, 'success');
  },
});

/* ---------------- Members ---------------- */
Screens.members = {
  roles: STAFF,
  render() {
    const q = UI.members.q.toLowerCase();
    const list = Store.all('members').map(m => ({ m, u: Services.user(m.userId) })).filter(x => x.u)
      .filter(x => !q || x.u.name.toLowerCase().includes(q) || x.m.studentId.toLowerCase().includes(q) || x.u.email.toLowerCase().includes(q))
      .sort((a, b) => a.u.name.localeCompare(b.u.name));
    return `${Header({ title: 'Members', subtitle: `${list.length} students`, back: true, actions: [{ icon: 'scan-line', action: 'libScan', attrs: 'data-mode="member"', label: 'Scan membership card' }] })}
      <div class="sticky-tools"><form class="search-bar" data-submit="memberSearch">${icon('search')}<input name="q" value="${esc(UI.members.q)}" placeholder="Name, email or student ID" aria-label="Search members" data-input="memberSearchLive"></form></div>
      <div class="scroll"><div class="pad" id="member-list">${list.map(({ m, u }) => {
        const loans = Services.activeLoans(m.id);
        const od = loans.filter(t => t.status === 'OVERDUE').length;
        return `<button class="list-card" data-action="go" data-to="memberDetail" data-id="${m.id}">${avatar(u, 42)}
          <div class="lc-body"><b>${esc(u.name)}</b><small>${m.studentId} · ${plural(loans.length, 'loan')}${od ? ` · <span class="text-red">${od} overdue</span>` : ''}</small></div>
          ${Services.isMembershipValid(m) ? badge('ACTIVE') : badge('SUSPENDED', m.status === 'SUSPENDED' ? 'Suspended' : 'Expired')}</button>`;
      }).join('') || emptyState({ icon: 'user-x', title: 'No members found' })}</div></div>`;
  },
};
Actions.memberSearch = form => { UI.members.q = form.q.value; Router.refresh(); };
Actions.memberSearchLive = debounce(el => { UI.members.q = el.value; const pos = el.selectionStart; Router.refresh(); const i = $('[data-input="memberSearchLive"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 250);

Screens.memberDetail = {
  roles: STAFF,
  render({ id }) {
    const m = Services.member(id);
    if (!m) return Screens.error.render({ code: 404 });
    const u = Services.user(m.userId);
    const loans = Services.activeLoans(m.id);
    const owed = Services.outstanding(m.id);
    const fines = Store.filter('fines', f => f.memberId === m.id && f.status === 'UNPAID');
    const hist = Store.filter('borrowTransactions', t => t.memberId === m.id && t.status === 'RETURNED').sort((a, b) => toMs(b.returnedAt) - toMs(a.returnedAt));
    const rsv = Store.filter('reservations', r => r.memberId === m.id && ['WAITING', 'READY'].includes(r.status));
    const el = Services.eligibility(m.id, 0);
    const valid = Services.isMembershipValid(m);
    return `${Header({ title: 'Member', back: true })}
      <div class="scroll"><div class="pad">
        <div class="profile-card">
          ${avatar(u, 56)}<h2>${esc(u.name)}</h2><p class="muted">${esc(m.studentId)} · ${esc(m.program)}, Year ${m.year}</p>
          <div class="row-center gap8">${valid ? badge('ACTIVE') : badge('SUSPENDED', m.status === 'SUSPENDED' ? 'Suspended' : 'Membership expired')}<span class="badge gray">Expires ${fmtDate(m.expiresAt)}</span></div>
          <div class="row-center gap8 mt12">
            <a class="btn ghost sm" href="mailto:${esc(u.email)}">${icon('mail')} Email</a>
            <button class="btn ghost sm" data-action="toggleMember" data-id="${m.id}">${icon(m.status === 'ACTIVE' ? 'user-x' : 'user-check')} ${m.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button>
            <button class="btn ghost sm" data-action="renewMember" data-id="${m.id}">${icon('calendar-plus')} Renew</button>
          </div>
        </div>
        <div class="stats-inline">
          <div><b>${loans.length}/${Store.settings().maxBorrow}</b><small>On loan</small></div>
          <div><b>${hist.length}</b><small>Returned</small></div>
          ${FEATURES.fines
            ? `<div><b class="${owed.total ? 'text-red' : ''}">${money(owed.total)}</b><small>Owed</small></div>`
            : `<div><b class="${loans.some(t => t.status === 'OVERDUE') ? 'text-red' : ''}">${loans.filter(t => t.status === 'OVERDUE').length}</b><small>Overdue</small></div>`}
        </div>
        <div class="callout ${el.ok ? 'green' : 'red'}">${icon(el.ok ? 'shield-check' : 'shield-alert')}<div><b>${el.ok ? 'Eligible to borrow' : 'Borrowing blocked'}</b><p>${el.ok ? `${plural(el.remaining, 'slot')} available` : esc(el.errors.join(' · '))}</p></div></div>
        ${sectionTitle('Student ID card')}
        <div class="id-on-file">
          ${m.idCardPhoto
            ? `<button class="id-photo" data-action="viewIdCard" data-id="${m.id}" aria-label="View ID card photo"><img src="${m.idCardPhoto}" alt="ID card of ${esc(u.name)}"></button>
               <div class="grow"><b class="mono">${esc(m.studentId)}</b><small class="muted block">Verified by ${esc(Services.user(m.idVerifiedBy)?.name || 'staff')} · ${fmtDate(m.idVerifiedAt)}</small></div>`
            : `<div class="id-photo"><div class="id-photo-empty">${icon('contact')}</div></div>
               <div class="grow"><b class="mono">${esc(m.studentId)}</b><small class="text-amber block">No card photo on file</small></div>`}
          <label class="btn ghost sm">${icon('camera')} ${m.idCardPhoto ? 'Replace' : 'Add photo'}<input type="file" accept="image/*" capture="environment" class="sr-only" data-change="idCardFile" data-member="${m.id}"></label>
        </div>
        ${sectionTitle(`Current loans (${loans.length})`)}
        ${loans.length ? loans.map(t => bookRow(Services.book(t.bookId), { sub: `${t.copyId} · ${dueLabel(t.dueAt)}`, right: badge(t.status), action: 'txDetail', attrs: `data-id="${t.id}"` })).join('') : `<div class="empty-inline">${icon('book-open')} No active loans</div>`}
        ${!FEATURES.fines ? '' : sectionTitle(`Unpaid fines (${fines.length})`, fines.length > 1 ?{ label: `Record all ${money(fines.reduce((s, f) => s + f.amount, 0))}`, action: 'payFine', attrs: `data-ids="${fines.map(f => f.id).join(',')}"` } : null)}
        ${!FEATURES.fines ? '' : fines.length ? fines.map(f => `<div class="list-card static"><span class="lc-ic red">${icon('wallet')}</span><div class="lc-body"><b class="clamp1">${esc(Services.book(f.bookId)?.title || 'Fee')}</b><small>${f.reason === 'DAMAGED' ? 'Damage fee' : 'Overdue'} · ${fmtShort(f.createdAt)}</small></div><b>${money(f.amount)}</b><button class="btn primary sm" data-action="payFine" data-id="${f.id}">Record</button></div>`).join('') : `<div class="empty-inline">${icon('check-circle-2')} No unpaid fines</div>`}
        ${rsv.length ? `${sectionTitle('Reservations')}${rsv.map(r => bookRow(Services.book(r.bookId), { sub: r.status === 'READY' ? `Held until ${fmtShort(r.holdUntil)}` : `#${Services.queuePosition(r)} in queue`, right: badge(r.status), action: 'go', attrs: `data-to="bookDetail" data-id="${r.bookId}"` })).join('')}` : ''}
        ${sectionTitle('Recent history', { label: `Receipts (${Services.receiptsOf(m.id).length})`, attrs: `data-to="receipts" data-params='{"memberId":"${m.id}"}'` })}
        ${hist.slice(0, 6).map(t => bookRow(Services.book(t.bookId), { sub: `${fmtShort(t.borrowedAt)} → ${fmtShort(t.returnedAt)}`, right: t.fineAmount ? `<span class="badge red">${money(t.fineAmount)}</span>` : returnedLate(t) ? '<span class="badge red">Late</span>' : badge('RETURNED', 'On time'), action: 'txDetail', attrs: `data-id="${t.id}"` })).join('') || `<div class="empty-inline">${icon('history')} No history</div>`}
      </div></div>`;
  },
};
Object.assign(Actions, {
  viewIdCard: el => {
    const m = Services.member(el.dataset.id);
    Sheet.open({
      title: 'Student ID card',
      body: `<img class="id-photo-full" src="${m.idCardPhoto}" alt="ID card of ${esc(Services.memberName(m.id))}">
        <div class="card info-list mt12">${infoRow('Card number', `<span class="mono">${esc(m.studentId)}</span>`)}${infoRow('Name on account', esc(Services.memberName(m.id)))}${infoRow('Verified', `${esc(Services.user(m.idVerifiedBy)?.name || 'Staff')} · ${fmtDate(m.idVerifiedAt)}`)}</div>`,
    });
  },
  toggleMember: async el => {
    const m = Services.member(el.dataset.id);
    const suspend = m.status === 'ACTIVE';
    const ok = await Sheet.confirm({ title: suspend ? 'Suspend membership?' : 'Reactivate membership?', message: suspend ? 'The member will not be able to borrow until reactivated.' : 'The member will be able to borrow again.', confirmText: suspend ? 'Suspend' : 'Activate', danger: suspend, icon: suspend ? 'user-x' : 'user-check' });
    if (!ok) return;
    Services.setMemberStatus(m.id, suspend ? 'SUSPENDED' : 'ACTIVE', Auth.current().id);
    Toast.show(suspend ? 'Membership suspended' : 'Membership activated', suspend ? 'warn' : 'success');
    Router.refresh();
  },
  renewMember: el => { Services.renewMembership(el.dataset.id, Auth.current().id); Toast.show('Membership renewed for 1 year'); Router.refresh(); },
  /** Record payment for one fine (data-id) or several of the same member (data-ids). */
  payFine: el => {
    const ids = el.dataset.ids ? el.dataset.ids.split(',') : [el.dataset.id];
    const fines = ids.map(id => Store.get('fines', id)).filter(f => f && f.status === 'UNPAID');
    if (!fines.length) return Toast.show('Nothing left to pay', 'info');
    const total = fines.reduce((s, f) => s + f.amount, 0);
    const admin = Auth.is('ADMIN');
    Sheet.open({
      title: fines.length > 1 ? `Record payment · ${fines.length} fines` : 'Record payment',
      body: `<div class="balance-card red sm"><small>${esc(Services.memberName(fines[0].memberId))}</small><b>${money(total)}</b>
          <span>${fines.length > 1 ? fines.map(f => `${esc(Services.book(f.bookId)?.title || 'Fee')} ${money(f.amount)}`).join(' · ') : `${fines[0].reason === 'DAMAGED' ? 'Damage fee' : 'Overdue fine'} · ${esc(Services.book(fines[0].bookId)?.title || '')}`}</span></div>
        <form id="pay-form" data-submit="confirmPay" data-ids="${fines.map(f => f.id).join(',')}">
          <h4 class="group-label">Payment method</h4>
          ${['Cash', 'Card', 'Campus wallet'].map((m, i) => `<label class="radio-row"><input type="radio" name="method" value="${m}" ${i === 0 ? 'checked' : ''}><span>${m}</span><i class="radio-dot"></i></label>`).join('')}
          <p class="hint mt8">The student gets a receipt in their app straight away.</p>
        </form>`,
      footer: `${admin ? `<button class="btn ghost" data-action="waiveFine" data-ids="${fines.map(f => f.id).join(',')}">Waive</button>` : ''}<button class="btn primary grow" type="submit" form="pay-form">${icon('check')} Record ${money(total)}</button>`,
    });
  },
  confirmPay: form => {
    const r = Services.settleFines(form.dataset.ids.split(','), Auth.current().id, { method: form.method.value });
    Sheet.close();
    if (!r.ok) { Toast.show(r.error, 'error'); return Router.refresh(); }
    haptic([20, 40, 20]);
    Toast.show(`Receipt ${r.receipt.number} sent to the student`, 'success', { title: 'Payment recorded' });
    Router.go('receipt', { id: r.receipt.id });
  },
  waiveFine: async el => {
    Sheet.close();
    const ids = el.dataset.ids.split(',');
    const ok = await Sheet.confirm({ title: ids.length > 1 ? `Waive ${ids.length} fines?` : 'Waive this fine?', message: 'The amount is written off, logged, and the student receives a waiver receipt.', confirmText: 'Waive', icon: 'hand-coins' });
    if (!ok) return;
    const r = Services.settleFines(ids, Auth.current().id, { waive: true, reason: 'Waived at desk' });
    if (!r.ok) { Toast.show(r.error, 'error'); return Router.refresh(); }
    Toast.show(`Waiver receipt ${r.receipt.number} issued`, 'info');
    Router.go('receipt', { id: r.receipt.id });
  },
});

/* ---------------- Overdue ---------------- */
Screens.overdue = {
  roles: STAFF,
  render() {
    const list = Store.filter('borrowTransactions', t => t.status === 'OVERDUE').sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt));
    const total = list.reduce((s, t) => s + Services.calcFine(t).amount, 0);
    return `${Header({ title: 'Overdue books', subtitle: `${plural(list.length, 'loan')}${FEATURES.fines ? ` · ${money(total)} accrued` : ''}`, back: true, actions: list.length ? [{ icon: 'bell-ring', action: 'remindAll', label: 'Remind all' }] : [] })}
      <div class="scroll"><div class="pad stack10">
        ${list.length ? list.map(t => {
          const b = Services.book(t.bookId), u = Services.memberUser(t.memberId), f = Services.calcFine(t);
          return `<div class="overdue-card">
            <div class="row gap12">${cover(b, 'sm')}<div class="grow"><b class="clamp1">${esc(b.title)}</b><small class="muted block">${t.copyId}</small>
              <div class="row gap8 mt4">${avatar(u, 22)}<small>${esc(u.name)}</small></div></div>
              <div class="col end"><span class="badge red">${f.days}d late</span>${FEATURES.fines ? `<b class="text-red mt4">${money(f.amount)}</b>` : ''}</div></div>
            <div class="row gap8 mt12"><button class="btn ghost sm grow" data-action="sendReminder" data-id="${t.id}">${icon('bell-ring')} Remind</button><button class="btn primary sm grow" data-action="go" data-to="returnReview" data-id="${t.copyId}">${icon('undo-2')} Return</button></div>
          </div>`;
        }).join('') : emptyState({ icon: 'party-popper', title: 'Nothing overdue', text: 'All loans are within their due dates.' })}
      </div></div>`;
  },
};
Actions.remindAll = () => {
  const list = Store.filter('borrowTransactions', t => t.status === 'OVERDUE');
  list.forEach(t => {
    const u = Services.memberUser(t.memberId), b = Services.book(t.bookId);
    Services.notify(u.id, 'OVERDUE', 'Please return your book', `“${b.title}” is ${dueLabel(t.dueAt)}.${FEATURES.fines ? ` Fine so far: ${money(Services.calcFine(t).amount)}.` : ' Please bring it back as soon as you can.'}`, { to: 'mybooks' });
  });
  Services.log('REMINDER_SENT', `Overdue reminders sent for ${plural(list.length, 'loan')}`);
  Toast.show(`${plural(list.length, 'reminder')} sent`);
};

/* ---------------- Reservations ---------------- */
Screens.reservations = {
  roles: STAFF,
  render() {
    const live = Store.filter('reservations', r => ['WAITING', 'READY'].includes(r.status));
    const byBook = {};
    live.forEach(r => { (byBook[r.bookId] = byBook[r.bookId] || []).push(r); });
    return `${Header({ title: 'Reservation queues', subtitle: `${live.length} active`, back: true })}
      <div class="scroll"><div class="pad stack10">
        ${Object.keys(byBook).length ? Object.entries(byBook).map(([bookId, rs]) => {
          const b = Services.book(bookId), a = Services.availability(bookId);
          rs.sort((x, y) => (x.status === 'READY' ? -1 : 0) - (y.status === 'READY' ? -1 : 0) || toMs(x.createdAt) - toMs(y.createdAt));
          return `<div class="card">
            <div class="row gap12">${cover(b, 'xs')}<div class="grow"><b class="clamp1">${esc(b.title)}</b><small class="muted">${a.available}/${a.total} available · ${a.borrowed} on loan</small></div></div>
            <ol class="queue">${rs.map(r => `<li><span class="q-pos">${r.status === 'READY' ? icon('check') : Services.queuePosition(r)}</span>
              <div class="grow"><b>${esc(Services.memberName(r.memberId))}</b><small>${r.status === 'READY' ? `${r.copyId} held until ${fmtShort(r.holdUntil)}` : `Since ${fmtShort(r.createdAt)}`}</small></div>
              ${badge(r.status)}<button class="icon-btn sm danger" data-action="staffCancelRsv" data-id="${r.id}" aria-label="Cancel reservation">${icon('x')}</button></li>`).join('')}</ol>
          </div>`;
        }).join('') : emptyState({ icon: 'bookmark', title: 'No active reservations', text: 'Students can reserve titles when every copy is on loan.' })}
      </div></div>`;
  },
};
Actions.staffCancelRsv = async el => {
  const ok = await Sheet.confirm({ title: 'Cancel reservation?', message: 'If a copy was held, it passes to the next member in the queue.', confirmText: 'Cancel reservation', danger: true, icon: 'bookmark-x' });
  if (!ok) return;
  const r = Services.cancelReservation(el.dataset.id, Auth.current().id);
  Toast.show(r.ok ? 'Reservation cancelled' : r.error, r.ok ? 'info' : 'error');
  Router.refresh();
};

/* ---------------- Fines desk ---------------- */
// Only registered when fines are enabled (MVP ships without money).
if (FEATURES.fines) Screens.finesDesk = {
  roles: STAFF,
  render() {
    const tab = UI.fines;
    const all = Store.all('fines').sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const unpaid = all.filter(f => f.status === 'UNPAID');
    const list = tab === 'UNPAID' ? unpaid : all.filter(f => f.status !== 'UNPAID').slice(0, 60);
    const total = unpaid.reduce((s, f) => s + f.amount, 0);
    const collected = all.filter(f => f.status === 'PAID' && toMs(f.paidAt) > Date.now() - 30 * DAY_MS).reduce((s, f) => s + f.amount, 0);
    return `${Header({ title: 'Fines & payments', back: true })}
      <div class="scroll"><div class="pad">
        <div class="metrics c2">
          ${statCard({ label: 'Outstanding', value: money(total), warn: true, sub: plural(unpaid.length, 'fine') })}
          ${statCard({ label: 'Collected (30d)', value: money(collected) })}
        </div>
        ${segmented('fines', [['UNPAID', 'Unpaid'], ['SETTLED', 'Paid & waived']], tab, 'finesTab')}
        <div class="stack8 mt12">${list.length ? list.map(f => `<div class="list-card static">${avatar(Services.memberUser(f.memberId), 38)}
          <div class="lc-body"><b class="clamp1">${esc(Services.memberName(f.memberId))}</b><small class="clamp1">${f.reason === 'DAMAGED' ? 'Damage' : 'Overdue'} · ${esc(Services.book(f.bookId)?.title || '')}</small><small class="muted">${f.status === 'UNPAID' ? fmtShort(f.createdAt) : `${f.paidMethod} · ${fmtShort(f.paidAt)}`}</small></div>
          <div class="col end gap6"><b>${money(f.amount)}</b>${f.status === 'UNPAID' ? `<button class="btn primary sm" data-action="payFine" data-id="${f.id}">Record</button>` : badge(f.status)}</div></div>`).join('')
          : emptyState({ icon: 'wallet', title: tab === 'UNPAID' ? 'No unpaid fines' : 'No payments yet' })}</div>
      </div></div>`;
  },
};
Actions.finesTab = el => { UI.fines = el.dataset.value; Router.refresh(); };