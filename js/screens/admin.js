'use strict';
/* ===========================================================================
 * admin.js — Administrator: analytics dashboard, management hub, users &
 * roles, borrowing/fine policies, reports, activity logs, settings.
 * ======================================================================== */

const ADMIN = ['ADMIN'];
let pendingIdPhoto = null; // ID card photo captured in the add-user sheet, until the form is submitted

/* ---------------- Dashboard ---------------- */
Screens.adminDashboard = {
  roles: ADMIN, tab: true, skeleton: 'Dashboard',
  render() {
    const u = Auth.current();
    const S = Stats.admin(UI.adminRange);
    const c = S.cards;
    const maxTop = Math.max(1, ...S.top.map(t => t.count));
    return `<header class="home-header">
        <button class="home-user" data-action="tab" data-to="profile">${avatar(u, 44)}<div><small>${fmtDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' })}</small><b>Library overview</b></div></button>
        <div class="hdr-actions"><button class="icon-btn" data-action="go" data-to="reports" aria-label="Reports">${icon('file-bar-chart')}</button>
        <button class="icon-btn" data-action="go" data-to="notifications" aria-label="Notifications">${icon('bell')}${Services.unreadCount(u.id) ? `<span class="dot-badge">${Services.unreadCount(u.id)}</span>` : ''}</button></div>
      </header>
      <div class="sticky-tools">${segmented('range', Object.entries(RANGES).map(([k, r]) => [k, r.label.replace(' days', 'D').replace(' months', 'M').replace(' year', 'Y')]), UI.adminRange, 'adminRange')}</div>
      <div class="scroll"><div class="pad">
        <div class="metrics c2">
          ${statCard({ label: 'Borrowed books', value: c.borrowed.value, delta: c.borrowed.delta, action: 'txFilter', attrs: 'data-value="borrowed"' })}
          ${statCard({ label: 'Returned books', value: c.returned.value, delta: c.returned.delta, action: 'txFilter', attrs: 'data-value="returned"' })}
          ${statCard({ label: 'Overdue books', value: c.overdue.value, warn: true, sub: 'right now', action: 'go', attrs: 'data-to="overdue"' })}
          ${statCard({ label: 'Missing books', value: c.missing.value, sub: 'marked lost', action: 'invAttention' })}
          ${statCard({ label: 'Total books', value: c.totalBooks.value, sub: c.totalBooks.sub, action: 'tab', attrs: 'data-to="inventory"' })}
          ${statCard({ label: 'Visitors', value: c.visitors.value, delta: c.visitors.delta })}
          ${statCard({ label: 'New members', value: c.newMembers.value, delta: c.newMembers.delta, action: 'go', attrs: 'data-to="users"' })}
          ${FEATURES.fines
            ? statCard({ label: 'Pending fees', value: money(c.pendingFees.value), warn: true, sub: 'incl. accruing', action: 'go', attrs: 'data-to="finesDesk"' })
            : statCard({ label: 'On loan now', value: Store.count('borrowTransactions', t => t.status !== 'RETURNED'), sub: 'active loans', action: 'txFilter', attrs: 'data-value="borrowed"' })}
        </div>

        <section class="chart-card">
          <div class="chart-head"><div><h3>Checkouts</h3><small>Last ${S.range.label}</small></div>
          <div class="legend"><span><i style="background:${CHART.borrowed}"></i>Borrowed</span><span><i style="background:${CHART.returned}"></i>Returned</span></div></div>
          <div class="chart-box"><canvas id="ad-line" role="img" aria-label="Borrowed and returned books over time"></canvas></div>
        </section>
        <div class="split">
          <section class="chart-card">
            <div class="chart-head"><div><h3>By weekday</h3><small>Checkouts</small></div></div>
            <div class="chart-box sm"><canvas id="ad-week" role="img" aria-label="Checkouts by day of week"></canvas></div>
          </section>
          <section class="chart-card">
            <div class="chart-head"><div><h3>By category</h3><small>Share of loans</small></div></div>
            ${S.categories.length ? `<ul class="bar-list">${S.categories.slice(0, 5).map(([k, v]) => `<li><span class="clamp1">${esc(k)}</span><b>${v}</b><i style="width:${(v / S.categories[0][1]) * 100}%"></i></li>`).join('')}</ul>` : `<div class="empty-inline">No loans in this period</div>`}
          </section>
        </div>

        ${sectionTitle('Top borrowed books')}
        <div class="rank-list">${S.top.length ? S.top.map((t, i) => `<button class="rank-row" data-action="go" data-to="bookManage" data-id="${t.book.id}"><span class="rank">${i + 1}</span>${cover(t.book, 'xs')}
          <div class="grow"><b class="clamp1">${esc(t.book.title)}</b><div class="bar"><span style="width:${(t.count / maxTop) * 100}%"></span></div></div><span class="num">${t.count}</span></button>`).join('') : `<div class="empty-inline">No loans in this period</div>`}</div>

        ${sectionTitle('New arrivals', { action: 'tab', attrs: 'data-to="inventory"' })}
        <div class="shelf scroll-x">${S.newArrivals.map(b => `<button class="shelf-item" data-action="go" data-to="bookManage" data-id="${b.id}">${cover(b)}<b class="clamp2">${esc(b.title)}</b><small>${relTime(b.createdAt)}</small></button>`).join('')}</div>

        ${sectionTitle('Recently checked out', { action: 'txFilter', attrs: 'data-value="borrowed"' })}
        ${S.recent.map(t => bookRow(Services.book(t.bookId), { sub: `${esc(Services.memberName(t.memberId))} · ${relTime(t.borrowedAt)}`, right: badge(t.status), action: 'txDetail', attrs: `data-id="${t.id}"` })).join('')}

        ${sectionTitle('Overdue history', { action: 'txFilter', attrs: 'data-value="overdue"' })}
        <div class="stack8">${S.overdueHistory.length ? S.overdueHistory.map(t => {
          const b = Services.book(t.bookId);
          const f = t.status === 'RETURNED' ? { days: daysBetween(t.dueAt, t.returnedAt), amount: t.fineAmount } : Services.calcFine(t);
          return `<button class="od-card" data-action="txDetail" data-id="${t.id}">
            <div class="row-between"><b class="clamp1">${esc(b?.title)}</b>${badge(t.status === 'RETURNED' ? 'RETURNED' : 'OVERDUE', t.status === 'RETURNED' ? 'Returned late' : 'Overdue')}</div>
            <div class="od-grid"><div><small>Member</small><span>${esc(Services.memberName(t.memberId))}</span></div><div><small>Due</small><span>${fmtShort(t.dueAt)}</span></div>
            <div><small>Days late</small><span class="text-red">${f.days}</span></div>${FEATURES.fines ? `<div><small>Fine</small><span>${money(f.amount)}</span></div>` : `<div><small>Returned</small><span>${t.returnedAt ? fmtShort(t.returnedAt) : 'Not yet'}</span></div>`}</div></button>`;
        }).join('') : `<div class="empty-inline">${icon('party-popper')} No overdue history</div>`}</div>
      </div></div>`;
  },
  mount() {
    const S = Stats.admin(UI.adminRange);
    const line = $('#ad-line');
    if (line) {
      const ctx = line.getContext('2d');
      Charts.make(line, {
        type: 'line',
        data: {
          labels: S.series.labels,
          datasets: [
            { label: 'Borrowed', data: S.series.borrowed, borderColor: CHART.borrowed, backgroundColor: Charts.gradient(ctx, CHART.borrowed), fill: true, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
            { label: 'Returned', data: S.series.returned, borderColor: CHART.returned, backgroundColor: 'transparent', cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, borderWidth: 1.5 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: Charts.axes() },
      });
    }
    Charts.make($('#ad-week'), {
      type: 'bar',
      data: { labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], datasets: [{ label: 'Checkouts', data: S.weekly, backgroundColor: S.weekly.map(v => (v === Math.max(...S.weekly) ? CHART.borrowed : CHART.series[2])), borderRadius: 3, barPercentage: 0.7 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { ...Charts.axes(), y: { display: false, beginAtZero: true } } },
    });
  },
};
Actions.adminRange = el => { UI.adminRange = el.dataset.value; haptic(6); Router.refresh(); };
Actions.invAttention = () => { UI.inventory.filter = 'attention'; Router.tab('inventory'); };

/* ---------------- Management hub ---------------- */
Screens.manage = {
  roles: ADMIN, tab: true,
  render() {
    const users = Store.all('users');
    const p = Store.settings();
    const unpaid = Store.filter('fines', f => f.status === 'UNPAID').reduce((s, f) => s + f.amount, 0);
    // [icon, label, value shown on the right, destination]
    const groups = [
      ['People', [
        ['users', 'Users', users.length, 'users'],
        ['shield-check', 'Roles & permissions', `${users.filter(u => u.role !== 'STUDENT').length} staff`, 'roles'],
        ['contact', 'Member records', Store.count('members'), 'members'],
      ]],
      ['Circulation', [
        ['arrow-left-right', 'All transactions', Store.count('borrowTransactions'), 'transactions'],
        ...(FEATURES.fines ? [['wallet', 'Fines & payments', money(unpaid), 'finesDesk']] : []),
        ['receipt', 'Receipts', Store.count('receipts'), 'receipts'],
        ['bookmark', 'Reservation queues', Store.count('reservations', r => ['WAITING', 'READY'].includes(r.status)), 'reservations'],
        ['library', 'Inventory', `${Store.count('books')} titles`, 'inventory'],
      ]],
      ['Policies', [
        ['book-lock', 'Borrowing', `${p.maxBorrow} books · ${p.loanDays} days`, 'policies'],
        ...(FEATURES.fines ? [['receipt', 'Fines', `${money(p.finePerDay)}/day`, 'policies#fines']] : []),
      ]],
      ['System', [
        ['file-bar-chart', 'Reports', '', 'reports'],
        ['scroll-text', 'Activity log', '', 'activity'],
        ['settings', 'Settings', '', 'settings'],
      ]],
    ];
    return `${Header({ title: 'Manage', large: true, actions: [bellAction()] })}
      <div class="scroll"><div class="pad">
        ${groups.map(([title, rows]) => `<div class="menu-group"><h4>${title}</h4>${rows.map(([ic, label, value, to]) => {
          const [name, anchor] = to.split('#');
          return `<button class="menu-row" data-action="${name === 'inventory' ? 'tab' : 'go'}" data-to="${name}" ${anchor ? `data-params='{"section":"${anchor}"}'` : ''}>
            <span class="menu-ic">${icon(ic)}</span><span>${label}</span>${value !== '' ? `<span class="menu-value">${esc(value)}</span>` : ''}${icon('chevron-right', 'muted')}</button>`;
        }).join('')}</div>`).join('')}
      </div></div>`;
  },
};

/* ---------------- Users ---------------- */
Screens.users = {
  roles: ADMIN,
  render() {
    const f = UI.users;
    const q = f.q.toLowerCase();
    const all = Store.all('users');
    const list = all.filter(u => (f.role === 'ALL' || u.role === f.role) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const count = r => all.filter(u => u.role === r).length;
    return `${Header({ title: 'Users', subtitle: `${all.length} accounts`, back: true, actions: [{ icon: 'user-plus', action: 'userForm', label: 'Add user' }] })}
      <div class="sticky-tools">
        <form class="search-bar" data-submit="userSearch">${icon('search')}<input name="q" value="${esc(f.q)}" placeholder="Search name or email" aria-label="Search users"></form>
        ${chips([['ALL', `All ${all.length}`], ['STUDENT', `Students ${count('STUDENT')}`], ['LIBRARIAN', `Librarians ${count('LIBRARIAN')}`], ['ADMIN', `Admins ${count('ADMIN')}`]], f.role, 'userRole')}
      </div>
      <div class="scroll"><div class="pad">${list.map(u => {
        const m = Services.memberByUser(u.id);
        return `<button class="list-card" data-action="userSheet" data-id="${u.id}">${avatar(u, 42)}
          <div class="lc-body"><b>${esc(u.name)}${u.id === Auth.current().id ? ' <small class="muted">(you)</small>' : ''}</b><small class="clamp1">${esc(u.email)}${m ? ` · ${m.studentId}` : ''}</small></div>
          <div class="col end gap6">${badge(u.role)}${u.active ? '' : '<span class="badge gray">Inactive</span>'}</div></button>`;
      }).join('') || emptyState({ icon: 'user-x', title: 'No users found' })}</div></div>`;
  },
};
Object.assign(Actions, {
  userSearch: form => { UI.users.q = form.q.value; Router.refresh(); },
  userRole: el => { UI.users.role = el.dataset.value; Router.refresh(); },
  userForm: () => {
    pendingIdPhoto = null;
    Sheet.open({
      title: 'Add user',
      size: 'tall',
      body: `<form id="user-form" class="form" data-submit="createUser" novalidate>
        <div class="field"><label for="uf-role">Role</label><select id="uf-role" name="role" data-change="userFormRole"><option value="STUDENT">Student</option><option value="LIBRARIAN">Librarian</option><option value="ADMIN">Administrator</option></select><div class="field-error" data-err="role"></div></div>
        <div class="field"><label for="uf-name">Full name</label><input id="uf-name" name="name" placeholder="As printed on the ID card" autocomplete="off"><div class="field-error" data-err="name"></div></div>
        <div class="field"><label for="uf-email">Email</label><input id="uf-email" name="email" type="email" inputmode="email" placeholder="jane@uni.edu" autocomplete="off"><div class="field-error" data-err="email"></div></div>
        <fieldset class="id-card-fields" id="uf-student">
          <legend>Student ID card <span class="req">Required</span></legend>
          <p class="hint">Check the physical card before registering. The card number becomes the member’s library ID.</p>
          <div class="field"><label for="uf-sid">ID card number</label><input id="uf-sid" name="studentId" placeholder="e.g. STU-10241" autocapitalize="characters" autocomplete="off" spellcheck="false"><div class="field-error" data-err="studentId"></div></div>
          <div class="field">
            <span class="field-label">Photo of the card (front)</span>
            <div class="id-photo" id="uf-id-preview"><div class="id-photo-empty">${icon('contact')}<small>No photo yet</small></div></div>
            <div class="row gap8">
              <label class="btn ghost sm">${icon('camera')} Take photo<input type="file" accept="image/*" capture="environment" class="sr-only" data-change="idCardFile"></label>
              <label class="btn ghost sm">${icon('upload')} Upload<input type="file" accept="image/*" class="sr-only" data-change="idCardFile"></label>
            </div>
            <div class="field-error" data-err="idCardPhoto"></div>
          </div>
          <div class="grid2"><div class="field"><label for="uf-program">Program</label><input id="uf-program" name="program" placeholder="Biology"></div>
          <div class="field"><label for="uf-year">Year</label><select id="uf-year" name="year">${[1, 2, 3, 4, 5].map(y => `<option>${y}</option>`).join('')}</select></div></div>
        </fieldset>
        <div class="field"><label for="uf-pw">Temporary password</label><div class="input-wrap"><input id="uf-pw" name="password" type="password" value="welcome123"><button type="button" class="input-btn" data-action="togglePassword" data-target="uf-pw" aria-label="Show password">${icon('eye')}</button></div><div class="field-error" data-err="password"></div></div>
      </form>`,
      footer: `<button class="btn primary block" type="submit" form="user-form">${icon('user-plus')} Create account</button>`,
    });
  },
  userFormRole: el => { $('#uf-student').hidden = el.value !== 'STUDENT'; },
  /** Validates and compresses an ID card photo; shared by the add-user form and member records. */
  idCardFile: async input => {
    const f = input.files && input.files[0];
    input.value = '';
    const form = input.closest('form');
    const err = msg => { if (form) showErrors(form, { idCardPhoto: msg }); else Toast.show(msg, 'error'); };
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) return err('Use a JPG, PNG or WebP photo of the card.');
    if (f.size > 8 * 1024 * 1024) return err('Photo is larger than 8 MB.');
    try {
      const photo = await compressImage(f, 640, 0.8); // wide enough to read the card text
      if (input.dataset.member) {
        Services.setIdCardPhoto(input.dataset.member, photo, Auth.current().id);
        Toast.show('ID card photo saved to the member record');
        return Router.refresh();
      }
      pendingIdPhoto = photo;
      $('#uf-id-preview').innerHTML = `<img src="${photo}" alt="ID card photo preview">`;
      if (form) form.querySelector('[data-err="idCardPhoto"]').textContent = '';
    } catch (e) { err(e.message); }
  },
  createUser: form => {
    const d = formData(form);
    if (d.role === 'STUDENT') d.idCardPhoto = pendingIdPhoto;
    const r = Services.createUser(d, Auth.current().id);
    if (!r.ok) return showErrors(form, r.errors);
    pendingIdPhoto = null;
    Sheet.close();
    Toast.show(`${r.user.name} can now sign in`, 'success', { title: 'Account created' });
    Router.refresh();
  },
  userSheet: el => {
    const u = Services.user(el.dataset.id);
    const m = Services.memberByUser(u.id);
    const me = u.id === Auth.current().id;
    Sheet.open({
      title: 'User account',
      body: `<div class="row gap12 mb12">${avatar(u, 52)}<div class="grow"><b>${esc(u.name)}</b><small class="muted block">${esc(u.email)}</small><div class="row gap6 mt4">${badge(u.role)}${u.active ? badge('ACTIVE') : '<span class="badge gray">Inactive</span>'}</div></div></div>
        <div class="card info-list">${infoRow('Phone', esc(u.phone || '—'), 'phone')}${infoRow('Created', fmtDate(u.createdAt), 'calendar')}${m ? infoRow('Student ID', esc(m.studentId), 'contact') : ''}</div>
        <div class="field mt12"><label for="us-role">Role assignment</label><select id="us-role" data-change="changeRole" data-id="${u.id}" ${me ? 'disabled' : ''}>
          ${['STUDENT', 'LIBRARIAN', 'ADMIN'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${STATUS_META[r][0]}</option>`).join('')}</select>${me ? '<small class="hint">You can’t change your own role.</small>' : ''}</div>`,
      footer: `${m ? `<button class="btn ghost" data-action="go" data-to="memberDetail" data-id="${m.id}">Member record</button>` : ''}
        ${me ? '' : `<button class="btn ghost" data-action="toggleUser" data-id="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button><button class="btn danger-ghost" data-action="deleteUser" data-id="${u.id}" aria-label="Delete user">${icon('trash-2')}</button>`}`,
    });
  },
  changeRole: async el => {
    const u = Services.user(el.dataset.id);
    const role = el.value;
    const ok = await Sheet.confirm({ title: `Make ${u.name} ${STATUS_META[role][0].toLowerCase()}?`, message: 'Their navigation and permissions change at next sign-in.', confirmText: 'Change role', icon: 'shield-check' });
    if (!ok) { el.value = u.role; return; }
    const res = Services.updateUser(u.id, { role }, Auth.current().id);
    if (!res.ok) { el.value = u.role; return Toast.show(res.error, 'warn', { title: 'ID card required', duration: 4200 }); }
    Sheet.closeAll();
    Toast.show(`${u.name} is now ${STATUS_META[role][0]}`);
    Router.refresh();
  },
  toggleUser: el => {
    const u = Services.user(el.dataset.id);
    Services.updateUser(u.id, { active: !u.active }, Auth.current().id);
    Sheet.closeAll();
    Toast.show(u.active ? 'Account deactivated' : 'Account activated', u.active ? 'warn' : 'success');
    Router.refresh();
  },
  deleteUser: async el => {
    const chk = Services.canDeleteUser(el.dataset.id, Auth.current().id);
    Sheet.closeAll();
    if (!chk.ok) return Toast.show(chk.reason, 'warn', { title: 'Cannot delete', duration: 4000 });
    const ok = await Sheet.confirm({ title: 'Delete this account?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true, icon: 'trash-2' });
    if (!ok) return;
    const r = Services.deleteUser(el.dataset.id, Auth.current().id);
    Toast.show(r.ok ? 'Account deleted' : r.error, r.ok ? 'success' : 'error');
    Router.refresh();
  },
});

/* ---------------- Roles & permissions ---------------- */
const PERMISSIONS = {
  ADMIN: ['Global dashboard & analytics', 'Manage librarians and students', 'Add, edit, archive & delete books', 'View all transactions', ...(FEATURES.fines ? ['Manage penalties, fees & waivers', 'Change borrowing & fine policies'] : ['Change borrowing policies']), 'Application settings & activity logs'],
  LIBRARIAN: ['Librarian dashboard', 'Scan & approve checkout QRs', 'Process returns & issue receipts', 'Register & edit books and copies', 'Manage reservation queues', 'View member records', ...(FEATURES.fines ? ['Record fine payments'] : [])],
  STUDENT: ['Browse & search the catalogue', 'Scan books into a borrow cart', 'Generate checkout QR passes', 'Track loans, due dates & history', 'Reserve unavailable titles', FEATURES.fines ? 'View fines, receipts & membership card' : 'View receipts & membership card'],
};
Screens.roles = {
  roles: ADMIN,
  render() {
    const users = Store.all('users');
    return `${Header({ title: 'Roles & permissions', back: true })}
      <div class="scroll"><div class="pad stack12">
        ${Object.entries(PERMISSIONS).map(([role, perms]) => `<div class="card">
          <div class="row-between mb8"><div class="row gap8">${badge(role)}<b>${users.filter(u => u.role === role).length} users</b></div></div>
          <ul class="perm-list">${perms.map(p => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
          <div class="avatar-stack">${users.filter(u => u.role === role).slice(0, 8).map(u => `<button data-action="userSheet" data-id="${u.id}" title="${esc(u.name)}">${avatar(u, 32)}</button>`).join('')}</div>
        </div>`).join('')}
        <button class="btn primary block" data-action="go" data-to="users">${icon('users')} Assign roles in User management</button>
      </div></div>`;
  },
};

/* ---------------- Policies ---------------- */
Screens.policies = {
  roles: ADMIN,
  render() {
    const p = Store.settings();
    const num = (name, label, val, opts = {}) => `<div class="field"><label for="pl-${name}">${label}</label>
      <div class="input-wrap">${opts.prefix ? `<span class="affix">${opts.prefix}</span>` : ''}<input id="pl-${name}" name="${name}" type="number" inputmode="decimal" step="${opts.step || 1}" min="${opts.min ?? 0}" max="${opts.max ?? 999}" value="${val}">${opts.suffix ? `<span class="affix">${opts.suffix}</span>` : ''}</div>
      ${opts.hint ? `<small class="hint">${opts.hint}</small>` : ''}<div class="field-error" data-err="${name}"></div></div>`;
    const toggle = (name, label, on, hint, disabled = false) => `<label class="toggle-row"><div><b>${label}</b><small>${hint}</small></div><input type="checkbox" name="${name}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="switch"></span></label>`;
    return `${Header({ title: 'Policies', subtitle: FEATURES.fines ? 'Borrowing & fines' : 'Borrowing rules', back: true })}
      <div class="scroll has-footer"><div class="pad">
        <form id="policy-form" class="form" data-guard data-submit="savePolicies" novalidate>
          <h3 class="h3" id="borrow">${icon('book-lock')} Borrowing policy</h3>
          <div class="card stack12">
            <div class="grid2">${num('maxBorrow', 'Max active books', p.maxBorrow, { min: 1, max: 20, suffix: 'books' })}${num('loanDays', 'Loan duration', p.loanDays, { min: 1, max: 90, suffix: 'days' })}</div>
            <div class="grid2">${num('requestExpiryMin', 'Checkout QR validity', p.requestExpiryMin, { min: 1, max: 120, suffix: 'min' })}${num('reservationHoldDays', 'Reservation hold', p.reservationHoldDays, { min: 1, max: 14, suffix: 'days' })}</div>
            ${num('dueSoonDays', 'Due-soon reminder', p.dueSoonDays, { min: 0, max: 14, suffix: 'days before' })}
            ${toggle('onlyActive', 'Only active members may borrow', true, 'Suspended or expired memberships are always blocked.', true)}
            ${toggle('blockOnOverdue', 'Block borrowing while overdue', p.blockOnOverdue, 'Students must return overdue books before new checkouts.')}
            ${toggle('requireHandoverScan', 'Scan books at checkout', p.requireHandoverScan, 'Librarian scans each book before approving, so the loan matches the copy handed over.')}
            ${toggle('dueReminders', 'Send due-date reminders', p.dueReminders, 'In-app notifications before the due date.')}
          </div>
          ${FEATURES.fines ? `<h3 class="h3" id="fines">${icon('receipt')} Fine policy</h3>
          <div class="card stack12">
            <div class="grid2">${num('finePerDay', 'Overdue fine per day', p.finePerDay, { step: 0.05, prefix: p.currency })}${num('maxFinePerItem', 'Max fine per book', p.maxFinePerItem, { step: 0.5, prefix: p.currency })}</div>
            <div class="grid2">${num('damagedFee', 'Damaged book fee', p.damagedFee, { step: 0.5, prefix: p.currency })}${num('lostFee', 'Lost book fee', p.lostFee, { step: 1, prefix: p.currency })}</div>
            ${num('maxUnpaidFines', 'Block borrowing above unpaid', p.maxUnpaidFines, { step: 0.5, prefix: p.currency, hint: 'Members owing more than this cannot check out.' })}
          </div>` : ''}
          <div class="callout gray">${icon('info')}<div><b>Changes apply immediately</b><p>Existing loans keep their due dates.${FEATURES.fines ? ' New fines use the new rates.' : ''}</p></div></div>
        </form>
      </div></div>
      <div class="sticky-footer"><button class="btn primary block lg" type="submit" form="policy-form">${icon('save')} Save policies</button></div>`;
  },
  mount({ section }) { if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }), 100); },
};
Actions.savePolicies = form => {
  const d = formData(form);
  const ints = ['maxBorrow', 'loanDays', 'requestExpiryMin', 'reservationHoldDays', 'dueSoonDays'];
  const nums = FEATURES.fines ? ['finePerDay', 'maxFinePerItem', 'damagedFee', 'lostFee', 'maxUnpaidFines'] : [];
  const errors = {};
  const patch = { blockOnOverdue: !!d.blockOnOverdue, dueReminders: !!d.dueReminders, requireHandoverScan: !!d.requireHandoverScan };
  ints.forEach(k => { const v = Number(d[k]); const el = form[k]; if (!Number.isInteger(v) || v < +el.min || v > +el.max) errors[k] = `Whole number ${el.min}–${el.max}`; else patch[k] = v; });
  nums.forEach(k => { const v = Number(d[k]); if (!Number.isFinite(v) || v < 0) errors[k] = 'Enter a positive amount'; else patch[k] = Math.round(v * 100) / 100; });
  if (Object.keys(errors).length) return showErrors(form, errors);
  Store.saveSettings(patch);
  Services.log('POLICY_UPDATED', `Policies updated: ${patch.maxBorrow} books, ${patch.loanDays} days${FEATURES.fines ? `, ${money(patch.finePerDay)}/day` : ''}`);
  Toast.show('Policies saved', 'success');
  Router.refresh();
};

/* ---------------- Reports ---------------- */
Screens.reports = {
  roles: ADMIN,
  render() {
    const R = Stats.report(UI.reportRange);
    const S = Stats.admin(UI.reportRange);
    return `${Header({ title: 'Reports', subtitle: `Last ${RANGES[UI.reportRange].label}`, back: true })}
      <div class="sticky-tools">${segmented('rr', Object.entries(RANGES).map(([k, r]) => [k, r.label]), UI.reportRange, 'reportRange')}</div>
      <div class="scroll"><div class="pad">
        <div class="metrics c2">
          ${statCard({ label: 'Loans', value: R.loans })}
          ${statCard({ label: 'Returns', value: R.returns })}
          ${statCard({ label: 'On-time returns', value: R.onTimeRate + '%' })}
          ${statCard({ label: 'Avg. loan length', value: R.avgDays + 'd' })}
          ${FEATURES.fines
            ? `${statCard({ label: 'Fines collected', value: money(R.finesCollected) })}${statCard({ label: 'Fines outstanding', value: money(R.finesOutstanding), warn: true, sub: `${money(R.finesWaived)} waived` })}`
            : `${statCard({ label: 'Overdue now', value: Store.count('borrowTransactions', t => t.status === 'OVERDUE'), warn: true })}${statCard({ label: 'Active reservations', value: Store.count('reservations', r => ['WAITING', 'READY'].includes(r.status)) })}`}
        </div>
        <div class="card">
          <div class="row-between"><b>Collection utilisation</b><b>${R.utilization}%</b></div>
          <div class="progress green lg mt8"><span style="width:${R.utilization}%"></span></div>
          <small class="muted">Share of circulating copies currently on loan</small>
        </div>
        <div class="chart-card">
          <div class="chart-head"><div><h3>Loans over time</h3><small>Loans and returns</small></div></div>
          <div class="chart-box"><canvas id="rp-bar" role="img" aria-label="Loans over time"></canvas></div>
        </div>
        ${sectionTitle('Most active borrowers')}
        <div class="rank-list">${R.topBorrowers.map((t, i) => `<button class="rank-row" data-action="go" data-to="memberDetail" data-id="${t.member?.id}"><span class="rank">${i + 1}</span>${avatar(t.user, 32)}<div class="grow"><b>${esc(t.user?.name)}</b><small class="muted block">${esc(t.member?.studentId)}</small></div><span class="num">${t.count}</span></button>`).join('') || `<div class="empty-inline">No data</div>`}</div>
        ${sectionTitle('Export')}
        <div class="stack8">
          <button class="btn ghost block" data-action="exportTx">${icon('file-spreadsheet')} Transactions (CSV)</button>
          <button class="btn ghost block" data-action="exportInventory">${icon('file-spreadsheet')} Inventory & copies (CSV)</button>
          ${FEATURES.fines ? `<button class="btn ghost block" data-action="exportFines">${icon('file-spreadsheet')} Fines ledger (CSV)</button>` : ''}
        </div>
      </div></div>`;
  },
  mount() {
    const S = Stats.admin(UI.reportRange);
    Charts.make($('#rp-bar'), {
      type: 'bar',
      data: { labels: S.series.labels, datasets: [{ label: 'Loans', data: S.series.borrowed, backgroundColor: CHART.borrowed, borderRadius: 3 }, { label: 'Returns', data: S.series.returned, backgroundColor: CHART.returned, borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: Charts.axes(), plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } } } },
    });
  },
};
Object.assign(Actions, {
  reportRange: el => { UI.reportRange = el.dataset.value; Router.refresh(); },
  exportInventory: () => {
    const rows = [['Copy ID', 'Title', 'Author', 'ISBN', 'Category', 'Shelf', 'Status', 'Condition', 'Note']];
    Store.all('bookCopies').forEach(c => { const b = Services.book(c.bookId); rows.push([c.id, b?.title, b?.author, b?.isbn, b?.category, b?.shelf, c.status, c.condition, c.note]); });
    downloadFile('inventory.csv', toCSV(rows), 'text/csv');
    Toast.show('Inventory exported');
  },
  exportFines: () => {
    const rows = [['Fine', 'Member', 'Book', 'Reason', 'Amount', 'Status', 'Created', 'Paid', 'Method']];
    Store.all('fines').forEach(f => rows.push([f.id, Services.memberName(f.memberId), Services.book(f.bookId)?.title || '', f.reason, f.amount, f.status, f.createdAt, f.paidAt || '', f.paidMethod || '']));
    downloadFile('fines.csv', toCSV(rows), 'text/csv');
    Toast.show('Fines exported');
  },
});

/* ---------------- Activity logs ---------------- */
const LOG_GROUPS = {
  ALL: () => true,
  CIRC: a => /CHECKOUT|REQUEST|RETURN|RESERV|REMINDER/.test(a),
  BOOKS: a => /BOOK|COP/.test(a),
  PEOPLE: a => /USER|MEMBER|ROLE|LOGIN/.test(a),
  MONEY: a => /FINE|POLICY/.test(a),
  VISIT: a => a === 'VISIT',
};
const LOG_ICONS = { CHECKOUT_APPROVED: 'arrow-up-right', RETURN_PROCESSED: 'arrow-down-left', REQUEST_CREATED: 'qr-code', REQUEST_REJECTED: 'x-circle', REQUEST_CANCELLED: 'x', BOOK_CREATED: 'book-plus', BOOK_UPDATED: 'pencil', BOOK_ARCHIVED: 'archive', BOOK_DELETED: 'trash-2', COPY_STATUS: 'book-copy', COPIES_ADDED: 'copy-plus', FINE_PAID: 'hand-coins', FINE_WAIVED: 'hand-coins', POLICY_UPDATED: 'sliders-horizontal', VISIT: 'footprints', LOGIN: 'log-in', USER_CREATED: 'user-plus', ROLE_CHANGED: 'shield-check', MEMBER_STATUS: 'user-cog', RESERVATION_CREATED: 'bookmark-plus' };
Screens.activity = {
  roles: ADMIN,
  render() {
    const f = UI.logs;
    const all = Store.all('auditLogs').filter(l => (f.filter === 'ALL' ? l.action !== 'VISIT' : LOG_GROUPS[f.filter](l.action))).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const shown = all.slice(0, f.limit);
    return `${Header({ title: 'Activity logs', subtitle: `${all.length} events`, back: true })}
      <div class="sticky-tools">${chips([['ALL', 'All'], ['CIRC', 'Circulation'], ['BOOKS', 'Books'], ['PEOPLE', 'People'], ['MONEY', FEATURES.fines ? 'Fines & policy' : 'Policy'], ['VISIT', 'Visits']], f.filter, 'logFilter')}</div>
      <div class="scroll"><div class="pad">
        <ol class="timeline">${shown.map(l => `<li><span class="tl-ic">${icon(LOG_ICONS[l.action] || 'activity')}</span>
          <div><b>${esc(l.detail)}</b><small>${esc(l.action.replace(/_/g, ' ').toLowerCase())} · ${esc(Services.user(l.userId)?.name || 'System')} · ${relTime(l.createdAt)}</small></div></li>`).join('')}</ol>
        ${all.length > shown.length ? `<button class="btn ghost block" data-action="logMore">Load more (${all.length - shown.length})</button>` : ''}
        ${!all.length ? emptyState({ icon: 'scroll-text', title: 'No activity' }) : ''}
      </div></div>`;
  },
};
Actions.logFilter = el => { UI.logs.filter = el.dataset.value; UI.logs.limit = 60; Router.refresh(); };
Actions.logMore = () => { UI.logs.limit += 60; Router.refresh(); };

/* ---------------- Settings ---------------- */
Screens.settings = {
  roles: ADMIN,
  render() {
    const s = Store.settings();
    return `${Header({ title: 'Settings', back: true })}
      <div class="scroll has-footer"><div class="pad">
        <form id="settings-form" class="form" data-guard data-submit="saveSettings" novalidate>
          <h3 class="h3">Library</h3>
          <div class="card stack12">
            <div class="field"><label for="st-name">Library name</label><input id="st-name" name="libraryName" value="${esc(s.libraryName)}"><div class="field-error" data-err="libraryName"></div></div>
            <div class="field"><label for="st-campus">Campus / branch</label><input id="st-campus" name="campus" value="${esc(s.campus)}"></div>
            <div class="field"><label for="st-hours">Opening hours</label><input id="st-hours" name="openingHours" value="${esc(s.openingHours)}"></div>
            <div class="field"><label for="st-mail">Contact email</label><input id="st-mail" name="contactEmail" type="email" value="${esc(s.contactEmail)}"></div>
            ${FEATURES.fines ? `<div class="field"><label for="st-cur">Currency symbol</label><select id="st-cur" name="currency">${['$', '€', '£', '¥', '₩', '₹'].map(c => `<option ${s.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>` : ''}
          </div>
        </form>
        <h3 class="h3">Data</h3>
        <div class="card stack8">
          <div class="row-between"><span>Local storage used</span><b>${(Store.usageBytes() / 1024).toFixed(0)} KB</b></div>
          <div class="row-between"><span>Records</span><b>${COLLECTIONS.reduce((n, c) => n + Store.count(c), 0)}</b></div>
          <button class="btn ghost block" data-action="demoExport">${icon('download')} Export all data (JSON)</button>
          <button class="btn ghost block" data-action="go" data-to="demo">${icon('wrench')} Demo tools & reset</button>
        </div>
        <div class="callout gray">${icon('server')}<div><b>Backend migration</b><p>All persistence goes through the <code>Store</code> data layer, ready to be replaced with REST API calls.</p></div></div>
      </div></div>
      <div class="sticky-footer"><button class="btn primary block lg" type="submit" form="settings-form">${icon('save')} Save settings</button></div>`;
  },
};
Actions.saveSettings = form => {
  const d = formData(form);
  if (!d.libraryName.trim()) return showErrors(form, { libraryName: 'Required' });
  Store.saveSettings({ libraryName: d.libraryName.trim(), campus: d.campus.trim(), openingHours: d.openingHours.trim(), contactEmail: d.contactEmail.trim(), currency: d.currency || Store.settings().currency });
  Services.log('SETTINGS_UPDATED', 'Library settings updated');
  Toast.show('Settings saved');
  Router.refresh();
};