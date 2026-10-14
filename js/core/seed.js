'use strict';
/* ===========================================================================
 * seed.js — realistic demo dataset.
 * Dates are generated relative to "now" so due dates, overdue items and
 * dashboard charts always look current. A fixed PRNG seed keeps the history
 * identical across resets.
 * ======================================================================== */

const SEED_BOOKS = [
  ['Atomic Habits', 'James Clear', '9780735211292', 'Avery', 2018, 'Self-Help', 3, 'A-01', 'An easy and proven way to build good habits and break bad ones. Tiny changes, remarkable results — a practical framework for improving every day.'],
  ['Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', '9780062316097', 'Harper', 2015, 'History', 2, 'H-04', 'How did our species succeed in the battle for dominance? A sweeping account of human history from the Stone Age to the twenty-first century.'],
  ['The Pragmatic Programmer', 'David Thomas & Andrew Hunt', '9780135957059', 'Addison-Wesley', 2019, 'Technology', 2, 'T-02', 'The 20th anniversary edition of the classic guide to becoming a better, more effective software developer — from career to architecture.'],
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Prentice Hall', 2008, 'Technology', 2, 'T-02', 'A handbook of agile software craftsmanship: principles, patterns and practices for writing clean, readable and maintainable code.'],
  ['Educated', 'Tara Westover', '9780399590504', 'Random House', 2018, 'Biography', 2, 'B-01', 'A memoir about a young woman who, kept out of school, leaves her survivalist family and goes on to earn a PhD from Cambridge University.'],
  ['The Midnight Library', 'Matt Haig', '9780525559474', 'Viking', 2020, 'Fiction', 3, 'F-07', 'Between life and death there is a library. Nora Seed gets the chance to try every life she could have lived — and discover what makes one worth living.'],
  ['Project Hail Mary', 'Andy Weir', '9780593135204', 'Ballantine Books', 2021, 'Science Fiction', 2, 'S-03', 'A lone astronaut wakes up with no memory on a desperate, last-chance mission to save Earth — and an unlikely friendship changes everything.'],
  ['Dune', 'Frank Herbert', '9780441172719', 'Ace', 1990, 'Science Fiction', 2, 'S-01', 'Set on the desert planet Arrakis, the story of Paul Atreides is a stunning blend of adventure, mysticism, environmentalism and politics.'],
  ['1984', 'George Orwell', '9780451524935', 'Signet Classics', 1961, 'Fiction', 2, 'F-02', 'A chilling vision of a totalitarian future where Big Brother is always watching and independent thought is a crime.'],
  ['To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Harper Perennial', 2006, 'Fiction', 2, 'F-03', 'A gripping tale of racial injustice and childhood innocence in the American South, told through the eyes of Scout Finch.'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman', '9780374533557', 'Farrar, Straus and Giroux', 2013, 'Psychology', 2, 'P-01', 'A Nobel laureate explains the two systems that drive the way we think — and how they shape our judgments and decisions.'],
  ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Bantam', 1998, 'Science', 2, 'C-02', 'A landmark volume in science writing exploring the origins of the universe, black holes, and the nature of time itself.'],
  ['The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Scribner', 2004, 'Fiction', 2, 'F-04', 'The story of the mysteriously wealthy Jay Gatsby and his love for Daisy Buchanan — a portrait of the Jazz Age and the American dream.'],
  ['Deep Work', 'Cal Newport', '9781455586691', 'Grand Central Publishing', 2016, 'Self-Help', 2, 'A-02', 'Rules for focused success in a distracted world: how to master the ability to focus without distraction on cognitively demanding tasks.'],
  ['The Psychology of Money', 'Morgan Housel', '9780857197689', 'Harriman House', 2020, 'Business', 2, 'E-03', 'Timeless lessons on wealth, greed, and happiness — doing well with money has little to do with how smart you are.'],
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest & Stein', '9780262033848', 'MIT Press', 2009, 'Technology', 2, 'T-05', 'The comprehensive reference on modern algorithms, covering a broad range of algorithms in depth yet making their design accessible.'],
  ['The Lean Startup', 'Eric Ries', '9780307887894', 'Crown Business', 2011, 'Business', 2, 'E-01', 'How today\'s entrepreneurs use continuous innovation to create radically successful businesses through validated learning.'],
  ['Becoming', 'Michelle Obama', '9781524763138', 'Crown', 2018, 'Biography', 2, 'B-02', 'An intimate, powerful memoir by the former First Lady of the United States, chronicling the experiences that shaped her.'],
  ['The Alchemist', 'Paulo Coelho', '9780062315007', 'HarperOne', 2014, 'Fiction', 2, 'F-01', 'A magical fable about Santiago, an Andalusian shepherd boy who travels in search of a worldly treasure and finds wisdom instead.'],
  ['Cosmos', 'Carl Sagan', '9780345539434', 'Ballantine Books', 2013, 'Science', 2, 'C-01', 'The story of fifteen billion years of cosmic evolution transforming matter and life into consciousness.'],
  ['The Hobbit', 'J.R.R. Tolkien', '9780547928227', 'Mariner Books', 2012, 'Fantasy', 2, 'D-01', 'Bilbo Baggins is swept into an epic quest to reclaim the lost Dwarf Kingdom of Erebor from the fearsome dragon Smaug.'],
  ['Harry Potter and the Sorcerer\'s Stone', 'J.K. Rowling', '9780590353427', 'Scholastic', 1998, 'Fantasy', 3, 'D-02', 'Harry Potter discovers on his eleventh birthday that he is a wizard, and begins his education at Hogwarts School of Witchcraft and Wizardry.'],
  ['The Selfish Gene', 'Richard Dawkins', '9780198788607', 'Oxford University Press', 2016, 'Science', 2, 'C-03', 'The 40th anniversary edition of the classic that revolutionised thinking about natural selection from the gene\'s point of view.'],
  ['Man\'s Search for Meaning', 'Viktor E. Frankl', '9780807014271', 'Beacon Press', 2006, 'Psychology', 1, 'P-02', 'A psychiatrist\'s memoir of life in Nazi death camps and its lessons for spiritual survival and finding purpose in suffering.'],
  ['Zero to One', 'Peter Thiel', '9780804139298', 'Crown Business', 2014, 'Business', 2, 'E-02', 'Notes on startups, or how to build the future — the next Bill Gates will not build an operating system.'],
];

// Days since each title was added to the catalogue (drives "New arrivals").
const SEED_BOOK_AGE = [820, 760, 400, 900, 620, 20, 12, 880, 950, 930, 700, 860, 940, 520, 45, 980, 690, 580, 840, 750, 870, 990, 610, 720, 3];

const SEED_STUDENTS = [
  // name, email, program, year, joinedDaysAgo, membership expires in (days), status
  ['Alex Morgan', 'student@library.com', 'Computer Science', 3, 420, 310, 'ACTIVE'],
  ['Priya Sharma', 'priya.sharma@uni.edu', 'Biology', 2, 300, 430, 'ACTIVE'],
  ['Marcus Johnson', 'marcus.j@uni.edu', 'History', 4, 520, 210, 'ACTIVE'],
  ['Emma Wilson', 'emma.wilson@uni.edu', 'Psychology', 1, 25, 700, 'ACTIVE'],
  ['Noah Kim', 'noah.kim@uni.edu', 'Physics', 3, 200, 530, 'ACTIVE'],
  ['Liam Garcia', 'liam.garcia@uni.edu', 'Business Administration', 2, 150, 580, 'ACTIVE'],
  ['Olivia Brown', 'olivia.b@uni.edu', 'English Literature', 4, 600, 130, 'ACTIVE'],
  ['Ethan Davis', 'ethan.davis@uni.edu', 'Mechanical Engineering', 1, 3, 725, 'ACTIVE'],
  ['Sofia Rossi', 'sofia.rossi@uni.edu', 'Architecture', 2, 90, 640, 'SUSPENDED'],
  ['James Lee', 'james.lee@uni.edu', 'Mathematics', 4, 380, -10, 'ACTIVE'],
];

const Seed = {
  run() {
    const now = Date.now();
    const rnd = mulberry32(20241014);
    const ago = (days, hours = 0) => iso(now - days * DAY_MS - hours * HOUR_MS);
    const ahead = (days, hours = 0) => iso(now + days * DAY_MS + hours * HOUR_MS);
    const settings = { ...DEFAULT_SETTINGS };

    /* ---------------- users & members ---------------- */
    const users = [
      { id: 'usr_admin', name: 'Margaret Hughes', email: 'admin@library.com', password: 'admin123', role: 'ADMIN', phone: '+1 (555) 010-1000', title: 'Library Director', active: true, createdAt: ago(900) },
      { id: 'usr_lib1', name: 'Sarah Chen', email: 'librarian@library.com', password: 'library123', role: 'LIBRARIAN', phone: '+1 (555) 010-2001', title: 'Circulation Librarian', active: true, createdAt: ago(640) },
      { id: 'usr_lib2', name: 'David Okafor', email: 'd.okafor@library.com', password: 'library123', role: 'LIBRARIAN', phone: '+1 (555) 010-2002', title: 'Reference Librarian', active: true, createdAt: ago(410) },
    ];
    const members = [];
    SEED_STUDENTS.forEach(([name, email, program, year, joined, expires, status], i) => {
      const n = i + 1;
      users.push({ id: `usr_stu${n}`, name, email, password: 'student123', role: 'STUDENT', phone: `+1 (555) 020-${String(3000 + n)}`, active: true, createdAt: ago(joined) });
      members.push({
        id: `mem_${n}`, userId: `usr_stu${n}`, studentId: `STU-${10230 + n}`, program, year,
        memberToken: randomToken(20), status, joinedAt: ago(joined), expiresAt: ahead(expires),
        cart: [], createdAt: ago(joined), updatedAt: ago(joined),
      });
    });
    users.forEach(u => { u.updatedAt = u.createdAt; });

    /* ---------------- books & copies ---------------- */
    const books = [], copies = [], copiesOf = {}, bookOfCopy = {};
    SEED_BOOKS.forEach(([title, author, isbn, publisher, year, category, nCopies, shelf, description], i) => {
      const id = `bk_${String(i + 1).padStart(2, '0')}`;
      const created = ago(SEED_BOOK_AGE[i]);
      books.push({
        id, title, author, isbn, publisher, year, category, language: 'English', shelf, description,
        pages: 180 + Math.floor(rnd() * 500), coverData: null, archived: false,
        featured: ['bk_01', 'bk_07', 'bk_11', 'bk_06', 'bk_02'].includes(id),
        createdAt: created, updatedAt: created,
      });
      copiesOf[id] = [];
      for (let c = 0; c < nCopies; c++) {
        const cid = copyIdFor(++settings.copySeq);
        copies.push({ id: cid, bookId: id, status: 'AVAILABLE', condition: 'GOOD', note: '', acquiredAt: created, createdAt: created, updatedAt: created });
        copiesOf[id].push(cid);
        bookOfCopy[cid] = id;
      }
    });
    const copy = (bookNo, idx = 0) => copiesOf[`bk_${String(bookNo).padStart(2, '0')}`][idx];
    const setCopy = (cid, patch) => Object.assign(copies.find(c => c.id === cid), patch);

    /* ---------------- transactions ---------------- */
    const txs = [], fines = [];
    const staff = ['usr_lib1', 'usr_lib2'];
    function addTx(memberNo, cid, borrowedDaysAgo, returnedDaysAgo = null, opts = {}) {
      const borrowedAt = now - borrowedDaysAgo * DAY_MS - (opts.hours || 0) * HOUR_MS;
      const dueAt = endOfDay(borrowedAt + settings.loanDays * DAY_MS);
      const returnedAt = returnedDaysAgo == null ? null : now - returnedDaysAgo * DAY_MS - (opts.retHours || 0) * HOUR_MS;
      const by = opts.staff || staff[Math.floor(rnd() * 2)];
      let fineAmount = 0;
      if (FEATURES.fines && returnedAt && returnedAt > dueAt) {
        fineAmount = Math.min(daysBetween(dueAt, returnedAt) * settings.finePerDay, settings.maxFinePerItem);
      }
      const tx = {
        id: `tx_${String(txs.length + 1).padStart(4, '0')}`, requestId: null, memberId: `mem_${memberNo}`,
        copyId: cid, bookId: bookOfCopy[cid], borrowedAt: iso(borrowedAt), dueAt: iso(dueAt),
        returnedAt: returnedAt ? iso(returnedAt) : null,
        status: returnedAt ? 'RETURNED' : dueAt < now ? 'OVERDUE' : 'ACTIVE',
        approvedBy: by, returnedTo: returnedAt ? by : null, condition: returnedAt ? 'GOOD' : null,
        fineAmount, dueSoonNotified: true, overdueNotified: !returnedAt && dueAt < now,
        createdAt: iso(borrowedAt), updatedAt: iso(returnedAt || borrowedAt),
      };
      txs.push(tx);
      if (fineAmount > 0) {
        const paid = opts.finePaid ?? !(['mem_3', 'mem_5', 'mem_7'].includes(tx.memberId) && rnd() < 0.5);
        fines.push({
          id: `fin_${String(fines.length + 1).padStart(4, '0')}`, memberId: tx.memberId, txId: tx.id, bookId: tx.bookId,
          amount: fineAmount, reason: 'OVERDUE', note: `${daysBetween(dueAt, returnedAt)} days late`,
          status: paid ? 'PAID' : 'UNPAID', paidAt: paid ? iso(returnedAt + HOUR_MS) : null, paidMethod: paid ? 'Cash' : null,
          recordedBy: paid ? by : null, createdAt: iso(returnedAt), updatedAt: iso(returnedAt),
        });
      }
      if (!returnedAt) setCopy(cid, { status: 'BORROWED' });
      return tx;
    }

    // Current loans (keep in sync with copy statuses)
    const active = [
      [1, copy(14, 0), 12], // Alex — Deep Work, due in 2 days
      [2, copy(7, 0), 5], [2, copy(4, 0), 3],
      [3, copy(9, 0), 20], // overdue
      [4, copy(7, 1), 8], [4, copy(2, 0), 0, { hours: 2 }],
      [5, copy(8, 0), 25], [5, copy(13, 0), 17], // overdue x2
      [6, copy(15, 0), 1],
      [7, copy(11, 0), 30], [7, copy(1, 0), 14], // overdue + due today
      [8, copy(6, 0), 0, { hours: 4 }],
      [10, copy(22, 0), 9],
    ];
    const activeCopies = new Set(active.map(a => a[1]));
    // Historical, returned loans spread over the past year (weighted to recent months)
    const allCopyIds = copies.map(c => c.id);
    const histMembers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < 160; i++) {
      const m = histMembers[Math.floor(rnd() * histMembers.length)];
      const borrowed = Math.floor(Math.pow(rnd(), 1.3) * 360) + 4;
      const duration = 2 + Math.floor(rnd() * 19);
      const returned = Math.max(1, borrowed - duration);
      if (returned >= borrowed) continue;
      let cid = allCopyIds[Math.floor(rnd() * allCopyIds.length)];
      if (activeCopies.has(cid) && returned < 32) continue;
      // members who joined recently cannot have old history
      const joined = SEED_STUDENTS[m - 1][4];
      if (borrowed > joined) continue;
      addTx(m, cid, borrowed, returned, { finePaid: m === 1 ? true : undefined });
    }
    // Alex's notable history (one unpaid fine)
    addTx(1, copy(6, 1), 40, 23, { finePaid: false, staff: 'usr_lib1' });
    addTx(1, copy(21, 1), 62, 50, { staff: 'usr_lib1' });
    addTx(1, copy(3, 0), 95, 83, { staff: 'usr_lib2' });
    // Returned today
    addTx(2, copy(18, 0), 10, 0, { retHours: 3, staff: 'usr_lib1' });
    addTx(6, copy(20, 1), 16, 0, { retHours: 1, finePaid: true, staff: 'usr_lib1' });
    active.forEach(([m, cid, d, o]) => addTx(m, cid, d, null, o || {}));
    txs.sort((a, b) => toMs(a.borrowedAt) - toMs(b.borrowedAt));

    // Damaged-book fee for Marcus
    if (FEATURES.fines) fines.push({ id: 'fin_dmg1', memberId: 'mem_3', txId: null, bookId: 'bk_10', amount: settings.damagedFee, reason: 'DAMAGED', note: 'Water damage on cover', status: 'UNPAID', paidAt: null, paidMethod: null, recordedBy: 'usr_lib2', createdAt: ago(34), updatedAt: ago(34) });

    // Copy exceptions
    setCopy(copy(16, 1), { status: 'LOST', note: 'Reported missing during inventory audit' });
    setCopy(copy(19, 1), { status: 'MAINTENANCE', condition: 'DAMAGED', note: 'Spine damage — sent for rebinding' });
    setCopy(copy(5, 0), { status: 'RESERVED' });

    /* ---------------- reservations ---------------- */
    const reservations = [
      { id: 'rsv_1', memberId: 'mem_1', bookId: 'bk_07', status: 'WAITING', copyId: null, readyAt: null, holdUntil: null, createdAt: ago(2), updatedAt: ago(2) },
      { id: 'rsv_2', memberId: 'mem_8', bookId: 'bk_07', status: 'WAITING', copyId: null, readyAt: null, holdUntil: null, createdAt: ago(1), updatedAt: ago(1) },
      { id: 'rsv_3', memberId: 'mem_2', bookId: 'bk_05', status: 'READY', copyId: copy(5, 0), readyAt: ago(1), holdUntil: ahead(2), createdAt: ago(6), updatedAt: ago(1) },
      { id: 'rsv_4', memberId: 'mem_5', bookId: 'bk_08', status: 'CANCELLED', copyId: null, readyAt: null, holdUntil: null, createdAt: ago(40), updatedAt: ago(35) },
    ];

    /* ---------------- checkout requests ---------------- */
    const requests = [], items = [];
    function addRequest(memberNo, copyIds, status, requestedAt, extra = {}) {
      const id = `req_${requests.length + 1}`;
      requests.push({
        id, code: 'CR-' + randomToken(6), token: randomToken(24), memberId: `mem_${memberNo}`, status,
        requestedAt: iso(requestedAt), expiresAt: iso(requestedAt + settings.requestExpiryMin * MIN_MS),
        processedAt: extra.processedAt || null, processedBy: extra.processedBy || null, rejectReason: extra.rejectReason || null,
        createdAt: iso(requestedAt), updatedAt: iso(requestedAt),
      });
      copyIds.forEach((cid, i) => items.push({ id: `rqi_${id}_${i}`, requestId: id, copyId: cid, bookId: bookOfCopy[cid], createdAt: iso(requestedAt), updatedAt: iso(requestedAt) }));
    }
    addRequest(6, [copy(21, 0), copy(20, 0)], 'PENDING_APPROVAL', now - 2 * MIN_MS);
    addRequest(4, [copy(25, 0)], 'EXPIRED', now - DAY_MS - 5 * HOUR_MS);
    addRequest(8, [copy(17, 0)], 'REJECTED', now - 2 * DAY_MS, { processedAt: ago(2, -0.1), processedBy: 'usr_lib2', rejectReason: 'Student did not present a valid ID card' });
    members.find(m => m.id === 'mem_6').cart = [copy(21, 0), copy(20, 0)];

    /* ---------------- notifications ---------------- */
    const notifications = [];
    const notify = (userId, type, title, body, createdAt, read = false, link = null) =>
      notifications.push({ id: `ntf_${notifications.length + 1}`, userId, type, title, body, read, link, createdAt, updatedAt: createdAt });
    notify('usr_stu1', 'WELCOME', 'Welcome to Greenleaf Library', 'Your digital membership card is ready. Show it at any counter.', ago(400), true);
    notify('usr_stu1', 'CHECKOUT_APPROVED', 'Checkout approved', '“Deep Work” is now on your account. Due in 14 days.', ago(12), true, { to: 'mybooks' });
    if (FEATURES.fines) notify('usr_stu1', 'FINE_ADDED', 'Fine added: $1.50', '“The Midnight Library” was returned 3 days late.', ago(23), false, { to: 'fines' });
    notify('usr_stu1', 'RESERVATION_QUEUED', 'You’re #1 in the queue', 'We’ll notify you when “Project Hail Mary” is available.', ago(2), true, { to: 'bookDetail', id: 'bk_07' });
    notify('usr_stu1', 'DUE_SOON', 'Due in 2 days', '“Deep Work” is due on ' + fmtDate(now + 2 * DAY_MS) + '.', ago(0, 5), false, { to: 'mybooks' });
    notify('usr_stu2', 'RESERVATION_READY', 'Reservation ready for pickup', '“Educated” is held for you until ' + fmtDate(now + 2 * DAY_MS) + '.', ago(1));
    notify('usr_stu3', 'OVERDUE', 'Book overdue', '“1984” is overdue. Please return it as soon as you can.', ago(5));
    notify('usr_lib1', 'REQUEST_NEW', 'New checkout request', 'Liam Garcia requested 2 books at the counter.', ago(0, 0.03), false, { to: 'transactions' });
    notify('usr_lib1', 'OVERDUE', '4 overdue loans', 'Three members have overdue books. Consider sending reminders.', ago(0, 6), false, { to: 'overdue' });
    notify('usr_lib1', 'SYSTEM', 'Inventory audit complete', 'One copy of “Introduction to Algorithms” was marked lost.', ago(9), true);
    notify('usr_admin', 'SYSTEM', 'Weekly report ready', 'Circulation is up compared to last week. Open Reports for details.', ago(1), false, { to: 'reports' });
    notify('usr_admin', 'OVERDUE', 'Overdue loans need attention', '4 loans are overdue across 3 members.', ago(0, 6), false, { to: 'overdue' });

    /* ---------------- audit logs (incl. visitor gate entries) ---------------- */
    const logs = [];
    const log = (action, userId, detail, createdAt, entity = null) =>
      logs.push({ id: `log_${logs.length + 1}`, action, userId, detail, entity, createdAt, updatedAt: createdAt });
    for (let d = 364; d >= 0; d--) {
      const day = new Date(now - d * DAY_MS).getDay();
      const visits = Math.floor(rnd() * (day === 0 || day === 6 ? 2 : 4));
      for (let v = 0; v < visits; v++) {
        const sm = 1 + Math.floor(rnd() * 10);
        if (SEED_STUDENTS[sm - 1][4] < d) continue;
        log('VISIT', `usr_stu${sm}`, 'Library visit / sign-in', ago(d, rnd() * 10));
      }
    }
    log('BOOK_CREATED', 'usr_lib1', 'Added “Zero to One” with 2 copies', ago(3), 'bk_25');
    log('BOOK_CREATED', 'usr_lib1', 'Added “Project Hail Mary” with 2 copies', ago(12), 'bk_07');
    log('BOOK_CREATED', 'usr_lib2', 'Added “The Midnight Library” with 3 copies', ago(20), 'bk_06');
    log('COPY_STATUS', 'usr_lib2', `${copy(16, 1)} marked LOST`, ago(9), copy(16, 1));
    log('COPY_STATUS', 'usr_lib1', `${copy(19, 1)} sent to MAINTENANCE`, ago(15), copy(19, 1));
    log('POLICY_UPDATED', 'usr_admin', 'Borrowing policy reviewed: max 3 books, 14-day loans', ago(30));
    log('MEMBER_STATUS', 'usr_admin', 'Sofia Rossi suspended (repeated late returns)', ago(18), 'mem_9');
    log('REQUEST_REJECTED', 'usr_lib2', 'Rejected checkout for Ethan Davis — no valid ID', ago(2));
    txs.forEach(t => {
      if (toMs(t.borrowedAt) > now - 45 * DAY_MS) {
        const m = members.find(x => x.id === t.memberId), u = users.find(x => x.id === m.userId), b = books.find(x => x.id === t.bookId);
        log('CHECKOUT_APPROVED', t.approvedBy, `${b.title} (${t.copyId}) → ${u.name}`, t.borrowedAt, t.id);
        if (t.returnedAt) log('RETURN_PROCESSED', t.returnedTo, `${b.title} (${t.copyId}) returned by ${u.name}`, t.returnedAt, t.id);
      }
    });
    logs.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

    /* ---------------- receipts for past returns & payments ---------------- */
    const receipts = [];
    const receipt = (type, memberId, staffUserId, at, lines, extra = {}) => receipts.push({
      id: `rct_${receipts.length + 1}`, type, number: `${{ RETURN: 'RT', PAYMENT: 'PAY', WAIVER: 'WV' }[type]}-${randomToken(6)}`, token: randomToken(20),
      memberId, staffUserId, lines, total: lines.reduce((s, l) => s + (l.fine ?? l.amount ?? 0), 0), notificationId: null, createdAt: at, updatedAt: at, ...extra,
    });
    txs.filter(t => t.returnedAt).forEach(t => receipt('RETURN', t.memberId, t.returnedTo, t.returnedAt,
      [{ txId: t.id, copyId: t.copyId, bookId: t.bookId, returnedAt: t.returnedAt, dueAt: t.dueAt, condition: 'GOOD', fine: t.fineAmount }]));
    fines.filter(f => f.status === 'PAID').forEach(f => receipt('PAYMENT', f.memberId, f.recordedBy, f.paidAt,
      [{ fineId: f.id, bookId: f.bookId, reason: f.reason, note: f.note, amount: f.amount }], { method: f.paidMethod }));

    /* ---------------- persist ---------------- */
    Store.wipe();
    Store.replaceAll('users', users);
    Store.replaceAll('members', members);
    Store.replaceAll('books', books);
    Store.replaceAll('bookCopies', copies);
    Store.replaceAll('borrowTransactions', txs);
    Store.replaceAll('fines', fines);
    Store.replaceAll('receipts', receipts);
    Store.replaceAll('reservations', reservations);
    Store.replaceAll('borrowRequests', requests);
    Store.replaceAll('borrowRequestItems', items);
    Store.replaceAll('notifications', notifications);
    Store.replaceAll('auditLogs', logs);
    Store.saveSettings(settings);
    Store.markSeeded();
  },
};
