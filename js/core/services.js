'use strict';
/* ===========================================================================
 * services.js — BUSINESS LOGIC
 *
 * Every borrowing / return / reservation / fine rule lives here as a reusable
 * function. Screens call these functions and never re-implement rules.
 *
 * ⚠ CONCURRENCY NOTE: this prototype runs entirely in one browser, and
 * JavaScript is single-threaded, so "validate then write" inside one function
 * call is atomic here. In production these operations MUST run server-side
 * inside a database transaction with row-level locks
 * (e.g. SELECT … FOR UPDATE on book_copies + borrow_requests) and idempotency
 * keys, so that two librarians at two counters can never check out the same
 * physical copy or process the same request twice.
 * ======================================================================== */

const COPY_STATUS = { AVAILABLE: 'AVAILABLE', BORROWED: 'BORROWED', RESERVED: 'RESERVED', MAINTENANCE: 'MAINTENANCE', LOST: 'LOST' };
const REQ_STATUS = { PENDING: 'PENDING_APPROVAL', APPROVED: 'APPROVED', REJECTED: 'REJECTED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' };
const TX_STATUS = { ACTIVE: 'ACTIVE', RETURNED: 'RETURNED', OVERDUE: 'OVERDUE' };
const ROLES = { ADMIN: 'ADMIN', LIBRARIAN: 'LIBRARIAN', STUDENT: 'STUDENT' };
const CATEGORIES = ['Fiction', 'Science Fiction', 'Fantasy', 'Technology', 'Science', 'Business', 'Self-Help', 'Psychology', 'History', 'Biography'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Other'];

/* QR payload formats. Only opaque random tokens / copy IDs are encoded —
 * never names, emails or other personal data. */
const QR = {
  request: token => `LMS-REQ:${token}`,
  receipt: token => `LMS-RCT:${token}`,
  member: token => `LMS-MEM:${token}`,
  /** Turns any scanned/typed text into a typed payload. */
  parse(text) {
    const t = String(text || '').trim();
    const up = t.toUpperCase();
    let m;
    if ((m = up.match(/^BOOKCOPY-?(\d{1,6})$/))) return { type: 'COPY', id: copyIdFor(+m[1]) };
    if (/^\d{1,6}$/.test(up)) return { type: 'COPY', id: copyIdFor(+up) };
    if (up.startsWith('LMS-REQ:')) return { type: 'REQUEST', token: t.slice(8).trim() };
    if (up.startsWith('LMS-MEM:')) return { type: 'MEMBER', token: t.slice(8).trim() };
    if (/^CR-[A-Z0-9]{6}$/.test(up)) return { type: 'REQUEST_CODE', code: up };
    if (up.startsWith('LMS-RCT:')) return { type: 'RECEIPT', token: t.slice(8).trim() };
    if (/^(RT|PAY|WV)-[A-Z0-9]{6}$/.test(up)) return { type: 'RECEIPT_NO', number: up };
    if (/^STU-\d+$/.test(up)) return { type: 'STUDENT_ID', id: up };
    return { type: 'UNKNOWN', raw: t };
  },
};

/* ===================================================================== */
const Auth = {
  /* ⚠ DEMO-ONLY AUTHENTICATION.
   * Passwords are stored in plain text in localStorage and checked in the
   * browser. This must be replaced by server-side authentication (hashed
   * passwords, HTTP-only session cookies or short-lived JWTs, rate limiting)
   * before any production use. */
  login(identifier, password, remember = true) {
    const id = String(identifier || '').trim().toLowerCase();
    if (!id || !password) return { ok: false, error: 'Enter your email or student ID and password.' };
    let user = Store.find('users', u => u.email.toLowerCase() === id);
    if (!user) {
      const mem = Store.find('members', m => m.studentId.toLowerCase() === id);
      if (mem) user = Store.get('users', mem.userId);
    }
    if (!user || user.password !== password) return { ok: false, error: 'Incorrect email/student ID or password.' };
    if (!user.active) return { ok: false, error: 'This account has been deactivated. Contact the library.' };
    Store.setSession({ userId: user.id, at: iso() }, remember);
    if (user.role === ROLES.STUDENT) Services.log('VISIT', 'Signed in to the library app', null, user.id);
    else Services.log('LOGIN', `${user.name} signed in`, null, user.id);
    return { ok: true, user };
  },
  logout() { Store.clearSession(); },
  current() {
    const s = Store.getSession();
    if (!s) return null;
    const u = Store.get('users', s.userId);
    return u && u.active ? u : null;
  },
  role() { return this.current()?.role || null; },
  member() { const u = this.current(); return u ? Services.memberByUser(u.id) : null; },
  is(...roles) { return roles.includes(this.role()); },
};

/* ===================================================================== */
const Services = {
  /* ---------------- lookups ---------------- */
  user: id => Store.get('users', id),
  member: id => Store.get('members', id),
  book: id => Store.get('books', id),
  copy: id => Store.get('bookCopies', String(id || '').toUpperCase()),
  memberByUser: userId => Store.find('members', m => m.userId === userId),
  memberUser(memberId) { const m = this.member(memberId); return m ? this.user(m.userId) : null; },
  memberName(memberId) { return this.memberUser(memberId)?.name || 'Unknown member'; },
  copiesOf: bookId => Store.filter('bookCopies', c => c.bookId === bookId),
  catalog() { return Store.filter('books', b => !b.archived); },

  availability(bookId) {
    const cs = this.copiesOf(bookId);
    const by = s => cs.filter(c => c.status === s).length;
    const lost = by('LOST');
    const a = { total: cs.length - lost, available: by('AVAILABLE'), borrowed: by('BORROWED'), reserved: by('RESERVED'), maintenance: by('MAINTENANCE'), lost };
    a.isAvailable = a.available > 0;
    return a;
  },
  popularity(bookId) { return Store.count('borrowTransactions', t => t.bookId === bookId); },
  queueFor(bookId) {
    return Store.filter('reservations', r => r.bookId === bookId && r.status === 'WAITING')
      .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  },

  isMembershipValid(m) { return !!m && m.status === 'ACTIVE' && toMs(m.expiresAt) > Date.now(); },
  activeLoans(memberId) { return Store.filter('borrowTransactions', t => t.memberId === memberId && t.status !== TX_STATUS.RETURNED); },
  overdueLoans(memberId) { return Store.filter('borrowTransactions', t => t.memberId === memberId && t.status === TX_STATUS.OVERDUE); },
  activeTxForCopy(copyId) { return Store.find('borrowTransactions', t => t.copyId === copyId && t.status !== TX_STATUS.RETURNED); },
  pendingRequestOf(memberId) { return Store.find('borrowRequests', r => r.memberId === memberId && r.status === REQ_STATUS.PENDING); },
  requestItems(requestId) { return Store.filter('borrowRequestItems', i => i.requestId === requestId); },

  /* ---------------- fines ---------------- */
  /** Fine for a loan as of `at` (defaults to now): days late × daily rate, capped per item. */
  calcFine(tx, at = Date.now()) {
    const p = Store.settings();
    const end = tx.returnedAt ? toMs(tx.returnedAt) : at;
    const days = Math.max(0, daysBetween(tx.dueAt, end));
    const late = end > toMs(tx.dueAt) ? days : 0;
    // With fines switched off, lateness is still tracked (days) but costs nothing.
    return { days: late, amount: FEATURES.fines ? Math.min(late * p.finePerDay, p.maxFinePerItem) : 0 };
  },
  /** Unpaid fine records + fines still accruing on overdue loans. */
  outstanding(memberId) {
    if (!FEATURES.fines) return { unpaid: 0, accruing: 0, total: 0 };
    const unpaid = Store.filter('fines', f => f.memberId === memberId && f.status === 'UNPAID').reduce((s, f) => s + f.amount, 0);
    const accruing = this.overdueLoans(memberId).reduce((s, t) => s + this.calcFine(t).amount, 0);
    return { unpaid, accruing, total: unpaid + accruing };
  },

  /* ---------------- eligibility (single source of truth) ---------------- */
  /**
   * Can this member borrow `extra` more books right now?
   * Used by the cart, request generation AND librarian approval.
   */
  eligibility(memberId, extra = 0) {
    const p = Store.settings();
    const m = this.member(memberId);
    const checks = [];
    const add = (key, label, ok, detail) => checks.push({ key, label, ok, detail });
    if (!m) { add('member', 'Member record', false, 'No member record found'); return { ok: false, checks, errors: ['No member record found'] }; }
    const active = this.activeLoans(memberId);
    const overdue = active.filter(t => t.status === TX_STATUS.OVERDUE);
    const owed = this.outstanding(memberId);
    add('status', 'Membership active', m.status === 'ACTIVE', m.status === 'ACTIVE' ? 'Member in good standing' : `Membership is ${m.status.toLowerCase()}`);
    const expired = toMs(m.expiresAt) <= Date.now();
    add('expiry', 'Membership not expired', !expired, expired ? `Expired on ${fmtDate(m.expiresAt)}` : `Valid until ${fmtDate(m.expiresAt)}`);
    if (p.blockOnOverdue) add('overdue', 'No overdue books', !overdue.length, overdue.length ? `${plural(overdue.length, 'overdue book')} must be returned first` : 'No overdue loans');
    if (FEATURES.fines) add('fines', 'Fines within limit', owed.unpaid <= p.maxUnpaidFines, `${money(owed.unpaid)} unpaid (limit ${money(p.maxUnpaidFines)})`);
    const total = active.length + extra;
    add('limit', 'Borrowing limit', total <= p.maxBorrow, `${active.length} borrowed + ${extra} requested = ${total} of ${p.maxBorrow}`);
    const errors = checks.filter(c => !c.ok).map(c => c.detail);
    return { ok: !errors.length, checks, errors, activeCount: active.length, overdueCount: overdue.length, owed, remaining: Math.max(0, p.maxBorrow - active.length) };
  },

  /** Is this physical copy borrowable by this member right now? */
  copyCheck(copyId, memberId, ignoreRequestId = null) {
    const c = this.copy(copyId);
    if (!c) return { ok: false, error: `No book copy found with ID ${copyId}.` };
    const b = this.book(c.bookId);
    if (!b || b.archived) return { ok: false, copy: c, book: b, error: 'This title has been withdrawn from circulation.' };
    if (c.status === COPY_STATUS.RESERVED) {
      const r = Store.find('reservations', x => x.copyId === c.id && x.status === 'READY');
      if (r && r.memberId === memberId) return { ok: true, copy: c, book: b, reservation: r };
      return { ok: false, copy: c, book: b, error: 'This copy is on hold for another member’s reservation.' };
    }
    if (c.status !== COPY_STATUS.AVAILABLE) {
      const msg = { BORROWED: 'This copy is currently borrowed.', MAINTENANCE: 'This copy is under maintenance.', LOST: 'This copy is marked as lost.' }[c.status];
      return { ok: false, copy: c, book: b, error: msg || 'This copy is not available.' };
    }
    // Soft lock: copy already in another member's pending request
    const held = Store.filter('borrowRequestItems', i => i.copyId === c.id && i.requestId !== ignoreRequestId)
      .map(i => Store.get('borrowRequests', i.requestId))
      .find(r => r && r.status === REQ_STATUS.PENDING && r.memberId !== memberId);
    if (held) return { ok: false, copy: c, book: b, error: 'This copy is held in another member’s pending checkout.' };
    return { ok: true, copy: c, book: b };
  },

  /* ---------------- borrow cart ---------------- */
  cart(memberId) { return (this.member(memberId)?.cart || []).filter(id => this.copy(id)); },

  /** Student scanned a book QR → validate and add to cart. Copy status is NOT changed. */
  addToCart(memberId, rawCopyId) {
    const copyId = String(rawCopyId || '').trim().toUpperCase();
    const m = this.member(memberId);
    if (!m) return { ok: false, error: 'Member record not found.' };
    const cart = this.cart(memberId);
    const chk = this.copyCheck(copyId, memberId);
    if (!chk.copy) return chk;
    if (cart.includes(copyId)) return { ok: false, duplicate: true, copy: chk.copy, book: chk.book, error: 'This copy is already in your cart.' };
    if (!chk.ok) return chk;
    if (this.activeLoans(memberId).some(t => t.bookId === chk.book.id)) return { ok: false, copy: chk.copy, book: chk.book, error: 'You are already borrowing this title.' };
    if (cart.some(id => this.copy(id)?.bookId === chk.book.id)) return { ok: false, copy: chk.copy, book: chk.book, error: 'Another copy of this title is already in your cart.' };
    const el = this.eligibility(memberId, cart.length + 1);
    if (!el.ok) return { ok: false, copy: chk.copy, book: chk.book, error: el.errors[0] };
    Store.update('members', memberId, { cart: [...cart, copyId] });
    return { ok: true, copy: chk.copy, book: chk.book };
  },
  /** Picks the first borrowable copy of a title (Book Details → "Add to cart"). */
  addBookToCart(memberId, bookId) {
    const candidates = this.copiesOf(bookId).filter(c => c.status === 'AVAILABLE' || c.status === 'RESERVED');
    let last = { ok: false, error: 'No copies are available right now.' };
    for (const c of candidates) {
      if (!this.copyCheck(c.id, memberId).ok) continue;
      last = this.addToCart(memberId, c.id);
      if (last.ok || last.duplicate) return last;
      return last;
    }
    return last;
  },
  removeFromCart(memberId, copyId) {
    Store.update('members', memberId, { cart: this.cart(memberId).filter(id => id !== copyId) });
  },
  validateCart(memberId) {
    const items = this.cart(memberId).map(id => ({ id, ...this.copyCheck(id, memberId) }));
    const el = this.eligibility(memberId, items.length);
    const errors = [...el.errors];
    if (!items.length) errors.push('Your cart is empty.');
    items.filter(i => !i.ok).forEach(i => errors.push(`${i.id}: ${i.error}`));
    return { ok: !errors.length, errors, items, eligibility: el };
  },

  /* ---------------- checkout requests ---------------- */
  /** Student taps "Generate Checkout QR". Creates a PENDING_APPROVAL request with an opaque token. */
  createCheckoutRequest(memberId) {
    const v = this.validateCart(memberId);
    if (!v.ok) return { ok: false, error: v.errors[0], errors: v.errors };
    const p = Store.settings();
    // Only one live request per member: supersede any previous pending one.
    const prev = this.pendingRequestOf(memberId);
    if (prev) Store.update('borrowRequests', prev.id, { status: REQ_STATUS.CANCELLED, processedAt: iso() });
    const t = Date.now();
    const req = Store.insert('borrowRequests', {
      code: 'CR-' + randomToken(6),
      token: randomToken(24), // opaque — the QR carries ONLY this token
      memberId, status: REQ_STATUS.PENDING,
      requestedAt: iso(t), expiresAt: iso(t + p.requestExpiryMin * MIN_MS),
      processedAt: null, processedBy: null, rejectReason: null,
    });
    v.items.forEach(i => Store.insert('borrowRequestItems', { requestId: req.id, copyId: i.copy.id, bookId: i.book.id }));
    const name = this.memberName(memberId);
    Store.filter('users', u => u.role === ROLES.LIBRARIAN && u.active).forEach(u =>
      this.notify(u.id, 'REQUEST_NEW', 'New checkout request', `${name} requested ${plural(v.items.length, 'book')} (${req.code}).`, { to: 'requestReview', id: req.id }));
    this.log('REQUEST_CREATED', `${name} generated checkout ${req.code} for ${plural(v.items.length, 'book')}`, req.id);
    return { ok: true, request: req };
  },
  /**
   * Keeps a pending checkout alive while the student is showing the pass, so
   * the QR never dies in the queue. The token is rotated each time, so an old
   * screenshot of the code stops working.
   */
  refreshCheckoutRequest(requestId) {
    const r = Store.get('borrowRequests', requestId);
    if (!r || r.status !== REQ_STATUS.PENDING) return { ok: false };
    const updated = Store.update('borrowRequests', requestId, { token: randomToken(24), expiresAt: iso(Date.now() + Store.settings().requestExpiryMin * MIN_MS) });
    return { ok: true, request: updated };
  },
  cancelRequest(requestId, byUserId) {
    const r = Store.get('borrowRequests', requestId);
    if (!r || r.status !== REQ_STATUS.PENDING) return { ok: false, error: 'Only pending requests can be cancelled.' };
    Store.update('borrowRequests', requestId, { status: REQ_STATUS.CANCELLED, processedAt: iso(), processedBy: byUserId || null });
    this.log('REQUEST_CANCELLED', `Checkout ${r.code} cancelled`, requestId);
    return { ok: true };
  },
  findRequestByScan(text) {
    const p = QR.parse(text);
    if (p.type === 'REQUEST') return Store.find('borrowRequests', r => r.token === p.token);
    if (p.type === 'REQUEST_CODE') return Store.find('borrowRequests', r => r.code === p.code);
    return Store.find('borrowRequests', r => r.token === String(text).trim());
  },

  /** Everything the librarian needs to decide on a request: checks + items. */
  reviewRequest(requestId) {
    const req = Store.get('borrowRequests', requestId);
    if (!req) return null;
    const member = this.member(req.memberId);
    const user = member ? this.user(member.userId) : null;
    const items = this.requestItems(requestId).map(it => {
      const c = this.copyCheck(it.copyId, req.memberId, requestId);
      return { ...it, copy: this.copy(it.copyId), book: this.book(it.bookId), ok: c.ok, issue: c.ok ? null : c.error };
    });
    const checks = [];
    const pending = req.status === REQ_STATUS.PENDING;
    checks.push({ key: 'state', label: 'Request not yet processed', ok: pending, detail: pending ? 'Awaiting approval' : `Already ${req.status.replace('_', ' ').toLowerCase()}${req.processedAt ? ' on ' + fmtDateTime(req.processedAt) : ''}` });
    const notExpired = toMs(req.expiresAt) > Date.now();
    if (pending) checks.push({ key: 'expiry', label: 'QR code still valid', ok: notExpired, detail: notExpired ? `Expires ${fmtTime(req.expiresAt)}` : `Expired at ${fmtTime(req.expiresAt)}` });
    const el = this.eligibility(req.memberId, items.length);
    checks.push(...el.checks);
    const dup = new Set(items.map(i => i.copyId)).size !== items.length;
    checks.push({ key: 'dup', label: 'No duplicate copies', ok: !dup, detail: dup ? 'The same copy appears twice' : `${plural(items.length, 'unique copy', 'unique copies')}` });
    const allAvail = items.length > 0 && items.every(i => i.ok);
    checks.push({ key: 'avail', label: 'All copies available', ok: allAvail, detail: allAvail ? 'Every copy can be checked out' : `${items.filter(i => !i.ok).length} copy issue(s)` });
    const scanned = items.filter(i => i.verifiedAt).length;
    const needScan = Store.settings().requireHandoverScan;
    if (needScan && pending) checks.push({ key: 'handover', label: 'Books scanned at desk', ok: scanned === items.length, waiting: scanned < items.length, detail: `${scanned} of ${items.length} scanned` });
    return { request: req, member, user, items, checks, eligibility: el, ok: checks.every(c => c.ok), scanned, needScan };
  },

  /**
   * Librarian scans a physical book while handing it over. This guarantees the
   * loan is recorded against the copy that actually leaves the building:
   *  - the requested copy            → marked as scanned
   *  - another copy of the same title → the request switches to that copy
   *  - anything else                  → refused
   */
  handoverScan(requestId, rawCopyId, staffUserId) {
    const req = Store.get('borrowRequests', requestId);
    if (!req || req.status !== REQ_STATUS.PENDING) return { ok: false, error: 'This checkout is no longer pending.' };
    const copyId = String(rawCopyId || '').trim().toUpperCase();
    const items = this.requestItems(requestId);
    const exact = items.find(i => i.copyId === copyId);
    if (exact) {
      if (exact.verifiedAt) return { ok: false, duplicate: true, book: this.book(exact.bookId), error: 'Already scanned.' };
      Store.update('borrowRequestItems', exact.id, { verifiedAt: iso(), verifiedBy: staffUserId });
      return { ok: true, book: this.book(exact.bookId), copyId, swapped: false };
    }
    const c = this.copy(copyId);
    if (!c) return { ok: false, error: `No book copy found with ID ${copyId}.` };
    const book = this.book(c.bookId);
    const target = items.find(i => i.bookId === c.bookId && !i.verifiedAt);
    if (!target) {
      return { ok: false, book, error: items.some(i => i.bookId === c.bookId) ? 'This title has already been scanned.' : `“${book?.title}” is not part of this checkout.` };
    }
    const chk = this.copyCheck(copyId, req.memberId, requestId);
    if (!chk.ok) return { ok: false, book, error: chk.error };
    // Same title, different physical copy: record the one actually being lent.
    const from = target.copyId;
    Store.update('borrowRequestItems', target.id, { copyId, verifiedAt: iso(), verifiedBy: staffUserId, swappedFrom: from });
    const m = this.member(req.memberId);
    Store.update('members', m.id, { cart: (m.cart || []).map(id => (id === from ? copyId : id)) });
    this.log('HANDOVER_SWAP', `${req.code}: ${from} → ${copyId} (“${book.title}”)`, requestId, staffUserId);
    return { ok: true, book, copyId, swapped: true, from };
  },

  /**
   * Librarian approves a checkout. Re-validates EVERYTHING immediately before
   * writing, so a request can never be approved twice and a copy can never be
   * lent to two people. Due dates are generated HERE (at approval), not when
   * the student scanned the book.
   */
  approveRequest(requestId, staffUserId) {
    const rv = this.reviewRequest(requestId);
    if (!rv) return { ok: false, error: 'Checkout request not found.' };
    if (!rv.ok) return { ok: false, error: rv.checks.find(c => !c.ok).detail };
    // --- begin "transaction" (server: BEGIN; SELECT … FOR UPDATE) ---
    const p = Store.settings();
    const t = Date.now();
    const dueAt = iso(endOfDay(t + p.loanDays * DAY_MS));
    const txs = rv.items.map(it => {
      Store.update('bookCopies', it.copyId, { status: COPY_STATUS.BORROWED });
      const r = Store.find('reservations', x => x.memberId === rv.member.id && x.bookId === it.bookId && (x.status === 'READY' || x.status === 'WAITING'));
      if (r) Store.update('reservations', r.id, { status: 'FULFILLED' });
      return Store.insert('borrowTransactions', {
        requestId, memberId: rv.member.id, copyId: it.copyId, bookId: it.bookId,
        borrowedAt: iso(t), dueAt, returnedAt: null, status: TX_STATUS.ACTIVE,
        approvedBy: staffUserId, returnedTo: null, condition: null, fineAmount: 0,
        dueSoonNotified: false, overdueNotified: false,
      });
    });
    Store.update('borrowRequests', requestId, { status: REQ_STATUS.APPROVED, processedAt: iso(t), processedBy: staffUserId });
    const approved = new Set(rv.items.map(i => i.copyId));
    Store.update('members', rv.member.id, { cart: this.cart(rv.member.id).filter(id => !approved.has(id)) });
    // --- commit ---
    const titles = rv.items.map(i => `“${i.book.title}”`).join(', ');
    this.notify(rv.user.id, 'CHECKOUT_APPROVED', 'Checkout approved', `${titles} ${rv.items.length > 1 ? 'are' : 'is'} due on ${fmtDate(dueAt)}.`, { to: 'mybooks' });
    this.log('CHECKOUT_APPROVED', `${rv.request.code}: ${plural(rv.items.length, 'book')} → ${rv.user.name}`, requestId, staffUserId);
    return { ok: true, transactions: txs, request: Store.get('borrowRequests', requestId), dueAt };
  },
  rejectRequest(requestId, staffUserId, reason) {
    const r = Store.get('borrowRequests', requestId);
    if (!r) return { ok: false, error: 'Request not found.' };
    if (r.status !== REQ_STATUS.PENDING) return { ok: false, error: `This request was already ${r.status.toLowerCase()}.` };
    Store.update('borrowRequests', requestId, { status: REQ_STATUS.REJECTED, processedAt: iso(), processedBy: staffUserId, rejectReason: reason || 'Rejected at counter' });
    const u = this.memberUser(r.memberId);
    if (u) this.notify(u.id, 'CHECKOUT_REJECTED', 'Checkout rejected', reason || 'Your checkout request was rejected at the counter.', { to: 'mybooks' });
    this.log('REQUEST_REJECTED', `${r.code} rejected for ${u?.name}: ${reason}`, requestId, staffUserId);
    return { ok: true };
  },

  /* ---------------- returns ---------------- */
  /** Look up what will happen if this copy is returned now. */
  previewReturn(rawCopyId) {
    const copyId = String(rawCopyId || '').trim().toUpperCase();
    const copy = this.copy(copyId);
    if (!copy) return { ok: false, error: `No book copy found with ID ${copyId}.` };
    const tx = this.activeTxForCopy(copyId);
    const book = this.book(copy.bookId);
    if (!tx) return { ok: false, copy, book, error: copy.status === 'AVAILABLE' ? 'This copy is not on loan — it may already have been returned.' : `This copy has no active loan (status: ${copy.status}).` };
    const member = this.member(tx.memberId);
    const user = member ? this.user(member.userId) : null;
    return { ok: true, copy, book, tx, member, user, fine: this.calcFine(tx) };
  },
  /**
   * Librarian confirms a return. A copy cannot be returned twice because the
   * active transaction lookup fails once it is RETURNED.
   * condition: 'GOOD' | 'DAMAGED'
   */
  processReturn(copyId, { condition = 'GOOD', note = '', staffUserId, receiptId = null } = {}) {
    const pv = this.previewReturn(copyId);
    if (!pv.ok) return pv;
    const p = Store.settings();
    const t = Date.now();
    const fine = this.calcFine(pv.tx, t);
    const tx = Store.update('borrowTransactions', pv.tx.id, {
      status: TX_STATUS.RETURNED, returnedAt: iso(t), returnedTo: staffUserId, condition, returnNote: note, fineAmount: fine.amount,
    });
    const newFines = [];
    if (fine.amount > 0) newFines.push(Store.insert('fines', { memberId: pv.member.id, txId: tx.id, bookId: pv.book.id, amount: fine.amount, reason: 'OVERDUE', note: `${plural(fine.days, 'day')} late`, status: 'UNPAID', paidAt: null, paidMethod: null, recordedBy: staffUserId }));
    if (FEATURES.fines && condition === 'DAMAGED' && p.damagedFee > 0) newFines.push(Store.insert('fines', { memberId: pv.member.id, txId: tx.id, bookId: pv.book.id, amount: p.damagedFee, reason: 'DAMAGED', note: note || 'Returned damaged', status: 'UNPAID', paidAt: null, paidMethod: null, recordedBy: staffUserId }));
    let copyStatus = COPY_STATUS.AVAILABLE, heldFor = null;
    if (condition === 'DAMAGED') {
      copyStatus = COPY_STATUS.MAINTENANCE;
      Store.update('bookCopies', pv.copy.id, { status: copyStatus, condition: 'DAMAGED', note: note || 'Returned damaged' });
    } else {
      Store.update('bookCopies', pv.copy.id, { status: copyStatus, condition: 'GOOD' });
      heldFor = this.assignToQueue(pv.copy.id);
      if (heldFor) copyStatus = COPY_STATUS.RESERVED;
    }
    const receipt = this.addToReturnReceipt(receiptId, {
      memberId: pv.member.id, staffUserId,
      line: { txId: tx.id, copyId: pv.copy.id, bookId: pv.book.id, returnedAt: iso(t), dueAt: tx.dueAt, condition, fine: newFines.reduce((s, f) => s + f.amount, 0) },
    });
    newFines.forEach(f => this.notify(pv.user.id, 'FINE_ADDED', `Fine added: ${money(f.amount)}`, f.reason === 'DAMAGED' ? `Damage fee for “${pv.book.title}”.` : `“${pv.book.title}” was returned ${f.note}.`, { to: 'fines' }));
    this.log('RETURN_PROCESSED', `${pv.book.title} (${pv.copy.id}) returned by ${pv.user.name}${fine.days ? ` — ${fine.days}d late` : ''}${condition === 'DAMAGED' ? ' — damaged' : ''}`, tx.id, staffUserId);
    return { ok: true, tx, book: pv.book, copy: this.copy(pv.copy.id), member: pv.member, user: pv.user, fine, fines: newFines, copyStatus, heldFor, receipt };
  },

  /* ---------------- receipts (proof of return / payment) ---------------- */
  /*
   * Every return and every payment produces a receipt the student keeps in the
   * app. Each receipt carries an opaque token; its QR (LMS-RCT:<token>) lets
   * any desk pull up the authoritative record, so a screenshot or an edited
   * receipt can't be passed off as genuine.
   */
  RECEIPT_PREFIX: { RETURN: 'RT', PAYMENT: 'PAY', WAIVER: 'WV' },
  RECEIPT_MERGE_MS: 2 * HOUR_MS, // returns at the same desk visit share one receipt
  newReceipt(type, memberId, staffUserId, extra) {
    return Store.insert('receipts', {
      type, number: `${this.RECEIPT_PREFIX[type]}-${randomToken(6)}`, token: randomToken(20),
      memberId, staffUserId, lines: [], total: 0, notificationId: null, ...extra,
    });
  },
  /** Adds a returned book to the open receipt for this visit, or starts a new one. */
  addToReturnReceipt(receiptId, { memberId, staffUserId, line }) {
    let r = receiptId ? Store.get('receipts', receiptId) : null;
    const reusable = r && r.type === 'RETURN' && r.memberId === memberId && Date.now() - toMs(r.createdAt) < this.RECEIPT_MERGE_MS;
    if (!reusable) r = this.newReceipt('RETURN', memberId, staffUserId);
    const lines = [...r.lines, line];
    r = Store.update('receipts', r.id, { lines, total: lines.reduce((s, l) => s + l.fine, 0) });
    // One notification per receipt, kept up to date as books are added.
    const u = this.memberUser(memberId);
    const titles = lines.map(l => `“${this.book(l.bookId)?.title}”`);
    const title = lines.length > 1 ? `Return confirmed · ${lines.length} books` : 'Return confirmed';
    const body = `${titles.join(', ')} ${lines.length > 1 ? 'were' : 'was'} checked in. Receipt ${r.number}.`;
    const link = { to: 'receipt', id: r.id };
    const existing = r.notificationId && Store.get('notifications', r.notificationId);
    if (existing) Store.update('notifications', existing.id, { title, body, read: false, createdAt: iso() });
    else if (u) r = Store.update('receipts', r.id, { notificationId: this.notify(u.id, 'RETURN_CONFIRMED', title, body, link).id });
    return r;
  },
  receiptsOf(memberId) { return Store.filter('receipts', r => r.memberId === memberId).sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)); },
  receiptForTx(txId) { return Store.find('receipts', r => r.type === 'RETURN' && r.lines.some(l => l.txId === txId)); },
  receiptForFine(fineId) { return Store.find('receipts', r => r.type !== 'RETURN' && r.lines.some(l => l.fineId === fineId)); },
  findReceiptByScan(text) {
    const q = QR.parse(text);
    if (q.type === 'RECEIPT') return Store.find('receipts', r => r.token === q.token);
    if (q.type === 'RECEIPT_NO') return Store.find('receipts', r => r.number === q.number);
    return null;
  },

  /* ---------------- reservations ---------------- */
  /** When a copy becomes available, hold it for the next member in the queue. Returns that member or null. */
  assignToQueue(copyId) {
    const c = this.copy(copyId);
    if (!c || c.status !== COPY_STATUS.AVAILABLE) return null;
    const next = this.queueFor(c.bookId)[0];
    if (!next) return null;
    const p = Store.settings();
    Store.update('reservations', next.id, { status: 'READY', copyId, readyAt: iso(), holdUntil: iso(endOfDay(Date.now() + p.reservationHoldDays * DAY_MS)) });
    Store.update('bookCopies', copyId, { status: COPY_STATUS.RESERVED });
    const u = this.memberUser(next.memberId);
    const b = this.book(c.bookId);
    if (u) this.notify(u.id, 'RESERVATION_READY', 'Reservation available', `“${b.title}” is waiting for you. Pick it up within ${plural(p.reservationHoldDays, 'day')}.`, { to: 'mybooks', tab: 'reservations' });
    return this.member(next.memberId);
  },
  reserveBook(memberId, bookId) {
    const m = this.member(memberId);
    const b = this.book(bookId);
    if (!m || !b) return { ok: false, error: 'Not found.' };
    if (!this.isMembershipValid(m)) return { ok: false, error: 'Your membership must be active to reserve books.' };
    if (this.availability(bookId).available > 0) return { ok: false, error: 'Copies are available — add one to your cart instead.' };
    if (Store.find('reservations', r => r.memberId === memberId && r.bookId === bookId && ['WAITING', 'READY'].includes(r.status))) return { ok: false, error: 'You already have a reservation for this title.' };
    if (this.activeLoans(memberId).some(t => t.bookId === bookId)) return { ok: false, error: 'You are currently borrowing this title.' };
    const r = Store.insert('reservations', { memberId, bookId, status: 'WAITING', copyId: null, readyAt: null, holdUntil: null });
    const pos = this.queueFor(bookId).findIndex(x => x.id === r.id) + 1;
    this.notify(this.member(memberId).userId, 'RESERVATION_QUEUED', `You’re #${pos} in the queue`, `We’ll notify you when “${b.title}” is available.`, { to: 'bookDetail', id: bookId });
    this.log('RESERVATION_CREATED', `${this.memberName(memberId)} reserved “${b.title}” (#${pos})`, r.id);
    return { ok: true, reservation: r, position: pos };
  },
  cancelReservation(id, byUserId) {
    const r = Store.get('reservations', id);
    if (!r || !['WAITING', 'READY'].includes(r.status)) return { ok: false, error: 'This reservation cannot be cancelled.' };
    Store.update('reservations', id, { status: 'CANCELLED' });
    if (r.status === 'READY' && r.copyId) {
      Store.update('bookCopies', r.copyId, { status: COPY_STATUS.AVAILABLE });
      this.assignToQueue(r.copyId);
    }
    this.log('RESERVATION_CANCELLED', `Reservation for “${this.book(r.bookId)?.title}” cancelled`, id, byUserId);
    return { ok: true };
  },
  queuePosition(r) { return this.queueFor(r.bookId).findIndex(x => x.id === r.id) + 1; },

  /* ---------------- fines ---------------- */
  /** Settle one or more unpaid fines of a single member in one transaction, issuing one receipt. */
  settleFines(fineIds, staffUserId, { method = 'Cash', waive = false, reason = '' } = {}) {
    const fines = fineIds.map(id => Store.get('fines', id));
    if (!fines.length || fines.some(f => !f || f.status !== 'UNPAID')) return { ok: false, error: 'One or more fines are no longer payable.' };
    const memberId = fines[0].memberId;
    if (fines.some(f => f.memberId !== memberId)) return { ok: false, error: 'Fines must belong to the same member.' };
    const t = iso();
    fines.forEach(f => Store.update('fines', f.id, waive
      ? { status: 'WAIVED', paidAt: t, paidMethod: 'Waived', recordedBy: staffUserId, waiveReason: reason }
      : { status: 'PAID', paidAt: t, paidMethod: method, recordedBy: staffUserId }));
    const total = fines.reduce((s, f) => s + f.amount, 0);
    const receipt = this.newReceipt(waive ? 'WAIVER' : 'PAYMENT', memberId, staffUserId, {
      method: waive ? 'Waived' : method, reason, total,
      lines: fines.map(f => ({ fineId: f.id, bookId: f.bookId, reason: f.reason, note: f.note, amount: f.amount })),
    });
    const u = this.memberUser(memberId);
    if (u) {
      const n = this.notify(u.id, waive ? 'FINE_WAIVED' : 'PAYMENT_RECEIVED', waive ? `Fine waived: ${money(total)}` : `Payment received: ${money(total)}`,
        `${plural(fines.length, 'fine')} ${waive ? 'waived' : `paid by ${method.toLowerCase()}`}. Receipt ${receipt.number}.`, { to: 'receipt', id: receipt.id });
      Store.update('receipts', receipt.id, { notificationId: n.id });
    }
    this.log(waive ? 'FINE_WAIVED' : 'FINE_PAID', `${money(total)} ${waive ? 'waived for' : 'paid by'} ${this.memberName(memberId)}${waive ? '' : ` (${method})`} · ${receipt.number}`, receipt.id, staffUserId);
    return { ok: true, receipt: Store.get('receipts', receipt.id) };
  },
  payFine(fineId, staffUserId, method = 'Cash') { return this.settleFines([fineId], staffUserId, { method }); },
  waiveFine(fineId, staffUserId, reason = '') { return this.settleFines([fineId], staffUserId, { waive: true, reason }); },

  /* ---------------- books & copies ---------------- */
  validateBook(d, editingId = null) {
    const errors = {};
    if (!d.title?.trim()) errors.title = 'Title is required';
    if (!d.author?.trim()) errors.author = 'Author is required';
    const isbn = normalizeISBN(d.isbn);
    if (!isbn) errors.isbn = 'ISBN is required';
    else if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) errors.isbn = 'Enter a 10- or 13-digit ISBN';
    else if (!isValidISBN(isbn)) errors.isbn = 'ISBN checksum is invalid — check the digits';
    else if (Store.find('books', b => normalizeISBN(b.isbn) === isbn && b.id !== editingId)) errors.isbn = 'A book with this ISBN already exists';
    const y = +d.year;
    if (d.year && (!Number.isInteger(y) || y < 1450 || y > new Date().getFullYear() + 1)) errors.year = 'Enter a valid year';
    if (!d.category) errors.category = 'Choose a category';
    if (!editingId) { const n = +d.copies; if (!Number.isInteger(n) || n < 1 || n > 50) errors.copies = 'Between 1 and 50 copies'; }
    return errors;
  },
  createBook(d, staffUserId) {
    const errors = this.validateBook(d);
    if (Object.keys(errors).length) return { ok: false, errors };
    const book = Store.insert('books', {
      title: d.title.trim(), author: d.author.trim(), isbn: normalizeISBN(d.isbn), publisher: d.publisher?.trim() || '',
      year: d.year ? +d.year : null, category: d.category, language: d.language || 'English', description: d.description?.trim() || '',
      shelf: d.shelf?.trim() || 'Unshelved', pages: d.pages ? +d.pages : null, coverData: d.coverData || null, archived: false, featured: false,
      acquiredAt: d.acquiredAt || iso(),
    });
    const copies = this.addCopies(book.id, +d.copies, staffUserId, true).copies;
    this.log('BOOK_CREATED', `Added “${book.title}” with ${plural(copies.length, 'copy', 'copies')}`, book.id, staffUserId);
    return { ok: true, book, copies };
  },
  updateBook(id, d, staffUserId) {
    const errors = this.validateBook(d, id);
    if (Object.keys(errors).length) return { ok: false, errors };
    const patch = {
      title: d.title.trim(), author: d.author.trim(), isbn: normalizeISBN(d.isbn), publisher: d.publisher?.trim() || '',
      year: d.year ? +d.year : null, category: d.category, language: d.language, description: d.description?.trim() || '',
      shelf: d.shelf?.trim() || '', pages: d.pages ? +d.pages : null, acquiredAt: d.acquiredAt || null,
    };
    if (d.coverData !== undefined) patch.coverData = d.coverData;
    const book = Store.update('books', id, patch);
    this.log('BOOK_UPDATED', `Edited “${book.title}”`, id, staffUserId);
    return { ok: true, book };
  },
  /** Each physical copy gets its own unique, QR-encodable identifier. */
  addCopies(bookId, n, staffUserId, silent = false) {
    const copies = [];
    for (let i = 0; i < n; i++) {
      const c = Store.insert('bookCopies', { id: Store.nextCopyId(), bookId, status: COPY_STATUS.AVAILABLE, condition: 'GOOD', note: '', acquiredAt: iso() });
      copies.push(c);
      this.assignToQueue(c.id);
    }
    if (!silent) this.log('COPIES_ADDED', `${plural(n, 'copy', 'copies')} added to “${this.book(bookId)?.title}”`, bookId, staffUserId);
    return { ok: true, copies };
  },
  /** Manual copy status changes (lost / damaged / maintenance / back to shelf). */
  setCopyStatus(copyId, status, note, staffUserId) {
    const c = this.copy(copyId);
    if (!c) return { ok: false, error: 'Copy not found.' };
    if (c.status === COPY_STATUS.BORROWED) return { ok: false, error: 'This copy is on loan. Process the return first.' };
    if (![COPY_STATUS.AVAILABLE, COPY_STATUS.MAINTENANCE, COPY_STATUS.LOST].includes(status)) return { ok: false, error: 'Unsupported status.' };
    if (c.status === COPY_STATUS.RESERVED) {
      const r = Store.find('reservations', x => x.copyId === copyId && x.status === 'READY');
      if (r) Store.update('reservations', r.id, { status: 'WAITING', copyId: null, readyAt: null, holdUntil: null });
    }
    Store.update('bookCopies', copyId, { status, note: note || '', condition: note && /damag/i.test(note) ? 'DAMAGED' : status === 'AVAILABLE' ? 'GOOD' : c.condition });
    if (status === COPY_STATUS.AVAILABLE) this.assignToQueue(copyId);
    this.log('COPY_STATUS', `${copyId} → ${status}${note ? ` (${note})` : ''}`, copyId, staffUserId);
    return { ok: true };
  },
  setArchived(bookId, archived, staffUserId) {
    const b = Store.update('books', bookId, { archived });
    this.log(archived ? 'BOOK_ARCHIVED' : 'BOOK_RESTORED', `“${b.title}” ${archived ? 'archived' : 'restored to catalogue'}`, bookId, staffUserId);
    return { ok: true };
  },
  /** Business rule: a title may only be deleted if it has never circulated. Otherwise archive it. */
  canDeleteBook(bookId) {
    const copyIds = new Set(this.copiesOf(bookId).map(c => c.id));
    if (Store.find('borrowTransactions', t => copyIds.has(t.copyId))) return { ok: false, reason: 'This title has borrowing history. Archive it instead to keep records intact.' };
    if (Store.find('borrowRequestItems', i => i.bookId === bookId)) return { ok: false, reason: 'This title appears in checkout requests. Archive it instead.' };
    if (Store.find('reservations', r => r.bookId === bookId && ['WAITING', 'READY'].includes(r.status))) return { ok: false, reason: 'Members have active reservations for this title.' };
    return { ok: true };
  },
  deleteBook(bookId, staffUserId) {
    const chk = this.canDeleteBook(bookId);
    if (!chk.ok) return { ok: false, error: chk.reason };
    const b = this.book(bookId);
    this.copiesOf(bookId).forEach(c => Store.remove('bookCopies', c.id));
    Store.filter('members', m => (m.cart || []).some(id => !this.copy(id))).forEach(m => Store.update('members', m.id, { cart: m.cart.filter(id => this.copy(id)) }));
    Store.remove('books', bookId);
    this.log('BOOK_DELETED', `Deleted “${b.title}”`, bookId, staffUserId);
    return { ok: true };
  },

  /* ---------------- users & members ---------------- */
  createUser(d, staffUserId) {
    const errors = {};
    if (!d.name?.trim()) errors.name = 'Name is required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) errors.email = 'Enter a valid email';
    else if (Store.find('users', u => u.email.toLowerCase() === d.email.toLowerCase())) errors.email = 'Email already in use';
    if (!d.password || d.password.length < 6) errors.password = 'At least 6 characters';
    if (!Object.values(ROLES).includes(d.role)) errors.role = 'Choose a role';
    if (d.role === ROLES.STUDENT) Object.assign(errors, this.validateIdCard(d.studentId, d.idCardPhoto));
    if (Object.keys(errors).length) return { ok: false, errors };
    const user = Store.insert('users', { name: d.name.trim(), email: d.email.trim().toLowerCase(), password: d.password, role: d.role, phone: d.phone || '', title: d.title || '', active: true });
    if (d.role === ROLES.STUDENT) this.ensureMember(user.id, { ...d, verifiedBy: staffUserId });
    this.log('USER_CREATED', `Created ${d.role.toLowerCase()} account for ${user.name}${d.role === ROLES.STUDENT ? ` (ID card ${normalizeStudentId(d.studentId)})` : ''}`, user.id, staffUserId);
    return { ok: true, user };
  },
  /**
   * Business rule: a library member is only created against a physical student
   * ID card — its number (unique) and a photo of the card, checked by staff.
   */
  validateIdCard(rawId, photo, ignoreMemberId = null) {
    const errors = {};
    const sid = normalizeStudentId(rawId);
    if (!sid) errors.studentId = 'Enter the number printed on the student ID card';
    else if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(sid)) errors.studentId = '4–20 letters, digits or dashes';
    else if (Store.find('members', m => m.studentId === sid && m.id !== ignoreMemberId)) errors.studentId = 'This ID card is already registered to another member';
    if (!photo) errors.idCardPhoto = 'Add a photo of the front of the ID card';
    return errors;
  },
  ensureMember(userId, d = {}) {
    const existing = this.memberByUser(userId);
    if (existing) return existing;
    return Store.insert('members', {
      userId, studentId: normalizeStudentId(d.studentId), program: d.program?.trim() || 'Undeclared', year: +d.year || 1,
      idCardPhoto: d.idCardPhoto || null, idVerifiedBy: d.idCardPhoto ? d.verifiedBy || null : null, idVerifiedAt: d.idCardPhoto ? iso() : null,
      memberToken: randomToken(20), status: 'ACTIVE', joinedAt: iso(), expiresAt: iso(Date.now() + 365 * DAY_MS), cart: [],
    });
  },
  /** Attach / replace the ID card photo on an existing member record. */
  setIdCardPhoto(memberId, photo, staffUserId) {
    Store.update('members', memberId, { idCardPhoto: photo, idVerifiedBy: staffUserId, idVerifiedAt: iso() });
    this.log('MEMBER_ID_CARD', `ID card photo added for ${this.memberName(memberId)}`, memberId, staffUserId);
  },
  updateUser(id, patch, staffUserId) {
    // Turning an account into a student would create a member without an ID card.
    if (patch.role === ROLES.STUDENT && !this.memberByUser(id)) {
      return { ok: false, error: 'Students must be registered with their ID card. Create a new student account instead.' };
    }
    const u = Store.update('users', id, patch);
    this.log(patch.role ? 'ROLE_CHANGED' : 'USER_UPDATED', patch.role ? `${u.name} → ${patch.role}` : `Updated ${u.name}`, id, staffUserId);
    return { ok: true, user: u };
  },
  canDeleteUser(id, currentUserId) {
    if (id === currentUserId) return { ok: false, reason: 'You cannot delete your own account.' };
    const m = this.memberByUser(id);
    if (m && Store.find('borrowTransactions', t => t.memberId === m.id)) return { ok: false, reason: 'This member has borrowing history. Deactivate the account instead.' };
    if (Store.find('borrowTransactions', t => t.approvedBy === id || t.returnedTo === id)) return { ok: false, reason: 'This staff member has processed transactions. Deactivate instead.' };
    return { ok: true };
  },
  deleteUser(id, staffUserId) {
    const chk = this.canDeleteUser(id, staffUserId);
    if (!chk.ok) return { ok: false, error: chk.reason };
    const u = this.user(id), m = this.memberByUser(id);
    if (m) Store.remove('members', m.id);
    Store.remove('users', id);
    this.log('USER_DELETED', `Deleted account ${u.name}`, id, staffUserId);
    return { ok: true };
  },
  setMemberStatus(memberId, status, staffUserId) {
    const m = Store.update('members', memberId, { status });
    this.log('MEMBER_STATUS', `${this.memberName(memberId)} → ${status}`, memberId, staffUserId);
    const u = this.memberUser(memberId);
    if (u) this.notify(u.id, 'SYSTEM', status === 'ACTIVE' ? 'Membership reactivated' : 'Membership suspended', status === 'ACTIVE' ? 'You can borrow books again.' : 'Please contact the library desk.');
    return m;
  },
  renewMembership(memberId, staffUserId) {
    const m = this.member(memberId);
    const base = Math.max(Date.now(), toMs(m.expiresAt));
    Store.update('members', memberId, { expiresAt: iso(base + 365 * DAY_MS) });
    this.log('MEMBER_RENEWED', `${this.memberName(memberId)} renewed until ${fmtDate(base + 365 * DAY_MS)}`, memberId, staffUserId);
  },

  /* ---------------- notifications & audit ---------------- */
  notify(userId, type, title, body, link = null) {
    return Store.insert('notifications', { userId, type, title, body, link, read: false });
  },
  notificationsFor(userId) {
    return Store.filter('notifications', n => n.userId === userId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  },
  unreadCount(userId) { return Store.count('notifications', n => n.userId === userId && !n.read); },
  markRead(id) { Store.update('notifications', id, { read: true }); },
  markAllRead(userId) { Store.filter('notifications', n => n.userId === userId && !n.read).forEach(n => Store.update('notifications', n.id, { read: true })); },
  log(action, detail, entity = null, userId = Auth.current()?.id || null) {
    return Store.insert('auditLogs', { action, detail, entity, userId });
  },

  /* ---------------- time-based status maintenance ---------------- */
  /**
   * Runs before each render: marks loans OVERDUE, expires stale QR requests and
   * reservation holds, and sends due-soon / overdue notifications (once each).
   * On a server this would be a scheduled job.
   */
  refreshStatuses() {
    const p = Store.settings();
    const t = Date.now();
    Store.filter('borrowTransactions', x => x.status !== TX_STATUS.RETURNED).forEach(tx => {
      const b = this.book(tx.bookId);
      const u = this.memberUser(tx.memberId);
      if (toMs(tx.dueAt) < t && tx.status !== TX_STATUS.OVERDUE) {
        Store.update('borrowTransactions', tx.id, { status: TX_STATUS.OVERDUE, overdueNotified: true });
        if (u && !tx.overdueNotified) this.notify(u.id, 'OVERDUE', 'Book overdue', `“${b?.title}” is overdue. Please return it as soon as you can.`, { to: 'mybooks' });
      } else if (tx.status === TX_STATUS.OVERDUE && toMs(tx.dueAt) >= t) {
        Store.update('borrowTransactions', tx.id, { status: TX_STATUS.ACTIVE });
      } else if (p.dueReminders && !tx.dueSoonNotified && tx.status === TX_STATUS.ACTIVE && daysUntil(tx.dueAt) <= p.dueSoonDays) {
        Store.update('borrowTransactions', tx.id, { dueSoonNotified: true });
        if (u) this.notify(u.id, 'DUE_SOON', dueLabel(tx.dueAt), `“${b?.title}” is due on ${fmtDate(tx.dueAt)}.`, { to: 'mybooks' });
      }
    });
    Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING && toMs(r.expiresAt) < t)
      .forEach(r => Store.update('borrowRequests', r.id, { status: REQ_STATUS.EXPIRED }));
    Store.filter('reservations', r => r.status === 'READY' && r.holdUntil && toMs(r.holdUntil) < t).forEach(r => {
      Store.update('reservations', r.id, { status: 'EXPIRED' });
      if (r.copyId && this.copy(r.copyId)?.status === COPY_STATUS.RESERVED) {
        Store.update('bookCopies', r.copyId, { status: COPY_STATUS.AVAILABLE });
        this.assignToQueue(r.copyId);
      }
    });
  },
};

/* ===================================================================== */
/* Statistics — always computed from stored data, never hard-coded.      */
const RANGES = {
  '7d': { label: '7 days', days: 7, bucket: 'day' },
  '30d': { label: '30 days', days: 30, bucket: 'day' },
  '6m': { label: '6 months', days: 182, bucket: 'month' },
  '1y': { label: '1 year', days: 365, bucket: 'month' },
};

const Stats = {
  librarian() {
    const txs = Store.all('borrowTransactions');
    const members = Store.all('members');
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(Date.now() - i * DAY_MS);
      last7.push({
        label: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
        borrowed: txs.filter(t => startOfDay(t.borrowedAt) === d).length,
        returned: txs.filter(t => t.returnedAt && startOfDay(t.returnedAt) === d).length,
      });
    }
    return {
      borrowedToday: txs.filter(t => isToday(t.borrowedAt)).length,
      returnedToday: txs.filter(t => isToday(t.returnedAt)).length,
      pending: Store.count('borrowRequests', r => r.status === REQ_STATUS.PENDING),
      overdue: txs.filter(t => t.status === TX_STATUS.OVERDUE).length,
      activeMembers: members.filter(m => Services.isMembershipValid(m)).length,
      availableCopies: Store.count('bookCopies', c => c.status === COPY_STATUS.AVAILABLE),
      dueToday: txs.filter(t => t.status === TX_STATUS.ACTIVE && isToday(t.dueAt)),
      last7,
    };
  },

  admin(rangeKey = '30d') {
    const R = RANGES[rangeKey];
    const t = Date.now();
    const from = startOfDay(t - (R.days - 1) * DAY_MS);
    const prevFrom = from - R.days * DAY_MS;
    const txs = Store.all('borrowTransactions');
    const inR = (v, a = from, b = t + 1) => v && toMs(v) >= a && toMs(v) < b;
    const visits = Store.filter('auditLogs', l => l.action === 'VISIT');
    const members = Store.all('members');
    const copies = Store.all('bookCopies');
    const delta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);

    const borrowed = txs.filter(x => inR(x.borrowedAt)).length;
    const borrowedPrev = txs.filter(x => inR(x.borrowedAt, prevFrom, from)).length;
    const returned = txs.filter(x => inR(x.returnedAt)).length;
    const returnedPrev = txs.filter(x => inR(x.returnedAt, prevFrom, from)).length;
    const visitors = visits.filter(v => inR(v.createdAt)).length;
    const visitorsPrev = visits.filter(v => inR(v.createdAt, prevFrom, from)).length;
    const newMembers = members.filter(m => inR(m.joinedAt)).length;
    const newMembersPrev = members.filter(m => inR(m.joinedAt, prevFrom, from)).length;
    const pendingFees = Store.filter('fines', f => f.status === 'UNPAID').reduce((s, f) => s + f.amount, 0)
      + txs.filter(x => x.status === TX_STATUS.OVERDUE).reduce((s, x) => s + Services.calcFine(x).amount, 0);

    // time series
    const labels = [], sB = [], sR = [];
    if (R.bucket === 'day') {
      for (let d = from; d <= t; d += DAY_MS) {
        const day = startOfDay(d);
        labels.push(fmtShort(day));
        sB.push(txs.filter(x => startOfDay(x.borrowedAt) === day).length);
        sR.push(txs.filter(x => x.returnedAt && startOfDay(x.returnedAt) === day).length);
      }
    } else {
      const months = R.days > 200 ? 12 : 6;
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        sB.push(txs.filter(x => inR(x.borrowedAt, d.getTime(), e.getTime())).length);
        sR.push(txs.filter(x => inR(x.returnedAt, d.getTime(), e.getTime())).length);
      }
    }
    const weekly = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    txs.filter(x => inR(x.borrowedAt)).forEach(x => { weekly[(new Date(toMs(x.borrowedAt)).getDay() + 6) % 7]++; });

    const byBook = {};
    txs.filter(x => inR(x.borrowedAt)).forEach(x => { byBook[x.bookId] = (byBook[x.bookId] || 0) + 1; });
    const top = Object.entries(byBook).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ book: Services.book(id), count: n })).filter(x => x.book);
    const byCat = {};
    txs.filter(x => inR(x.borrowedAt)).forEach(x => { const c = Services.book(x.bookId)?.category || 'Other'; byCat[c] = (byCat[c] || 0) + 1; });

    return {
      range: R, from,
      cards: {
        borrowed: { value: borrowed, delta: delta(borrowed, borrowedPrev) },
        returned: { value: returned, delta: delta(returned, returnedPrev) },
        overdue: { value: txs.filter(x => x.status === TX_STATUS.OVERDUE).length },
        missing: { value: copies.filter(c => c.status === COPY_STATUS.LOST).length },
        totalBooks: { value: copies.filter(c => c.status !== COPY_STATUS.LOST).length, sub: `${Store.count('books', b => !b.archived)} titles` },
        visitors: { value: visitors, delta: delta(visitors, visitorsPrev) },
        newMembers: { value: newMembers, delta: delta(newMembers, newMembersPrev) },
        pendingFees: { value: pendingFees },
      },
      series: { labels, borrowed: sB, returned: sR },
      weekly,
      top,
      categories: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
      recent: txs.slice().sort((a, b) => toMs(b.borrowedAt) - toMs(a.borrowedAt)).slice(0, 5),
      overdueHistory: txs.filter(x => x.status === TX_STATUS.OVERDUE || (x.returnedAt && inR(x.returnedAt) && toMs(x.returnedAt) > toMs(x.dueAt)))
        .sort((a, b) => toMs(b.dueAt) - toMs(a.dueAt)).slice(0, 6),
      newArrivals: Store.filter('books', b => !b.archived).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 8),
    };
  },

  report(rangeKey = '6m') {
    const R = RANGES[rangeKey];
    const from = startOfDay(Date.now() - (R.days - 1) * DAY_MS);
    const txs = Store.filter('borrowTransactions', x => toMs(x.borrowedAt) >= from);
    const returned = txs.filter(x => x.returnedAt);
    const onTime = returned.filter(x => toMs(x.returnedAt) <= toMs(x.dueAt)).length;
    const avgDays = returned.length ? returned.reduce((s, x) => s + (toMs(x.returnedAt) - toMs(x.borrowedAt)) / DAY_MS, 0) / returned.length : 0;
    const fines = Store.filter('fines', f => toMs(f.createdAt) >= from);
    const byMember = {};
    txs.forEach(x => { byMember[x.memberId] = (byMember[x.memberId] || 0) + 1; });
    const copies = Store.all('bookCopies');
    return {
      loans: txs.length,
      returns: returned.length,
      onTimeRate: returned.length ? Math.round((onTime / returned.length) * 100) : 100,
      avgDays: avgDays.toFixed(1),
      finesCollected: fines.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0),
      finesOutstanding: fines.filter(f => f.status === 'UNPAID').reduce((s, f) => s + f.amount, 0),
      finesWaived: fines.filter(f => f.status === 'WAIVED').reduce((s, f) => s + f.amount, 0),
      utilization: Math.round((copies.filter(c => c.status === 'BORROWED').length / Math.max(1, copies.filter(c => c.status !== 'LOST').length)) * 100),
      topBorrowers: Object.entries(byMember).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ member: Services.member(id), user: Services.memberUser(id), count: n })),
    };
  },
};
