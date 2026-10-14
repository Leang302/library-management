'use strict';
/* ===========================================================================
 * scanner.js — full-screen QR scanner overlay.
 * Uses html5-qrcode for real camera scanning (torch + camera switching where
 * the device supports them). Always offers manual ID entry and "simulate scan"
 * chips so the whole app can be demonstrated on a laptop without a camera.
 *
 * Scanner.open({
 *   title, subtitle, placeholder,
 *   samples: [{ value, label, sub }],        // simulation chips
 *   onResult(text) -> { ok, title, message, book, close } | undefined,
 *   footer: () => html                       // optional live footer (e.g. cart button)
 * })
 * ======================================================================== */

const Scanner = {
  el: null, qr: null, opts: null, cameras: [], camIndex: 0, torch: false, running: false, last: { text: '', at: 0 },

  isOpen() { return !!this.el; },

  open(opts) {
    if (this.el) this.close(true);
    this.opts = opts;
    this.last = { text: '', at: 0 };
    const el = document.createElement('div');
    el.className = 'scanner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', opts.title);
    el.innerHTML = `
      <div class="scanner-top">
        <button class="icon-btn glass" data-scan="close" aria-label="Close scanner">${icon('x')}</button>
        <div class="scanner-title"><b>${esc(opts.title)}</b><span>${esc(opts.subtitle || '')}</span></div>
        <button class="icon-btn glass" data-scan="torch" aria-label="Toggle flashlight" disabled>${icon('flashlight')}</button>
      </div>
      <div class="scanner-stage">
        <div id="qr-reader"></div>
        <div class="scan-perm">
          <div class="scan-perm-ic">${icon('camera')}</div>
          <b>Allow camera access</b>
          <p>We use your camera only to read QR codes. Nothing is recorded or uploaded.</p>
          <button class="btn primary" data-scan="start">${icon('camera')} Enable camera</button>
          <small class="scan-perm-msg"></small>
        </div>
        <div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><div class="scan-line"></div></div>
        <div class="scan-flash"></div>
      </div>
      <div class="scanner-sheet">
        <div class="scan-result" hidden></div>
        <div class="scan-controls">
          <button class="scan-ctl" data-scan="switch" disabled aria-label="Switch camera">${icon('switch-camera')}<span>Flip</span></button>
          <form class="manual" data-scan-form>
            <label class="sr-only" for="manual-code">Enter code manually</label>
            ${icon('keyboard')}
            <input id="manual-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(opts.placeholder || 'Type a code, e.g. BOOKCOPY-000004')}">
            <button class="btn primary sm" type="submit">Go</button>
          </form>
        </div>
        ${opts.samples && opts.samples.length ? `<div class="scan-samples"><span>${icon('sparkles')} Simulate a scan</span>
          <div class="scan-chips scroll-x">${opts.samples.map(s => `<button class="scan-chip" data-scan-sample="${esc(s.value)}"><b>${esc(s.label)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</button>`).join('')}</div></div>` : ''}
        <div class="scan-footer">${opts.footer ? opts.footer() : ''}</div>
      </div>`;
    $('#overlay-root').appendChild(el);
    this.el = el;
    refreshIcons();
    requestAnimationFrame(() => el.classList.add('open'));

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-scan]');
      const s = e.target.closest('[data-scan-sample]');
      if (s) { this.last.text = ''; this.handle(s.dataset.scanSample, true); return; }
      if (!b || b.disabled) return;
      const act = b.dataset.scan;
      if (act === 'close') this.close();
      else if (act === 'start') this.startCamera();
      else if (act === 'torch') this.toggleTorch();
      else if (act === 'switch') this.switchCamera();
    });
    el.querySelector('[data-scan-form]').addEventListener('submit', e => {
      e.preventDefault();
      const input = el.querySelector('#manual-code');
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      this.last.text = '';
      this.handle(v, true);
      input.value = '';
    });

    // If the camera permission was already granted, start immediately.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' }).then(p => { if (p.state === 'granted' && this.el === el) this.startCamera(); }).catch(() => {});
    }
  },

  setCamState(state, msg = '') {
    if (!this.el) return;
    this.el.dataset.cam = state; // idle | starting | live | error
    const m = this.el.querySelector('.scan-perm-msg');
    if (m) m.textContent = msg;
    const btn = this.el.querySelector('[data-scan="start"]');
    if (btn) {
      btn.disabled = state === 'starting';
      btn.innerHTML = state === 'starting' ? '<span class="spinner"></span> Starting…' : `${icon(state === 'error' ? 'refresh-cw' : 'camera')} ${state === 'error' ? 'Try again' : 'Enable camera'}`;
      refreshIcons();
    }
  },

  config() {
    return { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.68); return { width: s, height: s }; } };
  },

  async startCamera() {
    if (typeof Html5Qrcode === 'undefined') { this.setCamState('error', 'Scanner library could not load (offline?). Use manual entry below.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.setCamState('error', 'Camera is unavailable here. Browsers require HTTPS or localhost for camera access.'); return; }
    this.setCamState('starting');
    try {
      this.qr = new Html5Qrcode('qr-reader', { verbose: false });
      await this.qr.start({ facingMode: 'environment' }, this.config(), t => this.handle(t), () => {});
      if (!this.el) { await this.stopCamera(); return; }
      this.running = true;
      this.setCamState('live');
      try { this.cameras = await Html5Qrcode.getCameras(); } catch (e) { this.cameras = []; }
      if (!this.el) return;
      this.el.querySelector('[data-scan="switch"]').disabled = this.cameras.length < 2;
      this.updateTorchSupport();
    } catch (err) {
      this.running = false;
      const name = (err && (err.name || String(err))) || '';
      const msg = /NotAllowed|Permission/i.test(name) ? 'Camera permission was denied. Allow it in your browser settings, or enter the code manually.'
        : /NotFound|Requested device/i.test(name) ? 'No camera was found on this device. Use manual entry or a simulated scan.'
        : 'The camera could not be started. Use manual entry or a simulated scan.';
      this.setCamState('error', msg);
    }
  },

  updateTorchSupport() {
    if (!this.el) return;
    let supported = false;
    try { const caps = this.qr.getRunningTrackCapabilities(); supported = !!(caps && caps.torch); } catch (e) { supported = false; }
    const b = this.el.querySelector('[data-scan="torch"]');
    b.disabled = !supported;
    b.title = supported ? 'Flashlight' : 'Flashlight not supported on this device';
  },
  async toggleTorch() {
    if (!this.qr || !this.running) return;
    try {
      this.torch = !this.torch;
      await this.qr.applyVideoConstraints({ advanced: [{ torch: this.torch }] });
      this.el.querySelector('[data-scan="torch"]').classList.toggle('on', this.torch);
      haptic(8);
    } catch (e) { Toast.show('Flashlight is not supported on this camera', 'warn'); }
  },
  async switchCamera() {
    if (!this.qr || this.cameras.length < 2) return;
    this.camIndex = (this.camIndex + 1) % this.cameras.length;
    this.setCamState('starting');
    try {
      await this.qr.stop();
      await this.qr.start(this.cameras[this.camIndex].id, this.config(), t => this.handle(t), () => {});
      this.setCamState('live');
      this.updateTorchSupport();
    } catch (e) { this.setCamState('error', 'Could not switch camera.'); }
  },
  async stopCamera() {
    const qr = this.qr;
    this.qr = null;
    if (qr) {
      try { if (this.running) await qr.stop(); } catch (e) { /* already stopped */ }
      try { qr.clear(); } catch (e) { /* ignore */ }
    }
    this.running = false; this.torch = false;
  },

  /** Called for camera detections, manual entry and simulated scans. */
  handle(text, manual = false) {
    const t = String(text || '').trim();
    if (!t || !this.el) return;
    if (!manual && t === this.last.text && Date.now() - this.last.at < 2500) return; // ignore repeat frames
    this.last = { text: t, at: Date.now() };
    haptic(25);
    const flash = this.el.querySelector('.scan-flash');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    let res;
    try { res = this.opts.onResult(t); } catch (e) { console.error(e); res = { ok: false, title: 'Something went wrong', message: e.message }; }
    if (!res || res.close) return;
    this.showResult(res);
  },

  showResult({ ok, title, message, book, extra = '' }) {
    if (!this.el) return;
    const box = this.el.querySelector('.scan-result');
    box.hidden = false;
    box.className = `scan-result ${ok ? 'ok' : 'bad'}`;
    box.innerHTML = `${book ? cover(book, 'xs') : `<span class="scan-result-ic">${icon(ok ? 'check' : 'alert-triangle')}</span>`}
      <div class="sr-body"><b>${esc(title)}</b><small>${esc(message || '')}</small></div>
      <span class="sr-mark">${icon(ok ? 'check-circle-2' : 'x-circle')}</span>${extra}`;
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    if (!ok) haptic([30, 40, 30]);
    this.updateFooter();
    refreshIcons();
  },
  updateFooter() {
    if (this.el && this.opts.footer) { this.el.querySelector('.scan-footer').innerHTML = this.opts.footer(); refreshIcons(); }
  },

  async close(immediate = false) {
    const el = this.el;
    if (!el) return;
    this.el = null;
    const opts = this.opts;
    await this.stopCamera();
    el.classList.remove('open');
    setTimeout(() => el.remove(), immediate ? 0 : 260);
    if (opts && opts.onClose) opts.onClose();
  },
};
