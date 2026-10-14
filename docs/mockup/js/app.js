'use strict';
/* ===========================================================================
 * app.js — bootstrap: seed data on first run, restore the session, keep the
 * faux status-bar clock ticking, and react to changes made in other tabs.
 * ======================================================================== */

(function boot() {
  if (!Store.isSeeded()) Seed.run();

  // Screens that show live data refresh when another tab changes storage
  // (e.g. student's checkout QR updates the moment a librarian approves it).
  const LIVE = new Set(['checkoutQR', 'home', 'mybooks', 'libDashboard', 'scanHub', 'transactions', 'requestReview', 'adminDashboard', 'notifications', 'inventory', 'bookDetail']);
  Store.onExternalChange = key => {
    if (key && key.endsWith('session')) { Sheet.closeAll(); Router.reset(Auth.current() ? Router.homeName() : 'login'); return; }
    if (Scanner.isOpen() || Sheet.stack.length) return;
    if (LIVE.has(Router.current()?.name)) Router.refresh();
  };

  // Desktop preview: scale the life-size iPhone 18 Pro Max frame (468 x 984) to fit the window.
  const fitPhone = () => {
    const s = window.innerWidth < 640 ? 1 : Math.min(1, (window.innerHeight - 40) / 984, (window.innerWidth - 32) / 468);
    document.documentElement.style.setProperty('--phone-scale', s.toFixed(4));
  };
  fitPhone();
  window.addEventListener('resize', fitPhone);

  const clock = () => {
    const el = $('#sb-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '');
  };
  clock();
  setInterval(clock, 15000);

  // Periodically re-evaluate time-based statuses (overdue, expired QR requests).
  setInterval(() => {
    const name = Router.current()?.name;
    if (!name || name === 'checkoutQR' || Scanner.isOpen() || Sheet.stack.length || document.activeElement?.matches('input, textarea, select')) return;
    if (LIVE.has(name)) Router.refresh();
  }, 60000);

  window.addEventListener('error', e => {
    console.error(e.error || e.message);
    Toast.show('Something went wrong. Please try again.', 'error');
  });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); });

  // Connectivity: everything works offline (data is local), but covers, charts
  // and QR images come from CDNs — tell the user rather than failing silently.
  const offline = () => Toast.show('Your data is saved on this device. Book covers may not load.', 'warn', { title: 'You’re offline', duration: 4200 });
  window.addEventListener('offline', offline);
  window.addEventListener('online', () => Toast.show('Back online', 'success', { duration: 1800 }));

  Router.reset(Auth.current() ? Router.homeName() : 'login');
  try { history.replaceState({ depth: 1 }, ''); } catch (e) { /* sandboxed */ }

  // Launch screen: keep it at least ~600 ms after navigation start so it never
  // flashes, but don't add any wait if loading already took longer than that.
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 400);
      if (!navigator.onLine) offline();
    }, Math.max(0, 600 - performance.now()));
  }
})();
