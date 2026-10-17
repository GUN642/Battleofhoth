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
  rebels: [], imps: [], atats: [], atsts: [], turrets: [], speeders: [], bolts: [], grenades: [],
  player: null, genHP: 150, genMax: 150,
  diff: { spread: 0.04, rate: 1 },
  msg: () => {}, onPlayerHit: () => {}, onKill: () => {}, hitMarker: () => {}, onPilotDown: () => {},
  // Mehrspieler: alle menschlichen Spieler (lokal + entfernte Avatare beim Host)
  players: [],
  netHook: null,          // wird bei jedem neuen Laserschuss aufgerufen (Host: an Clients senden)
  netNadeHook: null,      // dasselbe für Thermaldetonatoren
  visualOnly: false,      // Client: Spiellogik läuft beim Host, hier nur Darstellung
  creditKill: (pl) => { pl.kills++; },
  onSpecialDown: () => {},  // Held oder Ewok gefallen (Meldung)
  reinforce: null,          // Geonosis: gefallene Klone warten auf ein Transportschiff (true = übernommen)
  traps: [], charges: [], netChargeHook: null, dropQueue: [], transport: null,
  onRemoteDown: () => {}, onRemoteEject: () => {},
};
// Seite des lokalen Spielers (Rebellen oder Imperium)
function playerFaction() { return G.player && G.player.faction === IMP ? IMP : REB; }
function isHuman(o) { return !!o && o.type === 'player'; }

// ---------------------------------------------------------------- Waffentypen
//  speed m/s, len/w = Optik, splash = Explosionsradius (tötet Infanterie),
//  atst/atat = Schaden an Läufern, struct = Schaden an Türmen/Generator, veh = Schaden an Schneegleitern
const KIND = [
  { speed: 125, len: 1.7, w: 0.09, splash: 0, atst: 0, atat: 0, struct: 0, veh: 0, life: 2.2 },     // 0 Blaster
  { speed: 115, len: 2.6, w: 0.15, splash: 2.2, atst: 0, atat: 0, struct: 0.5, veh: 1, life: 2.5 }, // 1 AT-ST Kanone
  { speed: 105, len: 5.0, w: 0.32, splash: 5, atst: 0, atat: 0, struct: 2, veh: 2, life: 3.5 },     // 2 AT-AT Kanone
  { speed: 160, len: 3.2, w: 0.22, splash: 3, atst: 1, atat: 1, struct: 0, veh: 0, life: 2.5 },     // 3 Geschützturm
  { speed: 230, len: 2.8, w: 0.12, splash: 1.8, atst: 1, atat: 0.25, struct: 0, veh: 0, life: 2 },  // 4 Schneegleiter
  { speed: 320, len: 3.4, w: 0.08, splash: 0, atst: 0, atat: 0, struct: 0, veh: 0, life: 2.2 },     // 5 Präzisionsgewehr
  { speed: 135, len: 1.3, w: 0.08, splash: 0, atst: 0, atat: 0, struct: 0, veh: 0, life: 1.8 },     // 6 Repetierblaster
  { speed: 34, len: 1.5, w: 0.045, splash: 0, atst: 0, atat: 0, struct: 0, veh: 0, life: 1.3 },     // 7 Ewok-Speer
];

// ---------------------------------------------------------------- Thermaldetonatoren
let NADE_GEO = null;
class Grenade {
  constructor(f, p, v, owner) {
    this.f = f; this.p = p.clone(); this.v = v.clone(); this.owner = owner; this.fuse = 2.4; this.bounces = 0;
    if (!NADE_GEO) NADE_GEO = mergeGeos([gSph(0.11, 0, 0, 0, 0x55595f, 1, 1, 1, 12), gCyl(0.115, 0.115, 0.03, 12, 0, 0, 0, 0x2a2c30)]);
    this.mesh = new THREE.Mesh(NADE_GEO, MAT.vehicle); this.mesh.castShadow = true;
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(8, 0.4, 0.2) }));
    this.led.position.y = 0.1; this.mesh.add(this.led);
    this.mesh.position.copy(this.p);
    G.dyn.add(this.mesh);
  }
}
function throwGrenade(f, p, v, owner, fromNet) {
  const g = new Grenade(f, p, v, owner);
  G.grenades.push(g);
  if (G.netNadeHook && !fromNet) G.netNadeHook(g);
  SFX.toss(p);
  return g;
}
function updateGrenades(dt) {
  const list = G.grenades;
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i];
    g.v.y -= 9.8 * dt;
    g.p.addScaledVector(g.v, dt);
    const gh = heightAt(g.p.x, g.p.z) + 0.1;
    if (g.p.y < gh) {               // abprallen und ausrollen
      g.p.y = gh;
      if (g.v.y < -1.5 && g.bounces < 4) { g.bounces++; SFX.impact(g.p); }
      g.v.y = Math.abs(g.v.y) * 0.32; g.v.x *= 0.55; g.v.z *= 0.55;
    }
    g.fuse -= dt;
    g.mesh.position.copy(g.p);
    g.mesh.rotation.x += g.v.length() * dt * 2;
    g.led.visible = Math.sin(g.fuse * (g.fuse < 0.8 ? 40 : 14)) > 0;
    if (g.fuse <= 0) {
      G.dyn.remove(g.mesh); list.splice(i, 1);
      _v3.copy(g.p); _v3.y += 0.3;
      if (G.visualOnly) { FX.explosion(_v3, 2.7); SFX.boom(_v3, 2.2); }
      else explode(_v3, 4.5, g.f, g.owner, null);
    }
  }
}

// ---------------------------------------------------------------- Soldaten-Modelle
function soldierGeos(f) {
  const H = Math.PI / 2;
  if (MAP.id === 'endor') return f === REB ? endorRebelGeos() : stormtrooperGeos();
  if (MAP.id === 'geonosis') return f === REB ? cloneGeos() : droidGeos();
  if (f === REB) {
    const coat = 0xcfc3a6, coat2 = 0xb9ad90, pants = 0x8a8170, skin = 0xd9a37c, helm = 0xe8e4da, dark = 0x2a2a2a;
    return {
      body: mergeGeos([
        gCap(0.2, 0.34, 0, 1.24, 0, coat, 0, 0, 1.3, 0.85),                 // Oberkörper (Parka)
        gCyl(0.25, 0.3, 0.4, 10, 0, 0.86, 0, coat2),                       // Mantelschoß
        gCyl(0.262, 0.262, 0.07, 10, 0, 1.0, 0, 0x5a4632),                 // Gürtel
        gBox(0.08, 0.1, 0.06, 0.18, 0.98, 0.18, 0x4a3828),                 // Tasche
        gCyl(0.13, 0.16, 0.12, 10, 0, 1.53, 0, 0xb3a78c),                  // Kragen/Schal
        gSph(0.12, 0, 1.66, 0.01, skin, 1, 1.1, 1),                         // Kopf
        gSph(0.15, 0, 1.69, -0.01, helm, 1, 0.95, 1.05, 14, true),          // Helm
        gCyl(0.165, 0.165, 0.03, 14, 0, 1.69, 0, 0xcdc8bc),                 // Helmrand
        gBox(0.22, 0.055, 0.07, 0, 1.73, 0.12, dark),                       // Schneebrille
        gBox(0.36, 0.42, 0.18, 0, 1.28, -0.22, 0x9b927c), gCyl(0.07, 0.07, 0.36, 8, 0, 1.06, -0.22, 0x7d7564, 0, H),
        gCyl(0.012, 0.012, 0.5, 4, 0.13, 1.62, -0.28, dark),                // Antenne
        gCap(0.065, 0.28, -0.2, 1.32, 0.16, coat, H), gCap(0.065, 0.26, 0.2, 1.32, 0.15, coat, H),   // Arme
        gSph(0.055, -0.1, 1.32, 0.36, 0x6b5a48), gSph(0.055, 0.12, 1.31, 0.33, 0x6b5a48),           // Handschuhe
        gBox(0.06, 0.1, 0.62, 0.03, 1.36, 0.42, dark), gCyl(0.025, 0.025, 0.35, 6, 0.03, 1.38, 0.88, 0x1a1a1a, H),
        gBox(0.05, 0.14, 0.08, 0.03, 1.25, 0.32, dark),
      ]),
      leg: mergeGeos([gCap(0.085, 0.58, 0, -0.38, 0, pants), gBox(0.2, 0.17, 0.3, 0, -0.81, 0.04, 0x3d3128), gBox(0.21, 0.05, 0.31, 0, -0.88, 0.04, 0x2a221c)]),
    };
  }
  const w = 0xf2f2f2, w2 = 0xdedfe2, dark = 0x1c1c1e;
  return {
    body: mergeGeos([
      gCap(0.2, 0.34, 0, 1.24, 0, w, 0, 0, 1.3, 0.85),
      gBox(0.36, 0.28, 0.12, 0, 1.3, 0.13, w2),                            // Brustpanzer
      gBox(0.1, 0.12, 0.04, -0.07, 1.33, 0.2, dark), gBox(0.06, 0.04, 0.04, 0.08, 1.36, 0.2, 0x5a6a90),
      gCyl(0.27, 0.38, 0.6, 12, 0, 0.72, 0, 0xe9e9eb),                     // Kama (Schneetruppler-Rock)
      gCyl(0.272, 0.272, 0.08, 12, 0, 1.02, 0, 0x2d2d30),                  // Gürtel
      gSph(0.165, 0, 1.69, 0, w, 1, 0.98, 1.05, 16),                       // Helm
      gCyl(0.18, 0.21, 0.12, 14, 0, 1.56, -0.01, w2),                      // Helmkragen
      gBox(0.25, 0.075, 0.08, 0, 1.71, 0.135, dark),                       // Visier
      gCyl(0.045, 0.06, 0.1, 8, 0, 1.6, 0.16, 0x4a4a4e, H),                // Atemfilter
      gBox(0.38, 0.4, 0.2, 0, 1.28, -0.23, w2), gCyl(0.08, 0.08, 0.4, 8, 0, 1.05, -0.24, 0xc9cace, 0, H),
      gCap(0.065, 0.28, -0.2, 1.32, 0.16, w, H), gCap(0.065, 0.26, 0.2, 1.32, 0.15, w, H),
      gSph(0.055, -0.1, 1.32, 0.36, dark), gSph(0.055, 0.12, 1.31, 0.33, dark),
      gBox(0.06, 0.1, 0.55, 0.03, 1.36, 0.4, dark), gCyl(0.035, 0.035, 0.12, 8, 0.03, 1.36, 0.72, 0x111111, H),
    ]),
    leg: mergeGeos([gCap(0.09, 0.56, 0, -0.38, 0, w), gBox(0.2, 0.18, 0.29, 0, -0.81, 0.04, 0x8f9096), gBox(0.21, 0.05, 0.3, 0, -0.88, 0.04, 0x55565c)]),
  };
}

// Endor: Rebellen-Kommando mit Tarnponcho und Helm mit Tarnbezug
function endorRebelGeos() {
  const H = Math.PI / 2, pon = 0x5d6638, pon2 = 0x48502b, pants = 0x6b5c42, skin = 0xd9a37c, helm = 0x535b34, dark = 0x2a2a2a;
  return {
    body: mergeGeos([
      gCap(0.2, 0.32, 0, 1.24, 0, 0x6f6450, 0, 0, 1.25, 0.85),           // Oberkörper
      gCyl(0.2, 0.36, 0.62, 8, 0, 1.17, 0, pon),                          // Poncho
      gCyl(0.3, 0.37, 0.1, 8, 0, 0.83, 0, pon2),                          // Ponchosaum
      gCyl(0.26, 0.26, 0.06, 10, 0, 1.0, 0, 0x3a2c1e),                    // Gürtel
      gSph(0.12, 0, 1.66, 0.01, skin, 1, 1.1, 1),                          // Kopf
      gSph(0.15, 0, 1.7, -0.01, helm, 1, 0.9, 1.08, 14, true),             // Helm mit Tarnbezug
      gBox(0.06, 0.03, 0.2, 0.08, 1.78, -0.02, 0x3b4224, 0, 0.6), gBox(0.06, 0.03, 0.2, -0.07, 1.79, 0.02, 0x6a7240, 0, -0.4),
      gBox(0.34, 0.36, 0.18, 0, 1.3, -0.24, 0x4a4630),                     // Rucksack
      gCap(0.065, 0.28, -0.2, 1.32, 0.16, pon, H), gCap(0.065, 0.26, 0.2, 1.32, 0.15, pon, H),
      gSph(0.055, -0.1, 1.32, 0.36, 0x4a3a2a), gSph(0.055, 0.12, 1.31, 0.33, 0x4a3a2a),
      gBox(0.06, 0.1, 0.62, 0.03, 1.36, 0.42, dark), gCyl(0.025, 0.025, 0.35, 6, 0.03, 1.38, 0.88, 0x1a1a1a, H),
    ]),
    leg: mergeGeos([gCap(0.085, 0.58, 0, -0.38, 0, pants), gBox(0.2, 0.17, 0.3, 0, -0.81, 0.04, 0x2e241a), gBox(0.21, 0.05, 0.31, 0, -0.88, 0.04, 0x1f1812)]),
  };
}
// Sturmtruppler (ohne Schneetruppen-Rock und -Kapuze)
function stormtrooperGeos() {
  const H = Math.PI / 2, w = 0xf2f2f2, w2 = 0xdedfe2, dark = 0x1c1c1e;
  return {
    body: mergeGeos([
      gCap(0.2, 0.34, 0, 1.24, 0, w, 0, 0, 1.3, 0.85),
      gBox(0.36, 0.28, 0.12, 0, 1.3, 0.13, w2), gBox(0.1, 0.12, 0.04, -0.07, 1.33, 0.2, dark),
      gBox(0.3, 0.05, 0.25, 0, 1.1, 0.02, dark),                           // Bauchpartie
      gCyl(0.24, 0.26, 0.2, 12, 0, 0.92, 0, w),                            // Becken
      gCyl(0.262, 0.262, 0.07, 12, 0, 1.0, 0, w2), gBox(0.08, 0.06, 0.04, 0.12, 1.0, 0.25, 0x9a9aa0),
      gSph(0.16, 0, 1.69, 0, w, 1, 1.02, 1.08, 16),                        // Helm
      gBox(0.09, 0.05, 0.05, -0.055, 1.71, 0.15, dark), gBox(0.09, 0.05, 0.05, 0.055, 1.71, 0.15, dark),   // Augengläser
      gBox(0.12, 0.05, 0.05, 0, 1.6, 0.16, 0x404046),                      // Mundgitter
      gCyl(0.17, 0.2, 0.08, 14, 0, 1.56, 0, w2),
      gBox(0.32, 0.36, 0.14, 0, 1.3, -0.2, w2),
      gCap(0.065, 0.28, -0.2, 1.32, 0.16, w, H), gCap(0.065, 0.26, 0.2, 1.32, 0.15, w, H),
      gSph(0.055, -0.1, 1.32, 0.36, dark), gSph(0.055, 0.12, 1.31, 0.33, dark),
      gBox(0.06, 0.1, 0.55, 0.03, 1.36, 0.4, dark), gCyl(0.035, 0.035, 0.12, 8, 0.03, 1.36, 0.72, 0x111111, H),
    ]),
    leg: mergeGeos([gCap(0.09, 0.56, 0, -0.38, 0, w), gBox(0.2, 0.18, 0.29, 0, -0.81, 0.04, 0xe8e8ea), gBox(0.21, 0.05, 0.3, 0, -0.88, 0.04, 0x55565c)]),
  };
}

const SOLDIER_RENDERERS = [];
// Nach einem Kartenwechsel: Soldatenmodelle der neuen Karte verwenden
function restyleSoldiers() { for (const r of SOLDIER_RENDERERS) r.restyle(); }

class SoldierRenderer {
  constructor(f, max) {
    this.f = f; SOLDIER_RENDERERS.push(this);
    const g = soldierGeos(f);
    this.body = new THREE.InstancedMesh(g.body, MAT.soldier, max);
    this.legL = new THREE.InstancedMesh(g.leg, MAT.soldier, max);
    this.legR = new THREE.InstancedMesh(g.leg, MAT.soldier, max);
    for (const m of [this.body, this.legL, this.legR]) {
      m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0;
      m.castShadow = true; m.receiveShadow = true;
    }
    this.max = max;
  }
  addTo(scene) { scene.add(this.body); scene.add(this.legL); scene.add(this.legR); }
  restyle() {
    const g = soldierGeos(this.f);
    this.body.geometry.dispose(); this.legL.geometry.dispose();
    this.body.geometry = g.body; this.legL.geometry = this.legR.geometry = g.leg;
  }
  update(list) {
    let n = 0;
    for (let j = 0; j < list.length && n < this.max; j++) {
      const s = list[j];
      if (s.special) continue;            // Helden und Ewoks haben eigene Modelle
      const i = n++;
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
  constructor(f, x, z, lives = 1) {
    this.f = f; this.type = 'sol'; this.livesLeft = lives - 1;
    this.pos = new V3(x, heightAt(x, z), z);
    this.yaw = f === REB ? Math.PI : 0;
    this.alive = true; this.fall = 0; this.deadT = 0;
    this.phase = rand(0, TAU); this.moving = false;
    this.fireCd = rand(1.5, 4); this.thinkCd = rand(0, 1.2); this.target = null;
    this.goal = new V3(); this.state = 'hold'; this.stateT = rand(0.5, 4);
    this.slotX = x; this.slotD = z - trenchZ(x);
    this.holdDist = rand(22, 65);
    this.r = 0.36; this.h = 1.85; this.ah = 1.65;   // Trefferzylinder und Zielhöhe
    this.special = null;                           // 'hero' | 'ewok' (eigene Modelle und KI)
  }
}

function aimPoint(t, out) {
  switch (t.type) {
    case 'sol': return out.set(t.pos.x, t.pos.y + t.ah * rand(0.67, 1), t.pos.z);
    case 'player': return out.set(t.pos.x, t.pos.y + rand(1.1, 1.6), t.pos.z);
    case 'turret': return out.set(t.pos.x, t.pos.y + t.hy * rand(0.5, 1.15) + (t.roof ? 0.8 : 0), t.pos.z);
    case 'gen': return MAP.id === 'endor' ? out.set(WORLD.gen.x + rand(-9, 9), WORLD.gen.y + rand(1, 5), WORLD.gen.z - 0.5)
      : out.set(WORLD.gen.x + rand(-6, 6), WORLD.gen.y + rand(3, 9), WORLD.gen.z);
    case 'speeder': return out.copy(t.hc || t.pos);
    case 'atst': return out.set(t.pos.x, t.pos.y + t.aimY, t.pos.z);
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

// Gefallener Rebell kehrt (solange er Leben übrig hat) in den Graben zurück
function respawnSoldier(s) {
  s.livesLeft--;
  if (s.f === IMP) {                   // imperiale Verstärkung rückt von hinten nach
    s.pos.set(rand(-130, 130), 0, rand(-250, -200)); s.pos.y = heightAt(s.pos.x, s.pos.z);
    s.alive = true; s.fall = 0; s.deadT = 0; s.target = null; s.moving = false; s.state = 'hold'; s.stateT = rand(0.5, 2); s.yaw = 0;
    return;
  }
  const x = clamp(s.slotX + rand(-8, 8), -TR.len + 3, TR.len - 3);
  s.slotX = x; s.pos.set(x, 0, trenchZ(x) + s.slotD); s.pos.y = heightAt(s.pos.x, s.pos.z);
  s.alive = true; s.fall = 0; s.deadT = 0; s.target = null; s.moving = false;
  s.state = 'hold'; s.stateT = rand(1, 3); s.fireCd = rand(1.5, 3); s.yaw = Math.PI;
}

function soldierTarget(s, range = 175) {
  const range2 = range * range;
  const list = s.f === REB ? G.imps : G.rebels;
  let b1 = null, b2 = null, b3 = null, d1 = range2, d2 = range2, d3 = range2;
  const consider = (t) => {
    const dx = t.pos.x - s.pos.x, dz = t.pos.z - s.pos.z, d = dx * dx + dz * dz;
    if (t.special === 'ewok' && d > 55 * 55) return;     // Ewoks sind im Farn kaum zu sehen
    if (d < d1) { b3 = b2; d3 = d2; b2 = b1; d2 = d1; b1 = t; d1 = d; }
    else if (d < d2) { b3 = b2; d3 = d2; b2 = t; d2 = d; }
    else if (d < d3) { b3 = t; d3 = d; }
  };
  for (const t of list) if (t.alive) consider(t);
  for (const pl of G.players) if (pl.faction !== s.f && targetAlive(pl)) consider(pl);
  _v1.set(s.pos.x, s.pos.y + 1.6, s.pos.z);
  for (const c of [b1, b2, b3]) {
    if (!c) continue;
    _v2.set(c.pos.x, c.pos.y + 1.6, c.pos.z);
    if (lineOfSight(_v1, _v2)) return c;
  }
  return null;
}

// Ewoks kämpfen im Wald, die Linie halten nur Rebellen und Helden
function rebelsHoldTrench() { return G.rebels.some(r => r.special !== 'ewok' && (r.alive || r.livesLeft > 0)) || G.players.some(p => p.faction === REB && (p.alive || p.lives > 0)); }

function updateSoldier(s, dt) {
  if (s.special === 'ewok') { updateEwok(s, dt); return; }
  if (!s.alive) {
    if (s.fall < 1) s.fall = Math.min(1, s.fall + dt * 2.5);
    s.deadT += dt;
    if (s.livesLeft > 0 && s.deadT > 9 && !s.queued && !(G.reinforce && G.reinforce(s))) respawnSoldier(s);
    return;
  }
  s.thinkCd -= dt;
  if (s.thinkCd <= 0) { s.thinkCd = rand(0.6, 1.3); s.target = soldierTarget(s); }
  if (s.target && !targetAlive(s.target)) s.target = null;
  s.moving = false;
  s.stateT -= dt;
  if (s.f === IMP) {
    if (MAP.id !== 'hoth') s.holdDist = Math.max(8, s.holdDist - dt * 0.15);   // zwischen Bäumen und Felsen rücken sie mit der Zeit näher
    if (s.state === 'advance') {
      const dx = s.goal.x - s.pos.x, dz = s.goal.z - s.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.5 || s.stateT <= 0) {
        s.stuck = d < 0.5 ? 0 : Math.min(3, (s.stuck | 0) + 1);       // Ziel nicht erreicht: beim nächsten Mal seitlich ausweichen
        s.state = 'hold'; s.stateT = s.target ? rand(2.5, 6) : rand(0.5, 2);
      }
      else {
        const spd = 2.4 * dt;
        s.pos.x += dx / d * spd; s.pos.z += dz / d * spd; s.moving = true;
        if (!s.target) s.yaw = Math.atan2(dx, dz);
      }
    } else if (s.stateT <= 0) {
      const limit = rebelsHoldTrench() ? trenchZ(s.pos.x) - s.holdDist : WORLD.gen.z - 25;
      if (s.pos.z < limit - 1) {
        s.state = 'advance'; s.stateT = rand(3, 7);
        const sx = (s.stuck | 0) * 7;
        s.goal.set(clamp(s.pos.x + rand(-8 - sx, 8 + sx), -TR.len, TR.len), 0, Math.min(limit, s.pos.z + rand(8, 22)));
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
  if (OBST.n) pushOutWorld(s.pos, 0.4);
  s.pos.y = heightAt(s.pos.x, s.pos.z);
  if (s.moving) s.phase += dt * 9;
  if (s.target) {
    const want = Math.atan2(s.target.pos.x - s.pos.x, s.target.pos.z - s.pos.z);
    s.yaw += angDiff(s.yaw, want) * Math.min(1, dt * 6);
    s.fireCd -= dt;
    if (s.fireCd <= 0 && (!s.moving || Math.random() < 0.3)) {
      const rate = s.f === IMP ? G.diff.rate : 1;
      s.fireCd = rand(1.3, 2.9) / rate * (s.special === 'hero' ? 0.55 : 1);
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      _v1.set(s.pos.x + sn * 0.8 + c * 0.04, s.pos.y + 1.36, s.pos.z + c * 0.8 - sn * 0.04);
      aimPoint(s.target, _v2);
      fireBolt(0, s.f, _v1, _v2, s.f === IMP ? G.diff.spread : s.special === 'hero' ? 0.018 : 0.034, s);
    }
  } else s.fireCd = Math.max(s.fireCd - dt, 0.3);
}

// Client: Soldat folgt dem Spielstand des Hosts
function updateSoldierNet(s, dt) {
  if (!s.alive) { if (s.fall < 1) s.fall = Math.min(1, s.fall + dt * 2.5); return; }
  const n = s.net;
  if (n) {
    const k = Math.min(1, dt * 8);
    if (Math.hypot(n.x - s.pos.x, n.z - s.pos.z) > 8) { s.pos.x = n.x; s.pos.z = n.z; }
    else { s.pos.x += (n.x - s.pos.x) * k; s.pos.z += (n.z - s.pos.z) * k; }
    s.yaw += angDiff(s.yaw, n.yaw) * k;
    s.moving = n.mv;
  }
  s.pos.y = heightAt(s.pos.x, s.pos.z);
  if (s.moving) s.phase += dt * 9;
}

function killSoldier(s, killer) {
  if (!s.alive) return;
  s.alive = false; s.target = null; s.moving = false;
  FX.sparks(_v3.set(s.pos.x, s.pos.y + 1.3, s.pos.z), 6, 1, 0.5, 0.2);
  if (isHuman(killer)) G.onKill(killer, s);
  if (s.special) G.onSpecialDown(s);
}

// ---------------------------------------------------------------- Laserschüsse
class Bolt {
  constructor() { this.p = new V3(); this.v = new V3(); this.prev = new V3(); this.dir = new V3(); this.f = 0; this.kind = 0; this.life = 0; this.owner = null; }
}
const boltPool = [];
function fireBolt(kind, f, from, to, spread, owner, fromNet) {
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
  if (G.netHook && !fromNet) G.netHook(b);
  if (kind === 7) { SFX.toss(from); return b; }
  FX.muzzle(from, f, kind > 0);
  SFX.shot(from, kind, f);
  if (kind === 2 || kind === 3) { const c = boltCol(f); FX.flash(from, c[0], c[1], c[2], 4, 0.12); }
  return b;
}

// Laserbolzen: heller HDR-Kern + additiver Lichtschein (leuchtet mit Bloom)
class BoltRenderer {
  // plain: ohne Leuchtkern und Schein (Ewok-Speere)
  constructor(r, g, b, max, plain) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1); geo.rotateX(Math.PI / 2);
    this.plain = !!plain;
    this.core = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: plain ? new THREE.Color().setRGB(r, g, b) : new THREE.Color().setRGB(r * 1.6 + 0.9, g * 1.6 + 0.9, b * 1.6 + 0.9) }), max);
    this.glow = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r * 0.6, g * 0.6, b * 0.6), transparent: true, opacity: 0.5, depthWrite: false }), max);
    for (const m of [this.core, this.glow]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; }
    this.glow.renderOrder = 7;
    this.max = max; this.n = 0;
  }
  addTo(scene) { scene.add(this.core); scene.add(this.glow); }
  begin() { this.n = 0; }
  add(b) {
    if (this.n >= this.max) return;
    const K = KIND[b.kind];
    const len = Math.min(K.len, (K.life - b.life) * K.speed + 0.3);   // wächst aus der Mündung
    _q.setFromUnitVectors(_Z, b.dir);
    _v1.copy(b.p).addScaledVector(b.dir, -len * 0.5);
    _v2.set(K.w, K.w, len);
    _m.compose(_v1, _q, _v2);
    this.core.setMatrixAt(this.n, _m);
    _v2.set(K.w * 3.2, K.w * 3.2, len * 1.08);
    _m.compose(_v1, _q, _v2);
    this.glow.setMatrixAt(this.n++, _m);
  }
  end() { for (const m of [this.core, this.glow]) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } if (this.plain) this.glow.count = 0; }
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
        const t = segCyl(x0, y0, z0, dx, dy, dz, p.x, p.y, p.z, s.r, s.h);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = s; hitType = 'sol'; }
      }
    }
    if (!G.visualOnly) {
      for (const P of G.players) {
        if (!P.alive || P.mode !== 'foot' || P.god > 0 || b.f === P.faction) continue;
        const t = segCyl(x0, y0, z0, dx, dy, dz, P.pos.x, P.pos.y, P.pos.z, 0.38, 1.8);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = P; hitType = 'player'; }
      }
    }
    if (b.f === IMP) {
      for (const tu of G.turrets) {
        if (!tu.alive) continue;
        const t = segCyl(x0, y0, z0, dx, dy, dz, tu.pos.x, tu.pos.y, tu.pos.z, 1.9, tu.hy + 1.2);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = tu; hitType = 'turret'; }
      }
      for (const sp of G.speeders) {
        if (!sp.alive || sp.mode === 'tow' || sp.mode === 'gone') continue;
        const t = segSphere(x0, y0, z0, dx, dy, dz, sp.hc, sp.rad);
        if (t >= 0 && t < bestT) { bestT = t; hitObj = sp; hitType = 'speeder'; }
      }
      if (G.genHP > 0 && b.kind > 0 && b.kind !== 7) {
        const t = genSeg(x0, y0, z0, dx, dy, dz);
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
    // Bäume, Baumstämme und Bunker (Endor)
    if (OBST.n) { const t = OBST.seg(x0, y0, z0, dx, dy, dz); if (t < bestT) { bestT = t; hitType = 'ground'; hitObj = null; } }
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
  const K = KIND[b.kind], byPlayer = b.owner === G.player, byHuman = isHuman(b.owner);
  if (b.kind === 7 && type !== 'sol' && type !== 'player') { FX.snowPuff(p, false); if (G.visualOnly) return; }
  if (G.visualOnly) {             // Client: nur Effekte, Schaden berechnet der Host
    if (b.kind === 7) return;
    if (K.splash > 0) { FX.explosion(p, K.splash * 0.6); SFX.boom(p, K.splash * 0.5); }
    else if (type === 'ground') { FX.impact(p, b.f); SFX.impact(p); }
    else { const c = boltCol(b.f); FX.sparks(p, 4, c[0], c[1], c[2]); }
    return;
  }
  switch (type) {
    case 'sol': killSoldier(obj, b.owner); if (byHuman) G.hitMarker(b.owner); break;
    case 'player': G.onPlayerHit(obj, b.kind === 7 ? 'Ewok-Speer' : b.kind === 0 || b.kind > 4 ? 'Blastertreffer' : 'Explosion'); break;
    case 'turret': if (K.struct > 0) { obj.damage(K.struct, b.owner); if (byHuman) G.hitMarker(b.owner); } else { FX.sparks(p, 4, 0.4, 1, 0.4); armorMsg(byPlayer); } break;
    case 'speeder': if (K.veh > 0) { obj.damage(K.veh, b.owner); if (byHuman) G.hitMarker(b.owner); } else { FX.sparks(p, 4, 0.4, 1, 0.4); armorMsg(byPlayer); } break;
    case 'gen': if (byHuman) G.hitMarker(b.owner); damageGenerator(K.struct); break;
    case 'atst': case 'atat': {
      const dmg = type === 'atst' ? K.atst : K.atat;
      if (dmg > 0) { obj.damage(dmg, b.owner); if (byHuman) G.hitMarker(b.owner); }
      else { FX.sparks(p, 5, 1, 0.8, 0.4); armorMsg(byPlayer); }
      break;
    }
    case 'ground': if (!K.splash && b.kind !== 7) { FX.impact(p, b.f); SFX.impact(p); } break;
  }
  if (b.kind === 7) return;
  if (K.splash > 0) explode(p, K.splash, b.f, b.owner, type === 'player' ? obj : null);
  else if (type !== 'ground') { const c = boltCol(b.f); FX.sparks(p, 4, c[0], c[1], c[2]); }
}

function armorMsg(byPlayer) {
  if (!byPlayer) return;
  const N = MAP.names;
  G.msg(playerFaction() === REB ? (MAP.id === 'endor' ? 'Blaster wirkungslos gegen Panzerung! Nutze die Bunkergeschütze oder die Ewok-Fallen.'
    : `Blaster wirkungslos gegen Panzerung! Nutze Geschütztürme oder ein ${N.flyer}.`.replace('ein Schneegleiter', 'einen Schneegleiter'))
    : MAP.id === 'hoth' ? 'Blaster wirkungslos gegen Panzerung! Steig in ein AT-ST oder AT-AT.' : `Blaster wirkungslos gegen Panzerung! Steig in einen ${N.walker === 'AAT' ? 'AAT-Panzer' : N.walker}.`, 'armor');
}

function explode(p, radius, f, owner, hitPlayer) {
  FX.explosion(p, radius * 0.6);
  SFX.boom(p, radius * 0.5);
  const r2 = radius * radius;
  const list = f === REB ? G.imps : G.rebels;
  for (const s of list) {
    if (!s.alive) continue;
    const dx = s.pos.x - p.x, dy = s.pos.y + 0.9 - p.y, dz = s.pos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) killSoldier(s, owner);
  }
  for (const P of G.players) {
    if (P === hitPlayer || f === P.faction || !P.alive || P.mode !== 'foot' || P.god > 0) continue;
    const dx = P.pos.x - p.x, dy = P.pos.y + 0.9 - p.y, dz = P.pos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) G.onPlayerHit(P, 'Explosion');
  }
}

function damageGenerator(d) {
  if (G.genHP <= 0) return;
  G.genHP = Math.max(0, G.genHP - d);
  G.msg(MAP.id === 'endor' ? 'Das Bunkertor wird angegriffen!' : MAP.id === 'geonosis' ? 'Die Kommandozentrale wird beschossen!' : 'Der Schildgenerator wird beschossen!', 'gen');
  if (G.genHP <= 0) genDestroyedFx();
}
function genDestroyedFx() {
  if (MAP.id === 'endor') {
    _v1.set(WORLD.gen.x, WORLD.gen.y + 2.5, WORLD.gen.z - 1);
    for (let i = 0; i < 6; i++) FX.explosion(_v2.set(_v1.x + rand(-9, 9), _v1.y + rand(-1, 3), _v1.z + rand(-2, 1)), 5);
  } else {
    _v1.set(WORLD.gen.x, WORLD.gen.y + 8, WORLD.gen.z);
    for (let i = 0; i < 6; i++) FX.explosion(_v2.set(_v1.x + rand(-10, 10), _v1.y + rand(-4, 6), _v1.z + rand(-10, 10)), 7);
  }
  SFX.boom(_v1, 4);
}

// ---------------------------------------------------------------- AT-AT
const C_WALK = 0x8d939a, C_WALK2 = 0x767c84, C_WALK3 = 0x5d636b, C_DARK = 0x2a2e33, C_GLASS = 0x101418;
let ATAT_GEO = null;
function atatGeos() {
  if (ATAT_GEO) return ATAT_GEO;
  const H = Math.PI / 2, body = [], legU = [], legL = [];
  body.push(gProfile([[-3.4, -2.4], [3.4, -2.4], [3.8, -1.0], [3.8, 1.5], [2.7, 2.9], [-2.7, 2.9], [-3.8, 1.5], [-3.8, -1.0]], 16, 'z', C_WALK, 0, 16.4, 0, 0.12));
  body.push(gBox(4.6, 0.6, 13, 0, 19.55, -0.5, C_WALK2), gBox(2.0, 0.5, 9, 0, 20.0, -1.5, C_WALK3));
  for (const sx of [-1, 1]) {
    body.push(gBox(0.25, 2.6, 6.5, sx * 3.92, 16.6, 3.2, C_WALK2), gBox(0.25, 2.6, 6.0, sx * 3.92, 16.6, -3.6, C_WALK2),
      gBox(0.3, 0.14, 4, sx * 3.96, 17.9, 0, C_DARK), gBox(0.3, 1.8, 0.14, sx * 3.96, 16.8, -0.3, C_DARK),
      gBox(1.0, 0.6, 0.3, sx * 1.6, 17.6, -8.45, C_DARK), gBox(1.0, 0.6, 0.3, sx * 1.6, 16.6, -8.45, C_DARK));
    for (const sz of [-1, 1]) body.push(gCyl(1.55, 1.55, 0.9, 18, sx * 3.75, 14.4, sz * 5.6, C_WALK3, 0, H), gCyl(0.7, 0.7, 1.0, 12, sx * 3.85, 14.4, sz * 5.6, C_DARK, 0, H));
  }
  body.push(gBox(6.4, 4.6, 0.5, 0, 16.6, 8.1, C_WALK2), gBox(6.4, 4.6, 0.5, 0, 16.6, -8.1, C_WALK2), gBox(5.8, 0.8, 13.5, 0, 13.7, 0, C_WALK3));
  for (let i = 0; i < 3; i++) body.push(gCyl(i === 1 ? 1.05 : 1.25, i === 1 ? 1.05 : 1.25, 1.0, 14, 0, 15.9, 8.7 + i, i === 1 ? C_DARK : C_WALK3, H));
  const head = [
    gProfile([[0, -1.5], [4.2, -1.4], [5.6, -0.7], [5.6, 0.5], [4.6, 1.2], [0.6, 1.6], [0, 1.4]], 3.6, 'x', C_WALK, 0, 0, 0, 0.08),
    gBox(3.0, 0.3, 3.6, 0, 1.62, 2.0, C_WALK2), gBox(3.8, 0.9, 1.0, 0, 0.1, 0.6, C_WALK3),
    gBox(0.85, 0.32, 0.06, 0.7, 0.05, 5.62, C_GLASS), gBox(0.85, 0.32, 0.06, -0.7, 0.05, 5.62, C_GLASS),
    gBox(1.2, 0.2, 0.06, 0, -0.45, 5.62, C_DARK),
    gCyl(0.26, 0.32, 2.6, 10, 1.0, -1.5, 5.3, C_DARK, H), gCyl(0.26, 0.32, 2.6, 10, -1.0, -1.5, 5.3, C_DARK, H),
    gCyl(0.36, 0.36, 0.5, 10, 1.0, -1.5, 4.0, C_WALK3, H), gCyl(0.36, 0.36, 0.5, 10, -1.0, -1.5, 4.0, C_WALK3, H),
    gCyl(0.15, 0.15, 2.0, 8, 1.95, 0.1, 4.6, C_DARK, H), gCyl(0.15, 0.15, 2.0, 8, -1.95, 0.1, 4.6, C_DARK, H),
  ];
  legU.push(gBox(1.3, 6.0, 1.8, 0, -3.2, 0, C_WALK), gBox(1.45, 4.0, 2.0, 0, -2.6, 0, C_WALK2),
    gCyl(0.18, 0.18, 4.6, 8, 0, -3.3, -1.15, C_DARK), gCyl(0.28, 0.28, 1.2, 8, 0, -1.3, -1.15, C_WALK3),
    gCyl(1.0, 1.0, 1.65, 16, 0, -6.6, 0, C_WALK3, 0, H), gCyl(0.5, 0.5, 1.75, 10, 0, -6.6, 0, C_DARK, 0, H));
  legL.push(gBox(1.1, 5.8, 1.4, 0, -3.0, 0, C_WALK), gBox(1.25, 3.0, 1.6, 0, -2.0, 0, C_WALK2),
    gCyl(0.16, 0.16, 4.2, 8, 0, -3.2, 0.95, C_DARK), gBox(1.4, 0.9, 1.6, 0, -6.2, 0, C_WALK3),
    gCyl(1.5, 1.85, 1.0, 20, 0, -7.1, 0, C_WALK3), gCyl(1.86, 1.86, 0.15, 20, 0, -7.55, 0, C_DARK));
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; legL.push(gBox(0.5, 0.5, 0.9, Math.sin(a) * 1.5, -7.3, Math.cos(a) * 1.5, C_WALK2, 0, a)); }
  ATAT_GEO = { body: mergeGeos(body), head: mergeGeos(head), upper: mergeGeos(legU), lower: mergeGeos(legL) };
  return ATAT_GEO;
}

class ATAT {
  constructor(x, z) {
    this.type = 'atat'; this.alive = true; this.maxHp = 45; this.hp = this.maxHp;
    this.pos = new V3(x, heightAt(x, z), z); this.yaw = 0; this.phase = rand(0, TAU); this.lastStep = 0;
    this.fireCd = rand(3, 6); this.thinkCd = rand(0, 1); this.target = null; this.tangled = false;
    this.fallT = 0; this.fallDir = 1; this.crashed = false; this.stopDist = rand(215, 235); this.smokeT = 0;
    this.pilot = null; this.ctrl = { fwd: 0, yaw: 0, pitch: 0, fire: false, aim: new V3() };
    const g = atatGeos();
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.root.add(new THREE.Mesh(g.body, MAT.vehicle));
    this.head = new THREE.Group(); this.head.position.set(0, 15.6, 11.4); this.head.add(new THREE.Mesh(g.head, MAT.vehicle));
    this.root.add(this.head);
    this.legs = [];
    const offs = [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5];
    [[4.6, 5.6], [-4.6, 5.6], [4.6, -5.6], [-4.6, -5.6]].forEach(([lx, lz], i) => {
      const hip = new THREE.Group(); hip.position.set(lx, 14.4, lz);
      hip.add(new THREE.Mesh(g.upper, MAT.vehicle));
      const knee = new THREE.Group(); knee.position.set(0, -6.6, 0); knee.add(new THREE.Mesh(g.lower, MAT.vehicle));
      hip.add(knee); this.root.add(hip);
      this.legs.push({ hip, knee, off: offs[i] });
    });
    this.local = [new V3(0, 16.6, -5.5), new V3(0, 16.6, 0), new V3(0, 16.6, 5.5), new V3(0, 15.6, 14)];
    this.spheres = this.local.map((p, i) => { const s = p.clone(); s.r = i === 3 ? 2.9 : 4.4; return s; });
    G.dyn.add(shadowify(this.root));
    this.syncMesh();
  }
  syncMesh() {
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) { const r = this.spheres[i].r; this.spheres[i].copy(this.local[i]).applyMatrix4(this.root.matrixWorld); this.spheres[i].r = r; }
  }
  legWorld(i, out) { return out.set(0, -6, 0).applyMatrix4(this.legs[i].hip.matrixWorld); }
  muzzle(i, out) { return out.set(i ? -1.0 : 1.0, -1.5, 6.7).applyMatrix4(this.head.matrixWorld); }
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
    if (isHuman(by)) G.creditKill(by);
    if (this.pilot) G.onPilotDown(this);
  }
  chooseTarget() {
    const dg = Math.hypot(WORLD.gen.x - this.pos.x, WORLD.gen.z - this.pos.z);
    const opts = [];
    if (dg < 265 && G.genHP > 0) opts.push({ type: 'gen', pos: WORLD.gen }, { type: 'gen', pos: WORLD.gen });
    let bt = null, bd = 230;
    for (const t of G.turrets) if (t.alive) { const d = t.pos.distanceTo(this.pos); if (d < bd) { bd = d; bt = t; } }
    if (bt) opts.push(bt);
    for (const s of G.speeders) if (targetAlive(s) && s.pos.distanceTo(this.pos) < 170) { opts.push(s); break; }
    for (const pl of G.players) if (pl.faction === REB && targetAlive(pl) && pl.pos.distanceTo(this.pos) < 200) opts.push(pl);
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
    if (this.pilot === G.player) { this.updatePilot(dt); return; }
    if (this.puppet || (this.pilot && this.pilot.remote)) { this.updateNet(dt); return; }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(2, 4); this.chooseTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    const dx = WORLD.gen.x - this.pos.x, dz = WORLD.gen.z - this.pos.z, dg = Math.hypot(dx, dz);
    if (!this.tangled && dg > this.stopDist) {
      this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 0.3);
      this.walk(2.1, dt);
    }
    this.animate();
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
  walk(speed, dt) {
    const sp = speed * dt;
    this.pos.x = clamp(this.pos.x + Math.sin(this.yaw) * sp, -440, 440);
    this.pos.z = clamp(this.pos.z + Math.cos(this.yaw) * sp, -760, 240);
    pushOutWorld(this.pos, 10);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.phase += dt * 1.1 * speed / 2.1;
    const step = Math.floor(this.phase / (Math.PI / 2));
    if (step !== this.lastStep) { this.lastStep = step; SFX.thump(this.pos); }
  }
  // Vom Spieler gesteuert: ctrl = { fwd, yaw, pitch, fire, aim }
  updatePilot(dt) {
    const c = this.ctrl;
    if (!this.tangled) {
      this.yaw += clamp(angDiff(this.yaw, c.yaw), -0.4 * dt, 0.4 * dt);
      if (Math.abs(c.fwd) > 0.05) this.walk(c.fwd * (c.fwd > 0 ? 3.4 : 1.6), dt);
    }
    this.animate();
    this.head.rotation.y = clamp(angDiff(this.yaw, c.yaw), -0.7, 0.7);
    this.head.rotation.x = clamp(-c.pitch, -0.35, 0.45);
    this.syncMesh();
    this.fireCd -= dt;
    if (c.fire && this.fireCd <= 0 && !this.tangled) {
      this.fireCd = 1.3;
      for (let i = 0; i < 2; i++) { this.muzzle(i, _v1); fireBolt(2, IMP, _v1, c.aim, 0.004, this.pilot); }
    }
  }
  // Pose aus dem Netz (Host-Spielstand oder entfernter Pilot)
  updateNet(dt) {
    const n = this.net;
    if (n) {
      const k = Math.min(1, dt * 10), ox = this.pos.x, oz = this.pos.z;
      if (Math.hypot(n.x - ox, n.z - oz) > 30) { this.pos.x = n.x; this.pos.z = n.z; }
      else { this.pos.x += (n.x - ox) * k; this.pos.z += (n.z - oz) * k; }
      this.yaw += angDiff(this.yaw, n.yaw) * k;
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.phase += Math.hypot(this.pos.x - ox, this.pos.z - oz) * 0.52;
      const step = Math.floor(this.phase / (Math.PI / 2));
      if (step !== this.lastStep) { this.lastStep = step; SFX.thump(this.pos); }
      this.head.rotation.y += (n.hy - this.head.rotation.y) * k;
      this.head.rotation.x += (n.hx - this.head.rotation.x) * k;
    }
    this.animate();
    this.syncMesh();
  }
  netDestroy() {
    if (!this.alive) return;
    this.alive = false; this.fallDir = this.tangled ? 1 : (Math.random() < 0.5 ? 1 : -1);
    FX.explosion(this.spheres[2], 5); SFX.boom(this.spheres[2], 3);
  }
  animate() {
    for (const L of this.legs) {
      const s = Math.sin(this.phase + L.off), c = Math.cos(this.phase + L.off);
      L.hip.rotation.x = 0.22 * s;
      L.knee.rotation.x = -0.32 * Math.max(0, c);
    }
    this.root.position.y = this.pos.y + Math.sin(this.phase * 2) * 0.15;
  }
}

// ---------------------------------------------------------------- AT-ST
let ATST_GEO = null;
function atstGeos() {
  if (ATST_GEO) return ATST_GEO;
  const H = Math.PI / 2;
  const head = [
    gProfile([[-1.3, -0.6], [0.9, -0.75], [1.9, -0.2], [1.9, 0.3], [1.2, 1.2], [-1.0, 1.35], [-1.4, 0.9]], 2.5, 'x', C_WALK, 0, 0.5, 0, 0.06),
    gBox(1.5, 0.17, 0.06, 0, 0.55, 1.92, C_GLASS), gBox(0.5, 0.12, 0.06, 0.6, 0.85, 1.6, C_GLASS), gBox(0.5, 0.12, 0.06, -0.6, 0.85, 1.6, C_GLASS),
    gCyl(0.5, 0.55, 0.3, 14, 0, 1.95, -0.2, C_WALK3), gBox(2.0, 1.0, 0.5, 0, 0.6, -1.5, C_WALK3),
    gBox(0.3, 0.6, 0.1, 0.5, 0.6, -1.78, C_DARK), gBox(0.3, 0.6, 0.1, -0.5, 0.6, -1.78, C_DARK),
    gBox(1.4, 0.8, 1.2, 0, -0.5, 0, C_WALK3), gCyl(0.55, 0.55, 1.7, 12, 0, -0.75, 0, C_DARK, 0, H),
  ];
  for (const sx of [-1, 1]) head.push(gBox(0.45, 0.45, 1.3, sx * 1.5, 0.4, 0.6, C_WALK3), gCyl(0.08, 0.08, 1.2, 6, sx * 1.5, 0.4, 1.8, C_DARK, H),
    gCyl(0.09, 0.09, 1.3, 8, sx * 0.35, -0.1, 2.3, C_DARK, H), gCyl(0.16, 0.16, 0.4, 8, sx * 0.35, -0.1, 1.75, C_WALK3, H));
  ATST_GEO = {
    head: mergeGeos(head),
    thigh: mergeGeos([gBox(0.42, 2.7, 0.55, 0, -1.35, 0, C_WALK), gBox(0.48, 1.6, 0.6, 0, -1.0, 0, C_WALK2), gCyl(0.08, 0.08, 2.2, 6, 0, -1.35, -0.38, C_DARK),
      gCyl(0.36, 0.36, 0.7, 12, 0, 0, 0, C_WALK3, 0, H)]),
    shin: mergeGeos([gBox(0.38, 2.9, 0.48, 0, -1.45, 0, C_WALK2), gCyl(0.07, 0.07, 2.4, 6, 0, -1.4, 0.33, C_DARK), gCyl(0.3, 0.3, 0.62, 12, 0, 0, 0, C_WALK3, 0, H)]),
    foot: mergeGeos([gBox(1.0, 0.22, 1.2, 0, -0.11, 0.1, C_WALK3), gBox(0.28, 0.2, 0.7, 0.33, -0.12, 0.95, C_WALK3, 0, -0.25), gBox(0.28, 0.2, 0.7, -0.33, -0.12, 0.95, C_WALK3, 0, 0.25),
      gBox(0.28, 0.2, 0.6, 0, -0.12, 1.0, C_WALK3), gBox(0.4, 0.2, 0.5, 0, -0.12, -0.6, C_WALK3), gBox(0.5, 0.35, 0.5, 0, 0.1, 0, C_DARK)]),
  };
  return ATST_GEO;
}

class ATST {
  constructor(x, z) {
    this.type = 'atst'; this.alive = true; this.hp = MAP.id === 'endor' ? 12 : MAP.id === 'geonosis' ? 16 : 8;
    // Geonosis: statt des AT-ST fährt der Schwebepanzer AAT der Droidenarmee (gleiche KI und Steuerung)
    this.aat = MAP.id === 'geonosis'; this.label = this.aat ? 'AAT' : 'AT-ST'; this.aimY = this.aat ? 1.9 : 6.8;
    this.pos = new V3(x, heightAt(x, z), z); this.yaw = 0; this.phase = rand(0, TAU);
    this.goal = new V3(x, 0, trenchZ(x) - rand(35, 60)); this.goalT = 0;
    // Endor: jeder AT-ST rückt auf einem Waldweg an
    this.lane = MAP.id === 'endor' ? ENDOR.lanes.reduce((a, l) => (Math.abs(l - x) < Math.abs(a - x) ? l : a), ENDOR.lanes[0]) : 0;
    if (MAP.id === 'endor') this.goal.set(this.lane, 0, z + 30);
    this.fireCd = rand(2, 4); this.thinkCd = rand(0, 1); this.target = null; this.fallT = 0; this.smokeT = 0; this.fallDir = 1;
    this.pilot = null; this.ctrl = { fwd: 0, yaw: 0, pitch: 0, fire: false, aim: new V3() }; this.gunI = 0;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.legs = [];
    if (this.aat) {
      const g = aatGeos();
      this.hull = new THREE.Group(); this.hull.position.y = 0.75; this.hull.add(new THREE.Mesh(g.hull, MAT.vehicle)); this.root.add(this.hull);
      this.head = new THREE.Group(); this.head.position.set(0, 1.55, -0.6); this.head.add(new THREE.Mesh(g.turret, MAT.vehicle)); this.hull.add(this.head);
      this.muz = [0, 0.45, 4.6];
      this.local = [new V3(0, 1.9, 0), new V3(0, 1.4, 2.2)];
      this.spheres = this.local.map((p, i) => { const s = p.clone(); s.r = i ? 2.2 : 2.6; return s; });
      G.dyn.add(shadowify(this.root));
      this.sync();
      return;
    }
    const g = atstGeos();
    this.muz = [0.35, -0.1, 2.95];
    this.head = new THREE.Group(); this.head.position.set(0, 6.2, 0); this.head.add(new THREE.Mesh(g.head, MAT.vehicle));
    this.root.add(this.head);
    [0.75, -0.75].forEach((lx, i) => {
      const th = new THREE.Group(); th.position.set(lx, 5.25, 0); th.add(new THREE.Mesh(g.thigh, MAT.vehicle));
      const kn = new THREE.Group(); kn.position.set(0, -2.7, 0); kn.add(new THREE.Mesh(g.shin, MAT.vehicle));
      const an = new THREE.Group(); an.position.set(0, -2.9, 0); an.add(new THREE.Mesh(g.foot, MAT.vehicle));
      kn.add(an); th.add(kn); this.root.add(th);
      this.legs.push({ th, kn, an, off: i * Math.PI });
    });
    this.local = [new V3(0, 6.8, 0.3), new V3(0, 5.5, 0)];
    this.spheres = this.local.map((p, i) => { const s = p.clone(); s.r = i ? 1.0 : 1.9; return s; });
    G.dyn.add(shadowify(this.root));
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
      G.msg(this.label + ' zerstört!', 'kill');
      if (isHuman(by)) G.creditKill(by);
      if (this.pilot) G.onPilotDown(this);
    }
  }
  chooseTarget() {
    let best = null, bd = 150 * 150;
    _v1.set(this.pos.x, this.pos.y + 6.8, this.pos.z);
    const test = (t, bias) => {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = (dx * dx + dz * dz) * bias;
      if (d < bd) { aimPoint(t, _v2); if (lineOfSight(_v1, _v2)) { bd = d; best = t; } }
    };
    for (const pl of G.players) if (pl.faction === REB && targetAlive(pl)) test(pl, 0.8);
    for (const t of G.turrets) if (t.alive) test(t, 0.7);
    if (this.aat) for (const sp of G.speeders) if (targetAlive(sp)) test(sp, 0.8);
    for (const r of G.rebels) if (r.alive && Math.abs(r.pos.x - this.pos.x) < 150 && (r.special !== 'ewok' || r.pos.distanceTo(this.pos) < 55)) test(r, 1);
    // Endor: in Reichweite auch auf das Bunkertor feuern (immer, sobald die Verteidiger gefallen sind)
    if (MAP.id === 'endor' && G.genHP > 0) {
      const dg = Math.hypot(WORLD.gen.x - this.pos.x, WORLD.gen.z - this.pos.z);
      if (dg < 95 && (!best || !rebelsHoldTrench() || Math.random() < 0.3)) best = { type: 'gen', pos: WORLD.gen };
    }
    this.target = best;
  }
  update(dt) {
    if (!this.alive) {
      if (this.fallT < 1) {
        this.fallT = Math.min(1, this.fallT + dt * 0.8);
        this.root.rotation.z = this.fallDir * this.fallT * this.fallT * (this.aat ? 0.18 : 1.45);
        this.root.position.y = this.pos.y - this.fallT * (this.aat ? 0.7 : 1.5);
        if (this.fallT >= 1) { FX.explosion(_v1.set(this.pos.x, this.pos.y + 1, this.pos.z), 3); SFX.boom(this.pos, 1.5); }
      }
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.25; FX.smokeColumn(_v1.set(this.pos.x, this.pos.y + 1, this.pos.z), 0.8); }
      return;
    }
    if (this.pilot === G.player) { this.updatePilot(dt); return; }
    if (this.puppet || (this.pilot && this.pilot.remote)) { this.updateNet(dt); return; }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(1, 2); this.chooseTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    this.goalT -= dt;
    let dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 2 && this.goalT <= 0) {
      this.goalT = rand(5, 10);
      const front = rebelsHoldTrench() ? trenchZ(this.pos.x) - rand(30, 55) : WORLD.gen.z - 40;
      if (MAP.id === 'endor' && this.pos.z < front - 25) { this.goal.set(this.lane + rand(-3, 3), 0, Math.min(front, this.pos.z + rand(25, 40))); this.goalT = 0; }
      else this.goal.set(clamp(this.pos.x + rand(-25, 25), -TR.len, TR.len), 0, front);
      dx = this.goal.x - this.pos.x; dz = this.goal.z - this.pos.z; d = Math.hypot(dx, dz);
    }
    let want = this.target ? Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) : this.yaw;
    if (d > 2) {
      const mv = Math.atan2(dx, dz);
      if (!this.target) want = mv;
      const sp = 2.6 * dt;
      this.pos.x += dx / d * sp; this.pos.z += dz / d * sp;
      if (pushOutWorld(this.pos, 2.4)) this.goalT = Math.min(this.goalT, 3);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.phase += dt * 3.2;
    }
    this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 1.5);
    this.animate(d > 2);
    this.sync();
    this.fireCd -= dt;
    if (this.target && this.fireCd <= 0) {
      this.fireCd = rand(1.1, 1.8) / G.diff.rate;
      aimPoint(this.target, _v2);
      if (Math.abs(angDiff(this.yaw, Math.atan2(_v2.x - this.pos.x, _v2.z - this.pos.z))) < 0.25) {
        for (let i = 0; i < 2; i++) {
          _v1.set(i ? -this.muz[0] : this.muz[0], this.muz[1], this.muz[2]).applyMatrix4(this.head.matrixWorld);
          fireBolt(1, IMP, _v1, _v2, G.diff.spread * 0.8, this);
        }
      }
    }
  }
  animate(moving) {
    if (this.aat) { this.hull.position.y = 0.75 + Math.sin(this.phase * 0.7) * 0.06; this.hull.rotation.x = moving ? -0.03 : 0; return; }
    for (const L of this.legs) {
      const s = moving ? Math.sin(this.phase + L.off) : 0, c = moving ? Math.cos(this.phase + L.off) : 0;
      L.th.rotation.x = -0.45 + 0.35 * s;
      L.kn.rotation.x = 0.95 + 0.35 * Math.max(0, c);
      L.an.rotation.x = -(L.th.rotation.x + L.kn.rotation.x);
    }
    this.head.position.y = 6.2 + Math.abs(Math.sin(this.phase)) * 0.15;
  }
  updateNet(dt) {
    const n = this.net;
    let moving = false;
    if (n) {
      const k = Math.min(1, dt * 10), ox = this.pos.x, oz = this.pos.z;
      if (Math.hypot(n.x - ox, n.z - oz) > 20) { this.pos.x = n.x; this.pos.z = n.z; }
      else { this.pos.x += (n.x - ox) * k; this.pos.z += (n.z - oz) * k; }
      this.yaw += angDiff(this.yaw, n.yaw) * k;
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      const d = Math.hypot(this.pos.x - ox, this.pos.z - oz);
      this.phase += d * 1.23; moving = d > 0.002 || n.mv;
    }
    this.animate(moving);
    this.sync();
  }
  netDestroy() {
    if (!this.alive) return;
    this.alive = false; this.fallDir = Math.random() < 0.5 ? 1 : -1;
    FX.explosion(this.spheres[0], 4); SFX.boom(this.spheres[0], 2.5);
  }
  // Vom Spieler gesteuert
  updatePilot(dt) {
    const c = this.ctrl;
    this.yaw += clamp(angDiff(this.yaw, c.yaw), -1.6 * dt, 1.6 * dt);
    const sp = c.fwd * (c.fwd > 0 ? 4.6 : 2.4);
    const moving = Math.abs(sp) > 0.05;
    if (moving) {
      this.pos.x = clamp(this.pos.x + Math.sin(this.yaw) * sp * dt, -440, 440);
      this.pos.z = clamp(this.pos.z + Math.cos(this.yaw) * sp * dt, -760, 240);
      pushOutWorld(this.pos, MAP.id === 'hoth' ? 3 : 2.4);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.phase += dt * 3.2 * sp / 2.6;
    }
    this.animate(moving);
    this.sync();
    this.fireCd -= dt;
    if (c.fire && this.fireCd <= 0) {
      this.fireCd = 0.38; this.gunI ^= 1;
      _v1.set(this.gunI ? -this.muz[0] : this.muz[0], this.muz[1], this.muz[2]).applyMatrix4(this.head.matrixWorld);
      fireBolt(1, IMP, _v1, c.aim, 0.003, this.pilot);
    }
  }
}

// ---------------------------------------------------------------- Geschützturm
let TUR_GEO = null;
function turretGeos() {
  if (TUR_GEO) return TUR_GEO;
  const H = Math.PI / 2, L = 0xd5d9de, M = 0xb3b9c0, D = 0x50565e;
  const base = [gCyl(2.1, 2.4, 0.6, 20, 0, 0.3, 0, M), gCyl(1.45, 1.85, 3.3, 20, 0, 2.25, 0, L), gCyl(1.9, 1.9, 0.25, 20, 0, 0.75, 0, D),
    gBox(0.9, 1.7, 0.1, 0, 1.45, -1.66, 0x8a9097), gBox(0.5, 0.25, 0.1, 0.9, 3.2, 1.45, D)];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; base.push(gBox(0.2, 3.0, 0.2, Math.sin(a) * 1.68, 2.1, Math.cos(a) * 1.68, M, 0, a)); }
  TUR_GEO = {
    base: mergeGeos(base),
    head: mergeGeos([gCyl(1.95, 1.95, 0.8, 20, 0, 0.4, 0, L), gCyl(2.0, 2.0, 0.12, 20, 0, 0.82, 0, D),
      gProfile([[-1.2, 0], [1.4, 0], [1.9, 0.5], [1.5, 1.3], [-1.0, 1.4], [-1.3, 0.9]], 1.9, 'x', M, 0, 0.8, 0, 0.05),
      gBox(1.2, 0.18, 0.06, 0, 1.75, 0.95, C_GLASS), gCyl(0.25, 0.25, 0.8, 8, 0.6, 2.4, -0.6, 0x6e747b), gCyl(0.45, 0.1, 0.25, 12, 0.6, 2.85, -0.6, L, 0.5)]),
    barrel: mergeGeos([gCyl(0.13, 0.15, 3.0, 10, 0.35, 0, 1.5, 0x3a3f45, H), gCyl(0.13, 0.15, 3.0, 10, -0.35, 0, 1.5, 0x3a3f45, H),
      gCyl(0.2, 0.2, 0.4, 10, 0.35, 0, 2.95, 0x2a2e33, H), gCyl(0.2, 0.2, 0.4, 10, -0.35, 0, 2.95, 0x2a2e33, H),
      gBox(1.1, 0.55, 0.9, 0, 0, 0.15, 0x8a9097)]),
  };
  return TUR_GEO;
}
class Turret {
  // opts.roof: Geschütz auf dem Bunkerdach (Endor), ohne Turmsockel
  constructor(x, z, opts) {
    this.type = 'turret'; this.alive = true; this.maxHp = 10; this.hp = this.maxHp;
    this.roof = !!(opts && opts.roof); this.hy = this.roof ? 0.7 : 3.9;
    this.pos = new V3(x, this.roof ? opts.y : heightAt(x, z), z);
    this.aimYaw = Math.PI; this.aimPitch = 0; this.fireCd = rand(1, 3); this.thinkCd = rand(0, 1); this.target = null;
    this.manned = false; this.smokeT = 0; this.gun = 0;
    const g = turretGeos();
    this.root = new THREE.Group(); this.root.position.copy(this.pos);
    if (!this.roof) this.root.add(new THREE.Mesh(g.base, MAT.building));
    else { this.root.add(vcMesh([gCyl(2.0, 2.3, 0.7, 20, 0, 0.35, 0, 0x6c726c), gCyl(1.7, 1.7, 0.1, 20, 0, 0.72, 0, 0x4a4f4a)], MAT.building)); this.aimYaw = Math.PI; }
    this.head = new THREE.Group(); this.head.position.y = this.hy; this.head.add(new THREE.Mesh(g.head, MAT.building));
    this.barrel = new THREE.Group(); this.barrel.position.set(0, 1.35, 1.2); this.barrel.add(new THREE.Mesh(g.barrel, MAT.vehicle));
    this.head.add(this.barrel); this.root.add(this.head);
    G.dyn.add(shadowify(this.root));
    this.apply();
  }
  apply() { this.head.rotation.y = this.aimYaw; this.barrel.rotation.x = -this.aimPitch; this.root.updateMatrixWorld(true); }
  muzzle(out) { this.gun ^= 1; return out.set(this.gun ? 0.35 : -0.35, 0, 3.1).applyMatrix4(this.barrel.matrixWorld); }
  damage(d, by) {
    if (!this.alive) return;
    this.hp -= d; FX.sparks(_v1.set(this.pos.x, this.pos.y + this.hy, this.pos.z), 5, 1, 0.6, 0.2);
    if (this.hp <= 0) {
      this.alive = false;
      if (isHuman(by)) G.creditKill(by);
      FX.explosion(_v1.set(this.pos.x, this.pos.y + this.hy, this.pos.z), 4); SFX.boom(this.pos, 2);
      this.head.visible = false; this.root.scale.y = 0.55;
      G.msg('Ein Geschützturm wurde zerstört!', 'turret');
      if (this.manned && this.mannedBy === G.player && G.player.mode === 'turret') G.player.exitTurret(true);
      else if (this.manned && this.mannedBy && this.mannedBy.remote) G.onRemoteEject(this.mannedBy);
    }
  }
  netDestroy() {
    if (!this.alive) return;
    this.alive = false;
    FX.explosion(_v1.set(this.pos.x, this.pos.y + this.hy, this.pos.z), 4); SFX.boom(this.pos, 2);
    this.head.visible = false; this.root.scale.y = 0.55;
  }
  pickTarget() {
    _v1.set(this.pos.x, this.pos.y + this.hy + 1.1, this.pos.z);
    let best = null, bd = 1e9;
    const consider = (t, maxd, bias) => {
      const d = t.pos.distanceTo(this.pos);
      if (d > maxd || d * bias > bd) return;
      aimPoint(t, _v2); if (!lineOfSight(_v1, _v2)) return;
      bd = d * bias; best = t;
    };
    for (const w of G.atsts) if (w.alive) consider(w, this.roof ? 125 : 200, 0.5);
    for (const w of G.atats) if (w.alive && !w.tangled) consider(w, 200, 0.7);
    for (const s of G.imps) if (s.alive && Math.abs(s.pos.x - this.pos.x) < 150) consider(s, 140, 1.2);
    for (const pl of G.players) if (pl.faction === IMP && targetAlive(pl)) consider(pl, 140, 1.1);
    this.target = best;
  }
  update(dt) {
    if (!this.alive) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.3; FX.smokeColumn(_v1.set(this.pos.x, this.pos.y + this.hy * 0.55, this.pos.z), 0.6); }
      return;
    }
    if (this.manned && this.mannedBy === G.player) { this.apply(); return; }
    if (this.puppet || this.manned) {        // Ausrichtung kommt aus dem Netz
      const n = this.net;
      if (n) { const k = Math.min(1, dt * 12); this.aimYaw += angDiff(this.aimYaw, n.ay) * k; this.aimPitch += (n.ap - this.aimPitch) * k; }
      this.apply(); return;
    }
    this.thinkCd -= dt;
    if (this.thinkCd <= 0) { this.thinkCd = rand(1, 2); this.pickTarget(); }
    if (this.target && !targetAlive(this.target)) this.target = null;
    if (!this.target) return;
    aimPoint(this.target, _v2);
    const dx = _v2.x - this.pos.x, dz = _v2.z - this.pos.z;
    const wantY = Math.atan2(dx, dz), wantP = Math.atan2(_v2.y - (this.pos.y + this.hy + 1.2), Math.hypot(dx, dz));
    const dy = angDiff(this.aimYaw, wantY);
    this.aimYaw += clamp(dy, -1.4 * dt, 1.4 * dt);
    this.aimPitch += clamp(wantP - this.aimPitch, -dt, dt);
    this.apply();
    this.fireCd -= dt;
    if (this.fireCd <= 0 && Math.abs(dy) < 0.06) {
      this.fireCd = rand(2.9, 4.2);
      this.muzzle(_v1);
      fireBolt(3, REB, _v1, _v2, 0.012, this);
    }
  }
}

// ---------------------------------------------------------------- Schneegleiter (T-47)
let SPEEDER_GEO = null, SPEEDER_GLOW = null;
function speederGeo() {
  if (SPEEDER_GEO) return SPEEDER_GEO;
  const H = Math.PI / 2;
  const sh = new THREE.Shape();
  sh.moveTo(0, 3.0); sh.lineTo(2.1, -1.0); sh.lineTo(1.7, -2.4); sh.lineTo(-1.7, -2.4); sh.lineTo(-2.1, -1.0); sh.lineTo(0, 3.0);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
  hull.rotateX(-Math.PI / 2); hull.translate(0, 0.12, 0); paint(hull, 0xe2e2dc);
  const top = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 });
  top.rotateX(-Math.PI / 2); top.scale(0.72, 1, 0.72); top.translate(0, 0.86, -0.3); paint(top, 0xcfcfc8);
  SPEEDER_GEO = mergeGeos([hull, top,
    gProfile([[-1.0, 0], [0.7, 0], [1.1, 0.25], [0.5, 0.65], [-0.6, 0.7], [-1.0, 0.4]], 1.05, 'x', C_GLASS, 0, 1.05, -0.2, 0.04),
    gBox(1.15, 0.08, 1.9, 0, 1.06, -0.2, 0x9a9a95),
    gCyl(0.45, 0.52, 1.9, 14, 0.95, 0.5, -2.4, 0x8f8f8b, H), gCyl(0.45, 0.52, 1.9, 14, -0.95, 0.5, -2.4, 0x8f8f8b, H),
    gCyl(0.54, 0.54, 0.2, 14, 0.95, 0.5, -1.6, 0x6a6a66, H), gCyl(0.54, 0.54, 0.2, 14, -0.95, 0.5, -1.6, 0x6a6a66, H),
    gCyl(0.38, 0.38, 0.12, 14, 0.95, 0.5, -3.32, 0x222222, H), gCyl(0.38, 0.38, 0.12, 14, -0.95, 0.5, -3.32, 0x222222, H),
    gBox(0.3, 0.05, 2.2, 1.15, 0.86, -0.4, 0xd9541e), gBox(0.3, 0.05, 2.2, -1.15, 0.86, -0.4, 0xd9541e), gBox(0.6, 0.05, 0.3, 0, 0.85, 1.6, 0xd9541e),
    gCyl(0.1, 0.1, 1.8, 8, 1.95, 0.45, 0.4, 0x3a3a3a, H), gCyl(0.1, 0.1, 1.8, 8, -1.95, 0.45, 0.4, 0x3a3a3a, H),
    gCyl(0.08, 0.08, 1.0, 6, 0, 1.0, -2.6, 0x3a3a3a, H), gBox(0.12, 0.5, 0.6, 0.6, 1.0, -2.3, 0xcfcfc8), gBox(0.12, 0.5, 0.6, -0.6, 1.0, -2.3, 0xcfcfc8),
  ]);
  SPEEDER_GLOW = mergeGeos([gCyl(0.33, 0.33, 0.06, 14, 0.95, 0.5, -3.4, 0xffffff, H), gCyl(0.33, 0.33, 0.06, 14, -0.95, 0.5, -3.4, 0xffffff, H)]);
  return SPEEDER_GEO;
}

class Speeder {
  constructor(mode, x, y, z, yaw) {
    // Geonosis: LAAT-Kanonenboot der Republik (größer, langsamer, robuster, transportiert Truppen)
    this.laat = MAP.id === 'geonosis'; this.label = this.laat ? 'Kanonenboot' : 'Schneegleiter';
    this.maxHp = this.laat ? 10 : 4; this.rad = this.laat ? 4.6 : 2.6; this.hc = new V3();
    this.type = 'speeder'; this.alive = true; this.hp = this.maxHp; this.mode = mode;
    this.home = new V3(x, y, z); this.homeYaw = yaw;
    this.pos = new V3(x, y, z); this.vel = new V3(); this.yaw = yaw; this.pitch = 0; this.roll = 0; this.speed = mode === 'parked' ? 0 : 45;
    this.fireCd = 0; this.gun = 0; this.respawnT = 0; this.smokeT = 0;
    this.ai = { target: null, state: 'approach', t: 0, retarget: 0 };
    this.tow = null;
    if (this.laat) { const g = laatGeos(); this.mesh = new THREE.Mesh(g.body, MAT.vehicle); this.mesh.add(new THREE.Mesh(g.glow, LAAT_GLOW_MAT())); }
    else { this.mesh = new THREE.Mesh(speederGeo(), MAT.vehicle); this.mesh.add(new THREE.Mesh(SPEEDER_GLOW, MAT.glow)); }
    this.mesh.rotation.order = 'YXZ';
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    G.dyn.add(this.mesh);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    this.cable = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x15171a })); this.cable.visible = false; this.cable.frustumCulled = false;
    G.dyn.add(this.cable);
    this.sync();
  }
  forward(out) { const cp = Math.cos(this.pitch); return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp); }
  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(-this.pitch, this.yaw, this.roll);
    this.mesh.visible = this.mode !== 'gone';
    this.mesh.updateMatrixWorld(true);
    this.hc.set(0, this.laat ? 2.4 : 0, 0).applyMatrix4(this.mesh.matrixWorld);
  }
  // Richtung ansteuern (wantYaw/wantPitch im Gleiter-System), mit begrenzter Drehrate
  fly(dt, wantYaw, wantPitch, speedTarget) {
    const dy = angDiff(this.yaw, wantYaw), turn = (this.laat ? 0.9 : 1.5) * dt;
    const yr = clamp(dy, -turn, turn);
    this.yaw += yr;
    this.pitch += clamp(wantPitch - this.pitch, -turn, turn);
    this.pitch = clamp(this.pitch, -0.7, 0.7);
    if (dt > 0) this.roll += (clamp(-yr / dt * 0.55, -1.1, 1.1) - this.roll) * Math.min(1, dt * 4);
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
      if (w.alive && Math.hypot(this.pos.x - w.pos.x, this.pos.z - w.pos.z) < 8.5 && this.pos.y < w.pos.y + 13) { this.damage(99); return; }
    }
    for (const w of G.atsts) if (w.alive && this.hc.distanceTo(w.spheres[0]) < w.spheres[0].r + this.rad * 0.6) { this.damage(99); w.damage(99, this.mode === 'player' || this.mode === 'remote' ? this.pilot : null); return; }
  }
  fire(dir, owner) {
    if (this.fireCd > 0) return;
    this.fireCd = this.laat ? 0.2 : 0.16; this.gun ^= 1;
    if (this.laat) _v1.set(this.gun ? 2.7 : -2.7, 2.2, 2.6).applyMatrix4(this.mesh.matrixWorld);   // Kugeltürme
    else _v1.set(this.gun ? 1.95 : -1.95, 0.4, 1.4).applyMatrix4(this.mesh.matrixWorld);
    _v2.copy(_v1).addScaledVector(dir, 200);
    fireBolt(4, REB, _v1, _v2, isHuman(owner) ? 0.002 : 0.02, owner);
  }
  damage(d, by) {
    if (!this.alive || this.mode === 'tow' || this.mode === 'parked' || this.mode === 'gone' || this.mode === 'crash') return;
    this.hp -= d;
    FX.sparks(this.pos, 6, 1, 0.7, 0.3);
    if (this.hp <= 0) {
      const wasPlayer = this.mode === 'player', wasRemote = this.mode === 'remote';
      if (isHuman(by)) G.creditKill(by);
      this.mode = 'crash'; this.alive = false;
      FX.explosion(this.hc, this.laat ? 4 : 2.5); SFX.boom(this.pos, this.laat ? 2.5 : 1.5);
      G.msg(wasPlayer ? `Dein ${this.label} wurde abgeschossen!` : `Ein ${this.label} wurde abgeschossen!`, 'speeder');
      if (wasPlayer) G.player.speederDestroyed();
      if (wasRemote && this.pilot) G.onRemoteDown(this.pilot, this.label + ' abgeschossen');
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
      a.destroy(T.prev === 'ai' ? null : this.pilot, true);
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
      const troops = G.imps.filter(s => s.alive);
      if (troops.length) opts.push(pick(troops), pick(troops));
      const atats = G.atats.filter(w => w.alive && !w.tangled);
      if (atats.length && (!opts.length || Math.random() < 0.3)) opts.push(pick(atats));
      A.target = opts.length ? pick(opts) : null;
      // Schleppkabel nur selten (sonst Beschuss mit Lasern)
      A.tow = !!A.target && A.target.type === 'atat' && G.time > 150 && Math.random() < 0.15;
      A.state = 'approach';
    }
    let wantYaw = this.yaw, wantPitch = 0.1;
    const t = A.target;
    if (t) {
      const isAtat = t.type === 'atat' && A.tow, strafeAtat = t.type === 'atat' && !A.tow;
      const tx = t.pos.x, tz = t.pos.z, ty = t.pos.y + (isAtat ? 6 : strafeAtat ? 17 : t.type === 'atst' ? t.aimY - 0.3 : 1);
      const dx = tx - this.pos.x, dz = tz - this.pos.z, dh = Math.hypot(dx, dz);
      if (A.state === 'approach') {
        const alt = dh > 220 ? Math.max(ty + 25, heightAt(this.pos.x, this.pos.z) + 25) : ty + (this.laat ? 14 : isAtat ? 0 : strafeAtat ? 8 : 2);
        wantYaw = Math.atan2(dx, dz);
        wantPitch = clamp(Math.atan2(alt - this.pos.y, Math.max(dh, 1)), -0.5, 0.5);
        if (isAtat && dh < 40 && Math.abs(this.pos.y - ty) < 10) { this.startTow(t); return; }
        _v1.set(dx, ty - this.pos.y, dz).normalize();
        if (!isAtat && dh < 230 && this.forward(_v2).dot(_v1) > 0.985) this.fire(_v1, this);
        if (dh < (this.laat ? 50 : isAtat ? 15 : strafeAtat ? 60 : 35)) { A.state = 'extend'; A.t = rand(2.5, 4); }
      } else {
        wantPitch = 0.25; A.t -= dt;
        if (A.t <= 0) A.state = 'approach';
      }
    } else {
      wantYaw = Math.atan2(-this.pos.x, -100 - this.pos.z); wantPitch = clamp((40 - this.pos.y) * 0.02, -0.3, 0.3);
    }
    if (this.pos.y - heightAt(this.pos.x, this.pos.z) < 10) wantPitch = Math.max(wantPitch, 0.25);
    if (Math.abs(this.pos.x) > 420 || this.pos.z < -820 || this.pos.z > 260) wantYaw = Math.atan2(-this.pos.x, -150 - this.pos.z);
    this.fly(dt, wantYaw, wantPitch, this.laat ? 34 : 48);
  }
  // Pose aus dem Netz, mit Vorausberechnung über die Geschwindigkeit
  updateNet(dt) {
    const n = this.net;
    this.mesh.visible = this.mode !== 'gone';
    if (n) {
      n.age = (n.age || 0) + dt;
      const tx = n.x + n.vx * n.age, ty = n.y + n.vy * n.age, tz = n.z + n.vz * n.age, k = Math.min(1, dt * 12);
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) > 40) this.pos.set(tx, ty, tz);
      else { this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k; }
      this.yaw += angDiff(this.yaw, n.yaw) * k; this.pitch += (n.pitch - this.pitch) * k; this.roll += (n.roll - this.roll) * k;
      this.vel.set(n.vx, n.vy, n.vz);
    }
    // Schleppkabel um die Beine des AT-AT
    const a = this.mode === 'tow' && this.netTow != null ? G.atats[this.netTow] : null;
    this.cable.visible = !!a;
    if (a) {
      const arr = this.cable.geometry.attributes.position.array, order = [0, 2, 3, 1, 0];
      let k = 0;
      for (let i = 0; i < 5; i++) { a.legWorld(order[i], _v1); _v1.y = a.pos.y + 6 + i * 0.4; arr[k++] = _v1.x; arr[k++] = _v1.y; arr[k++] = _v1.z; }
      for (let i = 5; i < 8; i++) { arr[k++] = this.pos.x; arr[k++] = this.pos.y; arr[k++] = this.pos.z; }
      this.cable.geometry.attributes.position.needsUpdate = true;
    }
    if (this.mode === 'crash') { this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.05; FX.smokeColumn(this.pos, 0.5); } }
    this.sync();
  }
  update(dt) {
    this.fireCd -= dt;
    if (this.puppet && (this.pilot !== G.player || this.mode === 'tow')) { this.updateNet(dt); return; }
    switch (this.mode) {
      case 'remote': this.checkCollide(); this.sync(); break;
      case 'ai': this.updateAI(dt); break;
      case 'tow': this.updateTow(dt); break;
      case 'crash': {
        this.vel.y -= 15 * dt; this.pos.addScaledVector(this.vel, dt);
        this.pitch = Math.max(-0.9, this.pitch - dt); this.roll += dt * 3;
        this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.05; FX.smokeColumn(this.pos, 0.5); }
        if (this.pos.y <= heightAt(this.pos.x, this.pos.z) + 0.5) {
          FX.explosion(this.pos, this.laat ? 5 : 3); SFX.boom(this.pos, 2);
          this.mode = 'gone'; this.respawnT = 25;
        }
        this.sync();
        break;
      }
      case 'gone':
        if (this.home && this.isPad) {
          this.respawnT -= dt;
          if (this.respawnT <= 0) { this.reset(); G.msg(this.laat ? 'Ein neues Kanonenboot steht an der Landezone bereit.' : 'Ein neuer Schneegleiter steht auf der Landeplattform bereit.', 'pad'); }
        }
        break;
    }
  }
  reset() {
    this.alive = true; this.hp = this.maxHp; this.mode = 'parked'; this.pos.copy(this.home); this.yaw = this.homeYaw;
    this.pitch = 0; this.roll = 0; this.speed = 0; this.vel.set(0, 0, 0); this.sync();
  }
}
