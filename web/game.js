'use strict';
// ============================================================================
//  Battle of Hoth - Spieler, Steuerung, HUD, Menüs und Hauptschleife
// ============================================================================

const $ = (id) => document.getElementById(id);
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const MAX_REBELS = 60, MAX_TROOPERS = 150;

// ---------------------------------------------------------------- Einstellungen
const SETTINGS = [
  { key: 'rebels', label: 'Rebellen (dein Team)', min: 0, max: MAX_REBELS, def: 20 },
  { key: 'troopers', label: 'Sturmtruppen', min: 0, max: MAX_TROOPERS, def: 40 },
  { key: 'atst', label: 'AT-ST', min: 0, max: 10, def: 3 },
  { key: 'atat', label: 'AT-AT', min: 0, max: 6, def: 2 },
  { key: 'aiSpeeders', label: 'Schneegleiter (KI-Verbündete)', min: 0, max: 8, def: 2 },
  { key: 'turrets', label: 'Geschütztürme', min: 0, max: 12, def: 6 },
  { key: 'lives', label: 'Deine Leben', min: 1, max: 10, def: 3 },
  { key: 'diff', label: 'Schwierigkeit', min: 0, max: 2, def: 1, names: ['Leicht', 'Normal', 'Schwer'] },
  { key: 'sens', label: 'Blick-Empfindlichkeit', min: 1, max: 10, def: 5 },
  { key: 'gfx', label: 'Grafik', min: 0, max: 2, def: 1, names: ['Niedrig', 'Mittel', 'Hoch'] },
];
const CFG = {};
SETTINGS.forEach(s => (CFG[s.key] = s.def));
try { Object.assign(CFG, JSON.parse(localStorage.getItem('hothCfg') || '{}')); } catch (e) { /* kein Speicher */ }
function saveCfg() { try { localStorage.setItem('hothCfg', JSON.stringify(CFG)); } catch (e) { /* egal */ } }

function buildSettingsUI() {
  const root = $('settings');
  root.innerHTML = '';
  for (const s of SETTINGS) {
    const div = document.createElement('div'); div.className = 'set';
    const lab = document.createElement('label');
    const name = document.createElement('span'); name.textContent = s.label;
    const val = document.createElement('b');
    lab.append(name, val);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = 1; inp.value = clamp(+CFG[s.key], s.min, s.max);
    const show = () => { CFG[s.key] = +inp.value; val.textContent = s.names ? s.names[CFG[s.key]] : CFG[s.key]; };
    inp.addEventListener('input', () => { show(); saveCfg(); if (s.key === 'gfx') applyGfx(); });
    show();
    div.append(lab, inp); root.append(div);
  }
}

// ---------------------------------------------------------------- Renderer & Szene
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: !IS_TOUCH, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd5e1ec);
scene.fog = new THREE.Fog(0xd5e1ec, 90, 900);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 5000);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x7a8698, 0.62));
const sun = new THREE.DirectionalLight(0xfff6ea, 0.68); sun.position.set(-0.6, 0.8, 0.45); scene.add(sun);

buildHeightCache();
scene.add(buildTerrainMesh());
buildSky(scene);
buildBaseProps(scene);
FX.init(scene);
const snow = new SnowFall(scene, 900);
G.scene = scene;
G.dyn = new THREE.Group(); scene.add(G.dyn);
const rebR = new SoldierRenderer(REB, MAX_REBELS), impR = new SoldierRenderer(IMP, MAX_TROOPERS);
rebR.addTo(scene); impR.addTo(scene);
const boltRed = new BoltRenderer(0xff3a22, 500), boltGreen = new BoltRenderer(0x44ff3a, 500);
scene.add(boltRed.mesh); scene.add(boltGreen.mesh);

function applyGfx() {
  const dpr = window.devicePixelRatio || 1;
  const pr = [0.75, Math.min(dpr, 1.25), Math.min(dpr, 2)][CFG.gfx | 0];
  renderer.setPixelRatio(pr);
  onResize();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const hpx = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  FX.setScale(hpx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
}
window.addEventListener('resize', onResize);

// Waffe in der Hand (Ego-Ansicht)
const gun = new THREE.Group();
gun.add(vcMesh([
  gBox(0.07, 0.09, 0.62, 0, 0, -0.1, 0x2a2a2a), gBox(0.05, 0.12, 0.18, 0, -0.08, 0.12, 0x3b2f25),
  gBox(0.035, 0.035, 0.32, 0, 0.01, -0.55, 0x1c1c1c), gBox(0.04, 0.05, 0.2, 0, 0.08, -0.15, 0x444444),
  gBox(0.06, 0.08, 0.06, 0, -0.08, -0.2, 0x2a2a2a), gBox(0.09, 0.07, 0.16, -0.02, -0.06, 0.05, 0xcabfa6),
]));
gun.position.set(0.11, -0.1, -0.3); gun.scale.setScalar(0.36); gun.rotation.y = 0.05;
const gunTip = new THREE.Object3D(); gunTip.position.set(0, 0.01, -0.72); gun.add(gunTip);
camera.add(gun);

// ---------------------------------------------------------------- Spieler
const P = G.player = {
  type: 'player', mode: 'spectate', alive: false, pos: new V3(), yaw: 0, pitch: 0, vy: 0, onGround: true,
  lives: 0, kills: 0, heat: 0, overheat: 0, fireCd: 0, respawnT: 0, turret: null, speeder: null,
  bob: 0, recoil: 0, god: 0, deathCause: '',
  exitTurret(destroyed) {
    const t = this.turret; if (!t) return;
    t.manned = false; this.turret = null; this.mode = 'foot';
    const back = trenchZ(t.pos.x) < t.pos.z ? 3 : -3;
    this.pos.set(t.pos.x + 1, 0, t.pos.z + back); this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.yaw = t.aimYaw - Math.PI; this.pitch = 0;
    if (destroyed) G.msg('Du wurdest aus dem zerstörten Turm geschleudert!', 'turret2');
  },
  speederDestroyed() { const sp = this.speeder; this.speeder = null; killPlayer('Schneegleiter abgeschossen', sp ? sp.pos : null); },
};

function spawnPlayer(first) {
  const x = first ? 0 : rand(-25, 25);
  P.pos.set(x, 0, trenchZ(x) + 0.2); P.pos.y = heightAt(P.pos.x, P.pos.z);
  P.yaw = 0; P.pitch = 0.03; P.vy = 0; P.mode = 'foot'; P.alive = true; P.heat = 0; P.overheat = 0;
  P.god = first ? 0 : 2.5; P.turret = null; P.speeder = null;
  $('dead').classList.add('hidden');
}

function killPlayer(cause, where) {
  if (!P.alive) return;
  if (P.mode === 'turret' && P.turret) P.turret.manned = false;
  if (P.speeder && P.speeder.mode === 'player') { P.speeder.mode = 'gone'; P.speeder.respawnT = 3; P.speeder.alive = false; }
  P.alive = false; P.lives--; P.deathCause = cause;
  P.mode = 'dead'; P.respawnT = 4; P.turret = null; P.speeder = null;
  if (where) P.pos.copy(where);
  $('dead').classList.remove('hidden');
  $('deadTitle').textContent = cause === 'Blastertreffer' ? 'Getroffen!' : cause + '!';
  SFX.boom(null, 0.6);
}
G.onPlayerHit = (cause) => { if (P.god > 0 || !P.alive) return; killPlayer(cause); };
G.onKill = () => { P.kills++; };
let hitTimer = 0;
G.hitMarker = () => { $('hit').classList.add('on'); hitTimer = 0.15; SFX.click(); };

// ---------------------------------------------------------------- Meldungen
const msgTimes = {};
G.msg = (text, key) => {
  if (state !== 'playing') return;
  const now = performance.now();
  if (key && msgTimes[key] && now - msgTimes[key] < 4000) return;
  if (key) msgTimes[key] = now;
  const box = $('msgs'), d = document.createElement('div');
  d.textContent = text; box.prepend(d);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 3500);
};

// ---------------------------------------------------------------- Eingabe
const input = { keys: {}, mouseFire: false, touchFire: false, lookDX: 0, lookDY: 0, joyX: 0, joyY: 0, use: false, jump: false, harpoon: false };
let pointerLocked = false;

window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (state !== 'playing') { if (e.code === 'Escape' && state === 'paused') resume(); return; }
  if (e.code === 'KeyE') input.use = true;
  if (e.code === 'KeyF') input.harpoon = true;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') pause();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
const canvas = renderer.domElement;
canvas.addEventListener('mousedown', (e) => {
  if (IS_TOUCH || state !== 'playing') return;
  SFX.init();
  if (!pointerLocked) { canvas.requestPointerLock && canvas.requestPointerLock(); return; }
  if (e.button === 0) input.mouseFire = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseFire = false; });
window.addEventListener('mousemove', (e) => { if (pointerLocked) { input.lookDX += e.movementX; input.lookDY += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && state === 'playing' && !IS_TOUCH) pause();
});

// Touch-Steuerung
const touches = {};   // id -> {kind, x, y, bx, by}
function touchStart(e) {
  if (state !== 'playing') return;
  e.preventDefault();
  SFX.init();
  for (const t of e.changedTouches) {
    const btn = t.target.closest && t.target.closest('.tbtn');
    const id = btn && btn.id;
    if (id === 'bPause') { pause(); continue; }
    if (id === 'bJump') { input.jump = true; btn.classList.add('on'); touches[t.identifier] = { kind: 'btn', el: btn }; continue; }
    if (id === 'bUse') { input.use = true; btn.classList.add('on'); touches[t.identifier] = { kind: 'btn', el: btn }; continue; }
    if (id === 'bHarp') { input.harpoon = true; btn.classList.add('on'); touches[t.identifier] = { kind: 'btn', el: btn }; continue; }
    if (id === 'bFire') { input.touchFire = true; btn.classList.add('on'); touches[t.identifier] = { kind: 'fire', el: btn, x: t.clientX, y: t.clientY }; continue; }
    if (t.clientX < window.innerWidth * 0.42 && !Object.values(touches).some(o => o.kind === 'joy')) {
      touches[t.identifier] = { kind: 'joy', bx: t.clientX, by: t.clientY };
      const jb = $('joyBase'); jb.style.display = 'block'; jb.style.left = t.clientX + 'px'; jb.style.top = t.clientY + 'px';
      $('joyHint').style.display = 'none';
    } else touches[t.identifier] = { kind: 'look', x: t.clientX, y: t.clientY };
  }
}
function touchMove(e) {
  if (state !== 'playing') return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const o = touches[t.identifier]; if (!o) continue;
    if (o.kind === 'look' || o.kind === 'fire') {
      input.lookDX += (t.clientX - o.x) * 2.2; input.lookDY += (t.clientY - o.y) * 2.2;
      o.x = t.clientX; o.y = t.clientY;
    } else if (o.kind === 'joy') {
      let dx = t.clientX - o.bx, dy = t.clientY - o.by; const d = Math.hypot(dx, dy), R = 55;
      if (d > R) { dx *= R / d; dy *= R / d; }
      input.joyX = dx / R; input.joyY = -dy / R;
      $('joyKnob').style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }
}
function touchEnd(e) {
  for (const t of e.changedTouches) {
    const o = touches[t.identifier]; if (!o) continue;
    if (o.el) o.el.classList.remove('on');
    if (o.kind === 'fire') input.touchFire = false;
    if (o.kind === 'joy') { input.joyX = input.joyY = 0; $('joyBase').style.display = 'none'; $('joyKnob').style.transform = ''; }
    delete touches[t.identifier];
  }
}
window.addEventListener('touchstart', touchStart, { passive: false });
window.addEventListener('touchmove', touchMove, { passive: false });
window.addEventListener('touchend', touchEnd);
window.addEventListener('touchcancel', touchEnd);
function resetInput() {
  for (const k in touches) delete touches[k];
  input.touchFire = input.mouseFire = false; input.joyX = input.joyY = 0; input.lookDX = input.lookDY = 0;
  input.use = input.jump = input.harpoon = false; input.keys = {};
  document.querySelectorAll('.tbtn.on').forEach(b => b.classList.remove('on'));
  $('joyBase').style.display = 'none';
}

// ---------------------------------------------------------------- Zielen
const _fwd = new V3(), _tmp = new V3(), _tmp2 = new V3();
function camForward(out) { const cp = Math.cos(P.pitch); return out.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp); }
// Entfernung bis zum anvisierten Punkt (damit Schüsse aus dem Lauf genau im Fadenkreuz landen)
function aimDistance(o, d, maxD) {
  let best = maxD;
  for (let t = 2; t < maxD; t += 2) if (heightAt(o.x + d.x * t, o.z + d.z * t) > o.y + d.y * t) { best = t; break; }
  for (const s of G.imps) {
    if (!s.alive) continue;
    _tmp.set(s.pos.x - o.x, s.pos.y + 1 - o.y, s.pos.z - o.z);
    const t = _tmp.dot(d); if (t <= 0 || t > best) continue;
    if (_tmp.addScaledVector(d, -t).lengthSq() < 0.6) best = t;
  }
  for (const w of G.atsts.concat(G.atats)) {
    if (!w.alive) continue;
    for (const sp of w.spheres) {
      _tmp.subVectors(sp, o); const t = _tmp.dot(d); if (t <= 0 || t > best) continue;
      if (_tmp.addScaledVector(d, -t).lengthSq() < sp.r * sp.r) best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------- Spieler-Update
function nearestUsable() {
  let best = null, bd = 1e9;
  for (const t of G.turrets) {
    if (!t.alive || t.manned) continue;
    const d = Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z);
    if (d < 4.5 && d < bd) { bd = d; best = t; }
  }
  for (const s of G.speeders) {
    if (s.mode !== 'parked') continue;
    const d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z);
    if (d < 6 && d < bd) { bd = d; best = s; }
  }
  return best;
}
function nearestTowable(sp) {
  let best = null, bd = 48;
  for (const a of G.atats) {
    if (!a.alive || a.tangled) continue;
    const d = Math.hypot(a.pos.x - sp.pos.x, a.pos.z - sp.pos.z);
    if (d < bd && sp.pos.y - a.pos.y < 17) { bd = d; best = a; }
  }
  return best;
}

function updatePlayer(dt) {
  const sens = 0.00045 * CFG.sens * (IS_TOUCH ? 1.2 : 1);
  const lookX = input.lookDX * sens, lookY = input.lookDY * sens;
  input.lookDX = input.lookDY = 0;
  const k = input.keys;
  const fwdIn = clamp((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + input.joyY, -1, 1);
  const strIn = clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.joyX, -1, 1);
  const firing = input.mouseFire || input.touchFire;
  const use = input.use, jump = input.jump, harpoon = input.harpoon;
  input.use = input.jump = input.harpoon = false;
  P.god = Math.max(0, P.god - dt);
  P.fireCd -= dt;
  if (P.overheat > 0) { P.overheat -= dt; if (P.overheat <= 0) P.heat = 0.3; }
  P.heat = Math.max(0, P.heat - dt * (firing ? 0.18 : 0.45));
  P.recoil = Math.max(0, P.recoil - dt * 6);
  const prompts = [];

  if (P.mode === 'dead') {
    P.respawnT -= dt;
    const left = Math.max(0, P.lives);
    $('deadText').textContent = left > 0 ? `Noch ${left} ${left === 1 ? 'Leben' : 'Leben'} – Rückkehr in ${Math.ceil(P.respawnT)} s` : 'Keine Leben mehr';
    camera.position.y = Math.max(heightAt(camera.position.x, camera.position.z) + 0.4, camera.position.y - dt * 1.5);
    camera.rotation.z = Math.min(0.5, camera.rotation.z + dt * 0.4);
    gun.visible = false;
    if (P.respawnT <= 0 && P.lives > 0) spawnPlayer(false);
    setPrompt(prompts);
    return;
  }
  camera.rotation.z = 0;

  if (P.mode === 'foot') {
    P.yaw -= lookX; P.pitch = clamp(P.pitch - lookY, -1.45, 1.45);
    const sprint = k.ShiftLeft || k.ShiftRight || Math.hypot(input.joyX, input.joyY) > 0.95;
    const spd = (sprint ? 7.2 : 4.6) * (P.onGround ? 1 : 0.8);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let mx = -sy * fwdIn + cy * strIn, mz = -cy * fwdIn - sy * strIn;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    P.pos.x += mx * spd * dt; P.pos.z += mz * spd * dt;
    // Hindernisse
    for (const t of G.turrets) {
      const dx = P.pos.x - t.pos.x, dz = P.pos.z - t.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.3 && d > 0.001) { P.pos.x = t.pos.x + dx / d * 2.3; P.pos.z = t.pos.z + dz / d * 2.3; }
    }
    { const dx = P.pos.x - WORLD.gen.x, dz = P.pos.z - WORLD.gen.z, d = Math.hypot(dx, dz);
      if (d < 15 && d > 0.001) { P.pos.x = WORLD.gen.x + dx / d * 15; P.pos.z = WORLD.gen.z + dz / d * 15; } }
    P.pos.x = clamp(P.pos.x, -420, 420); P.pos.z = clamp(P.pos.z, -700, 250);
    const gh = heightAt(P.pos.x, P.pos.z);
    if (P.onGround && jump) { P.vy = 4.6; P.onGround = false; }
    if (!P.onGround) {
      P.vy -= 13 * dt; P.pos.y += P.vy * dt;
      if (P.pos.y <= gh) { P.pos.y = gh; P.onGround = true; P.vy = 0; }
    } else {
      if (gh < P.pos.y - 0.6) { P.onGround = false; P.vy = 0; }
      else P.pos.y += (gh - P.pos.y) * Math.min(1, dt * 14);
    }
    if (ml > 0.1 && P.onGround) P.bob += dt * spd * 1.9;
    const bobY = Math.sin(P.bob) * 0.045 * Math.min(1, ml);
    camera.position.set(P.pos.x, P.pos.y + 1.62 + bobY, P.pos.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
    gun.visible = true;
    gun.position.set(0.11 + Math.cos(P.bob * 0.5) * 0.005, -0.1 + bobY * 0.15, -0.3 + P.recoil * 0.025);
    gun.rotation.x = P.recoil * 0.12;
    // Feuern
    if (firing && P.fireCd <= 0 && P.overheat <= 0) {
      P.fireCd = 0.17; P.heat += 0.075; P.recoil = 1;
      if (P.heat >= 1) { P.heat = 1; P.overheat = 1.6; G.msg('Blaster überhitzt!', 'heat'); }
      camera.updateMatrixWorld(true);
      camForward(_fwd);
      const dist = aimDistance(camera.position, _fwd, 260);
      _tmp2.copy(camera.position).addScaledVector(_fwd, dist);
      gunTip.getWorldPosition(_tmp);
      fireBolt(0, REB, _tmp, _tmp2, 0.002, P);
    }
    const u = nearestUsable();
    if (u) {
      prompts.push(u.type === 'turret' ? '[E] Geschützturm bemannen' : '[E] In den Schneegleiter steigen');
      if (use) {
        if (u.type === 'turret') {
          P.mode = 'turret'; P.turret = u; u.manned = true;
          P.yaw = u.aimYaw - Math.PI; P.pitch = clamp(u.aimPitch, -0.35, 0.6);
          G.msg('Geschützturm bemannt – ziele auf die Läufer!', 'tin');
        } else {
          P.mode = 'speeder'; P.speeder = u; u.mode = 'player'; u.speed = 20; u.pitch = 0.35;
          P.yaw = u.yaw - Math.PI; P.pitch = 0.3;
          G.msg('Schneegleiter gestartet! Flieg tief an ein AT-AT und feuere das Schleppkabel ab.', 'sin');
        }
      }
    }
  } else if (P.mode === 'turret') {
    const t = P.turret;
    P.yaw -= lookX * 0.8; P.pitch = clamp(P.pitch - lookY * 0.8, -0.35, 0.6);
    t.aimYaw = P.yaw + Math.PI; t.aimPitch = P.pitch; t.apply();
    camForward(_fwd);
    camera.position.set(t.pos.x, t.pos.y + 7.4, t.pos.z).addScaledVector(_fwd, -6.5);
    camera.rotation.set(P.pitch, P.yaw, 0);
    gun.visible = false;
    if (firing && P.fireCd <= 0 && P.overheat <= 0) {
      P.fireCd = 0.36; P.heat += 0.09;
      if (P.heat >= 1) { P.heat = 1; P.overheat = 2; G.msg('Geschütz überhitzt!', 'heat'); }
      camera.updateMatrixWorld(true);
      const dist = aimDistance(camera.position, _fwd, 400);
      _tmp2.copy(camera.position).addScaledVector(_fwd, dist);
      t.muzzle(_tmp);
      fireBolt(3, REB, _tmp, _tmp2, 0.003, P);
    }
    prompts.push('[E] Turm verlassen');
    if (use) P.exitTurret(false);
  } else if (P.mode === 'speeder') {
    const sp = P.speeder;
    if (sp.mode === 'tow') {
      const a = sp.tow.atat;
      _tmp.subVectors(sp.pos, a.pos); _tmp.y = 0; _tmp.normalize();
      camera.position.copy(sp.pos).addScaledVector(_tmp, 12); camera.position.y += 5;
      camera.lookAt(a.pos.x, a.pos.y + 9, a.pos.z);
      gun.visible = false;
      prompts.push('Schleppkabel wird um die Beine gewickelt...');
      P.yaw = sp.yaw - Math.PI; P.pitch = 0.3;
      setPrompt(prompts);
      P.pos.copy(sp.pos);
      return;
    }
    P.yaw -= lookX * 0.9; P.pitch = clamp(P.pitch - lookY * 0.9, -0.6, 0.6);
    // außerhalb des Schlachtfelds -> zurücklenken
    if (Math.abs(sp.pos.x) > 450 || sp.pos.z < -850 || sp.pos.z > 270) {
      const want = Math.atan2(sp.pos.x, sp.pos.z + 150);   // Kamera-Yaw Richtung Zentrum
      P.yaw += angDiff(P.yaw, want) * Math.min(1, dt * 1.5);
      G.msg('Kehre zum Schlachtfeld zurück!', 'bounds');
    }
    sp.fly(dt, P.yaw + Math.PI, P.pitch, 45 + fwdIn * 22);
    if (P.speeder !== sp) { setPrompt(prompts); return; }   // bei Kollision zerstört
    camForward(_fwd);
    camera.position.copy(sp.pos).addScaledVector(_fwd, -11); camera.position.y += 4.2;
    const ch = heightAt(camera.position.x, camera.position.z) + 1;
    if (camera.position.y < ch) camera.position.y = ch;
    camera.rotation.set(P.pitch, P.yaw, 0);
    gun.visible = false;
    if (firing) sp.fire(_fwd, P);
    const a = nearestTowable(sp);
    if (a) {
      prompts.push(IS_TOUCH ? 'KABEL: Schleppkabel abfeuern!' : '[F] Schleppkabel abfeuern!');
      if (harpoon) sp.startTow(a);
    } else if (harpoon) G.msg('Kein AT-AT in Reichweite – flieg tief (unter 17 m) und nah heran.', 'harp');
    const alt = sp.pos.y - heightAt(sp.pos.x, sp.pos.z);
    prompts.push(alt < 12 ? '[E] Aussteigen' : 'Höhe ' + alt.toFixed(0) + ' m');
    if (use) {
      if (alt < 12) {
        P.mode = 'foot'; P.speeder = null;
        P.pos.set(sp.pos.x, heightAt(sp.pos.x, sp.pos.z), sp.pos.z); P.onGround = true; P.pitch = 0;
        sp.mode = 'gone'; sp.alive = false; sp.respawnT = 4; sp.sync();
        G.msg('Der Schneegleiter kehrt automatisch zur Landeplattform zurück.', 'back');
      } else G.msg('Zum Aussteigen tiefer fliegen (unter 12 m).', 'low');
    }
    P.pos.copy(sp.pos);
  }
  setPrompt(prompts);
}

let lastPrompt = '';
function setPrompt(list) {
  const s = list.join('|');
  if (s === lastPrompt) return;
  lastPrompt = s;
  const el = $('prompt'); el.innerHTML = '';
  for (const p of list) { const sp = document.createElement('span'); sp.textContent = IS_TOUCH ? p.replace('[E]', 'E:').replace('[F]', 'KABEL:') : p; el.append(sp); }
}

// ---------------------------------------------------------------- HUD
let hudT = 0, radarT = 0;
const radarCtx = $('radar').getContext('2d');
function updateHUD(dt) {
  if (hitTimer > 0) { hitTimer -= dt; if (hitTimer <= 0) $('hit').classList.remove('on'); }
  const heat = $('heat');
  $('heatFill').style.width = (P.heat * 100).toFixed(0) + '%';
  heat.classList.toggle('over', P.overheat > 0);
  heat.style.visibility = (P.mode === 'foot' || P.mode === 'turret') && P.heat > 0.01 ? 'visible' : 'hidden';
  $('cross').className = P.mode === 'speeder' || P.mode === 'turret' ? 'big' : '';
  $('cross').style.visibility = P.mode === 'dead' ? 'hidden' : 'visible';
  $('bHarp').classList.toggle('hidden', P.mode !== 'speeder');
  $('bJump').classList.toggle('hidden', P.mode !== 'foot');
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.2;
    const reb = G.rebels.filter(s => s.alive).length, imp = G.imps.filter(s => s.alive).length;
    const st = G.atsts.filter(s => s.alive).length, at = G.atats.filter(s => s.alive).length;
    $('stats').innerHTML = `<span class="reb">Rebellen: <b>${reb}</b></span><br><span class="imp">Sturmtruppen: <b>${imp}</b> · AT-ST: <b>${st}</b> · AT-AT: <b>${at}</b></span>`;
    $('lives').innerHTML = `Leben: <b style="color:#ff8a7a">${'♥'.repeat(Math.max(0, P.lives))}</b><br>Abschüsse: <b style="color:#ffe81f">${P.kills}</b>`;
    $('genFill').style.width = (100 * G.genHP / G.genMax).toFixed(1) + '%';
    $('genFill').style.background = G.genHP / G.genMax < 0.3 ? '#ff5a3a' : '';
  }
  radarT -= dt;
  if (radarT <= 0) { radarT = 0.12; drawRadar(); }
}
function drawRadar() {
  const c = radarCtx, S = 150, R = 72, range = 260;
  c.clearRect(0, 0, S, S);
  c.save(); c.translate(S / 2, S / 2);
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(0, 0, R / 2, 0, TAU); c.stroke();
  const yaw = P.mode === 'speeder' && P.speeder ? P.speeder.yaw - Math.PI : P.yaw;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const px = camera.position.x, pz = camera.position.z;
  const dot = (x, z, r, col, sq) => {
    const dx = x - px, dz = z - pz;
    const rx = (dx * cs - dz * sn) / range * R, ry = (dx * sn + dz * cs) / range * R;
    if (rx * rx + ry * ry > R * R) return;
    c.fillStyle = col;
    if (sq) c.fillRect(rx - r, ry - r, r * 2, r * 2); else { c.beginPath(); c.arc(rx, ry, r, 0, TAU); c.fill(); }
  };
  dot(WORLD.gen.x, WORLD.gen.z, 5, '#4fc3ff');
  for (const t of G.turrets) if (t.alive) dot(t.pos.x, t.pos.z, 2.5, '#9ad0ff', true);
  for (const s of G.rebels) if (s.alive) dot(s.pos.x, s.pos.z, 1.6, '#7dff8a');
  for (const s of G.speeders) if (s.mode === 'ai' || s.mode === 'tow' || s.mode === 'parked') dot(s.pos.x, s.pos.z, 2.5, '#ffb340');
  for (const s of G.imps) if (s.alive) dot(s.pos.x, s.pos.z, 1.6, '#ff5040');
  for (const w of G.atsts) if (w.alive) dot(w.pos.x, w.pos.z, 3.5, '#ff7a3a', true);
  for (const w of G.atats) if (w.alive) dot(w.pos.x, w.pos.z, 5, '#ff3020', true);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- Spielablauf
let state = 'menu', endTimer = 0, demo = true, menuT = 0, battleT = 0;

function clearBattle() {
  for (const ch of G.dyn.children.slice()) { if (ch.isLine) ch.geometry.dispose(); G.dyn.remove(ch); }
  G.rebels = []; G.imps = []; G.atats = []; G.atsts = []; G.turrets = []; G.speeders = [];
  for (const b of G.bolts) boltPool.push(b);
  G.bolts.length = 0; FX.clear(); G.time = 0;
}

function setupBattle(cfg) {
  clearBattle();
  G.genMax = G.genHP = 150;
  G.diff = [{ spread: 0.06, rate: 0.75 }, { spread: 0.048, rate: 1 }, { spread: 0.028, rate: 1.3 }][cfg.diff | 0];
  const nR = Math.min(cfg.rebels, MAX_REBELS);
  for (let i = 0; i < nR; i++) {
    let x = -TR.len + 8 + (i + 0.5) / nR * (2 * TR.len - 16) + rand(-2, 2);
    if (Math.abs(x) < 2.5) x += 4;
    G.rebels.push(new Soldier(REB, x, trenchZ(x) + rand(-0.6, 0.2)));
  }
  for (let i = 0; i < Math.min(cfg.troopers, MAX_TROOPERS); i++) G.imps.push(new Soldier(IMP, rand(-150, 150), rand(-275, -165)));
  for (let i = 0; i < cfg.atst; i++) G.atsts.push(new ATST(rand(-110, 110), rand(-340, -260)));
  for (let i = 0; i < cfg.atat; i++) G.atats.push(new ATAT((i - (cfg.atat - 1) / 2) * 55 + rand(-8, 8), rand(-520, -460)));
  for (let i = 0; i < cfg.turrets; i++) {
    const x = cfg.turrets === 1 ? 12 : -140 + 280 * i / (cfg.turrets - 1) + rand(-4, 4);
    G.turrets.push(new Turret(Math.abs(x) < 4 ? x + 8 : x, trenchZ(x) + rand(9, 15)));
  }
  for (const dx of [-7, 7]) {
    const x = WORLD.pad.x + dx, z = WORLD.pad.z;
    const s = new Speeder('parked', x, heightAt(x, z) + 1.0, z, Math.PI);
    s.isPad = true; G.speeders.push(s);
  }
  for (let i = 0; i < cfg.aiSpeeders; i++) G.speeders.push(new Speeder('ai', rand(-120, 120), rand(35, 55), rand(60, 140), Math.PI + rand(-0.3, 0.3)));
}

function newGame() {
  demo = false;
  setupBattle(CFG);
  if (G.rebels.length + G.imps.length + G.atats.length + G.atsts.length === 0) { /* leer */ }
  P.lives = CFG.lives; P.kills = 0; spawnPlayer(true);
  state = 'playing'; endTimer = 0; battleT = 0; document.title = 'Hoth';
  resetInput();
  ['menu', 'over', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !IS_TOUCH);
  $('joyHint').style.display = '';
  $('msgs').innerHTML = '';
  lastPrompt = '#';
  SFX.init();
  G.msg('Das Imperium greift an! Halte den Graben und schütze den Schildgenerator!', 'start');
  if (!IS_TOUCH && canvas.requestPointerLock) canvas.requestPointerLock();
}

function startDemo() {
  demo = true;
  setupBattle({ rebels: 24, troopers: 45, atst: 3, atat: 3, aiSpeeders: 3, turrets: 6, diff: 1 });
  P.mode = 'spectate'; P.alive = false; P.lives = 0;
}

function showMenu() {
  state = 'menu'; document.title = 'Hoth-Menu';
  if (document.pointerLockElement) document.exitPointerLock();
  ['over', 'pause', 'hud', 'touch'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  buildSettingsUI();
  startDemo();
}
function pause() {
  if (state !== 'playing') return;
  state = 'paused'; resetInput();
  if (document.pointerLockElement) document.exitPointerLock();
  $('pause').classList.remove('hidden');
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing'; $('pause').classList.add('hidden');
  if (!IS_TOUCH && canvas.requestPointerLock) canvas.requestPointerLock();
}
function endGame(win, reason) {
  state = 'over'; document.title = 'Hoth';
  if (document.pointerLockElement) document.exitPointerLock();
  resetInput();
  $('touch').classList.add('hidden');
  $('over').classList.remove('hidden');
  const t = $('overTitle');
  t.textContent = win ? 'SIEG!' : 'NIEDERLAGE';
  t.className = win ? 'win' : 'lose';
  const m = Math.floor(battleT / 60), s = Math.floor(battleT % 60);
  const reb = G.rebels.filter(r => r.alive).length;
  $('overText').innerHTML = (win ? 'Der Angriff des Imperiums wurde abgewehrt. Echo Base ist gerettet!' : reason) +
    `<br><br>Deine Abschüsse: <b>${P.kills}</b><br>Überlebende Rebellen: <b>${reb} / ${G.rebels.length}</b>` +
    `<br>Schildgenerator: <b>${Math.round(100 * G.genHP / G.genMax)}%</b><br>Dauer: <b>${m}:${String(s).padStart(2, '0')}</b>`;
}
window.hothPause = () => pause();
window.hothBack = () => {
  if (state === 'playing') pause();
  else if (state === 'paused') resume();
  else if (state === 'over') showMenu();
};

$('startBtn').addEventListener('click', () => { SFX.init(); newGame(); });
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', showMenu);
$('againBtn').addEventListener('click', newGame);
$('menuBtn').addEventListener('click', showMenu);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function checkEnd(dt) {
  const enemies = G.imps.some(s => s.alive) || G.atsts.some(s => s.alive) || G.atats.some(s => s.alive);
  let res = null;
  if (!enemies) res = [true, ''];
  else if (G.genHP <= 0) res = [false, 'Der Schildgenerator wurde zerstört – Echo Base ist gefallen.'];
  else if (P.lives <= 0 && !P.alive) res = [false, 'Du bist gefallen und hast keine Leben mehr.'];
  if (!res) { endTimer = 0; return; }
  endTimer += dt;
  if (endTimer > (res[0] ? 2 : 3)) endGame(res[0], res[1]);
}

// ---------------------------------------------------------------- Hauptschleife
function simulate(dt) {
  G.time += dt;
  SFX.tick(dt);
  for (const s of G.rebels) updateSoldier(s, dt);
  for (const s of G.imps) updateSoldier(s, dt);
  for (const w of G.atats) w.update(dt);
  for (const w of G.atsts) w.update(dt);
  for (const t of G.turrets) t.update(dt);
  for (const s of G.speeders) s.update(dt);
  updateBolts(dt);
}
function drawDynamic() {
  boltRed.begin(); boltGreen.begin();
  for (const b of G.bolts) (b.f === REB ? boltRed : boltGreen).add(b);
  boltRed.end(); boltGreen.end();
  rebR.update(G.rebels); impR.update(G.imps);
}

function menuCamera(dt) {
  menuT += dt * 0.05;
  const x = Math.sin(menuT) * 130;
  camera.position.set(x, heightAt(x, 40) + 16, 40);
  camera.lookAt(x * 0.4, 12, -160);
  gun.visible = false;
  SFX.listener.copy(camera.position);
  // Demo-Schlacht neu starten, wenn sie vorbei ist
  const enemies = G.imps.some(s => s.alive) || G.atsts.some(s => s.alive) || G.atats.some(s => s.alive);
  if (!enemies || G.genHP <= 0 || G.time > 420) startDemo();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (state === 'playing') {
    battleT += dt;
    updatePlayer(dt);
    SFX.listener.copy(camera.position);
    simulate(dt);
    updateHUD(dt);
    checkEnd(dt);
  } else if (state === 'menu') {
    simulate(dt);
    menuCamera(dt);
  }
  if (state === 'playing' || state === 'menu') FX.update(dt);
  drawDynamic();
  snow.update(dt, camera.position);
  renderer.render(scene, camera);
}

// Debug-/Testschnittstelle
window.__hoth = { G, P, CFG, newGame, showMenu, simulate, setupBattle, get state() { return state; }, input };

applyGfx();
showMenu();
requestAnimationFrame(frame);
