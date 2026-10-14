'use strict';
/* ===========================================================================
 * receipts.js — proof of return and payment.
 *
 * Students keep every receipt in the app (no paper needed). Each receipt shows
 * a QR with an opaque token; staff scan it in "Verify receipt" mode to pull up
 * the record from the system, so disputes ("I returned it", "I paid") are
 * settled against the source of truth rather than a screenshot.
 * ======================================================================== */

const RECEIPT_KIND = {
  RETURN: { label: 'Return receipt', icon: 'undo-2', staffLabel: 'Received by' },
  PAYMENT: { label: 'Payment receipt', icon: 'wallet', staffLabel: 'Recorded by' },
  WAIVER: { label: 'Fine waiver', icon: 'hand-coins', staffLabel: 'Approved by' },
};
function receiptHeadline(r) {
  if (r.type === 'RETURN') return `${plural(r.lines.length, 'book')} returned`;
  return `${money(r.total)} ${r.type === 'WAIVER' ? 'waived' : 'paid'}`;
}
function canSeeReceipt(r) {
  if (!r) return false;
  if (Auth.is('LIBRARIAN', 'ADMIN')) return true;
  return Auth.member()?.id === r.memberId;
}

/** The receipt document itself. Used by the receipt screen and for printing. */
function receiptView(r, { verified = false } = {}) {
  const kind = RECEIPT_KIND[r.type];
  const user = Services.memberUser(r.memberId), member = Services.member(r.memberId);
  const lines = r.type === 'RETURN'
    ? r.lines.map(l => {
      const b = Services.book(l.bookId);
      const late = Math.max(0, daysBetween(l.dueAt, l.returnedAt));
      const fines = Store.filter('fines', f => f.txId === l.txId);
      const status = !fines.length ? '' : fines.every(f => f.status !== 'UNPAID') ? badge('PAID', 'Settled') : badge('UNPAID');
      return `<li class="rcpt-line">${cover(b, 'xs')}
        <div class="grow"><b class="clamp1">${esc(b?.title || 'Removed title')}</b>
          <small class="mono">${esc(l.copyId)}</small>
          <small>${fmtTime(l.returnedAt)} · ${late ? `<span class="text-red">${plural(late, 'day')} late</span>` : 'on time'}${l.condition === 'DAMAGED' ? ' · <span class="text-red">damaged</span>' : ''}</small></div>
        ${FEATURES.fines ? `<div class="col end gap6"><span class="rcpt-amt">${l.fine ? money(l.fine) : '—'}</span>${status}</div>` : badge('RETURNED', l.condition === 'DAMAGED' ? 'Damaged' : 'Checked in')}</li>`;
    }).join('')
    : r.lines.map(l => {
      const b = Services.book(l.bookId);
      return `<li class="rcpt-line"><div class="grow"><b class="clamp1">${esc(b?.title || 'Library fee')}</b>
        <small>${l.reason === 'DAMAGED' ? 'Damage fee' : 'Overdue fine'}${l.note ? ` · ${esc(l.note)}` : ''}</small></div>
        <span class="rcpt-amt">${money(l.amount)}</span></li>`;
    }).join('');
  const totalRow = r.type === 'RETURN'
    ? (FEATURES.fines ? `<div class="rcpt-total"><span>Fines added</span><b>${r.total ? money(r.total) : 'None'}</b></div>` : `<div class="rcpt-total"><span>Books returned</span><b>${r.lines.length}</b></div>`)
    : `<div class="rcpt-total"><span>${r.type === 'WAIVER' ? 'Total waived' : 'Total paid'}</span><b>${money(r.total)}</b></div>`;
  return `<article class="rcpt">
    ${verified ? `<div class="status-strip green">${icon('shield-check')}<div><b>Genuine receipt</b><small>Matches the library’s records. Details below come from the system, not the student’s screen.</small></div></div>` : ''}
    <header class="rcpt-head">
      <span class="rcpt-kind">${icon(kind.icon)} ${kind.label}</span>
      <h2>${receiptHeadline(r)}</h2>
      <small>${esc(Store.settings().libraryName)} · ${fmtDateTime(r.updatedAt)}</small>
    </header>
    <dl class="rcpt-meta">
      <div><dt>Receipt no.</dt><dd class="mono">${esc(r.number)}</dd></div>
      <div><dt>Member</dt><dd>${esc(user?.name || 'Former member')} <span class="muted">${esc(member?.studentId || '')}</span></dd></div>
      <div><dt>${kind.staffLabel}</dt><dd>${esc(Services.user(r.staffUserId)?.name || 'Library staff')}</dd></div>
      ${r.method && r.type === 'PAYMENT' ? `<div><dt>Method</dt><dd>${esc(r.method)}</dd></div>` : ''}
      ${r.reason ? `<div><dt>Reason</dt><dd>${esc(r.reason)}</dd></div>` : ''}
    </dl>
    <ul class="rcpt-lines">${lines}</ul>
    ${totalRow}
    <div class="rcpt-verify"><div class="rcpt-qr" data-receipt-qr="${esc(r.token)}"></div>
      <div><b>Proof of ${r.type === 'RETURN' ? 'return' : 'payment'}</b><small>Staff at any desk can scan this code to confirm the record.</small></div></div>
  </article>`;
}

Screens.receipt = {
  roles: ['STUDENT', 'LIBRARIAN', 'ADMIN'],
  render({ id, verified }) {
    const r = Store.get('receipts', id);
    if (!canSeeReceipt(r)) return Screens.error.render({ code: 404 });
    const staff = Auth.is('LIBRARIAN', 'ADMIN');
    const unpaid = FEATURES.fines && !staff && r.type === 'RETURN' && Store.filter('fines', f => r.lines.some(l => l.txId === f.txId) && f.status === 'UNPAID').length;
    return `${Header({ title: RECEIPT_KIND[r.type].label, subtitle: r.number, back: true })}
      <div class="scroll has-footer"><div class="pad">
        ${receiptView(r, { verified })}
        ${unpaid ? `<div class="callout amber">${icon('wallet')}<div><b>Fines to settle</b><p>Pay at any library counter. You’ll get a payment receipt here.</p></div></div>` : ''}
        ${!staff && r.type === 'RETURN' ? `<p class="fineprint">${icon('info')} Books you return on another day get their own receipt. Books returned together in one visit share a receipt.</p>` : ''}
      </div></div>
      <div class="sticky-footer">
        ${staff ? `<button class="btn ghost lg" data-action="printReceipt">${icon('printer')} Print</button>` : `<button class="btn ghost lg" data-action="shareReceipt" data-id="${r.id}">${icon('share-2')} Share</button>`}
        <button class="btn primary lg grow" data-action="back">Done</button>
      </div>`;
  },
  mount() { $$('[data-receipt-qr]').forEach(el => renderQR(el, QR.receipt(el.dataset.receiptQr), 168)); },
};

/* Receipt history — a student's own, or a member's (for staff). */
Screens.receipts = {
  roles: ['STUDENT', 'LIBRARIAN', 'ADMIN'],
  render({ memberId }) {
    const staff = Auth.is('LIBRARIAN', 'ADMIN');
    // Staff: one member's receipts, or every receipt issued at the desk. Students: only their own.
    const m = staff ? (memberId ? Services.member(memberId) : null) : Auth.member();
    if (!m && !staff) return Screens.error.render({ code: 404 });
    const f = UI.receiptsFilter || 'ALL';
    const all = m ? Services.receiptsOf(m.id) : Store.all('receipts').sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)).slice(0, 100);
    const list = all.filter(r => f === 'ALL' || (f === 'RETURN' ? r.type === 'RETURN' : r.type !== 'RETURN'));
    return `${Header({ title: 'Receipts', subtitle: m ? (staff ? Services.memberName(m.id) : `${all.length} on file`) : 'All members · latest 100', back: true })}
      ${FEATURES.fines ? `<div class="sticky-tools">${segmented('rf', [['ALL', 'All'], ['RETURN', 'Returns'], ['MONEY', 'Payments']], f, 'receiptsFilter')}</div>` : ''}
      <div class="scroll"><div class="pad">
        ${list.length ? list.map(r => `<button class="list-card" data-action="go" data-to="receipt" data-id="${r.id}">
          <span class="lc-ic ${r.type === 'RETURN' ? 'gray' : 'green'}">${icon(RECEIPT_KIND[r.type].icon)}</span>
          <div class="lc-body"><b>${receiptHeadline(r)}</b><small><span class="mono">${esc(r.number)}</span> · ${fmtDate(r.updatedAt)}${m ? '' : ` · ${esc(Services.memberName(r.memberId))}`}</small></div>
          <span class="num">${r.type === 'RETURN' ? (FEATURES.fines && r.total ? `<span class="text-red">${money(r.total)}</span>` : '') : money(r.total)}</span>${icon('chevron-right', 'muted')}</button>`).join('')
          : emptyState({ icon: 'receipt', title: 'No receipts yet', text: FEATURES.fines ? 'Receipts for returns and fine payments appear here automatically.' : 'A receipt appears here each time you return books.' })}
      </div></div>`;
  },
};

Object.assign(Actions, {
  receiptsFilter: el => { UI.receiptsFilter = el.dataset.value; Router.refresh(); },
  /** Open the receipt for a returned loan; older loans without one fall back to loan details. */
  openTxReceipt: el => {
    const r = Services.receiptForTx(el.dataset.id);
    Sheet.closeAll();
    if (r) Router.go('receipt', { id: r.id }); else Actions.loanDetail(el);
  },
  openFineReceipt: el => {
    const r = Services.receiptForFine(el.dataset.id);
    if (r) Router.go('receipt', { id: r.id }); else Toast.show('No receipt on file for this fine', 'info');
  },
  shareReceipt: async el => {
    const r = Store.get('receipts', el.dataset.id);
    const text = `${Store.settings().libraryName} — ${RECEIPT_KIND[r.type].label} ${r.number}: ${receiptHeadline(r)} on ${fmtDateTime(r.updatedAt)}.`;
    try {
      if (navigator.share) await navigator.share({ title: r.number, text });
      else { await navigator.clipboard.writeText(text); Toast.show('Receipt details copied', 'info'); }
    } catch (e) { /* share cancelled */ }
  },
  /** Prints whichever receipt is on screen (page or sheet). */
  printReceipt: () => {
    const r = $('.sheet .rcpt') || $('.screen .rcpt') || $('.sheet .receipt') || $('.screen .receipt');
    if (!r) return;
    $('#print-root').innerHTML = `<div class="print-receipt">${r.outerHTML}</div>`;
    window.print();
    setTimeout(() => { $('#print-root').innerHTML = ''; }, 500);
  },
});
