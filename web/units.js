'use strict';
// ============================================================================
//  Battle of Hoth - Einheiten: Soldaten, Laserschüsse, AT-AT, AT-ST,
//  Geschütztürme und Schneegleiter
// ============================================================================

const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _one = new V3(1, 1, 1), _Z = new V3(0, 0, 1);

// Globaler Spielzustand (wird in game.js befüllt)
const G = {
  scene: null, dyn: null, time: 0,
  rebels: [], imps: [], atats: [], atsts: [], turrets: [], speeders: [], bolts: [],
  player: null, genHP: 150, genMax: 150,
  diff: { spread: 0.04, rate: 1 },
  msg: () => {}, onPlayerHit: () => {}, onKill: () => {}, hitMarker: () => {},
};

// ---------------------------------------------------------------- Waffentypen
//  speed m/s, len/w = Optik, splash = Explosionsradius (tötet Infanterie),
//  atst/atat = Schaden an Läufern, struct = Schaden an Türmen/Generator, veh = Schaden an Schneegleitern
const KIND = [
  { speed: 125, len: 1.6, w: 0.07, splash: 0, atst: 0, atat: 0, struct: 0, veh: 0, life: 2.2 },     // 0 Blaster
  { speed: 115, len: 2.6, w: 0.15, splash: 2.2, atst: 0, atat: 0, struct: 0.5, veh: 1, life: 2.5 }, // 1 AT-ST Kanone
  { speed: 105, len: 5.0, w: 0.32, splash: 5, atst: 0, atat: 0, struct: 2, veh: 2, life: 3.5 },     // 2 AT-AT Kanone
  { speed: 160, len: 3.2, w: 0.22, splash: 3, atst: 1, atat: 1, struct: 0, veh: 0, life: 2.5 },     // 3 Geschützturm
  { speed: 230, len: 2.8, w: 0.12, splash: 1.8, atst: 1, atat: 0.25, struct: 0, veh: 0, life: 2 },  // 4 Schneegleiter
];

// ---------------------------------------------------------------- Soldaten-Modelle
function soldierGeos(f) {
  if (f === REB) {
    const coat = 0xcabfa6, pants = 0x8c8372;
    return {
      body: mergeGeos([
        gBox(0.5, 0.62, 0.3, 0, 1.22, 0, coat), gBox(0.54, 0.32, 0.34, 0, 0.84, 0, 0xbdb196),
        gBox(0.55, 0.06, 0.35, 0, 0.96, 0, 0x5a4632), gBox(0.24, 0.26, 0.26, 0, 1.66, 0, 0xd8a47c),
        gBox(0.32, 0.16, 0.33, 0, 1.8, -0.01, 0xe4e0d4), gBox(0.27, 0.07, 0.05, 0, 1.7, 0.14, 0x262626),
        gBox(0.38, 0.46, 0.2, 0, 1.24, -0.25, 0x9e967f),
        gBox(0.12, 0.12, 0.46, -0.2, 1.3, 0.2, coat), gBox(0.12, 0.12, 0.42, 0.2, 1.3, 0.17, coat),
        gBox(0.07, 0.11, 0.8, 0.04, 1.34, 0.45, 0x2b2b2b),
      ]),
      leg: mergeGeos([gBox(0.18, 0.78, 0.2, 0, -0.39, 0, pants), gBox(0.19, 0.16, 0.27, 0, -0.82, 0.03, 0x3a3028)]),
    };
  }
  const w = 0xeeeeee, g = 0xd4d4d4;
  return {
    body: mergeGeos([
      gBox(0.5, 0.62, 0.3, 0, 1.22, 0, w), gBox(0.58, 0.5, 0.38, 0, 0.74, 0, 0xe2e2e2),
      gBox(0.55, 0.07, 0.35, 0, 0.98, 0, 0x2e2e2e), gBox(0.3, 0.3, 0.32, 0, 1.7, 0, w),
      gBox(0.27, 0.08, 0.05, 0, 1.73, 0.16, 0x111111), gBox(0.14, 0.12, 0.06, 0, 1.6, 0.17, 0x3a3a3a),
      gBox(0.36, 0.42, 0.2, 0, 1.25, -0.25, g),
      gBox(0.12, 0.12, 0.46, -0.2, 1.3, 0.2, w), gBox(0.12, 0.12, 0.42, 0.2, 1.3, 0.17, w),
      gBox(0.07, 0.11, 0.7, 0.04, 1.34, 0.42, 0x1a1a1a),
    ]),
    leg: mergeGeos([gBox(0.18, 0.78, 0.2, 0, -0.39, 0, 0xe8e8e8), gBox(0.2, 0.16, 0.28, 0, -0.82, 0.03, 0x9a9a9a)]),
  };
}

class SoldierRenderer {
  constructor(f, max) {
    const g = soldierGeos(f);
    this.body = new THREE.InstancedMesh(g.body, VCMAT, max);
    this.legL = new THREE.InstancedMesh(g.leg, VCMAT, max);
    this.legR = new THREE.InstancedMesh(g.leg, VCMAT, max);
    for (const m of [this.body, this.legL, this.legR]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; }
    this.max = max;
  }
  addTo(scene) { scene.add(this.body); scene.add(this.legL); scene.add(this.legR); }
  update(list) {
    const n = Math.min(list.length, this.max);
    for (let i = 0; i < n; i++) {
      const s = list[i];
      _e.set(-s.fall * 1.45, s.yaw, 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(s.pos, _q, _one);
      this.body.setMatrixAt(i, _m);
      const sw = s.moving && s.alive ? Math.sin(s.phase) * 0.55 : 0;
      for (let k = 0; k < 2; k++) {
        _e.set(k ? -sw : sw, 0, 0); _q.setFromEuler(_e);
        _v1.set(k ? 0.12 : -0.12, 0.9, 0);
        _m2.compose(_v1, _q, _one);
        _m2.premultiply(_m);
        (k ? this.legR : this.legL).setMatrixAt(i, _m2);
      }
    }
    for (const m of [this.body, this.legL, this.legR]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- Soldaten-KI
class Soldier {
  constructor(f, x, z) {
    this.f = f; this.type = 'sol';
    this.pos = new V3(x, heightAt(x, z), z);
    this.yaw = f === REB ? Math.PI : 0;
    this.alive = true; this.fall = 0; this.deadT = 0;
    this.phase = rand(0, TAU); this.moving = false;
    this.fireCd = rand(1.5, 4); this.thinkCd = rand(0, 1.2); this.target = null;
    this.goal = new V3(); this.state = 'hold'; this.stateT = rand(0.5, 4);
    this.slotX = x; this.slotD = z - trenchZ(x);
    this.holdDist = rand(22, 65);
  }
}

function aimPoint(t, out) {
  switch (t.type) {
    case 'sol': return out.set(t.pos.x, t.pos.y + rand(1.1, 1.65), t.pos.z);
    case 'player': return out.set(t.pos.x, t.pos.y + rand(1.1, 1.6), t.pos.z);
    case 'turret': return out.set(t.pos.x, t.pos.y + rand(2, 4.5), t.pos.z);
    case 'gen': return out.set(WORLD.gen.x + rand(-6, 6), WORLD.gen.y + rand(3, 9), WORLD.gen.z);
    case 'speeder': return out.copy(t.pos);
    case 'atst': return out.set(t.pos.x, t.pos.y + 6.8, t.pos.z);
    case 'atat': return out.set(t.pos.x, t.pos.y + 16, t.pos.z);
  }
  return out.copy(t.pos);
}
function targetAlive(t) {
  if (!t) return false;
  if (t.type === 'player') return t.alive && t.mode === 'foot';
  if (t.type === 'gen') return G.genHP > 0;
  if (t.type === 'speeder') return t.alive && (t.mode === 'ai' || t.mode === 'player');
  return t.alive;
}

function soldierTarget(s) {
  const range2 = 175 * 175;
  const list = s.f === REB ? G.imps : G.rebels;
  let b1 = null, b2 = null, b3 = null, d1 = range2, d2 = range2, d3 = range2;
  const consider = (t) => {
    const dx = t.pos.x - s.pos.x, dz = t.pos.z - s.pos.z, d = dx * dx + dz * dz;
    if (d < d1) { b3 = b2; d3 = d2; b2 = b1; d2 = d1; b1 = t; d1 = d; }
    else if (d < d2) { b3 = b2; d3 = d2; b2 = t; d2 = d; }
    else if (d < d3) { b3 = t; d3 = d; }
  };
  for (const t of list) if (t.alive) consider(t);
  if (s.f === IMP && targetAlive(G.player)) consider(G.player);
  _v1.set(s.pos.x, s.pos.y + 1.6, s.pos.z);
  for (const c of [b1, b2, b3]) {
    if (!c) continue;
    _v2.set(c.pos.x, c.pos.y + 1.6, c.pos.z);
    if (lineOfSight(_v1, _v2)) return c;
  }
  return null;
}

function rebelsHoldTrench() { return G.rebels.some(r => r.alive) || (G.player && G.player.lives > 0); }

function updateSoldier(s, dt) {
  if (!s.alive) { if (s.fall < 1) s.fall = Math.min(1, s.fall + dt * 2.5); s.deadT += dt; return; }
  s.thinkCd -= dt;
  if (s.thinkCd <= 0) { s.thinkCd = rand(0.6, 1.3); s.target = soldierTarget(s); }
  if (s.target && !targetAlive(s.target)) s.target = null;
  s.moving = false;
  s.stateT -= dt;
  if (s.f === IMP) {
    if (s.state === 'advance') {
      const dx = s.goal.x - s.pos.x, dz = s.goal.z - s.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.5 || s.stateT <= 0) { s.state = 'hold'; s.stateT = s.target ? rand(2.5, 6) : rand(0.5, 2); }
      else {
        const spd = 2.4 * dt;
        s.pos.x += dx / d * spd; s.pos.z += dz / d * spd; s.moving = true;
        if (!s.target) s.yaw = Math.atan2(dx, dz);
      }
    } else if (s.stateT <= 0) {
      const limit = rebelsHoldTrench() ? trenchZ(s.pos.x) - s.holdDist : WORLD.gen.z - 25;
      if (s.pos.z < limit - 1) {
        s.state = 'advance'; s.stateT = rand(3, 7);
        s.goal.set(clamp(s.pos.x + rand(-8, 8), -TR.len, TR.len), 0, Math.min(limit, s.pos.z + rand(8, 22)));
      } else s.stateT = rand(2, 4);
    }
  } else {
    if (s.state === 'advance') {
      const dx = s.goal.x - s.pos.x;
      if (Math.abs(dx) < 0.3 || s.stateT <= 0) { s.state = 'hold'; s.stateT = rand(4, 12); }
      else { s.pos.x += Math.sign(dx) * 2.2 * dt; s.pos.z = trenchZ(s.pos.x) + s.slotD; s.moving = true; }
    } else if (s.stateT <= 0) {
      s.state = 'advance'; s.stateT = rand(1.5, 3);
      s.goal.x = clamp(s.slotX + rand(-5, 5), -TR.len + 3, TR.len - 3);
    }
  }
  s.pos.y = heightAt(s.pos.x, s.pos.z);
  if (s.moving) s.phase += dt * 9;
  if (s.target) {
    const want = Math.atan2(s.target.pos.x - s.pos.x, s.target.pos.z - s.pos.z);
    s.yaw += angDiff(s.yaw, want) * Math.min(1, dt * 6);
    s.fireCd -= dt;
    if (s.fireCd <= 0 && (!s.moving || Math.random() < 0.3)) {
      const rate = s.f === IMP ? G.diff.rate : 1;
      s.fireCd = rand(1.3, 2.9) / rate;
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      _v1.set(s.pos.x + sn * 0.8 + c * 0.04, s.pos.y + 1.36, s.pos.z + c * 0.8 - sn * 0.04);
      aimPoint(s.target, _v2);
      fireBolt(0, s.f, _v1, _v2, s.f === IMP ? G.diff.spread : 0.034, s);
    }
  } else s.fireCd = Math.max(s.fireCd - dt, 0.3);
}

function killSoldier(s, killer) {
  if (!s.alive) return;
  s.alive = false; s.target = null; s.moving = false;
  FX.sparks(_v3.set(s.pos.x, s.pos.y + 1.3, s.pos.z), 6, 1, 0.5, 0.2);
  if (killer === G.player) { G.onKill(s); }
}

// ---------------------------------------------------------------- Laserschüsse
class Bolt {
  constructor() { this.p = new V3(); this.v = new V3(); this.prev = new V3(); this.dir = new V3(); this.f = 0; this.kind = 0; this.life = 0; this.owner = null; }
}
const boltPool = [];
function fireBolt(kind, f, from, to, spread, owner) {
  const K = KIND[kind];
  const b = boltPool.pop() || new Bolt();
  b.dir.subVectors(to, from).normalize();
  if (spread > 0) {
    b.dir.x += (Math.random() + Math.random() - 1) * spread;
    b.dir.y += (Math.random() + Math.random() - 1) * spread * 0.6;
    b.dir.z += (Math.random() + Math.random() - 1) * spread;
    b.dir.normalize();
  }
  b.p.copy(from); b.prev.copy(from); b.v.copy(b.dir).multiplyScalar(K.speed);
  b.f = f; b.kind = kind; b.life = K.life; b.owner = owner;
  G.bolts.push(b);
  FX.muzzle(from, f);
  SFX.blaster(from, f, kind >= 1 && kind <= 3);
  return b;
}

class BoltRenderer {
  constructor(color, max) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color, fog: false }), max);
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0;
    this.max = max; this.n = 0;
  }
  begin() { this.n = 0; }
  add(b) {
    if (this.n >= this.max) return;
    const K = KIND[b.kind];
    _q.setFromUnitVectors(_Z, b.dir);
    _v1.copy(b.p).addScaledVector(b.dir, -K.len * 0.5);
    _v2.set(K.w, K.w, K.len);
    _m.compose(_v1, _q, _v2);
    this.mesh.setMatrixAt(this.n++, _m);
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}

// Segment gegen senkrechten Zylinder (Personen, Türme); gibt Parameter t oder -1 zurück
function segCyl(x0, y0, z0, dx, dy, dz, cx, cy, cz, r, h) {
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-6 ? ((cx - x0) * dx + (cz - z0) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = x0 + dx * t - cx, pz = z0 + dz * t - cz, py = y0 + dy * t;
  if (px * px + pz * pz > r * r || py < cy || py > cy + h) return -1;
  return t;
}
function segSphere(x0, y0, z0, dx, dy, dz, c, r) {
  const l2 = dx * dx + dy * dy + dz * dz;
  const t = clamp(((c.x - x0) * dx + (c.y - y0) * dy + (c.z - z0) * dz) / l2, 0, 1);
  const px = x0 + dx * t - c.x, py = y0 + dy * t - c.y, pz = z0 + dz * t - c.z;
  return px * px + py * py + pz * pz < r * r ? t : -1;
}

function updateBolts(dt) {
  const list = G.bolts;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i], K = KIND[b.kind];
    b.prev.copy(b.p); b.p.addScaledVector(b.v, dt); b.life -= dt;
    const x0 = b.prev.x, y0 = b.prev.y, z0 = b.prev.z, dx = b.p.x - x0, dy = b.p.y - y0, dz = b.p.z - z0;
    let bestT = 2, hitObj = null, hitType = '';
    const minx = Math.min(x0, b.p.x) - 2, maxx = Math.max(x0, b.p.x) + 2, minz = Math.min(z0, b.p.z) - 2, maxz = Math.max(z0, b.p.z) + 2;
    // Infanterie
    const enemies = b.f === REB ? G.imps : G.rebels;
    if (Math.min(y0, b.p.y) < 60) {
      for (const s of enemies) {
        if (!s.alive) continue;
        const p = s.pos;
        if (p.x < minx || p.x > maxx || p.z < minz || p.z > maxz) continue;
        const t = segCyl(x0, y0, z0, dx, dy, dz, p.x, p.y, p.z, 0.36, 1.85);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = s; hitType = 'sol'; }
      }
    }
    if (b.f === IMP) {
      const P = G.player;
      if (P && P.alive && P.mode === 'foot' && !P.god) {
        const t = segCyl(x0, y0, z0, dx, dy, dz, P.pos.x, P.pos.y, P.pos.z, 0.38, 1.8);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = P; hitType = 'player'; }
      }
      for (const tu of G.turrets) {
        if (!tu.alive) continue;
        const t = segCyl(x0, y0, z0, dx, dy, dz, tu.pos.x, tu.pos.y, tu.pos.z, 1.9, 5);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = tu; hitType = 'turret'; }
      }
      for (const sp of G.speeders) {
        if (!sp.alive || sp.mode === 'tow' || sp.mode === 'gone') continue;
        const t = segSphere(x0, y0, z0, dx, dy, dz, sp.pos, 2.6);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = sp; hitType = 'speeder'; }
      }
      if (G.genHP > 0 && b.kind > 0) {
        _v1.set(WORLD.gen.x, WORLD.gen.y, WORLD.gen.z);
        const t = segSphere(x0, y0, z0, dx, dy, dz, _v1, 14.5);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = 'gen'; hitType = 'gen'; }
      }
    } else {
      for (const w of G.atsts) {
        if (!w.alive) continue;
        for (const sp of w.spheres) { const t = segSphere(x0, y0, z0, dx, dy, dz, sp, sp.r); if (t >= 0 && t < bestT) { bestT = t; hitObj = w; hitType = 'atst'; } }
      }
      for (const w of G.atats) {
        if (!w.alive) continue;
        for (const sp of w.spheres) { const t = segSphere(x0, y0, z0, dx, dy, dz, sp, sp.r); if (t >= 0 && t < bestT) { bestT = t; hitObj = w; hitType = 'atat'; } }
      }
    }
    // Gelände
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz), steps = Math.max(1, Math.ceil(len / 1.2));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      if (t >= bestT) break;
      const x = x0 + dx * t, y = y0 + dy * t, z = z0 + dz * t;
      if (heightAt(x, z) > y) { bestT = t; hitType = 'ground'; hitObj = null; break; }
    }
    if (bestT <= 1) {
      _v3.set(x0 + dx * bestT, y0 + dy * bestT, z0 + dz * bestT);
      onBoltHit(b, hitType, hitObj, _v3);
      list.splice(i, 1); boltPool.push(b);
    } else if (b.life <= 0) { list.splice(i, 1); boltPool.push(b); }
  }
}

function onBoltHit(b, type, obj, p) {
  const K = KIND[b.kind], byPlayer = b.owner === G.player;
  switch (type) {
    case 'sol': killSoldier(obj, b.owner); if (byPlayer) G.hitMarker(); break;
    case 'player': G.onPlayerHit(b.kind === 0 ? 'Blastertreffer' : 'Explosion'); break;
    case 'turret': if (K.struct > 0) obj.damage(K.struct); else FX.sparks(p, 4, 0.4, 1, 0.4); break;
    case 'speeder': if (K.veh > 0) obj.damage(K.veh); else FX.sparks(p, 4, 0.4, 1, 0.4); break;
    case 'gen': damageGenerator(K.struct); break;
    case 'atst': case 'atat': {
      const dmg = type === 'atst' ? K.atst : K.atat;
      if (dmg > 0) { obj.damage(dmg, b.owner); if (byPlayer) G.hitMarker(); }
      else { FX.sparks(p, 5, 1, 0.8, 0.4); if (byPlayer) G.msg('Blaster wirkungslos gegen Panzerung! Nutze Geschütztürme oder Schneegleiter.', 'armor'); }
      break;
    }
    case 'ground': if (!K.splash) FX.snowPuff(p, false); break;
  }
  if (K.splash > 0) explode(p, K.splash, b.f, b.owner, type === 'player');
  else if (type !== 'ground') FX.sparks(p, 3, b.f === REB ? 1 : 0.4, b.f === REB ? 0.4 : 1, 0.3);
}

function explode(p, radius, f, owner, playerAlreadyHit) {
  FX.explosion(p, radius * 0.6);
  SFX.boom(p, radius * 0.5);
  const r2 = radius * radius;
  const list = f === REB ? G.imps : G.rebels;
  for (const s of list) {
    if (!s.alive) continue;
    const dx = s.pos.x - p.x, dy = s.pos.y + 0.9 - p.y, dz = s.pos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) killSoldier(s, owner);
  }
  const P = G.player;
  if (f === IMP && !playerAlreadyHit && P && P.alive && P.mode === 'foot' && !P.god) {
    const dx = P.pos.x - p.x, dy = P.pos.y + 0.9 - p.y, dz = P.pos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) G.onPlayerHit('Explosion');
  }
}

function damageGenerator(d) {
  if (G.genHP <= 0) return;
  G.genHP = Math.max(0, G.genHP - d);
  G.msg('Der Schildgenerator wird beschossen!', 'gen');
  if (G.genHP <= 0) {
    _v1.set(WORLD.gen.x, WORLD.gen.y + 8, WORLD.gen.z);
    for (let i = 0; i < 6; i++) FX.explosion(_v2.set(_v1.x + rand(-10, 10), _v1.y + rand(-4, 6), _v1.z + rand(-10, 10)), 7);
    SFX.boom(_v1, 4);
  }
}

// ---------------------------------------------------------------- AT-AT
const C_WALK = 0x80868d, C_WALK2 = 0x6b7178, C_WALK3 = 0x575c63, C_DARK = 0x2f3338;
let ATAT_GEO = null;
function atatGeos() {
  if (ATAT_GEO) return ATAT_GEO;
  ATAT_GEO = {
    body: mergeGeos([
      gBox(7, 5.4, 16, 0, 16.6, 0, C_WALK), gBox(5.2, 1.1, 13.5, 0, 19.8, 0, C_WALK2),
      gBox(6.2, 1.0, 14, 0, 13.5, 0, C_WALK3), gBox(0.4, 3.8, 13, 3.7, 16.8, 0, C_WALK2), gBox(0.4, 3.8, 13, -3.7, 16.8, 0, C_WALK2),
      gBox(5.6, 4.4, 0.6, 0, 16.4, 8.2, C_WALK2), gBox(5.6, 4.4, 0.6, 0, 16.4, -8.2, C_WALK2),
      gBox(2.4, 0.4, 10, 0, 20.5, -1, C_WALK3), gBox(7.2, 0.25, 0.3, 0, 18.2, 3, C_WALK3), gBox(7.2, 0.25, 0.3, 0, 18.2, -3, C_WALK3),
      gCyl(1.3, 1.3, 7.8, 12, 0, 14.3, 5.6, C_WALK3, 0, Math.PI / 2), gCyl(1.3, 1.3, 7.8, 12, 0, 14.3, -5.6, C_WALK3, 0, Math.PI / 2),
      gBox(2.2, 2.2, 3.6, 0, 15.8, 9.8, C_WALK3), gBox(2.6, 0.5, 3.0, 0, 17.1, 9.8, C_WALK2),
    ]),
    head: mergeGeos([
      gBox(3.6, 3.0, 4.6, 0, 0, 2.3, C_WALK), gBox(2.8, 2.2, 1.6, 0, -0.4, 5.2, C_WALK2),
      gBox(2.2, 0.35, 0.1, 0, 0.5, 4.62, 0x111111), gBox(3.8, 0.5, 4, 0, 1.6, 2.2, C_WALK2),
      gCyl(0.28, 0.28, 3.2, 8, 1.0, -1.6, 5.0, C_DARK, Math.PI / 2), gCyl(0.28, 0.28, 3.2, 8, -1.0, -1.6, 5.0, C_DARK, Math.PI / 2),
      gCyl(0.18, 0.18, 2.2, 8, 2.0, 0.3, 4.2, C_DARK, Math.PI / 2), gCyl(0.18, 0.18, 2.2, 8, -2.0, 0.3, 4.2, C_DARK, Math.PI / 2),
    ]),
    upper: mergeGeos([gBox(1.4, 6.6, 1.9, 0, -3.3, 0, C_WALK), gBox(1.6, 1.6, 2.1, 0, -0.4, 0, C_WALK2),
      gCyl(1.0, 1.0, 1.8, 10, 0, -6.6, 0, C_WALK3, 0, Math.PI / 2)]),
    lower: mergeGeos([gBox(1.2, 6.2, 1.5, 0, -3.1, 0, C_WALK), gBox(1.3, 1.2, 1.6, 0, -5.2, 0, C_WALK2),
      gCyl(1.45, 1.75, 1.1, 14, 0, -6.1, 0, C_WALK3)]),
  };
  return ATAT_GEO;
}

class ATAT {
  constructor(x, z) {
    this.type = 'atat'; this.alive = true; this.maxHp = 30; this.hp = this.maxHp;
    this.pos = new V3(x, heightAt(x, z), z); this.yaw = 0; this.phase = rand(0, TAU); this.lastStep = 0;
    this.fireCd = rand(3, 6); this.thinkCd = rand(0, 1); this.target = null; this.tangled = false;
    this.fallT = 0; this.fallDir = 1; this.crashed = false; this.stopDist = rand(215, 235); this.smokeT = 0;
    const g = atatGeos();
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.root.add(new THREE.Mesh(g.body, VCMAT));
    this.head = new THREE.Group(); this.head.position.set(0, 15.6, 11.4); this.head.add(new THREE.Mesh(g.head, VCMAT));
    this.root.add(this.head);
    this.legs = [];
    const offs = [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5];
    [[3.0, 5.6], [-3.0, 5.6], [3.0, -5.6], [-3.0, -5.6]].forEach(([lx, lz], i) => {
      const hip = new THREE.Group(); hip.position.set(lx, 14.3, lz);
      hip.add(new THREE.Mesh(g.upper, VCMAT));
      const knee = new THREE.Group(); knee.position.set(0, -6.6, 0); knee.add(new THREE.Mesh(g.lower, VCMAT));
      hip.add(knee); this.root.add(hip);
      this.legs.push({ hip, knee, off: offs[i] });
    });
    this.local = [new V3(0, 16.6, -5.5), new V3(0, 16.6, 0), new V3(0, 16.6, 5.5), new V3(0, 15.6, 14)];
    this.spheres = this.local.map((p, i) => { const s = p.clone(); s.r = i === 3 ? 2.9 : 4.4; return s; });
    G.dyn.add(this.root);
    this.syncMesh();
  }
  syncMesh() {
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) { const r = this.spheres[i].r; this.spheres[i].copy(this.local[i]).applyMatrix4(this.root.matrixWorld); this.spheres[i].r = r; }
  }
  legWorld(i, out) { return out.set(0, -6, 0).applyMatrix4(this.legs[i].hip.matrixWorld); }
  muzzle(i, out) { return out.set(i ? -1.0 : 1.0, -1.6, 6.7).applyMatrix4(this.head.matrixWorld); }
  damage(d, by) {
    if (!this.alive || this.tangled) return;
    this.hp -= d;
    FX.sparks(this.spheres[1], 4, 1, 0.7, 0.3);
    if (this.hp <= 0) this.destroy(by, false);
  }
  destroy(by, tow) {
    if (!this.alive) return;
    this.alive = false; this.fallDir = tow ? 1 : (Math.random() < 0.5 ? 1 : -1);
    FX.explosion(this.spheres[2], 5); SFX.boom(this.spheres[2], 3);
    G.msg(tow ? 'AT-AT mit dem Schleppkabel zu Fall gebracht!' : 'AT-AT zerstört!', 'kill');
    if (by === G.player) G.player.kills++;
  }
  chooseTarget() {
    const dg = Math.hypot(WORLD.gen.x - this.pos.x, WORLD.gen.z - this.pos.z);
    const opts = [];
    if (dg < 265 && G.genHP > 0) opts.push({ type: 'gen', pos: WORLD.gen }, { type: 'gen', pos: WORLD.gen });
    let bt = null, bd = 230;
    for (const t of G.turrets) if (t.alive) { const d = t.pos.distanceTo(this.pos); if (d < bd) { bd = d; bt = t; } }
    if (bt) opts.push(bt);
    for (const s of G.speeders) if (targetAlive(s) && s.pos.distanceTo(this.pos) < 170) { opts.push(s); break; }
    if (targetAlive(G.player) && G.player.pos.distanceTo(this.pos) < 200) opts.push(G.player);
    const reb = G.rebels.filter(r => r.alive && Math.abs(r.pos.x - this.pos.x) < 60 && r.pos.distanceTo(this.pos) < 200);
    if (reb.length) opts.push(pick(reb));
    this.target = opts.length ? pick(opts) : null;
  }
  update(dt) {
    if (!this.alive) {
      if (!this.crashed) {
        this.fallT += dt;
        const a = Math.min(1.42, this.fallT * this.fallT * 0.32);
        this.root.rotation.x = a * this.fallDir;
        this.head.rotation.x = -a * 0.3;
        if (a >= 1.42) {
          this.crashed = true;
          this.root.updateMatrixWorld(true);
          for (let i = 0; i < 3; i++) { this.spheres[i].copy(this.local[i]).applyMatrix4(this.root.matrixWorld); FX.explosion(this.spheres[i], 6); }
          SFX.boom(this.spheres[1], 4);
        }
      } else {
        this.smokeT -= dt;
        if (this.smokeT <= 0) { this.smokeT = 0.15; FX.smokeColumn(this.spheres[1], 1.6); }
      }
      return;
    }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(2, 4); this.chooseTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    const dx = WORLD.gen.x - this.pos.x, dz = WORLD.gen.z - this.pos.z, dg = Math.hypot(dx, dz);
    if (!this.tangled && dg > this.stopDist) {
      this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 0.3);
      const sp = 2.1 * dt;
      this.pos.x += Math.sin(this.yaw) * sp; this.pos.z += Math.cos(this.yaw) * sp;
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.phase += dt * 1.1;
      const step = Math.floor(this.phase / (Math.PI / 2));
      if (step !== this.lastStep) { this.lastStep = step; SFX.thump(this.pos); }
    }
    for (const L of this.legs) {
      const s = Math.sin(this.phase + L.off), c = Math.cos(this.phase + L.off);
      L.hip.rotation.x = 0.22 * s;
      L.knee.rotation.x = -0.32 * Math.max(0, c);
    }
    this.root.position.y = this.pos.y + Math.sin(this.phase * 2) * 0.15;
    // Kopf zum Ziel drehen
    let hy = 0, hp = 0;
    if (this.target) {
      aimPoint(this.target, _v1);
      const lx = _v1.x - this.pos.x, lz = _v1.z - this.pos.z;
      hy = clamp(angDiff(this.yaw, Math.atan2(lx, lz)), -0.6, 0.6);
      hp = clamp(Math.atan2(_v1.y - (this.pos.y + 15), Math.hypot(lx, lz)), -0.4, 0.3);
    }
    this.head.rotation.y += (hy - this.head.rotation.y) * Math.min(1, dt * 2);
    this.head.rotation.x += (-hp - this.head.rotation.x) * Math.min(1, dt * 2);
    this.syncMesh();
    this.fireCd -= dt;
    if (this.target && this.fireCd <= 0 && !this.tangled) {
      this.fireCd = rand(2.8, 4) / G.diff.rate;
      aimPoint(this.target, _v2);
      if (this.target.type === 'speeder') _v2.addScaledVector(this.target.vel, this.target.pos.distanceTo(this.pos) / KIND[2].speed);
      if (Math.abs(angDiff(this.yaw, Math.atan2(_v2.x - this.pos.x, _v2.z - this.pos.z))) < 0.9) {
        for (let i = 0; i < 2; i++) { this.muzzle(i, _v1); fireBolt(2, IMP, _v1, _v2, 0.012, this); }
      }
    }
  }
}

// ---------------------------------------------------------------- AT-ST
let ATST_GEO = null;
function atstGeos() {
  if (ATST_GEO) return ATST_GEO;
  ATST_GEO = {
    head: mergeGeos([
      gBox(2.4, 1.7, 2.4, 0, 0.6, 0, C_WALK), gBox(2.2, 0.9, 1.0, 0, 0.2, 1.6, C_WALK2),
      gBox(1.6, 0.25, 0.08, 0, 0.8, 1.22, 0x111111), gCyl(0.5, 0.5, 0.3, 10, 0, 1.6, -0.2, C_WALK3),
      gBox(0.5, 0.5, 1.4, 1.45, 0.3, 0.6, C_WALK3), gBox(0.5, 0.5, 1.4, -1.45, 0.3, 0.6, C_WALK3),
      gCyl(0.08, 0.08, 1.2, 6, 1.45, 0.3, 1.8, 0x222222, Math.PI / 2), gCyl(0.08, 0.08, 1.2, 6, -1.45, 0.3, 1.8, 0x222222, Math.PI / 2),
      gCyl(0.1, 0.1, 1.2, 6, 0.3, -0.35, 2.3, 0x222222, Math.PI / 2), gCyl(0.1, 0.1, 1.2, 6, -0.3, -0.35, 2.3, 0x222222, Math.PI / 2),
      gBox(2.0, 1.2, 0.6, 0, 0.5, -1.4, C_WALK3), gBox(1.3, 0.7, 1.0, 0, -0.6, 0, C_WALK3),
    ]),
    thigh: mergeGeos([gBox(0.45, 2.7, 0.6, 0, -1.35, 0, C_WALK), gCyl(0.35, 0.35, 0.7, 8, 0, 0, 0, C_WALK3, 0, Math.PI / 2)]),
    shin: mergeGeos([gBox(0.4, 2.9, 0.5, 0, -1.45, 0, C_WALK2), gCyl(0.3, 0.3, 0.6, 8, 0, 0, 0, C_WALK3, 0, Math.PI / 2)]),
    foot: mergeGeos([gBox(1.0, 0.25, 1.7, 0, -0.12, 0.25, C_WALK3), gBox(0.6, 0.3, 0.5, 0, 0.05, -0.55, C_WALK3)]),
  };
  return ATST_GEO;
}

class ATST {
  constructor(x, z) {
    this.type = 'atst'; this.alive = true; this.hp = 8;
    this.pos = new V3(x, heightAt(x, z), z); this.yaw = 0; this.phase = rand(0, TAU);
    this.goal = new V3(x, 0, trenchZ(x) - rand(35, 60)); this.goalT = 0;
    this.fireCd = rand(2, 4); this.thinkCd = rand(0, 1); this.target = null; this.fallT = 0; this.smokeT = 0; this.fallDir = 1;
    const g = atstGeos();
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.head = new THREE.Group(); this.head.position.set(0, 6.2, 0); this.head.add(new THREE.Mesh(g.head, VCMAT));
    this.root.add(this.head);
    this.legs = [];
    [0.75, -0.75].forEach((lx, i) => {
      const th = new THREE.Group(); th.position.set(lx, 5.25, 0); th.add(new THREE.Mesh(g.thigh, VCMAT));
      const kn = new THREE.Group(); kn.position.set(0, -2.7, 0); kn.add(new THREE.Mesh(g.shin, VCMAT));
      const an = new THREE.Group(); an.position.set(0, -2.9, 0); an.add(new THREE.Mesh(g.foot, VCMAT));
      kn.add(an); th.add(kn); this.root.add(th);
      this.legs.push({ th, kn, an, off: i * Math.PI });
    });
    this.local = [new V3(0, 6.8, 0.3), new V3(0, 5.5, 0)];
    this.spheres = this.local.map((p, i) => { const s = p.clone(); s.r = i ? 1.0 : 1.9; return s; });
    G.dyn.add(this.root);
    this.sync();
  }
  sync() {
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) { const r = this.spheres[i].r; this.spheres[i].copy(this.local[i]).applyMatrix4(this.root.matrixWorld); this.spheres[i].r = r; }
  }
  damage(d, by) {
    if (!this.alive) return;
    this.hp -= d; FX.sparks(this.spheres[0], 5, 1, 0.7, 0.3);
    if (this.hp <= 0) {
      this.alive = false; this.fallDir = Math.random() < 0.5 ? 1 : -1;
      FX.explosion(this.spheres[0], 4); SFX.boom(this.spheres[0], 2.5);
      G.msg('AT-ST zerstört!', 'kill');
      if (by === G.player) G.player.kills++;
    }
  }
  chooseTarget() {
    let best = null, bd = 150 * 150;
    _v1.set(this.pos.x, this.pos.y + 6.8, this.pos.z);
    const test = (t, bias) => {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = (dx * dx + dz * dz) * bias;
      if (d < bd) { aimPoint(t, _v2); if (lineOfSight(_v1, _v2)) { bd = d; best = t; } }
    };
    if (targetAlive(G.player)) test(G.player, 0.8);
    for (const t of G.turrets) if (t.alive) test(t, 0.7);
    for (const r of G.rebels) if (r.alive && Math.abs(r.pos.x - this.pos.x) < 150) test(r, 1);
    this.target = best;
  }
  update(dt) {
    if (!this.alive) {
      if (this.fallT < 1) {
        this.fallT = Math.min(1, this.fallT + dt * 0.8);
        this.root.rotation.z = this.fallDir * this.fallT * this.fallT * 1.45;
        this.root.position.y = this.pos.y - this.fallT * 1.5;
        if (this.fallT >= 1) { FX.explosion(_v1.set(this.pos.x, this.pos.y + 1, this.pos.z), 3); SFX.boom(this.pos, 1.5); }
      }
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.25; FX.smokeColumn(_v1.set(this.pos.x, this.pos.y + 1, this.pos.z), 0.8); }
      return;
    }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(1, 2); this.chooseTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    this.goalT -= dt;
    let dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 2 && this.goalT <= 0) {
      this.goalT = rand(5, 10);
      const front = rebelsHoldTrench() ? trenchZ(this.pos.x) - rand(30, 55) : WORLD.gen.z - 40;
      this.goal.set(clamp(this.pos.x + rand(-25, 25), -TR.len, TR.len), 0, front);
      dx = this.goal.x - this.pos.x; dz = this.goal.z - this.pos.z; d = Math.hypot(dx, dz);
    }
    let want = this.target ? Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) : this.yaw;
    if (d > 2) {
      const mv = Math.atan2(dx, dz);
      if (!this.target) want = mv;
      const sp = 2.6 * dt;
      this.pos.x += dx / d * sp; this.pos.z += dz / d * sp;
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.phase += dt * 3.2;
    }
    this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 1.5);
    for (const L of this.legs) {
      const s = d > 2 ? Math.sin(this.phase + L.off) : 0, c = d > 2 ? Math.cos(this.phase + L.off) : 0;
      L.th.rotation.x = -0.45 + 0.35 * s;
      L.kn.rotation.x = 0.95 + 0.35 * Math.max(0, c);
      L.an.rotation.x = -(L.th.rotation.x + L.kn.rotation.x);
    }
    this.head.position.y = 6.2 + Math.abs(Math.sin(this.phase)) * 0.15;
    this.sync();
    this.fireCd -= dt;
    if (this.target && this.fireCd <= 0) {
      this.fireCd = rand(1.1, 1.8) / G.diff.rate;
      aimPoint(this.target, _v2);
      if (Math.abs(angDiff(this.yaw, Math.atan2(_v2.x - this.pos.x, _v2.z - this.pos.z))) < 0.25) {
        for (let i = 0; i < 2; i++) {
          _v1.set(i ? -0.3 : 0.3, -0.35, 2.9).applyMatrix4(this.head.matrixWorld);
          fireBolt(1, IMP, _v1, _v2, G.diff.spread * 0.8, this);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- Geschützturm
let TUR_GEO = null;
function turretGeos() {
  if (TUR_GEO) return TUR_GEO;
  TUR_GEO = {
    base: mergeGeos([gCyl(2.0, 2.3, 0.6, 16, 0, 0.3, 0, 0xbfc4ca), gCyl(1.45, 1.8, 3.3, 16, 0, 2.25, 0, 0xc9ced4),
      gBox(0.9, 1.6, 0.1, 0, 1.4, -1.66, 0x8a9097), gBox(0.4, 0.2, 0.1, 0.9, 3.2, 1.45, 0x555a60)]),
    head: mergeGeos([gCyl(1.9, 1.9, 0.8, 16, 0, 0.4, 0, 0xd2d7dc), gBox(1.8, 1.0, 2.0, 0, 1.2, 0.3, 0xb5bbc1),
      gBox(2.2, 0.3, 2.4, 0, 0.85, 0, 0xa3a9b0), gCyl(0.25, 0.25, 0.8, 8, 0, 1.9, -0.6, 0x6e747b)]),
    barrel: mergeGeos([gCyl(0.13, 0.13, 3.0, 8, 0.35, 0, 1.5, 0x3a3f45, Math.PI / 2), gCyl(0.13, 0.13, 3.0, 8, -0.35, 0, 1.5, 0x3a3f45, Math.PI / 2),
      gBox(1.1, 0.5, 0.8, 0, 0, 0.1, 0x8a9097)]),
  };
  return TUR_GEO;
}
class Turret {
  constructor(x, z) {
    this.type = 'turret'; this.alive = true; this.maxHp = 10; this.hp = this.maxHp;
    this.pos = new V3(x, heightAt(x, z), z);
    this.aimYaw = Math.PI; this.aimPitch = 0; this.fireCd = rand(1, 3); this.thinkCd = rand(0, 1); this.target = null;
    this.manned = false; this.smokeT = 0; this.gun = 0;
    const g = turretGeos();
    this.root = new THREE.Group(); this.root.position.copy(this.pos);
    this.root.add(new THREE.Mesh(g.base, VCMAT));
    this.head = new THREE.Group(); this.head.position.y = 3.9; this.head.add(new THREE.Mesh(g.head, VCMAT));
    this.barrel = new THREE.Group(); this.barrel.position.set(0, 1.2, 1.2); this.barrel.add(new THREE.Mesh(g.barrel, VCMAT));
    this.head.add(this.barrel); this.root.add(this.head);
    G.dyn.add(this.root);
    this.apply();
  }
  apply() { this.head.rotation.y = this.aimYaw; this.barrel.rotation.x = -this.aimPitch; this.root.updateMatrixWorld(true); }
  muzzle(out) { this.gun ^= 1; return out.set(this.gun ? 0.35 : -0.35, 0, 3.1).applyMatrix4(this.barrel.matrixWorld); }
  damage(d) {
    if (!this.alive) return;
    this.hp -= d; FX.sparks(_v1.set(this.pos.x, this.pos.y + 4, this.pos.z), 5, 1, 0.6, 0.2);
    if (this.hp <= 0) {
      this.alive = false;
      FX.explosion(_v1.set(this.pos.x, this.pos.y + 4, this.pos.z), 4); SFX.boom(this.pos, 2);
      this.head.visible = false; this.root.scale.y = 0.55;
      G.msg('Ein Geschützturm wurde zerstört!', 'turret');
      if (this.manned && G.player.mode === 'turret') G.player.exitTurret(true);
    }
  }
  pickTarget() {
    _v1.set(this.pos.x, this.pos.y + 5, this.pos.z);
    let best = null, bd = 1e9;
    const consider = (t, maxd, bias) => {
      const d = t.pos.distanceTo(this.pos);
      if (d > maxd || d * bias > bd) return;
      aimPoint(t, _v2); if (!lineOfSight(_v1, _v2)) return;
      bd = d * bias; best = t;
    };
    for (const w of G.atsts) if (w.alive) consider(w, 200, 0.5);
    for (const w of G.atats) if (w.alive && !w.tangled) consider(w, 200, 0.7);
    for (const s of G.imps) if (s.alive && Math.abs(s.pos.x - this.pos.x) < 150) consider(s, 140, 1.2);
    this.target = best;
  }
  update(dt) {
    if (!this.alive) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.3; FX.smokeColumn(_v1.set(this.pos.x, this.pos.y + 2.2, this.pos.z), 0.6); }
      return;
    }
    if (this.manned) { this.apply(); return; }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(1, 2); this.pickTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    if (!this.target) return;
    aimPoint(this.target, _v2);
    const dx = _v2.x - this.pos.x, dz = _v2.z - this.pos.z;
    const wantY = Math.atan2(dx, dz), wantP = Math.atan2(_v2.y - (this.pos.y + 5.1), Math.hypot(dx, dz));
    const dy = angDiff(this.aimYaw, wantY);
    this.aimYaw += clamp(dy, -1.4 * dt, 1.4 * dt);
    this.aimPitch += clamp(wantP - this.aimPitch, -dt, dt);
    this.apply();
    this.fireCd -= dt;
    if (this.fireCd <= 0 && Math.abs(dy) < 0.06) {
      this.fireCd = rand(2.2, 3.4);
      this.muzzle(_v1);
      fireBolt(3, REB, _v1, _v2, 0.012, this);
    }
  }
}

// ---------------------------------------------------------------- Schneegleiter (T-47)
let SPEEDER_GEO = null;
function speederGeo() {
  if (SPEEDER_GEO) return SPEEDER_GEO;
  const sh = new THREE.Shape();
  sh.moveTo(0, 3.0); sh.lineTo(2.1, -1.0); sh.lineTo(1.7, -2.4); sh.lineTo(-1.7, -2.4); sh.lineTo(-2.1, -1.0); sh.lineTo(0, 3.0);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false });
  hull.rotateX(-Math.PI / 2); paint(hull, 0xdcdcd6);
  const top = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false });
  top.rotateX(-Math.PI / 2); top.scale(0.75, 1, 0.75); top.translate(0, 0.8, -0.3); paint(top, 0xc8c8c2);
  SPEEDER_GEO = mergeGeos([hull, top,
    gBox(1.0, 0.55, 1.5, 0, 1.25, -0.2, 0x2c3540), gBox(0.9, 0.2, 1.2, 0, 1.55, -0.3, 0x434e5b),
    gCyl(0.45, 0.5, 1.9, 10, 0.95, 0.5, -2.4, 0x8f8f8b, Math.PI / 2), gCyl(0.45, 0.5, 1.9, 10, -0.95, 0.5, -2.4, 0x8f8f8b, Math.PI / 2),
    gCyl(0.3, 0.3, 0.1, 10, 0.95, 0.5, -3.36, 0xff9a40, Math.PI / 2), gCyl(0.3, 0.3, 0.1, 10, -0.95, 0.5, -3.36, 0xff9a40, Math.PI / 2),
    gBox(0.3, 0.06, 2.2, 1.15, 0.83, -0.4, 0xd9541e), gBox(0.3, 0.06, 2.2, -1.15, 0.83, -0.4, 0xd9541e),
    gCyl(0.1, 0.1, 1.8, 6, 1.95, 0.4, 0.4, 0x3a3a3a, Math.PI / 2), gCyl(0.1, 0.1, 1.8, 6, -1.95, 0.4, 0.4, 0x3a3a3a, Math.PI / 2),
    gCyl(0.08, 0.08, 1.0, 6, 0, 1.0, -2.6, 0x3a3a3a, Math.PI / 2),
  ]);
  return SPEEDER_GEO;
}

class Speeder {
  constructor(mode, x, y, z, yaw) {
    this.type = 'speeder'; this.alive = true; this.hp = 4; this.mode = mode;
    this.home = new V3(x, y, z); this.homeYaw = yaw;
    this.pos = new V3(x, y, z); this.vel = new V3(); this.yaw = yaw; this.pitch = 0; this.roll = 0; this.speed = mode === 'parked' ? 0 : 45;
    this.fireCd = 0; this.gun = 0; this.respawnT = 0; this.smokeT = 0;
    this.ai = { target: null, state: 'approach', t: 0, retarget: 0 };
    this.tow = null;
    this.mesh = new THREE.Mesh(speederGeo(), VCMAT); this.mesh.rotation.order = 'YXZ';
    G.dyn.add(this.mesh);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    this.cable = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x222222 })); this.cable.visible = false; this.cable.frustumCulled = false;
    G.dyn.add(this.cable);
    this.sync();
  }
  forward(out) { const cp = Math.cos(this.pitch); return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp); }
  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(-this.pitch, this.yaw, this.roll);
    this.mesh.visible = this.mode !== 'gone';
    this.mesh.updateMatrixWorld(true);
  }
  // Richtung ansteuern (wantYaw/wantPitch im Gleiter-System), mit begrenzter Drehrate
  fly(dt, wantYaw, wantPitch, speedTarget) {
    const dy = angDiff(this.yaw, wantYaw), turn = 1.5 * dt;
    const yr = clamp(dy, -turn, turn);
    this.yaw += yr;
    this.pitch += clamp(wantPitch - this.pitch, -turn, turn);
    this.pitch = clamp(this.pitch, -0.7, 0.7);
    this.roll += (clamp(-yr / dt * 0.55, -1.1, 1.1) - this.roll) * Math.min(1, dt * 4);
    this.speed += clamp(speedTarget - this.speed, -20 * dt, 20 * dt);
    this.forward(this.vel).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    const gh = heightAt(this.pos.x, this.pos.z) + 3;
    if (this.pos.y < gh) { this.pos.y = gh; if (this.pitch < 0) this.pitch *= 0.5; }
    if (this.pos.y > 140) this.pos.y = 140;
    this.checkCollide();
    this.sync();
  }
  checkCollide() {
    for (const w of G.atats) {
      if (!w.alive && !w.crashed) continue;
      for (const s of w.spheres) if (this.pos.distanceTo(s) < s.r + 1.5) { this.damage(99); return; }
      if (w.alive && Math.hypot(this.pos.x - w.pos.x, this.pos.z - w.pos.z) < 7 && this.pos.y < w.pos.y + 13) { this.damage(99); return; }
    }
    for (const w of G.atsts) if (w.alive && this.pos.distanceTo(w.spheres[0]) < 3.5) { this.damage(99); w.damage(99, this.mode === 'player' ? G.player : null); return; }
  }
  fire(dir, owner) {
    if (this.fireCd > 0) return;
    this.fireCd = 0.16; this.gun ^= 1;
    _v1.set(this.gun ? 1.95 : -1.95, 0.4, 1.4).applyMatrix4(this.mesh.matrixWorld);
    _v2.copy(_v1).addScaledVector(dir, 200);
    fireBolt(4, REB, _v1, _v2, owner === G.player ? 0.002 : 0.02, owner);
  }
  damage(d) {
    if (!this.alive || this.mode === 'tow' || this.mode === 'parked' || this.mode === 'gone' || this.mode === 'crash') return;
    this.hp -= d;
    FX.sparks(this.pos, 6, 1, 0.7, 0.3);
    if (this.hp <= 0) {
      const wasPlayer = this.mode === 'player';
      this.mode = 'crash'; this.alive = false;
      FX.explosion(this.pos, 2.5); SFX.boom(this.pos, 1.5);
      G.msg(wasPlayer ? 'Dein Schneegleiter wurde abgeschossen!' : 'Ein Schneegleiter wurde abgeschossen!', 'speeder');
      if (wasPlayer) G.player.speederDestroyed();
    }
  }
  startTow(atat) {
    const prev = this.mode;
    this.tow = { atat, prev, t: 0, ang: Math.atan2(this.pos.x - atat.pos.x, this.pos.z - atat.pos.z) };
    this.mode = 'tow'; atat.tangled = true;
    this.cable.visible = true;
    G.msg('Schleppkabel abgefeuert! Umkreise die Beine...', 'tow');
  }
  updateTow(dt) {
    const T = this.tow, a = T.atat;
    T.t += dt; T.ang += 2.2 * dt;
    const R = 13, h = Math.min(7, 7 + (T.t < 0.6 ? 6 * (1 - T.t / 0.6) : 0));
    this.pos.set(a.pos.x + Math.sin(T.ang) * R, a.pos.y + h, a.pos.z + Math.cos(T.ang) * R);
    this.yaw = Math.atan2(Math.cos(T.ang), -Math.sin(T.ang)); this.pitch = 0; this.roll = 0.8;
    this.speed = 2.2 * R; this.forward(this.vel).multiplyScalar(this.speed);
    // Kabel: um alle vier Beine gewickelt + zum Gleiter
    const arr = this.cable.geometry.attributes.position.array;
    const order = [0, 2, 3, 1, 0];
    const wraps = Math.min(order.length, Math.floor(T.t / 1.1) + 1);
    let k = 0;
    for (let i = 0; i < wraps; i++) { a.legWorld(order[i], _v1); _v1.y = a.pos.y + 6 + i * 0.4; arr[k++] = _v1.x; arr[k++] = _v1.y; arr[k++] = _v1.z; }
    for (let i = wraps; i < 8; i++) { arr[k++] = this.pos.x; arr[k++] = this.pos.y; arr[k++] = this.pos.z; }
    this.cable.geometry.attributes.position.needsUpdate = true;
    this.sync();
    if (T.t > 5.2) {
      this.cable.visible = false;
      a.tangled = false;
      a.destroy(T.prev === 'player' ? G.player : null, true);
      this.mode = T.prev; this.tow = null; this.pitch = 0.35; this.speed = 50;
    }
  }
  updateAI(dt) {
    const A = this.ai;
    A.retarget -= dt;
    if (!A.target || !A.target.alive || A.target.tangled || A.retarget <= 0) {
      A.retarget = rand(12, 20);
      const opts = [];
      G.atsts.forEach(w => { if (w.alive) opts.push(w, w); });
      if (G.time > 150 && Math.random() < 0.12) G.atats.forEach(w => { if (w.alive && !w.tangled) opts.push(w); });
      const troops = G.imps.filter(s => s.alive);
      if (troops.length) opts.push(pick(troops), pick(troops));
      A.target = opts.length ? pick(opts) : null;
      A.state = 'approach';
    }
    let wantYaw = this.yaw, wantPitch = 0.1;
    const t = A.target;
    if (t) {
      const isAtat = t.type === 'atat';
      const tx = t.pos.x, tz = t.pos.z, ty = t.pos.y + (isAtat ? 6 : t.type === 'atst' ? 6.5 : 1);
      const dx = tx - this.pos.x, dz = tz - this.pos.z, dh = Math.hypot(dx, dz);
      if (A.state === 'approach') {
        const alt = dh > 220 ? Math.max(ty + 25, heightAt(this.pos.x, this.pos.z) + 25) : ty + (isAtat ? 0 : 2);
        wantYaw = Math.atan2(dx, dz);
        wantPitch = clamp(Math.atan2(alt - this.pos.y, Math.max(dh, 1)), -0.5, 0.5);
        if (isAtat && dh < 40 && Math.abs(this.pos.y - ty) < 10) { this.startTow(t); return; }
        _v1.set(dx, ty - this.pos.y, dz).normalize();
        if (!isAtat && dh < 230 && this.forward(_v2).dot(_v1) > 0.985) this.fire(_v1, this);
        if (dh < (isAtat ? 15 : 35)) { A.state = 'extend'; A.t = rand(2.5, 4); }
      } else {
        wantPitch = 0.25; A.t -= dt;
        if (A.t <= 0) A.state = 'approach';
      }
    } else {
      wantYaw = Math.atan2(-this.pos.x, -100 - this.pos.z); wantPitch = clamp((40 - this.pos.y) * 0.02, -0.3, 0.3);
    }
    if (this.pos.y - heightAt(this.pos.x, this.pos.z) < 10) wantPitch = Math.max(wantPitch, 0.25);
    if (Math.abs(this.pos.x) > 420 || this.pos.z < -820 || this.pos.z > 260) wantYaw = Math.atan2(-this.pos.x, -150 - this.pos.z);
    this.fly(dt, wantYaw, wantPitch, 48);
  }
  update(dt) {
    this.fireCd -= dt;
    switch (this.mode) {
      case 'ai': this.updateAI(dt); break;
      case 'tow': this.updateTow(dt); break;
      case 'crash': {
        this.vel.y -= 15 * dt; this.pos.addScaledVector(this.vel, dt);
        this.pitch = Math.max(-0.9, this.pitch - dt); this.roll += dt * 3;
        this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.05; FX.smokeColumn(this.pos, 0.5); }
        if (this.pos.y <= heightAt(this.pos.x, this.pos.z) + 0.5) {
          FX.explosion(this.pos, 3); SFX.boom(this.pos, 2);
          this.mode = 'gone'; this.respawnT = 25;
        }
        this.sync();
        break;
      }
      case 'gone':
        if (this.home && this.isPad) {
          this.respawnT -= dt;
          if (this.respawnT <= 0) { this.reset(); G.msg('Ein neuer Schneegleiter steht auf der Landeplattform bereit.', 'pad'); }
        }
        break;
    }
  }
  reset() {
    this.alive = true; this.hp = 4; this.mode = 'parked'; this.pos.copy(this.home); this.yaw = this.homeYaw;
    this.pitch = 0; this.roll = 0; this.speed = 0; this.vel.set(0, 0, 0); this.sync();
  }
}
