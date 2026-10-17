'use strict';
// ============================================================================
//  Battle of Hoth - Controller & Menü-Navigation (Android TV, Gamepads,
//  Fernbedienung, Tastatur)
//
//  Eingabequellen:
//   - Android-App: MainActivity reicht Controller-Tasten (hothPadKey) und
//     Sticks/Trigger (hothPadAxes) direkt an das Spiel weiter.
//   - Browser: Gamepad-API (navigator.getGamepads, Standard-Belegung).
//   - Fernbedienung/Tastatur: Pfeiltasten, Enter, Escape.
//
//  Menüs: hoch/runter = Eintrag wechseln, links/rechts = Wert ändern bzw.
//  zwischen Knöpfen wechseln, A/OK = bestätigen, B = zurück.
// ============================================================================

const PAD = {
  nat: { axes: [0, 0, 0, 0, 0, 0, 0, 0], btn: {} },   // von der Android-App
  web: { axes: [0, 0, 0, 0], lt: 0, rt: 0, btn: {} },  // Gamepad-API
  edges: new Set(),          // im Spiel gedrückte Tasten (werden von game.js abgeholt)
  connected: false,
  dirHeld: null, dirT: 0, dl: false, dr: false,
  down(n) { return !!(this.nat.btn[n] || this.web.btn[n]); },
  // Steuerkreuz-Kante; manche Controller melden das Kreuz doppelt (Taste + Achse) -> kurz entprellen
  dT: {},
  dEdge(n) { const t = performance.now(); if (t - (this.dT[n] || 0) > 90) this.edges.add(n); this.dT[n] = t; },
  take(n) { const had = this.edges.has(n); this.edges.delete(n); return had; },
  // Stick mit Totzone und weicher Kennlinie
  stick(x, y) {
    const m = Math.hypot(x, y), dz = 0.17;
    if (m < dz) return [0, 0];
    const k = Math.min(1, (m - dz) / (1 - dz)), c = k * k * 0.6 + k * 0.4;
    return [x / m * c, y / m * c];
  },
  axes() {
    const a = this.nat.axes, w = this.web.axes;
    const pick = (i) => (Math.abs(a[i]) > Math.abs(w[i]) ? a[i] : w[i]);
    const [lx, ly] = this.stick(pick(0), pick(1));
    const [rx, ry] = this.stick(pick(2), pick(3));
    return { lx, ly, rx, ry, lt: Math.max(a[4], this.web.lt), rt: Math.max(a[5], this.web.rt) };
  },
  fire() { const a = this.axes(); return a.rt > 0.35 || this.down('r2') || this.down('r1'); },
  zoom() { const a = this.axes(); return a.lt > 0.35 || this.down('l2') || this.down('l1'); },
  sprint() { return this.down('l3'); },
};

// Android-Tastencodes -> Namen. Die vier Haupttasten kommen nach ihrer Position (S/E/W/N = unten/rechts/links/oben)
// und werden je nach Einstellung "Controller-Tasten" auf die Beschriftung umgesetzt (Nintendo: rechts = A).
const PAD_KEYS = { 96: 'S', 97: 'E', 99: 'W', 100: 'N', 102: 'l1', 103: 'r1', 104: 'l2', 105: 'r2', 106: 'l3', 107: 'r3',
  108: 'start', 109: 'select', 110: 'start', 19: 'up', 20: 'down', 21: 'left', 22: 'right', 23: 'a', 66: 'a' };
const DIRS = ['up', 'down', 'left', 'right'];

const LAYOUTS = [{ S: 'b', E: 'a', W: 'y', N: 'x' },     // Nintendo
  { S: 'a', E: 'b', W: 'x', N: 'y' }];                      // Xbox / PlayStation
function padLabel(n) { const L = LAYOUTS[(typeof CFG !== 'undefined' && CFG.padLayout === 1) ? 1 : 0]; return L[n] || n; }

window.hothPadKey = (code, down) => {
  const n = padLabel(PAD_KEYS[code]);
  if (!n) return;
  const was = !!PAD.nat.btn[n];
  PAD.nat.btn[n] = !!down;
  PAD.connected = true;
  if (down && !was && !DIRS.includes(n)) padPress(n);
  if (down && !was && (n === 'left' || n === 'right') && !visibleScreen()) PAD.dEdge('d' + n);
};
window.hothPadAxes = (lx, ly, rx, ry, lt, rt, hx, hy) => {
  PAD.nat.axes = [lx, ly, rx, ry, lt, rt, hx, hy];
  const b = PAD.nat.btn, inGame = !visibleScreen();
  if (inGame && hx < -0.5 && !b.hatL) PAD.dEdge('dleft');
  if (inGame && hx > 0.5 && !b.hatR) PAD.dEdge('dright');
  PAD.nat.btn.hatL = hx < -0.5; PAD.nat.btn.hatR = hx > 0.5; PAD.nat.btn.hatU = hy < -0.5; PAD.nat.btn.hatD = hy > 0.5;
  PAD.connected = true;
};

// ---------------------------------------------------------------- Menü-Navigation
const NAV = { idx: 0, screen: null, items: [] };

function visibleScreen() {
  for (const id of ['updModal', 'over', 'pause', 'mp', 'menu']) { const el = $(id); if (el && !el.classList.contains('hidden')) return id; }
  return null;
}
function isShown(el) { return el && !el.classList.contains('hidden') && el.offsetParent !== null && !el.disabled; }
function navItems(screen) {
  const root = $(screen), items = [];
  if (screen === 'menu') {
    items.push($('startBtn'), $('mpBtn'));
    root.querySelectorAll('#settings .set').forEach(s => items.push(s));
    if (isShown($('updBtn'))) items.push($('updBtn'));
    items.push(root.querySelector('details.help summary'));
  } else if (screen === 'mp') {
    root.querySelectorAll('#mpName, #mpFactionRow, #mpIp, button').forEach(b => { if (isShown(b) && !(b.closest('.seg'))) items.push(b); });
  } else root.querySelectorAll('button').forEach(b => { if (isShown(b)) items.push(b); });
  return items.filter(Boolean);
}
function navRefresh() {
  const sc = visibleScreen();
  if (sc !== NAV.screen) { NAV.screen = sc; NAV.idx = 0; }
  if (!sc) { document.querySelectorAll('.navfocus').forEach(e => e.classList.remove('navfocus')); return; }
  NAV.items = navItems(sc);
  NAV.idx = clamp(NAV.idx, 0, Math.max(0, NAV.items.length - 1));
  NAV.items.forEach((el, i) => el.classList.toggle('navfocus', i === NAV.idx));
}
function navFocus() {
  const el = NAV.items[NAV.idx];
  if (!el) return;
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  NAV.items.forEach((e, i) => e.classList.toggle('navfocus', i === NAV.idx));
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
// Navigationsaktion ausführen; true = verarbeitet
function navAction(act) {
  const sc = visibleScreen();
  if (!sc) return false;
  document.body.classList.add('kbnav');
  navRefresh();
  const el = NAV.items[NAV.idx];
  const isSet = el && el.classList.contains('set');
  switch (act) {
    case 'up': NAV.idx = (NAV.idx - 1 + NAV.items.length) % NAV.items.length; navFocus(); break;
    case 'down': NAV.idx = (NAV.idx + 1) % NAV.items.length; navFocus(); break;
    case 'left': case 'right': {
      const d = act === 'left' ? -1 : 1;
      if (isSet && el._step) { el._step(d); SFX.click(); }
      else if (el && el.tagName === 'BUTTON' && el.parentElement.classList.contains('btns')) {
        // zwischen nebeneinanderliegenden Knöpfen wechseln
        const sib = [...el.parentElement.querySelectorAll('button')].filter(isShown);
        const j = sib.indexOf(el) + d;
        if (j >= 0 && j < sib.length) { NAV.idx = NAV.items.indexOf(sib[j]); navFocus(); }
      }
      break;
    }
    case 'ok':
      if (!el) break;
      if (isSet) { if (el._step) el._step(1, true); }
      else if (el.tagName === 'INPUT') el.focus();      // Bildschirmtastatur öffnen
      else el.click();
      SFX.init();
      setTimeout(navRefresh, 0);
      break;
    case 'back':
      if (sc === 'updModal') $('updLater').click();
      else if (sc === 'pause') $('resumeBtn').click();
      else if (sc === 'over') $('menuBtn').click();
      else if (sc === 'mp') $('mpBack').click();
      else return false;
      setTimeout(navRefresh, 0);
      break;
  }
  return true;
}

// Fernbedienung / Tastatur in Menüs: Pfeiltasten dürfen keine Schieberegler "fangen"
window.addEventListener('keydown', (e) => {
  if (!visibleScreen()) return;
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT' && ae.type === 'text') {   // Texteingabe: Tasten gehören dem Feld
    if (e.key === 'Enter' || e.key === 'Escape') { ae.blur(); ae.dispatchEvent(new Event('change')); e.preventDefault(); e.stopImmediatePropagation(); }
    return;
  }
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', GoBack: 'back' };
  let act = map[e.key] || map[e.code];
  if (!act && e.keyCode === 13) act = 'ok';
  if (!act) return;
  if (navAction(act)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
// Maus/Touch: Fokus-Rahmen wieder ausblenden
window.addEventListener('pointerdown', () => document.body.classList.remove('kbnav'), true);

// Controller-Taste gedrückt
function padPress(n) {
  if (visibleScreen()) {
    if (n === 'a') navAction('ok');
    else if (n === 'b') navAction('back');
    else if (n === 'start') { if (visibleScreen() === 'menu') $('startBtn').click(); else navAction('back'); }
    return;
  }
  PAD.edges.add(n);
}

// ---------------------------------------------------------------- Abfrage pro Frame
function pollGamepadApi() {
  const w = PAD.web;
  w.axes = [0, 0, 0, 0]; w.lt = 0; w.rt = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const names = ['S', 'E', 'W', 'N', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right'];
  const now = {};
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    PAD.connected = true;
    for (let i = 0; i < 4 && i < gp.axes.length; i++) if (Math.abs(gp.axes[i]) > Math.abs(w.axes[i])) w.axes[i] = gp.axes[i];
    gp.buttons.forEach((b, i) => {
      const n = names[i]; if (!n) return;
      const v = typeof b === 'object' ? b.value : b, p = typeof b === 'object' ? b.pressed : b > 0.5;
      if (p) now[n] = true;
      if (n === 'l2') w.lt = Math.max(w.lt, v); if (n === 'r2') w.rt = Math.max(w.rt, v);
    });
  }
  for (const raw of names) {
    const n = padLabel(raw);
    if (now[raw] && !w.btn[n] && !DIRS.includes(n)) padPress(n);
    w.btn[n] = !!now[raw];
  }
}
function padDir() {
  const a = PAD.nat.axes, w = PAD.web.axes, b = (n) => PAD.down(n);
  const x = Math.abs(a[0]) > Math.abs(w[0]) ? a[0] : w[0], y = Math.abs(a[1]) > Math.abs(w[1]) ? a[1] : w[1];
  if (b('up') || PAD.nat.btn.hatU || y < -0.6) return 'up';
  if (b('down') || PAD.nat.btn.hatD || y > 0.6) return 'down';
  if (b('left') || PAD.nat.btn.hatL || x < -0.6) return 'left';
  if (b('right') || PAD.nat.btn.hatR || x > 0.6) return 'right';
  return null;
}
let navLast = performance.now();
function navLoop(now) {
  requestAnimationFrame(navLoop);
  const dt = Math.min(0.1, (now - navLast) / 1000); navLast = now;
  pollGamepadApi();
  const sc = visibleScreen();
  if (sc !== NAV.screen) navRefresh();
  if (!sc) {
    PAD.dirHeld = null;
    // Steuerkreuz links/rechts im Spiel: Waffe wechseln (nur Kreuz, nicht der Stick)
    // (Android-Eingaben setzen die Kanten direkt in hothPadKey/hothPadAxes, hier nur die Gamepad-API)
    const dl = !!PAD.web.btn.left, dr = !!PAD.web.btn.right;
    if (dl && !PAD.dl) PAD.dEdge('dleft');
    if (dr && !PAD.dr) PAD.dEdge('dright');
    PAD.dl = dl; PAD.dr = dr;
    return;
  }
  PAD.edges.clear();
  // Steuerkreuz/Stick mit Wiederholung beim Halten
  const d = padDir();
  if (d !== PAD.dirHeld) { PAD.dirHeld = d; PAD.dirT = 0.38; if (d) navAction(d); }
  else if (d) { PAD.dirT -= dt; if (PAD.dirT <= 0) { PAD.dirT = 0.11; navAction(d); } }
}
requestAnimationFrame(navLoop);
