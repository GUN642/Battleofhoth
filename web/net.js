'use strict';
// ============================================================================
//  Battle of Hoth - LAN-Mehrspieler
//
//  Ein Gerät eröffnet das Spiel (Host), die anderen im selben Netzwerk treten
//  bei. Der Host berechnet die komplette Schlacht (KI, Treffer, Schaden) und
//  schickt ~15x pro Sekunde den Spielstand an alle. Jeder Client steuert seinen
//  eigenen Soldaten bzw. sein Fahrzeug selbst und meldet Position und Schüsse
//  an den Host.
//
//  Transport: in der Android-App über window.HothApp (LanNet.java: TCP + UDP-
//  Broadcast zur Spielsuche). Für automatische Tests im Browser gibt es mit
//  "?net=test" einen BroadcastChannel-Transport zwischen zwei Fenstern.
// ============================================================================

function androidTransport() {
  const A = window.HothApp;
  if (!A || !A.netHost) return null;
  return {
    kind: 'lan',
    host: (info) => A.netHost(JSON.stringify(info)),
    info: (info) => A.netInfo(JSON.stringify(info)),
    join: (ip, port) => A.netJoin(String(ip), port | 0),
    send: (peer, obj) => A.netSend(peer, JSON.stringify(obj)),
    poll: () => {
      const s = A.netPoll(), out = [];
      if (!s) return out;
      for (const line of s.split('\n')) {
        const i = line.indexOf('\t');
        if (i < 0) continue;
        try { out.push({ p: +line.slice(0, i), m: JSON.parse(line.slice(i + 1)) }); } catch (e) { /* kaputte Nachricht */ }
      }
      return out;
    },
    scan: (on) => A.netScan(!!on),
    hosts: () => { try { return JSON.parse(A.netHosts()); } catch (e) { return []; } },
    ip: () => A.netIp(),
    stop: () => A.netStop(),
  };
}

function testTransport() {
  const ch = new BroadcastChannel('hoth-net'), tok = Math.random().toString(36).slice(2, 8);
  const inbox = [], peers = new Map(), toks = new Map(), hosts = new Map();
  let role = null, hostTok = null, nextId = 1, info = null, beacon = null;
  ch.onmessage = (e) => {
    const d = e.data;
    if (d.k === 'beacon') { hosts.set(d.tok, { ip: 'test-' + d.tok, port: 1, info: d.info, t: Date.now() }); return; }
    if (role === 'host') {
      if (d.k === 'join' && d.to === tok) {
        const id = nextId++; peers.set(id, d.tok); toks.set(d.tok, id);
        ch.postMessage({ k: 'acc', to: d.tok, from: tok }); inbox.push({ p: id, m: { t: '_join' } });
      } else if (d.k === 'msg' && d.to === tok && toks.has(d.from)) inbox.push({ p: toks.get(d.from), m: d.m });
      else if (d.k === 'bye' && toks.has(d.from)) { const id = toks.get(d.from); toks.delete(d.from); peers.delete(id); inbox.push({ p: id, m: { t: '_leave' } }); }
    } else if (role === 'client') {
      if (d.k === 'acc' && d.to === tok) inbox.push({ p: 0, m: { t: '_open' } });
      else if (d.k === 'msg' && d.from === hostTok && (d.to === tok || d.to === '*')) inbox.push({ p: 0, m: d.m });
      else if (d.k === 'bye' && d.from === hostTok) inbox.push({ p: 0, m: { t: '_leave' } });
    }
  };
  return {
    kind: 'test',
    host: (inf) => { role = 'host'; info = inf; beacon = setInterval(() => ch.postMessage({ k: 'beacon', tok, info }), 400); return 'ok:test:1'; },
    info: (inf) => { info = inf; },
    join: (ip) => { role = 'client'; hostTok = String(ip).replace('test-', ''); ch.postMessage({ k: 'join', to: hostTok, tok }); },
    send: (peer, m) => {
      if (role === 'host') ch.postMessage({ k: 'msg', from: tok, to: peer < 0 ? '*' : peers.get(peer), m });
      else if (role === 'client') ch.postMessage({ k: 'msg', from: tok, to: hostTok, m });
    },
    poll: () => inbox.splice(0),
    scan: () => {},
    hosts: () => [...hosts.values()].filter(h => Date.now() - h.t < 2500),
    ip: () => 'test',
    stop: () => { if (beacon) clearInterval(beacon); beacon = null; if (role) ch.postMessage({ k: 'bye', from: tok }); role = null; },
  };
}

// ---------------------------------------------------------------- Avatare der Mitspieler
const PMODES = ['foot', 'turret', 'speeder', 'walker', 'dead', 'spectate', 'gunner'];
const SPMODES = ['parked', 'ai', 'player', 'remote', 'tow', 'crash', 'gone'];
const BATTLE_KEYS = ['map', 'rebels', 'rebLives', 'ewoks', 'troopers', 'atst', 'atat', 'aiSpeeders', 'turrets', 'bunkerGuns', 'lives', 'diff'];
const GLOBAL_MSG = new Set(['kill', 'turret', 'gen', 'tow', 'pad', 'trap', 'sap', 'herohan', 'herochewie', 'herorex', 'herocody', 'tp', 'drop']);

function nameSprite(name, f) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(250, ctx.measureText(name).width + 28);
  ctx.fillStyle = 'rgba(10,16,26,0.6)'; ctx.fillRect(128 - w / 2, 10, w, 44);
  ctx.fillStyle = f === REB ? '#ffb547' : '#9fd0ff'; ctx.fillRect(128 - w / 2, 50, w, 4);
  ctx.fillStyle = '#fff'; ctx.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }));
  s.scale.set(2.6, 0.65, 1); s.renderOrder = 8;
  return s;
}

class Avatar {
  constructor(id, name, f) {
    this.type = 'player'; this.remote = true; this.id = id; this.name = name; this.faction = f;
    this.pos = new THREE.Vector3(0, -50, 0); this.rpos = new THREE.Vector3(0, -50, 0);
    this.yaw = 0; this.pitch = 0; this.mode = 'dead'; this.alive = false; this.god = 0; this.kills = 0; this.lives = 0;
    this.veh = null; this.denyT = 0; this.hitT = 0;
    this.rs = { pos: this.rpos, yaw: 0, fall: 0, moving: false, alive: true, phase: 0 };
    this.sprite = null;
  }
  setName(name, f) {
    if (this.sprite && this.name === name && this.faction === f) return;
    this.name = name; this.faction = f;
    if (this.sprite) { G.scene.remove(this.sprite); this.sprite.material.map.dispose(); }
    this.sprite = nameSprite(name, f); G.scene.add(this.sprite);
  }
  dispose() { if (this.sprite) { G.scene.remove(this.sprite); this.sprite.material.map.dispose(); this.sprite = null; } }
}

// ---------------------------------------------------------------- Zustand
const NET = {
  mode: null,            // null | 'host' | 'client'
  tr: null, myId: 0, inGame: false, starting: false,
  name: '', faction: REB, lobby: [], avatars: new Map(),
  boltQ: [], snapT: 0, sendT: 0, hostsT: 0, endT: 0, firstSnap: true, hostIp: '',
  rend: null, origMsg: null,
  get active() { return this.mode !== null; },
};

function netTransport() {
  if (/[?&]net=test/.test(location.search) && window.BroadcastChannel) return testTransport();
  return androidTransport();
}

// ---------------------------------------------------------------- Lobby-Oberfläche
NET.initUI = function () {
  let nm = '';
  try { nm = localStorage.getItem('hothName') || ''; } catch (e) { /* egal */ }
  if (!nm) nm = ((window.HothApp && HothApp.deviceName && HothApp.deviceName()) || 'Spieler') + ' ' + (10 + Math.floor(Math.random() * 90));
  NET.name = nm.slice(0, 16);
  $('mpName').value = NET.name;
  $('mpName').addEventListener('change', () => {
    NET.name = ($('mpName').value || 'Spieler').trim().slice(0, 16) || 'Spieler';
    $('mpName').value = NET.name;
    try { localStorage.setItem('hothName', NET.name); } catch (e) { /* egal */ }
    if (NET.mode === 'host') { NET.lobby[0].n = NET.name; NET.sendLobby(); }
    else if (NET.mode === 'client') NET.send({ t: 'face', f: NET.faction, n: NET.name });
  });
  NET.faction = CFG.faction === 1 ? IMP : REB;
  const seg = $('mpFaction'), row = $('mpFactionRow');
  const setF = (f) => {
    NET.faction = f;
    [...seg.children].forEach((b, i) => b.classList.toggle('on', i === f));
    if (NET.mode === 'host') { NET.lobby[0].f = f; NET.sendLobby(); NET.renderLobby(); }
    else if (NET.mode === 'client') NET.send({ t: 'face', f, n: NET.name });
  };
  [...seg.children].forEach((b, i) => { b.tabIndex = -1; b.addEventListener('click', () => setF(i)); });
  row._step = (d, wrap) => setF(wrap ? 1 - NET.faction : clamp(NET.faction + d, 0, 1));
  setF(NET.faction);

  $('mpBtn').addEventListener('click', () => NET.openScreen());
  $('mpBack').addEventListener('click', () => { if (NET.mode) NET.leave(); else NET.closeScreen(); });
  $('mpHost').addEventListener('click', () => NET.host());
  $('mpJoinIp').addEventListener('click', () => {
    const v = $('mpIp').value.trim();
    if (!v) return;
    const [ip, port] = v.split(':');
    NET.join(ip, +port || 47780, ip);
  });
  $('mpGo').addEventListener('click', () => NET.startGame());
};

NET.status = function (txt, err) { const el = $('mpStatus'); el.textContent = txt; el.classList.toggle('err', !!err); };

NET.openScreen = function () {
  if (!NET.tr) NET.tr = netTransport();
  $('menu').classList.add('hidden'); $('mp').classList.remove('hidden');
  if (!NET.tr) {
    NET.status('Der LAN-Mehrspieler funktioniert nur in der Android-App (Handy, Tablet oder Android TV).', true);
    ['mpStartView', 'mpLobby'].forEach(id => $(id).classList.add('hidden'));
    return;
  }
  NET.showStartView();
};
NET.closeScreen = function () {
  if (NET.tr && !NET.mode) NET.tr.scan(false);
  $('mp').classList.add('hidden'); $('menu').classList.remove('hidden');
};
NET.showStartView = function () {
  $('mpStartView').classList.remove('hidden'); $('mpLobby').classList.add('hidden');
  NET.status('Eröffne ein Spiel oder tritt einem Spiel im selben Netzwerk bei.');
  NET.tr.scan(true);
  NET.lastHosts = '';
  NET.renderHosts();
};
NET.renderHosts = function () {
  if (!NET.tr || NET.mode || $('mp').classList.contains('hidden')) return;
  const list = NET.tr.hosts();
  const key = JSON.stringify(list.map(h => [h.ip, h.port, h.info && h.info.n, h.info && h.info.c, h.info && h.info.g]));
  if (key === NET.lastHosts) return;
  NET.lastHosts = key;
  const box = $('mpList'); box.innerHTML = '';
  if (!list.length) { const d = document.createElement('div'); d.className = 'mpempty'; d.textContent = 'Suche nach Spielen im Netzwerk …'; box.append(d); return; }
  for (const h of list) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sec mphost'; b.tabIndex = -1;
    const inf = h.info || {};
    b.textContent = `${inf.n || h.ip} · ${inf.c || 1} Spieler${inf.g ? ' · läuft' : ''}`;
    b.addEventListener('click', () => NET.join(h.ip, h.port, inf.n || h.ip));
    box.append(b);
  }
};
NET.renderLobby = function () {
  const box = $('mpPlayers'); box.innerHTML = '';
  for (const p of NET.lobby) {
    const d = document.createElement('div'); d.className = 'mpplayer ' + (p.f === IMP ? 'imp' : 'reb');
    d.innerHTML = `<span></span><b></b><i></i>`;
    d.children[0].textContent = p.f === IMP ? 'Imperium · Droiden' : 'Rebellen · Klone';
    d.children[1].textContent = p.n + (p.id === NET.myId ? ' (du)' : '');
    d.children[2].textContent = p.id === 0 ? 'Host' : '';
    box.append(d);
  }
  $('mpGo').classList.toggle('hidden', NET.mode !== 'host');
  $('mpWait').classList.toggle('hidden', NET.mode !== 'client');
};
NET.showLobby = function () {
  $('mpStartView').classList.add('hidden'); $('mpLobby').classList.remove('hidden');
  NET.renderLobby();
};

// ---------------------------------------------------------------- Verbinden
NET.beaconInfo = function () { return { n: NET.name, c: NET.lobby.length, g: NET.inGame ? 1 : 0 }; };
NET.host = function () {
  NET.tr.scan(false);
  const r = String(NET.tr.host({ n: NET.name, c: 1, g: 0 }));
  if (!r.startsWith('ok')) { NET.status('Spiel konnte nicht eröffnet werden: ' + r.replace('err:', ''), true); return; }
  NET.mode = 'host'; NET.myId = 0; NET.hostIp = r.split(':')[1] || '';
  NET.lobby = [{ id: 0, n: NET.name, f: NET.faction }];
  NET.status(`Dein Spiel ist offen (${NET.hostIp}). Mitspieler im selben Netzwerk finden es unter „Gefundene Spiele“.`);
  NET.showLobby();
};
NET.join = function (ip, port, label) {
  NET.tr.scan(false);
  NET.mode = 'client'; NET.myId = -1; NET.lobby = [];
  NET.status(`Verbinde mit ${label} …`);
  NET.tr.join(ip, port);
  NET.joinT = 6;
};
NET.leave = function (reason) {
  if (NET.tr) { NET.tr.stop(); }
  NET.endNetGame();
  NET.mode = null; NET.lobby = []; NET.myId = 0;
  for (const av of NET.avatars.values()) av.dispose();
  NET.avatars.clear();
  if (!$('mp').classList.contains('hidden') || reason) {
    if (reason) { $('menu').classList.add('hidden'); $('mp').classList.remove('hidden'); }
    NET.showStartView();
    if (reason) NET.status(reason, true);
  }
};
NET.send = function (obj) { if (NET.tr && NET.mode === 'client') NET.tr.send(0, obj); };
NET.sendTo = function (id, obj) { if (NET.tr && NET.mode === 'host') NET.tr.send(id, obj); };
NET.broadcast = function (obj) { if (NET.tr && NET.mode === 'host') NET.tr.send(-1, obj); };
NET.sendLobby = function () {
  NET.broadcast({ t: 'lobby', pl: NET.lobby });
  NET.tr.info(NET.beaconInfo());
  NET.renderLobby();
};

// ---------------------------------------------------------------- Spielstart / -ende
NET.battleCfg = function () { const c = {}; for (const k of BATTLE_KEYS) c[k] = CFG[k]; return c; };
NET.startGame = function () {
  if (NET.mode !== 'host') return;
  const cfg = NET.battleCfg();
  NET.broadcast({ t: 'start', cfg, pl: NET.lobby });
  NET.beginNetGame(cfg);
};
NET.beginNetGame = function (cfg, late) {
  NET.inGame = true; NET.firstSnap = true; NET.endT = 0; NET.boltQ.length = 0;
  for (const av of NET.avatars.values()) av.dispose();
  NET.avatars.clear();
  // Avatare (Host: für Spiellogik + Darstellung; Client: nur Darstellung)
  for (const p of NET.lobby) {
    if (p.id === NET.myId) continue;
    const av = new Avatar(p.id, p.n, p.f); av.setName(p.n, p.f);
    NET.avatars.set(p.id, av);
  }
  $('mp').classList.add('hidden');
  newGame({ cfg, faction: NET.faction, mp: NET.mode });
  if (NET.mode === 'host') {
    G.players = [P, ...NET.avatars.values()];
    NET.tr.info(NET.beaconInfo());
  } else {
    G.visualOnly = true;
    for (const w of G.atats.concat(G.atsts, G.turrets, G.speeders)) w.puppet = true;
  }
  NET.installHooks();
  if (late) G.msg('Du bist der laufenden Schlacht beigetreten.', 'late');
};
NET.installHooks = function () {
  G.netHook = (b) => {
    if (NET.mode === 'host') {
      const ex = b.owner && b.owner.remote ? b.owner.id : -1;
      const r = (v) => Math.round(v * 100) / 100;
      NET.boltQ.push(b.kind, b.f, r(b.p.x), r(b.p.y), r(b.p.z), r(b.dir.x * 1000) / 1000, r(b.dir.y * 1000) / 1000, r(b.dir.z * 1000) / 1000, ex);
    } else if (b.owner === P) {
      const r = (v) => Math.round(v * 100) / 100;
      NET.send({ t: 'fire', k: b.kind, f: b.f, o: [r(b.p.x), r(b.p.y), r(b.p.z)], d: [b.dir.x, b.dir.y, b.dir.z] });
    }
  };
  // Thermaldetonatoren: Host verteilt jeden Wurf, Clients melden ihre eigenen Würfe
  G.netNadeHook = (g) => {
    const r = (v) => Math.round(v * 100) / 100;
    const o = [r(g.p.x), r(g.p.y), r(g.p.z)], v = [r(g.v.x), r(g.v.y), r(g.v.z)];
    if (NET.mode === 'host') NET.broadcast({ t: 'g', f: g.f, o, v, ex: g.owner && g.owner.remote ? g.owner.id : -1 });
    else if (g.owner === P) NET.send({ t: 'nade', f: g.f, o, v });
  };
  // Sprengladungen am Bunkertor: Host verteilt jede Ladung an alle
  G.netChargeHook = () => { if (NET.mode === 'host') NET.broadcast({ t: 'cg' }); };
  if (NET.mode === 'host' && !NET.origMsg) {
    NET.origMsg = G.msg;
    G.msg = (text, key) => { NET.origMsg(text, key); if (GLOBAL_MSG.has(key)) NET.broadcast({ t: 'msg', x: text, k: key }); };
  }
};
NET.endNetGame = function () {
  NET.inGame = false;
  G.netHook = null; G.netNadeHook = null; G.netChargeHook = null; G.visualOnly = false; G.players = [P];
  if (NET.origMsg) { G.msg = NET.origMsg; NET.origMsg = null; }
  for (const av of NET.avatars.values()) av.dispose();
  NET.avatars.clear();
  if (NET.rend) { NET.rend.r.update([]); NET.rend.i.update([]); }
};

// Siegbedingung im Mehrspieler (nur Host)
NET.checkEnd = function (dt) {
  const hum = G.players;
  const impLeft = G.imps.some(s => s.alive || s.livesLeft > 0) || G.atsts.some(s => s.alive) || G.atats.some(s => s.alive) || hum.some(p => p.faction === IMP && (p.alive || p.lives > 0));
  const rebLeft = G.rebels.some(s => s.alive || s.livesLeft > 0) || G.turrets.some(t => t.alive) || hum.some(p => p.faction === REB && (p.alive || p.lives > 0));
  const w = G.genHP <= 0 ? IMP : !impLeft ? REB : !rebLeft ? IMP : null;
  if (w === null) { NET.endT = 0; return; }
  NET.endT += dt;
  if (NET.endT > 2.5) { NET.broadcast({ t: 'end', w }); NET.finish(w); }
};
NET.finish = function (w) {
  const win = w === P.faction;
  const txt = { hoth: ['Die Rebellen haben Echo Base verteidigt!', 'Das Imperium hat Echo Base erobert!'],
    endor: ['Die Rebellen haben den Bunkereingang auf Endor gehalten!', 'Das Imperium hat den Bunker auf Endor gestürmt!'],
    geonosis: ['Die Klonkrieger haben die Droidenarmee auf Geonosis geschlagen!', 'Die Droidenarmee hat die Kommandozentrale der Republik zerstört!'] }[MAP.id];
  endGame(win, txt[w === REB ? 0 : 1]);
  NET.inGame = false;
  if (NET.mode === 'host') NET.tr.info(NET.beaconInfo());
  $('againBtn').classList.toggle('hidden', NET.mode !== 'host');
  $('overWait').classList.toggle('hidden', NET.mode !== 'client');
};

// ---------------------------------------------------------------- Host: Spielstand senden
const R2 = (v) => Math.round(v * 100) / 100;
NET.snapshot = function () {
  const sol = (list) => { const a = []; for (const s of list) a.push(R2(s.pos.x), R2(s.pos.z), R2(s.yaw), (s.alive ? 1 : 0) | (s.moving ? 2 : 0) | (Math.max(0, s.livesLeft | 0) << 2)); return a; };
  const pid = (pl) => (pl ? (pl === P ? 0 : pl.id) : -1);
  const a = [], st = [], tu = [], sp = [], pl = [];
  for (const w of G.atats) a.push(R2(w.pos.x), R2(w.pos.z), R2(w.yaw), w.alive ? 1 : 0, R2(w.head.rotation.y), R2(w.head.rotation.x), w.tangled ? 1 : 0, pid(w.pilot));
  for (const w of G.atsts) st.push(R2(w.pos.x), R2(w.pos.z), R2(w.yaw), w.alive ? 1 : 0, 0, pid(w.pilot));
  for (const t of G.turrets) tu.push(R2(t.aimYaw), R2(t.aimPitch), t.alive ? 1 : 0, t.manned ? pid(t.mannedBy || P) : -1);
  for (const s of G.speeders) {
    sp.push(R2(s.pos.x), R2(s.pos.y), R2(s.pos.z), R2(s.yaw), R2(s.pitch), R2(s.roll), R2(s.vel.x), R2(s.vel.y), R2(s.vel.z),
      SPMODES.indexOf(s.mode), pid(s.pilot && (s.mode === 'player' || s.mode === 'remote' || s.mode === 'tow') ? s.pilot : null), s.alive ? 1 : 0,
      s.tow ? G.atats.indexOf(s.tow.atat) : -1, pid(s.gunner));
  }
  for (const p of G.players) pl.push(pid(p), p === P ? NET.name : p.name, p.faction, R2(p.pos.x), R2(p.pos.y), R2(p.pos.z), R2(p.yaw), R2(p.pitch), PMODES.indexOf(p.mode), p.alive ? 1 : 0, p.kills, p.lives);
  const T = G.transport;
  return { t: 's', gen: R2(G.genHP), r: sol(G.rebels), i: sol(G.imps), a, st, tu, sp, pl, tr: G.traps.map(t => t.state),
    tp: T ? [R2(T.pos.x), R2(T.pos.y), R2(T.pos.z), R2(T.yaw), R2(T.pitch)] : 0, dq: G.dropQueue.length };
};

NET.hostTick = function (dt) {
  if (!NET.inGame) return;
  if (NET.boltQ.length) { NET.broadcast({ t: 'b', l: NET.boltQ }); NET.boltQ = []; }
  NET.snapT -= dt;
  if (NET.snapT <= 0) { NET.snapT = 1 / 15; NET.broadcast(NET.snapshot()); }
};

// Fahrzeug eines entfernten Spielers beim Host übernehmen bzw. freigeben
function walkerList(k) { return k === 'atat' ? G.atats : k === 'atst' ? G.atsts : null; }
NET.releaseVehicle = function (av, v) {
  const wl = walkerList(v.k);
  if (wl) {
    const w = wl[v.i];
    if (w && w.pilot === av) { w.pilot = null; w.net = null; w.ctrl.fire = false; w.target = null; w.thinkCd = 0; if (w.goal) { w.goal.copy(w.pos); w.goalT = 0; } }
  } else if (v.k === 'sp') {
    const sp = G.speeders[v.i];
    if (sp && sp.pilot === av && sp.mode === 'remote') { sp.mode = 'gone'; sp.alive = false; sp.respawnT = 4; sp.pilot = null; sp.sync(); }
  } else if (v.k === 'tu') {
    const t = G.turrets[v.i];
    if (t && t.mannedBy === av) { t.manned = false; t.mannedBy = null; t.net = null; }
  } else if (v.k === 'gn') {
    const sp = G.speeders[v.i];
    if (sp && sp.gunner === av) sp.gunner = null;
  }
};
NET.deny = function (av) {
  if (G.time - av.denyT < 1) return;
  av.denyT = G.time;
  NET.sendTo(av.id, { t: 'deny' });
};
NET.applyRemoteVehicle = function (av, v) {
  const prev = av.veh;
  if (prev && (!v || prev.k !== v.k || prev.i !== v.i)) NET.releaseVehicle(av, prev);
  av.veh = null;
  if (!v) return;
  const wl = walkerList(v.k);
  if (wl) {
    const w = wl[v.i];
    if (!w) return;
    if (w.pilot !== av) {
      if (w.pilot || !w.alive || w.tangled) { NET.deny(av); return; }
      w.pilot = av;
    }
    if (!w.alive) return;
    w.net = { x: v.x, z: v.z, yaw: v.yaw, hy: v.hy, hx: v.hx, mv: !!v.mv };
  } else if (v.k === 'sp') {
    const sp = G.speeders[v.i];
    if (!sp) return;
    if (sp.pilot !== av || (sp.mode !== 'remote' && sp.mode !== 'tow')) {
      if (sp.mode !== 'parked') { if (!(sp.pilot === av && (sp.mode === 'crash' || sp.mode === 'gone'))) NET.deny(av); return; }
      sp.mode = 'remote'; sp.pilot = av; sp.alive = true; sp.hp = sp.maxHp;
    }
    if (sp.mode === 'remote') {
      sp.pos.set(v.x, v.y, v.z); sp.yaw = v.yaw; sp.pitch = v.pitch; sp.roll = v.roll;
      sp.vel.set(v.vx, v.vy, v.vz); sp.speed = sp.vel.length();
    }
  } else if (v.k === 'gn') {             // Bordschütze eines Kanonenboots
    const sp = G.speeders[v.i];
    if (!sp || !sp.alive || (sp.gunner && sp.gunner !== av)) { NET.deny(av); return; }
    sp.gunner = av;
  } else if (v.k === 'tu') {
    const t = G.turrets[v.i];
    if (!t || !t.alive) { NET.deny(av); return; }
    if (t.mannedBy !== av) { if (t.manned) { NET.deny(av); return; } t.manned = true; t.mannedBy = av; }
    t.net = { ay: v.ay, ap: v.ap };
  }
  av.veh = { k: v.k, i: v.i };
};

NET.onHostMsg = function (id, m) {
  let av = NET.avatars.get(id);
  switch (m.t) {
    case 'hello': {
      const n = String(m.n || 'Spieler').slice(0, 16), f = m.f === IMP ? IMP : REB;
      NET.lobby = NET.lobby.filter(p => p.id !== id);
      NET.lobby.push({ id, n, f });
      NET.sendTo(id, { t: 'welcome', id });
      NET.sendLobby();
      if (NET.inGame) {             // später Beitritt in eine laufende Schlacht
        av = new Avatar(id, n, f); av.setName(n, f); NET.avatars.set(id, av);
        G.players.push(av);
        NET.sendTo(id, { t: 'start', cfg: NET.battleCfg(), pl: NET.lobby, late: 1 });
        G.msg(n + ' ist der Schlacht beigetreten.', 'join');
      }
      break;
    }
    case 'face': {
      const p = NET.lobby.find(q => q.id === id);
      if (p) { if (!NET.inGame) p.f = m.f === IMP ? IMP : REB; if (m.n) p.n = String(m.n).slice(0, 16); NET.sendLobby(); }
      if (av && m.n) av.setName(String(m.n).slice(0, 16), av.faction);
      break;
    }
    case 'p':
      if (!av || !NET.inGame) return;
      av.pos.set(m.x, m.y, m.z); av.yaw = m.yaw; av.pitch = m.pitch;
      av.mode = PMODES[m.mo] || 'dead'; av.alive = !!m.al; av.god = m.g ? 1 : 0; av.lives = m.l | 0;
      NET.applyRemoteVehicle(av, m.v || null);
      break;
    case 'fire':
      if (!av || !NET.inGame || !KIND[m.k]) return;
      { const o = new THREE.Vector3(m.o[0], m.o[1], m.o[2]), d = new THREE.Vector3(m.d[0], m.d[1], m.d[2]).normalize();
        fireBolt(m.k, m.f === IMP ? IMP : REB, o, o.clone().addScaledVector(d, 100), 0, av); }
      break;
    case 'nade':
      if (!av || !NET.inGame || !Array.isArray(m.o) || !Array.isArray(m.v) || !m.o.concat(m.v).every(isFinite)) return;
      throwGrenade(av.faction, new THREE.Vector3(m.o[0], m.o[1], m.o[2]), new THREE.Vector3(m.v[0], m.v[1], m.v[2]).clampLength(0, 30), av);
      break;
    case 'trap': {
      const t = G.traps[m.i | 0];
      if (av && NET.inGame && t && av.faction === REB) t.trigger(av);
      break;
    }
    case 'drop': {
      const sp = G.speeders.find(v => v.pilot === av && v.mode === 'remote');
      if (av && NET.inGame && sp && isFinite(m.x) && isFinite(m.z) && Math.hypot(sp.pos.x - m.x, sp.pos.z - m.z) < 30) {
        const n = dropTroops(new THREE.Vector3(m.x, 0, m.z), 6);
        if (n) G.msg(`${av.name} hat ${n} Klonkrieger abgesetzt!`, 'drop');
      }
      break;
    }
    case 'charge':
      if (av && NET.inGame && av.faction === IMP && G.genHP > 0) plantCharge(av);
      break;
    case 'tow': {
      if (!av || !NET.inGame) return;
      const sp = G.speeders[m.i], a = G.atats[m.a];
      if (!sp || !a || sp.pilot !== av || sp.mode !== 'remote') break;
      if (isFinite(m.x)) sp.pos.set(m.x, m.y, m.z);       // aktuelle Position mitgeschickt
      if (a.alive && !a.tangled && Math.hypot(sp.pos.x - a.pos.x, sp.pos.z - a.pos.z) < 60) sp.startTow(a);
      break;
    }
    case '_leave': {
      NET.lobby = NET.lobby.filter(p => p.id !== id);
      if (av) {
        if (av.veh) NET.releaseVehicle(av, av.veh);
        av.dispose(); NET.avatars.delete(id);
        G.players = G.players.filter(p => p !== av);
        G.msg(av.name + ' hat das Spiel verlassen.', 'leave' + id);
      }
      NET.sendLobby();
      break;
    }
  }
};

// Treffer & Abschüsse bei entfernten Spielern (Host)
NET.remoteDie = function (av, cause) {
  if (!av.alive) return;
  av.alive = false; av.mode = 'dead';
  NET.sendTo(av.id, { t: 'die', c: cause });
};

// ---------------------------------------------------------------- Client
NET.myVehicle = function () {
  const r2 = R2;
  if (P.walker) { const w = P.walker; return { k: w.type, i: walkerList(w.type).indexOf(w), x: r2(w.pos.x), z: r2(w.pos.z), yaw: r2(w.yaw), hy: r2(w.head.rotation.y), hx: r2(w.head.rotation.x), mv: Math.abs(w.ctrl.fwd) > 0.05 ? 1 : 0 }; }
  if (P.speeder) { const s = P.speeder; return { k: 'sp', i: G.speeders.indexOf(s), x: r2(s.pos.x), y: r2(s.pos.y), z: r2(s.pos.z), yaw: r2(s.yaw), pitch: r2(s.pitch), roll: r2(s.roll), vx: r2(s.vel.x), vy: r2(s.vel.y), vz: r2(s.vel.z) }; }
  if (P.turret) { const t = P.turret; return { k: 'tu', i: G.turrets.indexOf(t), ay: r2(t.aimYaw), ap: r2(t.aimPitch) }; }
  if (P.gunship) return { k: 'gn', i: G.speeders.indexOf(P.gunship) };
  return null;
};
NET.clientTick = function (dt) {
  if (!NET.inGame) return;
  NET.sendT -= dt;
  if (NET.sendT <= 0) {
    NET.sendT = 0.05;
    NET.send({ t: 'p', x: R2(P.pos.x), y: R2(P.pos.y), z: R2(P.pos.z), yaw: R2(P.yaw), pitch: R2(P.pitch), mo: PMODES.indexOf(P.mode),
      al: P.alive ? 1 : 0, g: P.god > 0 ? 1 : 0, l: P.lives, v: NET.myVehicle() });
  }
};
NET.requestTow = function (sp, a) { NET.send({ t: 'tow', i: G.speeders.indexOf(sp), a: G.atats.indexOf(a), x: R2(sp.pos.x), y: R2(sp.pos.y), z: R2(sp.pos.z) }); };

function avatarRef(id) { return id < 0 ? null : id === NET.myId ? P : (NET.avatars.get(id) || { remote: true, id }); }

NET.applySnapshot = function (m) {
  const quiet = NET.firstSnap;      // beim späten Beitritt keine Explosionen für längst Zerstörtes
  NET.firstSnap = false;
  if (G.genHP > 0 && m.gen <= 0 && !quiet) genDestroyedFx();
  // Geonosis: Transportschiff nur als Bild, wartende Verstärkung für das eigene Kanonenboot
  NET.dq = m.dq | 0;
  if (m.tp && MAP.id === 'geonosis') {
    if (!G.transport) { G.transport = new NetTransport(); }
    G.transport.net(m.tp);
  } else if (G.transport) { G.transport.remove(); G.transport = null; }
  // Ewok-Fallen: Host löst aus, Clients spielen die Bewegung ab
  if (m.tr) G.traps.forEach((t, i) => {
    const st = m.tr[i];
    if (st === 1 && t.state === 0) { if (quiet) { t.state = 2; t.ang = 0.1; t.hitDone = true; } else t.trigger(null, true); }
    else if (st === 0 && t.state === 2) t.state = 3;
  });
  G.genHP = m.gen;
  const sol = (list, arr) => {
    for (let i = 0; i < list.length && i * 4 < arr.length; i++) {
      const s = list[i], x = arr[i * 4], z = arr[i * 4 + 1], yaw = arr[i * 4 + 2], fl = arr[i * 4 + 3];
      const alive = !!(fl & 1);
      s.net = { x, z, yaw, mv: !!(fl & 2) };
      s.livesLeft = fl >> 2;
      if (s.alive && !alive) { s.alive = false; s.fall = quiet ? 1 : 0; s.moving = false; if (!quiet) FX.sparks(_v3.set(s.pos.x, s.pos.y + 1.3, s.pos.z), 6, 1, 0.5, 0.2); }
      else if (!s.alive && alive) { s.alive = true; s.fall = 0; s.pos.set(x, heightAt(x, z), z); s.yaw = yaw; }
    }
  };
  sol(G.rebels, m.r); sol(G.imps, m.i);
  G.atats.forEach((w, i) => {
    const b = i * 8; if (b >= m.a.length) return;
    if (w.pilot !== P) w.net = { x: m.a[b], z: m.a[b + 1], yaw: m.a[b + 2], hy: m.a[b + 4], hx: m.a[b + 5] };
    w.tangled = !!m.a[b + 6];
    if (w.pilot !== P) w.pilot = avatarRef(m.a[b + 7]);
    if (w.alive && !m.a[b + 3]) { if (quiet) { w.alive = false; } else w.netDestroy(); }
  });
  G.atsts.forEach((w, i) => {
    const b = i * 6; if (b >= m.st.length) return;
    if (w.pilot !== P) w.net = { x: m.st[b], z: m.st[b + 1], yaw: m.st[b + 2], mv: false };
    if (w.pilot !== P) w.pilot = avatarRef(m.st[b + 5]);
    if (w.alive && !m.st[b + 3]) { if (quiet) w.alive = false; else w.netDestroy(); }
  });
  G.turrets.forEach((t, i) => {
    const b = i * 4; if (b >= m.tu.length) return;
    const mid = m.tu[b + 3];
    if (t.mannedBy !== P) { t.net = { ay: m.tu[b], ap: m.tu[b + 1] }; t.manned = mid >= 0; t.mannedBy = avatarRef(mid); }
    if (t.alive && !m.tu[b + 2]) { if (quiet) { t.alive = false; t.head.visible = false; t.root.scale.y = 0.55; } else t.netDestroy(); }
  });
  G.speeders.forEach((s, i) => {
    const b = i * 14; if (b >= m.sp.length) return;
    if (P.gunship !== s) s.gunner = avatarRef(m.sp[b + 13]);
    const a = m.sp, mode = SPMODES[a[b + 9]] || 'parked', pl = a[b + 10], mine = P.speeder === s;
    s.netTow = a[b + 12] >= 0 ? a[b + 12] : null;
    s.alive = !!a[b + 11];
    if (mine) {
      if (mode === 'tow') { s.mode = 'tow'; s.tow = { atat: G.atats[a[b + 12]] }; }
      else if (s.mode === 'tow' && (mode === 'remote' || mode === 'player')) { s.mode = 'player'; s.tow = null; s.pitch = 0.35; s.speed = 50; P.yaw = s.yaw - Math.PI; }
    } else {
      if (s.mode !== 'gone' && mode === 'gone' && s.mode === 'crash' && !quiet) { FX.explosion(s.pos, 3); SFX.boom(s.pos, 2); }
      s.mode = mode === 'remote' && pl === NET.myId ? 'gone' : mode;
      s.pilot = avatarRef(pl);
    }
    if (!mine || s.mode === 'tow') s.net = { x: a[b], y: a[b + 1], z: a[b + 2], yaw: a[b + 3], pitch: a[b + 4], roll: a[b + 5], vx: a[b + 6], vy: a[b + 7], vz: a[b + 8], age: 0 };
  });
  // Spieler
  const seen = new Set();
  for (let k = 0; k + 11 < m.pl.length; k += 12) {
    const id = m.pl[k];
    if (id === NET.myId) { P.kills = m.pl[k + 10]; continue; }
    seen.add(id);
    let av = NET.avatars.get(id);
    if (!av) { av = new Avatar(id, m.pl[k + 1], m.pl[k + 2]); NET.avatars.set(id, av); }
    av.setName(m.pl[k + 1], m.pl[k + 2]);
    av.pos.set(m.pl[k + 3], m.pl[k + 4], m.pl[k + 5]); av.yaw = m.pl[k + 6]; av.pitch = m.pl[k + 7];
    av.mode = PMODES[m.pl[k + 8]] || 'dead'; av.alive = !!m.pl[k + 9]; av.kills = m.pl[k + 10]; av.lives = m.pl[k + 11];
  }
  for (const [id, av] of NET.avatars) if (!seen.has(id)) { av.dispose(); NET.avatars.delete(id); }
};

NET.onClientMsg = function (m) {
  switch (m.t) {
    case '_open': NET.joinT = 0; NET.send({ t: 'hello', n: NET.name, f: NET.faction }); NET.status('Verbunden – warte auf den Host …'); break;
    case '_fail': NET.mode = null; NET.status('Verbindung fehlgeschlagen. Ist das Gerät im selben Netzwerk?', true); NET.tr.scan(true); break;
    case 'welcome': NET.myId = m.id; NET.showLobby(); NET.status('Verbunden. Wähle deine Seite – der Host startet die Schlacht.'); break;
    case 'lobby': NET.lobby = m.pl || []; { const me = NET.lobby.find(p => p.id === NET.myId); if (me) NET.faction = me.f; } NET.renderLobby(); break;
    case 'start':
      NET.lobby = m.pl || NET.lobby;
      { const me = NET.lobby.find(p => p.id === NET.myId); if (me) NET.faction = me.f; }
      NET.beginNetGame(m.cfg || {}, !!m.late);
      break;
    case 's': if (NET.inGame) NET.applySnapshot(m); break;
    case 'b':
      if (!NET.inGame || !m.l) break;
      for (let k = 0; k + 8 < m.l.length; k += 9) {
        if (m.l[k + 8] === NET.myId) continue;
        const o = new THREE.Vector3(m.l[k + 2], m.l[k + 3], m.l[k + 4]);
        fireBolt(m.l[k], m.l[k + 1], o, o.clone().add(_v1.set(m.l[k + 5], m.l[k + 6], m.l[k + 7]).multiplyScalar(100)), 0, null, true);
      }
      break;
    case 'g':
      if (!NET.inGame || m.ex === NET.myId || !m.o || !m.v) break;
      throwGrenade(m.f === IMP ? IMP : REB, new THREE.Vector3(m.o[0], m.o[1], m.o[2]), new THREE.Vector3(m.v[0], m.v[1], m.v[2]), null, true);
      break;
    case 'cg': if (NET.inGame) plantCharge(null, true); break;
    case 'die': if (NET.inGame) killPlayer(m.c || 'Getroffen'); break;
    case 'hit': G.hitMarker(P); break;
    case 'deny':
      if (P.gunship) P.exitGunner(true);
      else if (P.walker) P.exitWalker(); else if (P.turret) P.exitTurret(false);
      else if (P.speeder) { const sp = P.speeder; P.mode = 'foot'; P.speeder = null; P.pos.set(sp.pos.x, heightAt(sp.pos.x, sp.pos.z), sp.pos.z); }
      G.msg('Dieses Fahrzeug ist schon besetzt.', 'deny');
      break;
    case 'eject': if (P.turret) P.exitTurret(true); break;
    case 'msg': if (NET.inGame) G.msg(m.x, m.k); break;
    case 'end': NET.finish(m.w); break;
    case '_leave': NET.leave('Die Verbindung zum Host wurde getrennt.'); showMenu({ mp: true }); NET.status('Die Verbindung zum Host wurde getrennt.', true); break;
  }
};

// ---------------------------------------------------------------- Pro Frame
NET.tick = function (dt) {
  if (!NET.tr) return;
  if (!NET.mode) {
    NET.hostsT -= dt;
    if (NET.hostsT <= 0) { NET.hostsT = 1; NET.renderHosts(); }
    return;
  }
  for (const { p, m } of NET.tr.poll()) {
    if (!m || typeof m !== 'object') continue;
    if (NET.mode === 'host') NET.onHostMsg(p, m); else if (p === 0) NET.onClientMsg(m);
    if (!NET.mode) break;
  }
  if (NET.mode === 'client' && NET.joinT > 0) {
    NET.joinT -= dt;
    if (NET.joinT <= 0 && NET.myId < 0) { NET.tr.stop(); NET.mode = null; NET.status('Keine Antwort vom Host.', true); NET.tr.scan(true); }
  }
  if (NET.mode === 'host') NET.hostTick(dt); else if (NET.mode === 'client') NET.clientTick(dt);
};

// Mitspieler zeichnen (Soldatenmodell + Namensschild)
NET.drawAvatars = function (dt) {
  if (!NET.rend) {
    NET.rend = { r: new SoldierRenderer(REB, 16), i: new SoldierRenderer(IMP, 16) };
    NET.rend.r.addTo(G.scene); NET.rend.i.addTo(G.scene);
  }
  const lr = [], li = [];
  if (NET.inGame) {
    for (const av of NET.avatars.values()) {
      const vis = av.mode === 'foot' || (av.mode === 'dead' && av.pos.y > -10);
      const k = Math.min(1, dt * 14);
      if (av.rpos.distanceTo(av.pos) > 6) av.rpos.copy(av.pos); else av.rpos.lerp(av.pos, k);
      const rs = av.rs, moved = av.rs.last ? av.rpos.distanceTo(av.rs.last) : 0;
      rs.last = rs.last || new THREE.Vector3(); rs.last.copy(av.rpos);
      rs.yaw = av.yaw + Math.PI; rs.moving = moved > dt * 0.8; if (rs.moving) rs.phase += dt * 9;
      rs.alive = av.alive; rs.fall = av.alive ? 0 : Math.min(1, rs.fall + dt * 2.5);
      if (vis) (av.faction === IMP ? li : lr).push(rs);
      if (av.sprite) { av.sprite.visible = av.mode === 'foot' && av.alive; av.sprite.position.set(av.rpos.x, av.rpos.y + 2.25, av.rpos.z); }
    }
  }
  NET.rend.r.update(lr); NET.rend.i.update(li);
};
