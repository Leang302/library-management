(async () => {
  const log = window.__log || [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const assert = (c, m) => { if (!c) throw new Error('ASSERT FAILED: ' + m); log.push('ok  ' + m); };
  const q = s => document.querySelector(s);
  const click = s => { const el = q(s); if (!el) throw new Error('missing element ' + s); el.click(); };
  const screenErr = () => { const e = q('.error-code'); return e ? e.textContent + ' ' + (q('.empty p')?.textContent || '') : null; };
  try {
    localStorage.clear(); sessionStorage.clear();
    Seed.run(); UI.visited = {}; Router.reset('login'); await sleep(150);
    assert(q('.login-form'), 'login renders');

    // wrong password
    const f = q('.login-form'); f.identifier.value = 'student@library.com'; f.password.value = 'nope';
    f.requestSubmit(); await sleep(800);
    assert(!Auth.current() && q('[data-err=password]').textContent.length > 0, 'bad password rejected with inline error');

    // ---------------- STUDENT ----------------
    click('[data-email="student@library.com"]'); await sleep(900);
    assert(Auth.role() === 'STUDENT', 'student logged in via demo account');
    await sleep(500);
    assert(q('[data-screen="home"]') && !screenErr(), 'student home renders');
    const mem = Auth.member();
    // login by student id
    Auth.logout(); assert(Auth.login('STU-10231', 'student123', true).ok, 'login by student ID works');

    Router.tab('explore'); await sleep(500);
    UI.explore.q = 'atomic'; Router.refresh(); await sleep(50);
    assert(q('#explore-results').textContent.includes('Atomic Habits'), 'explore search finds Atomic Habits');
    UI.explore.q = '9780735211292'; UI.explore.scope = 'isbn'; Router.refresh();
    assert(q('#explore-results').textContent.includes('Atomic Habits'), 'ISBN search');
    UI.explore.q = ''; UI.explore.scope = 'all';

    // unavailable book: cannot add, can reserve (Project Hail Mary bk_07 all borrowed; Alex already in queue)
    const phm = Services.addBookToCart(mem.id, 'bk_07');
    assert(!phm.ok, 'cannot add unavailable title to cart: ' + phm.error);

    // scan flow
    Actions.studentScan(); await sleep(100);
    assert(Scanner.isOpen(), 'scanner opens');
    const chips = [...document.querySelectorAll('[data-scan-sample]')];
    chips[0].click(); await sleep(50);
    assert(Services.cart(mem.id).length === 1, 'scan adds copy to cart');
    assert(Services.copy(chips[0].dataset.scanSample).status === 'AVAILABLE', 'copy status unchanged after scan (not BORROWED yet)');
    chips[0].click(); await sleep(50);
    assert(Services.cart(mem.id).length === 1 && q('.scan-result.bad'), 'duplicate scan rejected');
    const borrowedChip = chips.find(c => c.textContent.includes('error demo'));
    borrowedChip.click(); await sleep(50);
    assert(Services.cart(mem.id).length === 1, 'borrowed copy cannot be added');
    // second distinct title
    const second = chips.find(c => Services.copy(c.dataset.scanSample)?.bookId !== Services.copy(chips[0].dataset.scanSample).bookId && !c.textContent.includes('error demo'));
    second.click(); await sleep(50);
    assert(Services.cart(mem.id).length === 2, 'second book added (multi-scan)');
    // third would exceed limit (Alex has 1 active, max 3)
    const third = chips.find(c => ![chips[0], second].includes(c) && !c.textContent.includes('error demo') && Services.copy(c.dataset.scanSample)?.bookId !== Services.copy(chips[0].dataset.scanSample).bookId && Services.copy(c.dataset.scanSample)?.bookId !== Services.copy(second.dataset.scanSample).bookId);
    third.click(); await sleep(50);
    assert(Services.cart(mem.id).length === 2, 'borrowing limit enforced at scan time');
    click('[data-scan-cart]'); await sleep(450);
    assert(Router.current().name === 'cart' && !Scanner.isOpen(), 'cart opens from scanner');
    assert(document.querySelectorAll('.cart-item').length === 2, 'cart lists 2 items');

    click('[data-action="generateCheckout"]'); await sleep(1100);
    assert(Router.current().name === 'checkoutQR', 'checkout QR screen shown');
    const reqId = Router.current().params.id;
    const req = Store.get('borrowRequests', reqId);
    assert(req.status === 'PENDING_APPROVAL' && req.token.length === 24, 'request PENDING_APPROVAL with opaque token');
    assert(q('#checkout-qr canvas') || q('#checkout-qr img'), 'QR code rendered');
    assert(!JSON.stringify(req).includes('Alex') && QR.request(req.token).indexOf('@') < 0, 'QR payload contains no personal data');
    const items = Services.requestItems(reqId);
    assert(items.length === 2, 'request has 2 items');

    // ---------------- LIBRARIAN ----------------
    loginAs('LIBRARIAN'); Router.reset(); await sleep(600);
    assert(q('[data-screen="libDashboard"]') && !screenErr(), 'librarian dashboard renders');
    assert(q('#lib-chart') && Charts.list.length === 1, 'librarian chart created');
    Actions.libScan('checkout'); await sleep(80);
    Scanner.handle('LMS-REQ:WRONGTOKEN', true); await sleep(50);
    assert(q('.scan-result.bad'), 'unknown checkout QR rejected');
    Scanner.handle(QR.request(req.token), true); await sleep(450);
    assert(Router.current().name === 'requestReview' && !screenErr(), 'request review opens from scan');
    assert(document.querySelectorAll('.check-row.ok').length >= 6 && !q('.check-row.bad') && q('.check-row.wait') && !Services.reviewRequest(reqId).ok, 'policy checks pass; scanning shows as a pending step, not a failure');
    assert(!q('[data-action="approveRequest"]') && q('[data-action="handoverScan"]'), 'primary action is "Scan books" until every book is scanned');
    assert(!Services.approveRequest(reqId, 'usr_lib1').ok, 'cannot approve before scanning the books');
    // hand-over: scan a wrong book, then a different copy of the first title, then the second book
    click('[data-action="handoverScan"]'); await sleep(80);
    const wrongCopy = Store.find('bookCopies', c => c.status === 'AVAILABLE' && !items.some(i => i.bookId === c.bookId));
    Scanner.handle(wrongCopy.id, true); await sleep(40);
    assert(q('.scan-result.bad') && Services.reviewRequest(reqId).scanned === 0, 'scanning a book that is not in the checkout is refused');
    const altCopy = Services.copiesOf(items[0].bookId).find(c => c.id !== items[0].copyId && Services.copyCheck(c.id, mem.id, reqId).ok);
    Scanner.handle(altCopy ? altCopy.id : items[0].copyId, true); await sleep(40);
    if (altCopy) assert(Services.requestItems(reqId).some(i => i.copyId === altCopy.id && i.swappedFrom === items[0].copyId), 'different copy of the same title is swapped in');
    Scanner.handle(items[1].copyId, true); await sleep(900);
    assert(!Scanner.isOpen() && Services.reviewRequest(reqId).ok, 'scanner closes itself once every book is scanned');
    click('[data-action="approveRequest"]'); await sleep(900);
    assert(Router.current().name === 'checkoutReceipt', 'receipt after approval');
    assert(Store.get('borrowRequests', reqId).status === 'APPROVED', 'request APPROVED');
    const handed = Services.requestItems(reqId);
    const copyId = handed[0].copyId; // the copy actually handed over (may differ from the one the student scanned)
    assert(Services.copy(copyId).status === 'BORROWED', 'copy BORROWED after approval');
    const tx = Services.activeTxForCopy(copyId);
    assert(tx && daysBetween(tx.borrowedAt, tx.dueAt) === Store.settings().loanDays, 'due date = approval + 14 days');
    assert(Services.cart(mem.id).length === 0, 'student cart cleared');
    assert(!Services.approveRequest(reqId, 'usr_lib1').ok, 'checkout cannot be approved twice');
    assert(Store.count('notifications', n => n.userId === 'usr_stu1' && n.type === 'CHECKOUT_APPROVED' && !n.read) === 1, 'student notified of approval');

    // concurrency guard: two members, same copy
    const free = Store.find('bookCopies', c => c.status === 'AVAILABLE' && Services.copyCheck(c.id, 'mem_2').ok);
    Store.update('members', 'mem_4', { cart: [] });
    Store.update('members', 'mem_2', { cart: [] });
    // mem_2 already at limit? use mem_4 (Emma: 2 active of 3) and mem_8 (Ethan: 1 active)
    const rA = Services.addToCart('mem_4', free.id); assert(rA.ok, 'member A adds copy');
    const reqA = Services.createCheckoutRequest('mem_4'); assert(reqA.ok, 'member A request');
    const rB = Services.addToCart('mem_8', free.id); assert(!rB.ok, 'member B blocked by soft lock: ' + rB.error);
    // force B's cart with same copy (simulating a race) and create raw request
    Store.update('members', 'mem_8', { cart: [free.id] });
    const reqB = Services.createCheckoutRequest('mem_8'); assert(!reqB.ok, 'member B cannot create request for held copy');
    Services.requestItems(reqA.request.id).forEach(i => Services.handoverScan(reqA.request.id, i.copyId, 'usr_lib1'));
    assert(Services.approveRequest(reqA.request.id, 'usr_lib1').ok, 'A approved');
    // now B's raw request would fail at approval
    const rawB = Store.insert('borrowRequests', { code: 'CR-RACE01', token: randomToken(24), memberId: 'mem_8', status: 'PENDING_APPROVAL', requestedAt: iso(), expiresAt: iso(Date.now() + 600000) });
    Store.insert('borrowRequestItems', { requestId: rawB.id, copyId: free.id, bookId: free.bookId });
    const apB = Services.approveRequest(rawB.id, 'usr_lib1');
    assert(!apB.ok, 'second checkout of same copy refused at approval: ' + apB.error);
    Store.update('members', 'mem_8', { cart: [] });

    // ---------------- STUDENT sees loan ----------------
    loginAs('STUDENT'); Router.reset(); UI.mybooks = 'borrowed'; Router.tab('mybooks'); await sleep(500);
    const title = Services.book(handed[0].bookId).title;
    assert(q('.scroll').textContent.includes(title.slice(0, 15)), 'student sees borrowed book in My Books');

    // ---------------- RETURN ----------------
    loginAs('LIBRARIAN'); Router.reset(); await sleep(450);
    Actions.libScan('return'); await sleep(80);
    Scanner.handle(copyId, true); await sleep(450);
    assert(Router.current().name === 'returnReview' && !screenErr(), 'return review opens');
    click('[form="return-form"]'); await sleep(900);
    assert(Router.current().name === 'returnSession', 'return session shown');
    assert(Store.get('borrowTransactions', tx.id).status === 'RETURNED', 'transaction RETURNED');
    assert(['AVAILABLE', 'RESERVED'].includes(Services.copy(copyId).status), 'copy available again');
    assert(!Services.processReturn(copyId, { staffUserId: 'usr_lib1' }).ok, 'copy cannot be returned twice');
    // overdue return with fine (Marcus 1984 overdue 6 days)
    const od = Store.find('borrowTransactions', t => t.memberId === 'mem_3' && t.status === 'OVERDUE');
    const finesBefore = Store.count('fines');
    const ret = Services.processReturn(od.copyId, { condition: 'DAMAGED', staffUserId: 'usr_lib1' });
    if (FEATURES.fines) assert(ret.ok && ret.fine.amount > 0 && Store.count('fines') === finesBefore + 2, 'overdue + damage fines recorded');
    else assert(ret.ok && ret.fine.days > 0 && ret.fine.amount === 0 && Store.count('fines') === finesBefore, 'MVP: late, damaged return tracked as late but creates no fines');
    assert(Services.copy(od.copyId).status === 'MAINTENANCE', 'damaged copy goes to MAINTENANCE');
    // reservation hand-off: return a Project Hail Mary copy -> Alex's reservation READY
    const phmTx = Store.find('borrowTransactions', t => t.bookId === 'bk_07' && t.status !== 'RETURNED');
    const r3 = Services.processReturn(phmTx.copyId, { staffUserId: 'usr_lib1' });
    assert(r3.copyStatus === 'RESERVED' && Store.get('reservations', 'rsv_1').status === 'READY', 'returned copy held for first in reservation queue');
    UI.returnSession.unshift({ txId: r3.tx.id, copyId: r3.copy.id, at: iso(), fine: 0, status: r3.copyStatus, heldFor: 'mem_1' });
    Router.refresh(); await sleep(50);
    assert(document.querySelectorAll('.list-card').length >= 2, 'multiple returns listed in session');

    // ---------------- STUDENT history ----------------
    loginAs('STUDENT'); Router.reset(); UI.mybooks = 'history'; Router.tab('mybooks'); await sleep(500);
    assert(q('.scroll').textContent.includes(title.slice(0, 15)), 'student history shows returned book');
    // reserved copy can be added by Alex only
    const add = Services.addBookToCart('mem_1', 'bk_07');
    assert(add.ok, 'reserved copy can be added by reserving member');

    // ---------------- ADMIN ----------------
    loginAs('ADMIN'); Router.reset(); await sleep(700);
    assert(q('[data-screen="adminDashboard"]') && !screenErr(), 'admin dashboard renders');
    assert(Charts.list.length === 2 && q('.bar-list'), 'admin charts rendered (' + Charts.list.length + ')');
    const S = Stats.admin('7d');
    assert(S.cards.borrowed.value >= 4 && S.cards.returned.value >= 4, 'admin stats reflect new activity');
    for (const r of ['7d', '30d', '6m', '1y']) { UI.adminRange = r; Router.refresh(); await sleep(30); assert(!screenErr(), 'admin range ' + r); }

    // ---------------- Visit every screen as each allowed role ----------------
    const params = { bookDetail: { id: 'bk_01' }, bookManage: { id: 'bk_01' }, bookForm: {}, labels: { id: 'bk_01' }, memberDetail: { id: 'mem_1' }, requestReview: { id: reqId }, checkoutReceipt: { id: reqId }, returnReview: { id: Store.find('borrowTransactions', t => t.status !== 'RETURNED').copyId }, returnSession: {}, checkoutQR: { id: reqId }, receipt: { id: Services.receiptsOf('mem_1')[0]?.id } };
    for (const role of ['STUDENT', 'LIBRARIAN', 'ADMIN']) {
      loginAs(role, true);
      for (const [name, sc] of Object.entries(Screens)) {
        if (name === 'error' || name === 'login') continue;
        if (sc.roles && !sc.roles.includes(role)) continue;
        if (name === 'checkoutQR' && role !== 'STUDENT') continue;
        UI.visited[name] = true;
        Router.reset(name, params[name] || {});
        await sleep(20);
        const err = screenErr();
        if (err && !(name === 'checkoutQR')) throw new Error(`screen ${name} as ${role} shows error: ${err}`);
        if (!FEATURES.fines && /\$\s?\d/.test(q('#view').textContent)) throw new Error(`screen ${name} as ${role} shows a money amount`);
      }
      log.push('ok  all screens render for ' + role);
    }
    // role guard
    loginAs('STUDENT', true); Router.reset('adminDashboard'); await sleep(20);
    assert(q('.error-code')?.textContent === '403', 'student blocked from admin dashboard (403)');

    // book creation with copies & labels
    loginAs('LIBRARIAN', true); Router.reset('bookForm'); await sleep(50);
    const bf = q('#book-form');
    bf.title.value = 'Test Driven Development'; bf.author.value = 'Kent Beck'; bf.isbn.value = '0321146530'; bf.category.value = 'Technology'; bf.copies.value = '3';
    click('[form="book-form"]'); await sleep(800);
    assert(Router.current().name === 'labels', 'labels screen after creating book');
    const nb = Store.find('books', b => b.title === 'Test Driven Development');
    assert(Services.copiesOf(nb.id).length === 3, '3 copies created with unique IDs');
    assert(document.querySelectorAll('.label-qr canvas, .label-qr img').length >= 3, 'QR labels rendered');
    assert(Services.canDeleteBook(nb.id).ok && !Services.canDeleteBook('bk_01').ok, 'delete rules');
    // invalid ISBN
    Router.reset('bookForm'); await sleep(50);
    const bf2 = q('#book-form'); bf2.title.value = 'X'; bf2.author.value = 'Y'; bf2.isbn.value = '9780735211293'; bf2.category.value = 'Fiction';
    click('[form="book-form"]'); await sleep(700);
    assert(q('[data-err=isbn]').textContent.includes('checksum'), 'invalid ISBN checksum rejected');

    // seeded ISBNs all valid
    const badIsbn = Store.all('books').filter(b => !isValidISBN(b.isbn)).map(b => b.title);
    assert(!badIsbn.length, 'all seeded ISBNs valid ' + badIsbn.join(','));

    // ---------------- Member registration requires a student ID card ----------------
    loginAs('ADMIN', true); Router.reset('users'); await sleep(50);
    Actions.userForm(); await sleep(350);
    const uf = q('#user-form');
    uf.name.value = 'Grace Park'; uf.email.value = 'grace.park@uni.edu';
    click('[form="user-form"]'); await sleep(50);
    assert(q('[data-err=studentId]').textContent && q('[data-err=idCardPhoto]').textContent, 'student without ID card is rejected (number + photo required)');
    assert(!Store.find('users', u => u.email === 'grace.park@uni.edu'), 'no account created without ID card');
    uf.studentId.value = 'stu-10231'; pendingIdPhoto = 'data:image/jpeg;base64,AAAA';
    click('[form="user-form"]'); await sleep(50);
    assert(q('[data-err=studentId]').textContent.includes('already registered'), 'duplicate ID card number rejected (case-insensitive)');
    uf.studentId.value = 'STU-20991';
    click('[form="user-form"]'); await sleep(400);
    const gp = Store.find('users', u => u.email === 'grace.park@uni.edu');
    const gm = gp && Services.memberByUser(gp.id);
    assert(gm && gm.studentId === 'STU-20991' && gm.idCardPhoto && gm.idVerifiedBy === 'usr_admin', 'student created with ID card number, photo and verifier');
    assert(Auth.login('STU-20991', 'welcome123', false).ok, 'new member can sign in with ID card number');
    loginAs('ADMIN', true);
    const staff = Services.createUser({ name: 'Temp Staff', email: 'temp.staff@library.com', password: 'secret123', role: 'LIBRARIAN' }, 'usr_admin');
    assert(staff.ok && !Services.updateUser(staff.user.id, { role: 'STUDENT' }, 'usr_admin').ok, 'staff cannot be switched to student without an ID card');
    Router.reset('memberDetail', { id: gm.id }); await sleep(50);
    assert(q('.id-on-file img') && !screenErr(), 'member record shows ID card photo');

    // ---------------- Receipts: proof of return and payment ----------------
    const rtA = Services.receiptForTx(tx.id);
    assert(rtA && rtA.type === 'RETURN' && /^RT-[A-Z0-9]{6}$/.test(rtA.number), 'UI return produced a return receipt');
    assert(Store.find('notifications', n => n.link?.to === 'receipt' && n.link.id === rtA.id), 'student notification links to the receipt');
    // one desk visit, two books → one receipt, one notification
    const noahLoans = Store.filter('borrowTransactions', t => t.memberId === 'mem_5' && t.status !== 'RETURNED');
    const n1 = Services.processReturn(noahLoans[0].copyId, { staffUserId: 'usr_lib1' });
    const n2 = Services.processReturn(noahLoans[1].copyId, { staffUserId: 'usr_lib1', receiptId: n1.receipt.id });
    assert(n2.receipt.id === n1.receipt.id && n2.receipt.lines.length === 2, 'books returned in one visit share one receipt');
    assert(Store.count('notifications', n => n.link?.id === n1.receipt.id) === 1, 'combined receipt keeps a single notification');
    assert(n2.receipt.total === n1.fines.concat(n2.fines).reduce((s, f) => s + f.amount, 0), 'return receipt totals the fines added');
    // a later visit gets its own receipt
    const oliviaLoans = Store.filter('borrowTransactions', t => t.memberId === 'mem_7' && t.status !== 'RETURNED');
    const o1 = Services.processReturn(oliviaLoans[0].copyId, { staffUserId: 'usr_lib1' });
    Store.update('receipts', o1.receipt.id, { createdAt: iso(Date.now() - 3 * HOUR_MS) });
    const o2 = Services.processReturn(oliviaLoans[1].copyId, { staffUserId: 'usr_lib1', receiptId: o1.receipt.id });
    assert(o2.receipt.id !== o1.receipt.id, 'returning on a different visit issues a separate receipt');
    let verifyR = n2.receipt; // a receipt belonging to someone other than the demo student
    if (FEATURES.fines) {
    // pay several fines at once → one payment receipt
    const noahUnpaid = Store.filter('fines', f => f.memberId === 'mem_5' && f.status === 'UNPAID');
    const pay = Services.settleFines(noahUnpaid.map(f => f.id), 'usr_lib1', { method: 'Card' });
    assert(pay.ok && pay.receipt.type === 'PAYMENT' && pay.receipt.lines.length === noahUnpaid.length && noahUnpaid.every(f => Store.get('fines', f.id).status === 'PAID'), 'paying multiple fines issues one payment receipt');
    assert(!Services.settleFines(noahUnpaid.map(f => f.id), 'usr_lib1').ok, 'fines cannot be paid twice');
    verifyR = pay.receipt;
    }
    assert(Services.findReceiptByScan(QR.receipt(verifyR.token))?.id === verifyR.id && Services.findReceiptByScan(verifyR.number.toLowerCase())?.id === verifyR.id, 'receipt found by QR token and by typed number');
    assert(!Services.findReceiptByScan('LMS-RCT:FORGEDRECEIPT0000'), 'forged receipt QR is not recognised');
    // staff verification flow through the scanner
    loginAs('LIBRARIAN', true); Router.reset('scanHub'); await sleep(30);
    Actions.libScan('receipt'); await sleep(60);
    Scanner.handle('LMS-RCT:FORGEDRECEIPT0000', true); await sleep(40);
    assert(q('.scan-result.bad'), 'scanner flags an unrecognised receipt');
    Scanner.handle(QR.receipt(verifyR.token), true); await sleep(400);
    assert(Router.current().name === 'receipt' && q('.rcpt .status-strip.green') && q('.rcpt-qr canvas, .rcpt-qr img'), 'verified receipt opens with "Genuine" banner and QR');
    // student sees their receipts
    loginAs('STUDENT', true); Router.reset('receipts'); await sleep(40);
    assert(document.querySelectorAll('.scroll .list-card').length >= 3 && !screenErr(), 'student receipts list renders');
    Router.go('receipt', { id: verifyR.id }); await sleep(40);
    assert(q('.error-code'), 'student cannot open another member’s receipt');

    // ---------------- Cross-screen UX ----------------
    assert(!document.getElementById('splash'), 'launch screen is dismissed after start-up');
    // back returns to the same scroll position
    loginAs('LIBRARIAN', true); Router.reset('inventory'); await sleep(450);
    q('#view .scroll').scrollTop = 600; await sleep(20);
    const savedTop = q('#view .scroll').scrollTop;
    Router.go('bookManage', { id: 'bk_05' }); await sleep(40); Router.back(); await sleep(40);
    assert(savedTop > 0 && Math.abs(q('#view .scroll').scrollTop - savedTop) < 2, 'back restores the list scroll position');
    // tapping the active tab pops to its root
    Router.go('bookManage', { id: 'bk_05' }); await sleep(40);
    q('#tabbar [data-to="inventory"]').click(); await sleep(40);
    assert(Router.stack.length === 1 && Router.current().name === 'inventory', 're-tapping the active tab returns to its root');
    // unsaved changes are guarded
    Router.reset('bookForm'); await sleep(40);
    const bfg = q('#book-form'); bfg.title.value = 'Draft'; bfg.title.dispatchEvent(new Event('input', { bubbles: true }));
    Router.back(); await sleep(350);
    assert(Router.current().name === 'bookForm' && q('[data-confirm="1"]'), 'leaving an edited form asks to discard changes');
    click('[data-confirm="0"]'); await sleep(300);
    assert(Router.current().name === 'bookForm' && q('#book-form').title.value === 'Draft', '“Keep editing” keeps the draft');
    Router.back(); await sleep(350); click('[data-confirm="1"]'); await sleep(350);
    assert(Router.current().name !== 'bookForm', '“Discard” leaves the form');
    // undo removing a book from the cart
    loginAs('STUDENT', true);
    const freeCopy = Store.find('bookCopies', c => c.status === 'AVAILABLE' && Services.copyCheck(c.id, 'mem_1').ok && !Services.activeLoans('mem_1').some(t => t.bookId === c.bookId));
    Store.update('members', 'mem_1', { cart: [] });
    assert(Services.addToCart('mem_1', freeCopy.id).ok, 'cart prepared for undo test');
    Router.reset('cart'); await sleep(40);
    click(`[data-action="removeFromCart"][data-id="${freeCopy.id}"]`); await sleep(60);
    assert(Services.cart('mem_1').length === 0 && q('.toast-action'), 'removing shows an Undo action');
    q('.toast-action').click(); await sleep(60);
    assert(Services.cart('mem_1').includes(freeCopy.id) && document.querySelectorAll('.cart-item').length === 1, 'Undo puts the book back in the cart');
    // checkout pass renews itself while visible, with a new token
    const live = Services.createCheckoutRequest('mem_1');
    Router.reset('checkoutQR', { id: live.request.id }); await sleep(60);
    const oldToken = Store.get('borrowRequests', live.request.id).token;
    Store.update('borrowRequests', live.request.id, { expiresAt: iso(Date.now() + 10000) });
    await sleep(1300);
    const renewed = Store.get('borrowRequests', live.request.id);
    assert(renewed.status === 'PENDING_APPROVAL' && renewed.token !== oldToken && toMs(renewed.expiresAt) > Date.now() + 5 * MIN_MS, 'open checkout pass renews before expiry with a rotated token');
    assert(!Services.findRequestByScan(QR.request(oldToken)), 'old QR (e.g. a screenshot) no longer works after renewal');
    Services.cancelRequest(live.request.id);
    // profile adapts to the role
    Router.reset('profile'); await sleep(40);
    assert(q('[data-action="howBorrowing"]') && !q('[data-to="users"]'), 'student profile shows library card & help, no admin tools');
    loginAs('LIBRARIAN', true); Router.reset('profile'); await sleep(40);
    assert(q('.scroll').textContent.includes('Your desk today') && !q('[data-to="policies"]'), 'librarian profile shows today’s desk work, no admin tools');
    loginAs('ADMIN', true); Router.reset('profile'); await sleep(40);
    assert(q('.scroll').textContent.includes('Library at a glance') && q('[data-to="policies"]') && q('[data-to="members"]'), 'admin profile shows administration and desk tools');

    // persistence across reload: data stored
    assert(JSON.parse(localStorage.getItem('lms.v1.borrowTransactions')).some(t => t.id === tx.id && t.status === 'RETURNED'), 'data persisted to localStorage');
    return JSON.stringify({ ok: true, log });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.message, stack: e.stack, log });
  }
})()
