'use strict';
/* ===========================================================================
 * common.js — screens shared by all roles: login, profile, notifications,
 * demo tools, error pages.
 * ======================================================================== */

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', label: 'Administrator', email: 'admin@library.com', pw: 'admin123', icon: 'shield-check' },
  { role: 'LIBRARIAN', label: 'Librarian', email: 'librarian@library.com', pw: 'library123', icon: 'library' },
  { role: 'STUDENT', label: 'Student', email: 'student@library.com', pw: 'student123', icon: 'graduation-cap' },
];

/** Signs in as a demo role without the form (used by demo tools & role switcher). */
function loginAs(role, silent = false) {
  const acc = DEMO_ACCOUNTS.find(a => a.role === role);
  const cur = Auth.current();
  if (cur && cur.role === role) return true;
  Sheet.closeAll();
  if (Scanner.isOpen()) Scanner.close(true);
  const r = Auth.login(acc.email, acc.pw, true);
  if (!r.ok) { Toast.show(r.error, 'error'); return false; }
  UI.returnSession = [];
  if (!silent) Toast.show(`Signed in as ${r.user.name}`, 'info', { title: acc.label });
  return true;
}

/* ---------------- Login ---------------- */
Screens.login = {
  render() {
    const s = Store.settings();
    return `<div class="scroll login">
      <div class="login-hero">
        <div class="logo-mark">${icon('library')}</div>
        <h1>Sign in</h1>
        <p>${esc(s.libraryName)} · ${esc(s.campus)}</p>
      </div>
      <form class="form login-form" data-submit="login" novalidate>
        <div class="field">
          <label for="lg-id">Email or Student ID</label>
          <div class="input-wrap">${icon('mail')}<input id="lg-id" name="identifier" autocomplete="username" inputmode="email" placeholder="you@library.com or STU-10231" required></div>
          <div class="field-error" data-err="identifier"></div>
        </div>
        <div class="field">
          <label for="lg-pw">Password</label>
          <div class="input-wrap">${icon('lock')}<input id="lg-pw" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>
            <button type="button" class="input-btn" data-action="togglePassword" data-target="lg-pw" aria-label="Show password">${icon('eye')}</button></div>
          <div class="field-error" data-err="password"></div>
        </div>
        <div class="row-between">
          <label class="check"><input type="checkbox" name="remember" checked><span class="check-box">${icon('check')}</span>Remember me</label>
          <button type="button" class="link" data-action="forgotPassword">Forgot password?</button>
        </div>
        <button class="btn primary block lg" type="submit">Sign in</button>
      </form>
      <h4 class="group-label">Demo accounts</h4>
      <div class="demo-accounts">
        ${DEMO_ACCOUNTS.map(a => `<button class="demo-acc" data-action="fillDemo" data-email="${a.email}" data-pw="${a.pw}">
          <span class="demo-ic">${icon(a.icon)}</span>
          <span class="demo-txt"><b>${a.label}</b><small>${a.email}</small></span>${icon('chevron-right', 'muted')}</button>`).join('')}
      </div>
      <p class="fineprint">${icon('info')} Demo authentication only — accounts live in this browser’s storage. Replace with server-side auth before production.</p>
      <button class="btn ghost block" data-action="go" data-to="demo">${icon('wrench')} Developer demo tools</button>
    </div>`;
  },
};
Object.assign(Actions, {
  login: (form) => {
    const d = formData(form);
    const errs = {};
    if (!d.identifier.trim()) errs.identifier = 'Enter your email or student ID';
    if (!d.password) errs.password = 'Enter your password';
    if (Object.keys(errs).length) return showErrors(form, errs);
    withLoading(form.querySelector('[type=submit]'), () => {
      const r = Auth.login(d.identifier, d.password, d.remember);
      if (!r.ok) return showErrors(form, { password: r.error });
      UI.returnSession = [];
      Toast.show(`${greeting()}, ${r.user.name.split(' ')[0]}!`, 'success');
      Router.reset();
    }, 550);
  },
  fillDemo: el => {
    const form = $('.login-form');
    form.identifier.value = el.dataset.email;
    form.password.value = el.dataset.pw;
    haptic(8);
    form.requestSubmit ? form.requestSubmit() : Actions.login(form);
  },
  forgotPassword: () => Sheet.open({
    title: 'Reset password',
    body: `<p class="muted">In production this sends a reset link to your registered email. For this prototype, use one of the demo accounts:</p>
      <ul class="plain-list">${DEMO_ACCOUNTS.map(a => `<li><b>${a.label}</b><code>${a.email} / ${a.pw}</code></li>`).join('')}</ul>`,
    footer: `<button class="btn primary block" data-action="closeSheet">Got it</button>`,
  }),
});

/* ---------------- Profile (all roles) ---------------- */
Screens.profile = {
  roles: ['ADMIN', 'LIBRARIAN', 'STUDENT'], tab: true,
  render() {
    const u = Auth.current();
    const s = Store.settings();
    const row = (ic, label, attrs, sub = '', value = '') => `<button class="menu-row" ${attrs}><span class="menu-ic">${icon(ic)}</span><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${value !== '' ? `<span class="menu-value">${value}</span>` : ''}${icon('chevron-right', 'muted')}</button>`;
    const group = (title, rows) => `<div class="menu-group"><h4>${title}</h4>${rows.filter(Boolean).join('')}</div>`;
    const sections = { STUDENT: profileStudent, LIBRARIAN: profileLibrarian, ADMIN: profileAdmin }[u.role](u, row, group);
    const m = Auth.member();
    const status = m ? (Services.isMembershipValid(m) ? badge('ACTIVE', 'Member in good standing') : badge('SUSPENDED', 'Membership inactive'))
      : u.title ? `<span class="badge gray">${esc(u.title)}</span>` : '';
    return `${Header({ title: 'Profile', large: true, actions: [bellAction()] })}
      <div class="scroll"><div class="pad">
        <div class="profile-card">
          <label class="avatar-edit" aria-label="Change profile photo">
            ${avatar(u, 56)}<span class="avatar-cam">${icon('camera')}</span>
            <input type="file" accept="image/*" class="sr-only" data-change="profilePhoto">
          </label>
          <h2>${esc(u.name)}</h2>
          <p class="muted">${esc(u.email)}</p>
          <div class="row-center gap8">${badge(u.role)}${status}</div>
        </div>
        ${sections}
        ${group('Account', [
          row('user-cog', 'Edit profile', 'data-action="editProfile"'),
          row('bell', 'Notifications', 'data-action="go" data-to="notifications"', '', Services.unreadCount(u.id) || ''),
        ])}
        ${group('App', [
          row('repeat', 'Switch demo role', 'data-action="switchRole"'),
          row('wrench', 'Developer demo tools', 'data-action="go" data-to="demo"'),
          row('info', 'About this prototype', 'data-action="about"'),
        ])}
        <button class="btn danger-ghost block" data-action="logout">${icon('log-out')} Sign out</button>
        <p class="fineprint center">${esc(s.libraryName)} · v1.0 prototype</p>
      </div></div>`;
  },
};

/* Student: their card, their reading, their money, and help with borrowing. */
function profileStudent(u, row, group) {
  const m = Auth.member(), s = Store.settings();
  const owed = Services.outstanding(m.id);
  const loans = Services.activeLoans(m.id);
  const holds = Store.count('reservations', r => r.memberId === m.id && ['WAITING', 'READY'].includes(r.status));
  return `
    <button class="mini-card" data-action="go" data-to="memberCard">
      <span class="mini-card-ic">${icon('credit-card')}</span>
      <div><b>Library card</b><small>${esc(m.studentId)} · valid until ${fmtDate(m.expiresAt)}</small></div>${icon('chevron-right', 'muted')}
    </button>
    <div class="stats-inline">
      <div><b>${loans.length}/${s.maxBorrow}</b><small>Borrowed</small></div>
      <div><b>${Store.count('borrowTransactions', t => t.memberId === m.id)}</b><small>All-time loans</small></div>
      ${FEATURES.fines ? `<div><b class="${owed.total ? 'text-red' : ''}">${money(owed.total)}</b><small>Fines</small></div>` : `<div><b class="${Services.overdueLoans(m.id).length ? 'text-red' : ''}">${Services.overdueLoans(m.id).length}</b><small>Overdue</small></div>`}
    </div>
    ${group('My library', [
      row('book-open', 'My books', 'data-action="tab" data-to="mybooks"', '', loans.length || ''),
      row('bookmark', 'Reservations', 'data-action="profileMyBooks" data-value="reservations"', '', holds || ''),
      FEATURES.fines && row('wallet', 'Fines', 'data-action="go" data-to="fines"', '', owed.total ? money(owed.total) : ''),
      row('receipt', 'Receipts', 'data-action="go" data-to="receipts"', FEATURES.fines ? 'Proof of returns and payments' : 'Proof of your returns'),
    ])}
    ${group('Help', [
      row('help-circle', 'How borrowing works', 'data-action="howBorrowing"'),
      row('clock', 'Opening hours & contact', 'data-action="libraryInfo"'),
    ])}`;
}

/* Librarian: what they did at the desk today, desk tools, their recent activity. */
function profileLibrarian(u, row, group) {
  const txs = Store.all('borrowTransactions');
  const lent = txs.filter(t => t.approvedBy === u.id && isToday(t.borrowedAt)).length;
  const received = txs.filter(t => t.returnedTo === u.id && isToday(t.returnedAt)).length;
  const taken = Store.filter('receipts', r => r.type === 'PAYMENT' && r.staffUserId === u.id && isToday(r.createdAt)).reduce((sum, r) => sum + r.total, 0);
  const mine = Store.filter('auditLogs', l => l.userId === u.id && !['VISIT', 'LOGIN'].includes(l.action)).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 4);
  return `
    <h4 class="group-label">Your desk today</h4>
    <div class="stats-inline mt0">
      <div><b>${lent}</b><small>Books lent</small></div>
      <div><b>${received}</b><small>Returns</small></div>
      ${FEATURES.fines ? `<div><b>${money(taken)}</b><small>Collected</small></div>` : ''}
    </div>
    ${deskGroup(row, group)}
    <div class="menu-group"><h4>Your recent activity</h4>
      ${mine.length ? `<ol class="timeline compact">${mine.map(l => `<li><span class="tl-ic">${icon(LOG_ICONS[l.action] || 'activity')}</span><div><b>${esc(l.detail)}</b><small>${relTime(l.createdAt)}</small></div></li>`).join('')}</ol>`
        : `<div class="empty-inline">Nothing recorded yet today.</div>`}
    </div>`;
}

/* Admin: library-wide picture, administration, plus the desk tools they also use. */
function profileAdmin(u, row, group) {
  const users = Store.all('users');
  const unpaid = Store.filter('fines', f => f.status === 'UNPAID').reduce((sum, f) => sum + f.amount, 0);
  return `
    <h4 class="group-label">Library at a glance</h4>
    <div class="stats-inline mt0">
      <div><b>${Store.count('members', m => Services.isMembershipValid(m))}</b><small>Active members</small></div>
      <div><b>${users.filter(x => x.role !== 'STUDENT' && x.active).length}</b><small>Staff</small></div>
      ${FEATURES.fines ? `<div><b class="${unpaid ? 'text-red' : ''}">${money(unpaid)}</b><small>Unpaid fees</small></div>` : `<div><b>${Store.count('borrowTransactions', t => t.status === 'OVERDUE')}</b><small>Overdue loans</small></div>`}
    </div>
    ${group('Administration', [
      row('users', 'Users & roles', 'data-action="go" data-to="users"', '', users.length),
      row('book-lock', 'Borrowing & fine policies', 'data-action="go" data-to="policies"'),
      row('file-bar-chart', 'Reports', 'data-action="go" data-to="reports"'),
      row('scroll-text', 'Activity log', 'data-action="go" data-to="activity"'),
      row('settings', 'Library settings', 'data-action="go" data-to="settings"'),
    ])}
    ${deskGroup(row, group)}`;
}
function deskGroup(row, group) {
  return group('Library desk', [
    row('users', 'Member records', 'data-action="go" data-to="members"'),
    row('alarm-clock', 'Overdue books', 'data-action="go" data-to="overdue"', '', Store.count('borrowTransactions', t => t.status === 'OVERDUE') || ''),
    row('bookmark', 'Reservation queues', 'data-action="go" data-to="reservations"'),
    FEATURES.fines && row('wallet', 'Fines & payments', 'data-action="go" data-to="finesDesk"'),
    row('receipt', 'Receipts', 'data-action="go" data-to="receipts"', FEATURES.fines ? 'Returns and payments issued' : 'Return receipts issued'),
  ]);
}
Object.assign(Actions, {
  profilePhoto: async (input) => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) return Toast.show('Please choose an image file', 'error');
    if (f.size > 5 * 1024 * 1024) return Toast.show('Image must be under 5 MB', 'error');
    try {
      const data = await compressImage(f, 240, 0.85);
      Store.update('users', Auth.current().id, { photo: data });
      Toast.show('Profile photo updated');
      Router.refresh();
    } catch (e) { Toast.show(e.message, 'error'); }
  },
  profileMyBooks: el => { UI.mybooks = el.dataset.value; Router.tab('mybooks'); },
  howBorrowing: () => {
    const p = Store.settings();
    Sheet.open({
      title: 'How borrowing works',
      body: `<ol class="steps">
        <li><b>Find a book</b><span>Take it from the shelf, then scan the QR label on it — or tap “Add to Borrow Cart” on the book’s page.</span></li>
        <li><b>Show your checkout QR</b><span>In your cart, tap “Generate Checkout QR” and show it at the counter. It stays valid while the screen is open.</span></li>
        <li><b>The librarian scans your books</b><span>Each book is scanned as it’s handed over. Your loan starts and the due date is set.</span></li>
        <li><b>Return any time before the due date</b><span>Bring each book back whenever you’re done — not all at once. You get a receipt in the app.</span></li>
      </ol>
      <p class="hint">Up to ${p.maxBorrow} books · ${p.loanDays}-day loans${FEATURES.fines ? ` · ${money(p.finePerDay)}/day after the due date` : ' · reminders before each due date'}.</p>`,
      footer: '<button class="btn primary block" data-action="closeSheet">Got it</button>',
    });
  },
  libraryInfo: () => {
    const s = Store.settings();
    Sheet.open({
      title: s.libraryName,
      body: `<div class="card info-list">${infoRow('Branch', esc(s.campus))}${infoRow('Opening hours', esc(s.openingHours))}${infoRow('Email', `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>`)}</div>`,
    });
  },
  editProfile: () => {
    const u = Auth.current();
    Sheet.open({
      title: 'Edit profile',
      body: `<form class="form" id="profile-form" data-submit="saveProfile" novalidate>
        <div class="field"><label for="pf-name">Full name</label><input id="pf-name" name="name" value="${esc(u.name)}" required><div class="field-error" data-err="name"></div></div>
        <div class="field"><label for="pf-phone">Phone</label><input id="pf-phone" name="phone" type="tel" inputmode="tel" value="${esc(u.phone || '')}"></div>
        <div class="field"><label for="pf-email">Email</label><input id="pf-email" value="${esc(u.email)}" disabled><small class="hint">Contact an administrator to change your email.</small></div>
      </form>`,
      footer: `<button class="btn primary block" type="submit" form="profile-form">Save changes</button>`,
    });
  },
  saveProfile: form => {
    const d = formData(form);
    if (!d.name.trim()) return showErrors(form, { name: 'Name is required' });
    Store.update('users', Auth.current().id, { name: d.name.trim(), phone: d.phone.trim() });
    Sheet.close();
    Toast.show('Profile updated');
    Router.refresh();
  },
  logout: async () => {
    const ok = await Sheet.confirm({ title: 'Sign out?', message: 'Your data stays saved on this device.', confirmText: 'Sign out', danger: true, icon: 'log-out' });
    if (!ok) return;
    Auth.logout();
    Toast.show('Signed out', 'info');
    Router.reset('login');
  },
  switchRole: () => Sheet.open({
    title: 'Switch demo role',
    body: `<div class="demo-accounts">${DEMO_ACCOUNTS.map(a => `<button class="demo-acc ${Auth.role() === a.role ? 'current' : ''}" data-action="loginAs" data-role="${a.role}">
      <span class="demo-ic">${icon(a.icon)}</span><span class="demo-txt"><b>${a.label}</b><small>${a.email}</small></span>
      ${Auth.role() === a.role ? '<span class="badge green">Current</span>' : icon('chevron-right', 'muted')}</button>`).join('')}</div>`,
  }),
  loginAs: el => { if (loginAs(el.dataset.role)) Router.reset(); },
  about: () => Sheet.open({
    title: 'About this prototype',
    body: `<div class="prose">
      <p><b>${esc(Store.settings().libraryName)}</b> is a front-end prototype of a mobile library management system, built to be migrated to Flutter or React Native.</p>
      <ul>
        <li>All data is stored in <code>localStorage</code> via a single data-access layer (<code>Store</code>) that can be swapped for REST calls.</li>
        <li>Business rules live in <code>Services</code> and are shared by every screen.</li>
        <li><b>Demo-only authentication.</b> Production needs server-side auth.</li>
        <li><b>Concurrency:</b> a real deployment must validate checkouts in a server-side database transaction with row locks, so two counters can never lend the same copy.</li>
      </ul></div>`,
  }),
});

/* ---------------- Notifications ---------------- */
const NOTIF_META = {
  CHECKOUT_APPROVED: ['check-circle-2', 'green'], CHECKOUT_REJECTED: ['x-circle', 'red'], RETURN_CONFIRMED: ['undo-2', 'green'],
  DUE_SOON: ['clock', 'amber'], OVERDUE: ['alert-triangle', 'red'], RESERVATION_READY: ['bookmark-check', 'green'],
  RESERVATION_QUEUED: ['bookmark', 'blue'], FINE_ADDED: ['wallet', 'red'], PAYMENT_RECEIVED: ['receipt', 'green'], FINE_WAIVED: ['hand-coins', 'green'], REQUEST_NEW: ['inbox', 'blue'], WELCOME: ['party-popper', 'green'], SYSTEM: ['info', 'gray'],
};
Screens.notifications = {
  roles: ['ADMIN', 'LIBRARIAN', 'STUDENT'],
  render() {
    const u = Auth.current();
    const list = Services.notificationsFor(u.id);
    const unread = list.filter(n => !n.read).length;
    const groups = { Today: [], 'This week': [], Earlier: [] };
    list.forEach(n => {
      const d = daysBetween(n.createdAt, Date.now());
      (d === 0 ? groups.Today : d < 7 ? groups['This week'] : groups.Earlier).push(n);
    });
    const item = n => {
      const [ic, tone] = NOTIF_META[n.type] || NOTIF_META.SYSTEM;
      return `<button class="notif ${n.read ? '' : 'unread'}" data-action="openNotif" data-id="${n.id}">
        <span class="notif-ic ${tone}">${icon(ic)}</span>
        <div class="notif-body"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${relTime(n.createdAt)}</small></div>
        ${n.read ? '' : '<span class="unread-dot" aria-label="Unread"></span>'}</button>`;
    };
    return `${Header({ title: 'Notifications', subtitle: unread ? `${unread} unread` : 'All caught up', back: true, actions: unread ? [{ icon: 'check-check', action: 'markAllRead', label: 'Mark all as read' }] : [] })}
      <div class="scroll"><div class="pad">
        ${list.length ? Object.entries(groups).filter(([, v]) => v.length).map(([k, v]) => `<h4 class="group-label">${k}</h4><div class="notif-list">${v.map(item).join('')}</div>`).join('')
          : emptyState({ icon: 'bell-off', title: 'No notifications yet', text: 'Updates about your loans, reservations and fines appear here.' })}
      </div></div>`;
  },
};
Object.assign(Actions, {
  openNotif: el => {
    const n = Store.get('notifications', el.dataset.id);
    if (!n) return;
    Services.markRead(n.id);
    if (n.link && n.link.to && Screens[n.link.to]) {
      const sc = Screens[n.link.to];
      if (!sc.roles || sc.roles.includes(Auth.role())) {
        if (n.link.tab) UI.mybooks = n.link.tab;
        return Router.go(n.link.to, { id: n.link.id });
      }
    }
    Router.refresh();
  },
  markAllRead: () => { Services.markAllRead(Auth.current().id); Toast.show('All notifications marked as read'); Router.refresh(); },
});

/* ---------------- Error screens ---------------- */
Screens.error = {
  render({ code = 404, message = '' }) {
    const meta = {
      401: ['lock', 'Please sign in', 'You need to sign in to view this screen.'],
      403: ['shield-alert', 'Access restricted', 'Your role does not have permission to open this screen.'],
      404: ['map', 'Screen not found', 'The page you’re looking for doesn’t exist.'],
      500: ['bug', 'Something went wrong', message || 'An unexpected error occurred while rendering this screen.'],
    }[code] || ['alert-circle', 'Error', message];
    return `${Header({ title: '', back: Router.stack.length > 1 })}
      <div class="scroll"><div class="pad error-screen">
        <div class="error-code">${code}</div>
        ${emptyState({ icon: meta[0], title: meta[1], text: meta[2], action: `<div class="row-center gap8">${code === 500 ? `<button class="btn ghost" data-action="retryRender">${icon('refresh-cw')} Retry</button>` : ''}<button class="btn primary" data-action="goHome">${icon('home')} ${Auth.current() ? 'Go home' : 'Sign in'}</button></div>` })}
      </div></div>`;
  },
};
Actions.goHome = () => Router.reset();
Actions.retryRender = () => Router.refresh();

/* ---------------- Demo tools ---------------- */
Screens.demo = {
  render() {
    const u = Auth.current();
    const copies = Store.all('bookCopies');
    const opt = c => { const b = Services.book(c.bookId); return `<option value="${c.id}">${c.id} · ${esc(truncate(b?.title, 26))} (${c.status.toLowerCase()})</option>`; };
    const members = Store.all('members');
    const pending = Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING);
    const activeTx = Store.filter('borrowTransactions', t => t.status !== 'RETURNED');
    const steps = [
      ['STUDENT', 'Student browses & scans', 'Explore → scan a book → add to cart → Generate Checkout QR', 'explore'],
      ['LIBRARIAN', 'Librarian approves', 'Scan → Checkout QR → review → approve', 'scanHub'],
      ['STUDENT', 'Student sees the loan', 'My Books → Currently borrowed', 'mybooks'],
      ['LIBRARIAN', 'Librarian processes return', 'Scan → Book return → confirm', 'scanHub'],
      ['STUDENT', 'Student sees history', 'My Books → History', 'mybooks'],
      ['ADMIN', 'Admin sees updated stats', 'Dashboard → statistics', 'adminDashboard'],
    ];
    return `${Header({ title: 'Demo tools', subtitle: 'Developer only', back: true })}
      <div class="scroll"><div class="pad">
        <div class="callout info">${icon('flask-conical')}<div><b>Demonstrate everything without a camera.</b><p>Simulations run the same business logic as real scans.</p></div></div>

        ${sectionTitle('Active session')}
        <div class="card">
          ${u ? `<div class="row gap12">${avatar(u, 40)}<div class="grow"><b>${esc(u.name)}</b><small class="muted block">${esc(u.email)}</small></div>${badge(u.role)}</div>` : '<p class="muted">Not signed in.</p>'}
          <div class="role-switch">${DEMO_ACCOUNTS.map(a => `<button class="btn sm ${u?.role === a.role ? 'primary' : 'ghost'}" data-action="demoRole" data-role="${a.role}">${icon(a.icon)} ${a.label}</button>`).join('')}</div>
        </div>

        ${sectionTitle('Guided demo journey')}
        <ol class="journey">${steps.map(([role, t, d, to], i) => `<li><span class="j-num">${i + 1}</span><div class="grow"><b>${t}</b><small>${d}</small></div><button class="btn sm ghost" data-action="demoJump" data-role="${role}" data-to="${to}">Go</button></li>`).join('')}</ol>

        ${sectionTitle('Simulate book QR scan')}
        <div class="card form">
          <div class="field"><label for="d-copy">Physical copy</label><select id="d-copy">${copies.map(opt).join('')}</select></div>
          <div class="row gap8"><button class="btn primary sm grow" data-action="demoBookScan" data-as="STUDENT">${icon('graduation-cap')} Scan as student</button>
          <button class="btn ghost sm grow" data-action="demoBookScan" data-as="LIBRARIAN">${icon('library')} Look up as librarian</button></div>
        </div>

        ${sectionTitle('Simulate membership QR scan')}
        <div class="card form">
          <div class="field"><label for="d-mem">Member</label><select id="d-mem">${members.map(m => `<option value="${m.id}">${esc(Services.memberName(m.id))} · ${m.studentId}</option>`).join('')}</select></div>
          <button class="btn primary sm block" data-action="demoMemberScan">${icon('contact')} Scan membership card</button>
        </div>

        ${sectionTitle('Simulate checkout QR scan')}
        <div class="card">
          ${pending.length ? pending.map(r => `<div class="row gap12 demo-req"><div class="grow"><b>${r.code}</b><small class="muted block">${esc(Services.memberName(r.memberId))} · ${plural(Services.requestItems(r.id).length, 'book')} · expires ${fmtTime(r.expiresAt)}</small></div><button class="btn sm primary" data-action="demoReqScan" data-id="${r.id}">Scan</button></div>`).join('')
            : '<p class="muted small">No pending checkout requests.</p>'}
          <button class="btn ghost sm block" data-action="demoCreateRequest">${icon('plus')} Create a sample pending request</button>
        </div>

        ${sectionTitle('Simulate book return')}
        <div class="card form">
          <div class="field"><label for="d-ret">Active loan</label><select id="d-ret">${activeTx.map(t => `<option value="${t.copyId}">${t.copyId} · ${esc(truncate(Services.book(t.bookId)?.title, 20))} — ${esc(Services.memberName(t.memberId))}${t.status === 'OVERDUE' ? ' (overdue)' : ''}</option>`).join('')}</select></div>
          <button class="btn primary sm block" data-action="demoReturn" ${activeTx.length ? '' : 'disabled'}>${icon('undo-2')} Scan for return</button>
        </div>

        ${sectionTitle('Time & data')}
        <div class="card stack8">
          <button class="btn ghost block" data-action="demoOverdue">${icon('alarm-clock')} Generate overdue records</button>
          <button class="btn ghost block" data-action="demoExpire">${icon('timer-off')} Expire all pending QR requests</button>
          <button class="btn ghost block" data-action="demoExport">${icon('download')} Export data (JSON)</button>
          <button class="btn danger block" data-action="demoReset">${icon('rotate-ccw')} Reset demo data</button>
          <p class="fineprint">Storage used: ${(Store.usageBytes() / 1024).toFixed(0)} KB</p>
        </div>
      </div></div>`;
  },
};
Object.assign(Actions, {
  demoRole: el => { if (loginAs(el.dataset.role)) Router.refresh(); },
  demoJump: el => { if (!loginAs(el.dataset.role, true)) return; Router.reset(el.dataset.to); },
  demoBookScan: el => {
    const id = $('#d-copy').value;
    if (el.dataset.as === 'STUDENT') {
      if (!loginAs('STUDENT')) return;
      Router.reset('home');
      const r = Services.addToCart(Auth.member().id, id);
      Toast.show(r.ok ? `“${r.book.title}” added to your cart` : r.error, r.ok ? 'success' : 'error', { title: r.ok ? 'Book scanned' : 'Cannot add' });
      if (r.ok) Router.go('cart');
    } else {
      if (!Auth.is('LIBRARIAN', 'ADMIN') && !loginAs('LIBRARIAN')) return;
      Router.reset('scanHub');
      openCopySheet(id);
    }
  },
  demoMemberScan: () => {
    const id = $('#d-mem').value;
    if (!Auth.is('LIBRARIAN', 'ADMIN') && !loginAs('LIBRARIAN')) return;
    Router.reset('scanHub');
    Router.go('memberDetail', { id });
  },
  demoReqScan: el => {
    if (!Auth.is('LIBRARIAN', 'ADMIN') && !loginAs('LIBRARIAN')) return;
    Router.reset('scanHub');
    Router.go('requestReview', { id: el.dataset.id });
  },
  demoCreateRequest: () => {
    // pick an eligible member (not the main demo student) and 1–2 free copies
    const p = Store.settings();
    const mem = Store.all('members').filter(m => m.id !== 'mem_1').find(m => Services.eligibility(m.id, 1).ok && !Services.pendingRequestOf(m.id));
    if (!mem) return Toast.show('No eligible member available', 'warn');
    const n = Math.min(2, p.maxBorrow - Services.activeLoans(mem.id).length);
    const free = Store.filter('bookCopies', c => c.status === 'AVAILABLE').filter(c => Services.copyCheck(c.id, mem.id).ok && !Services.activeLoans(mem.id).some(t => t.bookId === c.bookId));
    const picked = [];
    for (const c of free.sort(() => Math.random() - 0.5)) { if (picked.length >= n) break; if (!picked.some(x => x.bookId === c.bookId)) picked.push(c); }
    Store.update('members', mem.id, { cart: picked.map(c => c.id) });
    const r = Services.createCheckoutRequest(mem.id);
    Toast.show(r.ok ? `${r.request.code} created for ${Services.memberName(mem.id)}` : r.error, r.ok ? 'success' : 'error');
    Router.refresh();
  },
  demoReturn: () => {
    const id = $('#d-ret').value;
    if (!id) return;
    if (!Auth.is('LIBRARIAN', 'ADMIN') && !loginAs('LIBRARIAN')) return;
    Router.reset('scanHub');
    Router.go('returnReview', { id });
  },
  demoOverdue: () => {
    const p = Store.settings();
    const candidates = Store.filter('borrowTransactions', t => t.status === 'ACTIVE');
    const others = candidates.filter(t => t.memberId !== 'mem_1');
    const pick = (others.length ? others : candidates).slice(0, 2);
    if (!pick.length) return Toast.show('No active loans to make overdue', 'warn');
    pick.forEach((t, i) => {
      const late = 3 + i * 4;
      const borrowed = Date.now() - (p.loanDays + late) * DAY_MS;
      Store.update('borrowTransactions', t.id, { borrowedAt: iso(borrowed), dueAt: iso(endOfDay(borrowed + p.loanDays * DAY_MS)) });
    });
    Services.refreshStatuses();
    Services.log('DEMO', `Generated ${pick.length} overdue record(s)`);
    Toast.show(`${plural(pick.length, 'loan')} backdated to overdue`, 'warn');
    Router.refresh();
  },
  demoExpire: () => {
    const list = Store.filter('borrowRequests', r => r.status === REQ_STATUS.PENDING);
    list.forEach(r => Store.update('borrowRequests', r.id, { expiresAt: iso(Date.now() - 1000) }));
    Services.refreshStatuses();
    Toast.show(`${plural(list.length, 'request')} expired`, 'info');
    Router.refresh();
  },
  demoExport: () => downloadFile(`library-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(Store.exportAll(), null, 2), 'application/json'),
  demoReset: async () => {
    const ok = await Sheet.confirm({ title: 'Reset all demo data?', message: 'Every change is discarded and the sample dataset is regenerated. You will stay signed in when possible.', confirmText: 'Reset data', danger: true, icon: 'rotate-ccw' });
    if (!ok) return;
    const role = Auth.role();
    Seed.run();
    UI.returnSession = [];
    if (role) loginAs(role, true);
    Toast.show('Demo data has been reset');
    Router.reset(Auth.current() ? 'demo' : 'login');
  },
});