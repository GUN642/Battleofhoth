'use strict';
// ============================================================================
//  Battle of Hoth - Welt: Hilfsfunktionen, Gelände, Texturen, Materialien,
//  Himmel, Kulissen und Effekte
// ============================================================================

const TAU = Math.PI * 2;
const REB = 0, IMP = 1;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function smooth(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

// ---------------------------------------------------------------- Rauschen
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.25 + vnoise(x * 4.3, z * 4.3) * 0.125; }

// ---------------------------------------------------------------- Gelände
const WORLD = {
  size: 900,                                  // Gelände reicht von -size..size
  gen: new THREE.Vector3(0, 0, 190),          // Hoth: Schildgenerator, Endor: Bunkertor (Ziel des Imperiums)
  pad: new THREE.Vector3(45, 0, 62),           // Landeplattform der Schneegleiter
  hangar: new THREE.Vector3(-70, 0, 262),
};
const TR = { depth: 1.05, half: 1.25, berm: 0.3, bermW: 3.2, len: 175 };   // Schützengraben (Endor: Verteidigungslinie)

// ---------------------------------------------------------------- Karten
//  hoth  = Schneefeld mit Schützengraben vor dem Schildgenerator
//  endor = Wald des Mondes Endor, Rebellen verteidigen den Bunkereingang
//  geonosis = Wüste von Geonosis, Klonkrieger (Seite "Rebellen") gegen die Droidenarmee (Seite "Imperium")
const MAP_IDS = ['hoth', 'endor', 'geonosis'];
const MAP = { id: 'hoth', look: null, names: null };
// Bezeichnungen je Karte (HUD, Meldungen, Menü)
const MAP_NAMES = {
  hoth: { reb: 'Rebellen', imp: 'Imperium', troops: 'Sturmtruppen', walker: 'AT-ST', flyer: 'Schneegleiter', gen: 'Schildgenerator', turret: 'Geschützturm' },
  endor: { reb: 'Rebellen', imp: 'Imperium', troops: 'Sturmtruppen', walker: 'AT-ST', flyer: 'Schneegleiter', gen: 'Bunkertor', turret: 'Bunkergeschütz' },
  geonosis: { reb: 'Klonkrieger', imp: 'Droidenarmee', troops: 'Kampfdroiden', walker: 'AAT', flyer: 'Kanonenboot', gen: 'Kommandozentrale', turret: 'Geschützturm' },
};
const GEO = { cmd: new THREE.Vector3(0, 0, 175), pad: new THREE.Vector3(52, 0, 72) };
// Laserfarbe je Seite: Hoth/Endor Rebellen rot, Imperium grün; Geonosis Klone blau, Droiden rot
function boltCol(f) {
  if (MAP.id === 'geonosis') return f === REB ? [0.3, 0.55, 1] : [1, 0.35, 0.25];
  return f === REB ? [1, 0.35, 0.25] : [0.4, 1, 0.3];
}
const ENDOR = {
  bunker: { x: 0, z: 50, w: 26, d: 16, h: 6.4 },    // Vorderkante bei z, Tiefe nach +z
  lanes: [-56, -19, 19, 56],                         // Waldwege, auf denen die AT-STs anrücken
};
const SKY_COL = { zen: new THREE.Vector3(), hor: new THREE.Vector3(), gnd: new THREE.Vector3() };
const MAP_LOOK = {
  hoth: { sun: [-0.55, 0.62, 0.56], horizon: [0.62, 0.72, 0.84], zen: [0.10, 0.24, 0.58], gnd: [0.70, 0.75, 0.82], envGround: [0.75, 0.8, 0.88],
    sunCol: [1.0, 0.93, 0.82], sunI: 1.45, hemiSky: [0.55, 0.65, 0.85], hemiGnd: [0.55, 0.58, 0.62], hemi: 0.15, fog: [120, 1100], exposure: 0.9, dust: [1.1, 1.13, 1.18] },
  geonosis: { sun: [0.38, 0.42, -0.82], horizon: [0.8, 0.36, 0.11], zen: [0.46, 0.22, 0.08], gnd: [0.6, 0.27, 0.1], envGround: [0.5, 0.22, 0.08],
    sunCol: [1.0, 0.78, 0.52], sunI: 1.75, hemiSky: [0.85, 0.55, 0.35], hemiGnd: [0.55, 0.3, 0.16], hemi: 0.38, fog: [70, 600], exposure: 0.95, dust: [0.95, 0.55, 0.3] },
  endor: { sun: [-0.42, 0.8, 0.43], horizon: [0.26, 0.33, 0.31], zen: [0.22, 0.4, 0.66], gnd: [0.16, 0.2, 0.13], envGround: [0.12, 0.13, 0.07],
    sunCol: [1.0, 0.84, 0.62], sunI: 1.8, hemiSky: [0.5, 0.62, 0.5], hemiGnd: [0.24, 0.19, 0.11], hemi: 0.42, fog: [20, 270], exposure: 1.05, dust: [0.36, 0.29, 0.2] },
};
function setMap(id) {
  MAP.id = MAP_IDS.includes(id) ? id : 'hoth';
  MAP.names = MAP_NAMES[MAP.id];
  const L = MAP.look = MAP_LOOK[MAP.id];
  SUN_DIR.set(L.sun[0], L.sun[1], L.sun[2]).normalize();
  HORIZON.setRGB(L.horizon[0], L.horizon[1], L.horizon[2]);
  SKY_COL.zen.set(...L.zen); SKY_COL.hor.set(...L.horizon); SKY_COL.gnd.set(...L.gnd);
  if (MAP.id === 'endor') {
    WORLD.size = 640; TR.len = 70;
    const B = ENDOR.bunker; WORLD.gen.set(B.x, 0, B.z);
  } else if (MAP.id === 'geonosis') {
    WORLD.size = 800; TR.len = 120; WORLD.gen.copy(GEO.cmd); WORLD.pad.copy(GEO.pad);
  } else {
    WORLD.size = 900; TR.len = 175; WORLD.gen.set(0, 0, 190); WORLD.pad.set(45, 0, 62);
  }
  OBST.clear();
  buildHeightCache();
  WORLD.gen.y = MAP.id === 'endor' ? baseHeight(WORLD.gen.x, WORLD.gen.z - 1) : heightAt(WORLD.gen.x, WORLD.gen.z);
}

function trenchZ(x) {
  if (MAP.id === 'endor') return 6 + 2.5 * Math.sin(x * 0.045);
  if (MAP.id === 'geonosis') return 3 * Math.sin(x * 0.03) + 1.5 * Math.sin(x * 0.09 + 2);
  return 3.5 * Math.sin(x * 0.027) + 1.8 * Math.sin(x * 0.083 + 1.3);
}

// Endor: Waldboden mit Hügel, in den der Bunker gebaut ist
function endorHeightRaw(x, z) {
  let h = (fbm(x * 0.008 + 4, z * 0.008 + 7) - 0.45) * 9 + (vnoise(x * 0.06, z * 0.06) - 0.5) * 0.8;
  const ax = Math.abs(x);
  // Lichtung vor dem Bunker und an der Verteidigungslinie einebnen
  const bx = x - ENDOR.bunker.x, bz = z - (ENDOR.bunker.z - 12);
  h *= smooth(28, 75, Math.sqrt(bx * bx + bz * bz * 1.6));
  // Hügel hinter dem Bunker, Talränder
  let m = smooth(ENDOR.bunker.z - 1, ENDOR.bunker.z + 30, z) * 15 + smooth(ENDOR.bunker.z + 30, 220, z) * 28;
  m += smooth(230, 420, ax) * (35 + fbm(x * 0.01, z * 0.01) * 50);
  m += smooth(-430, -620, z) * 40;
  // Bunker selbst steht auf ebenem Grund
  const B = ENDOR.bunker;
  if (ax < B.w / 2 + 1 && z > B.z - 1 && z < B.z + B.d) m *= 0.0;
  return h + m;
}

// Geonosis: flache Wüste mit Dünen, Tafelbergen (Stufen) am Rand
function geonosisHeightRaw(x, z) {
  let h = (fbm(x * 0.006 + 3, z * 0.006 + 11) - 0.45) * 9 + Math.sin(x * 0.045 + fbm(x * 0.02, z * 0.02) * 4) * 0.7;
  const flat = (cx, cz, r0, r1) => smooth(r0, r1, Math.hypot(x - cx, z - cz));
  h *= flat(GEO.cmd.x, GEO.cmd.z, 30, 75) * flat(GEO.pad.x, GEO.pad.z, 22, 50);
  if (Math.abs(x) < TR.len + 20) h *= lerp(1, smooth(4, 30, Math.abs(z - trenchZ(x))), 0.8);
  const ax = Math.abs(x);
  let t = smooth(230, 330, ax) * (35 + fbm(x * 0.008, z * 0.008) * 60) + smooth(270, 420, z) * (40 + fbm(x * 0.01 + 4, z * 0.01) * 50)
    + smooth(-560, -720, z) * (30 + fbm(x * 0.01, 7) * 40);
  // Tafelberge: Höhe in Stufen mit steilen Kanten
  const S = 13, q = t / S, fl = Math.floor(q);
  t = (fl + smooth(0.72, 0.95, q - fl)) * S;
  return h + t;
}

function baseHeightRaw(x, z) {
  if (MAP.id === 'endor') return endorHeightRaw(x, z);
  if (MAP.id === 'geonosis') return geonosisHeightRaw(x, z);
  let h = (fbm(x * 0.006 + 10, z * 0.006 + 3) - 0.45) * 7;
  const ax = Math.abs(x);
  let m = 0;
  m += smooth(260, 540, ax) * (55 + fbm(x * 0.01, z * 0.01) * 95);
  m += smooth(255, 430, z) * (60 + fbm(x * 0.012 + 5, z * 0.012) * 90);
  m += smooth(-700, -880, z) * 80 * fbm(x * 0.01, 3);
  // felsiger Berg links neben der Basis
  const dx = x + 165, dz = z - 140, r = Math.sqrt(dx * dx + dz * dz);
  m += Math.pow(Math.max(0, 1 - r / 75), 1.4) * 48 * (0.6 + 0.7 * fbm(x * 0.05, z * 0.05));
  // Basis-Plateau einebnen (Generator, Landeplattform)
  const gdx = x - WORLD.gen.x, gdz = z - WORLD.gen.z;
  h *= smooth(22, 70, Math.sqrt(gdx * gdx + gdz * gdz));
  const pdx = x - WORLD.pad.x, pdz = z - WORLD.pad.z;
  h *= smooth(14, 40, Math.sqrt(pdx * pdx + pdz * pdz));
  return h + m;
}

// Höhengitter (2 m Raster) als Cache, weil Höhenabfragen sehr oft passieren
const HG = { step: 2, n: 0, data: null };
function buildHeightCache() {
  const n = Math.floor((WORLD.size * 2) / HG.step) + 1;
  HG.n = n; HG.data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -WORLD.size + j * HG.step;
    for (let i = 0; i < n; i++) HG.data[j * n + i] = baseHeightRaw(-WORLD.size + i * HG.step, z);
  }
}
function baseHeight(x, z) {
  const n = HG.n;
  let fx = (x + WORLD.size) / HG.step, fz = (z + WORLD.size) / HG.step;
  fx = clamp(fx, 0, n - 1.001); fz = clamp(fz, 0, n - 1.001);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, d = HG.data, k = j * n + i;
  return lerp(lerp(d[k], d[k + 1], tx), lerp(d[k + n], d[k + n + 1], tx), tz);
}
function trenchProfile(d) {             // d = Abstand zur Grabenmitte (negativ = Richtung Imperium)
  const H = TR.half, D = TR.depth;
  if (d > -H && d < H) return -D;
  if (d >= H) return d < H + 0.6 ? -D * (1 - (d - H) / 0.6) : 0;
  const e = -d - H;
  if (e < 0.5) return lerp(-D, TR.berm, e / 0.5);
  if (e < 0.5 + TR.bermW) return TR.berm * (1 - smooth(0, 1, (e - 0.5) / TR.bermW));
  return 0;
}
function trenchFactor(x) { return 1 - smooth(TR.len, TR.len + 8, Math.abs(x)); }
function heightAt(x, z) {
  let h = baseHeight(x, z);
  if (MAP.id === 'endor') { const r = bunkerRoofAt(x, z); return r > h ? r : h; }   // Bunkerdach ist begehbar
  if (MAP.id === 'hoth' && Math.abs(x) < TR.len + 8) {
    const d = z - trenchZ(x);
    if (d > -6 && d < 3) h += trenchProfile(d) * trenchFactor(x);
  }
  return h;
}
// Sichtlinie über das Gelände (true = frei)
function lineOfSight(a, b) {
  const steps = 14;
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (heightAt(x, z) > y + 0.05) return false;
  }
  return !OBST.n || OBST.seg(a.x, a.y, a.z, b.x - a.x, b.y - a.y, b.z - a.z) > 1;
}

// ---------------------------------------------------------------- Hindernisse (Endor: Baumstämme, Stämme am Boden, Bunker)
//  Senkrechte Zylinder (x, z, r, Fuß y0, Höhe h) in einem Raster für schnelle Abfragen.
const OBST = {
  cell: 16, n: 0, list: [], grid: new Map(), stamp: 0, boxes: [],
  clear() { this.list = []; this.grid.clear(); this.n = 0; this.boxes = []; },
  key(i, j) { return i * 4096 + j; },
  add(x, z, r, y0, h, side) {
    const o = { x, z, r, y0, h, s: 0, side: side || (this.n % 2 ? 1 : -1) };
    this.list.push(o); this.n++;
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const k = this.key(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(o);
      }
    return o;
  },
  // Quader (Bunker): x0..x1, z0..z1, Höhe y0..y1
  addBox(x0, x1, z0, z1, y0, y1) { this.boxes.push({ x0, x1, z0, z1, y0, y1 }); },
  // Segment p0 + t*d (t 0..1) gegen alle Hindernisse; kleinstes t oder 2
  seg(x0, y0, z0, dx, dy, dz) {
    let best = 2;
    for (const b of this.boxes) { const t = segBox(x0, y0, z0, dx, dy, dz, b); if (t >= 0 && t < best) best = t; }
    if (!this.n) return best;
    const c = this.cell, st = ++this.stamp;
    let i = Math.floor(x0 / c), j = Math.floor(z0 / c);
    const i1 = Math.floor((x0 + dx) / c), j1 = Math.floor((z0 + dz) / c);
    const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(c / dx) : 1e9, tdz = dz !== 0 ? Math.abs(c / dz) : 1e9;
    let tmx = dx !== 0 ? ((dx > 0 ? (i + 1) * c : i * c) - x0) / dx : 1e9;
    let tmz = dz !== 0 ? ((dz > 0 ? (j + 1) * c : j * c) - z0) / dz : 1e9;
    const l2 = dx * dx + dz * dz;
    for (let guard = 0; guard < 200; guard++) {
      const a = this.grid.get(this.key(i, j));
      if (a) for (const o of a) {
        if (o.s === st) continue; o.s = st;
        let t = l2 > 1e-9 ? ((o.x - x0) * dx + (o.z - z0) * dz) / l2 : 0;
        // Eintrittspunkt in den Kreis
        const px = x0 + dx * t - o.x, pz = z0 + dz * t - o.z, d2 = px * px + pz * pz;
        if (d2 > o.r * o.r) continue;
        if (l2 > 1e-9) t -= Math.sqrt((o.r * o.r - d2) / l2);
        t = Math.max(0, t);
        if (t > 1 || t >= best) continue;
        const y = y0 + dy * t;
        if (y < o.y0 - 0.3 || y > o.y0 + o.h) continue;
        best = t;
      }
      if (i === i1 && j === j1) break;
      if (tmx < tmz) { if (tmx > 1) break; tmx += tdx; i += si; } else { if (tmz > 1) break; tmz += tdz; j += sj; }
    }
    return best;
  },
  // Kreis (Spieler, Soldat, Läufer) aus Hindernissen schieben; seitlich gleiten, damit niemand hängen bleibt
  push(pos, rad) {
    let hit = false;
    for (const b of this.boxes) {
      if (pos.y > b.y1 - 0.2) continue;
      const cx = clamp(pos.x, b.x0, b.x1), cz = clamp(pos.z, b.z0, b.z1);
      let dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= rad) continue;
      hit = true;
      if (d > 1e-4) { pos.x = cx + dx / d * rad; pos.z = cz + dz / d * rad; }
      else pos.z = b.z0 - rad;          // steckt drin: nach vorne raus
    }
    if (!this.n) return hit;
    const c = this.cell, a = this.grid.get(this.key(Math.floor(pos.x / c), Math.floor(pos.z / c)));
    if (!a) return hit;
    for (const o of a) {
      if (pos.y > o.y0 + o.h - 0.25) continue;
      const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), R = o.r + rad;
      if (d >= R || d < 1e-4) continue;
      hit = true;
      pos.x = o.x + dx / d * R + (-dz / d) * 0.06 * o.side;
      pos.z = o.z + dz / d * R + (dx / d) * 0.06 * o.side;
    }
    return hit;
  },
};
function segBox(x0, y0, z0, dx, dy, dz, b) {
  let t0 = 0, t1 = 1;
  const ax = [[x0, dx, b.x0, b.x1], [y0, dy, b.y0, b.y1], [z0, dz, b.z0, b.z1]];
  for (const [o, d, lo, hi] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let a = (lo - o) / d, c = (hi - o) / d;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    if (t0 > t1) return -1;
  }
  return t0;
}
// Ziel des Imperiums (Schildgenerator bzw. Bunker): Treffer-Parameter eines Segments oder -1
function genSeg(x0, y0, z0, dx, dy, dz) {
  if (MAP.id === 'endor') {
    const B = ENDOR.bunker, y = WORLD.gen.y;
    return segBox(x0, y0, z0, dx, dy, dz, { x0: B.x - B.w / 2, x1: B.x + B.w / 2, y0: y - 1, y1: y + B.h, z0: B.z - 0.3, z1: B.z + B.d });
  }
  const c = WORLD.gen, l2 = dx * dx + dy * dy + dz * dz, r = 14.5;
  const t = clamp(((c.x - x0) * dx + (c.y - y0) * dy + (c.z - z0) * dz) / l2, 0, 1);
  const px = x0 + dx * t - c.x, py = y0 + dy * t - c.y, pz = z0 + dz * t - c.z;
  return px * px + py * py + pz * pz < r * r ? t : -1;
}
// Spieler/Einheiten aus Generator bzw. Bunker und Hindernissen schieben
function pushOutWorld(pos, rad) {
  let hit = false;
  if (MAP.id !== 'endor') {
    const dx = pos.x - WORLD.gen.x, dz = pos.z - WORLD.gen.z, d = Math.hypot(dx, dz), R = 14 + rad;
    if (d < R && d > 0.001) { pos.x = WORLD.gen.x + dx / d * R; pos.z = WORLD.gen.z + dz / d * R; hit = true; }
  }
  return OBST.push(pos, rad) || hit;
}

// ---------------------------------------------------------------- Farben & Texturen
// Farben werden als sRGB angegeben und linear gerechnet (physikalisch korrektes Licht)
THREE.ColorManagement.legacyMode = false;
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const HORIZON = new THREE.Color().setRGB(0.62, 0.72, 0.84);   // linear
function srgb2lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

// kachelbares Rauschen (Periode p) für Texturen
function tnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function tfbm(x, y, p, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { s += tnoise(x * f, y * f, p * f) * a; a *= 0.5; f *= 2; }
  return s;
}
function dataTexture(size, fn, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  fn(img.data, size);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  return t;
}
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}

const TEX = {};
function buildTextures() {
  const S = 256, P = 8;
  // Schnee: Höhenfeld -> Farbe + Normalen
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tfbm(x / S * P, y / S * P, P, 5);
    const drift = tnoise(x / S * 3 + n * 0.8, y / S * 3, 3);
    hgt[y * S + x] = n * 0.7 + drift * 0.5;
  }
  TEX.snow = dataTexture(S, (d) => {
    for (let i = 0; i < S * S; i++) {
      const v = 222 + (hgt[i] - 0.5) * 70 + (Math.random() - 0.5) * 8;
      d[i * 4] = v - 6; d[i * 4 + 1] = v - 2; d[i * 4 + 2] = Math.min(255, v + 8); d[i * 4 + 3] = 255;
    }
  }, true);
  TEX.snowN = dataTexture(S, (d) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const h = (xx, yy) => hgt[((yy + S) % S) * S + ((xx + S) % S)];
      let nx = (h(x - 1, y) - h(x + 1, y)) * 3.0, ny = (h(x, y - 1) - h(x, y + 1)) * 3.0;
      nx += (Math.random() - 0.5) * 0.15; ny += (Math.random() - 0.5) * 0.15;   // Glitzer-Körnung
      const l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }, false);
  // Paneele für Fahrzeuge und Gebäude
  TEX.panel = canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#d4d6da'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; ctx.fillRect(Math.random() * s, Math.random() * s, rand(2, 14), rand(2, 14)); }
    const panels = (x, y, w, h, depth) => {
      if (depth > 3 || (depth > 2 && Math.random() < 0.4)) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rand(0.02, 0.09)})`;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = 'rgba(40,42,48,0.38)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + 2); ctx.stroke();
        if (w > 30 && Math.random() < 0.5) {
          ctx.fillStyle = 'rgba(30,30,35,0.5)';
          for (const [px, py] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) { ctx.beginPath(); ctx.arc(px, py, 1.3, 0, TAU); ctx.fill(); }
        }
        if (Math.random() < 0.15) { ctx.fillStyle = 'rgba(30,32,36,0.45)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 6, y + 6 + k * 5, w * 0.4, 2); }
        return;
      }
      if (w > h) { const c = w * rand(0.3, 0.7); panels(x, y, c, h, depth + 1); panels(x + c, y, w - c, h, depth + 1); }
      else { const c = h * rand(0.3, 0.7); panels(x, y, w, c, depth + 1); panels(x, y + c, w, h - c, depth + 1); }
    };
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) panels(x * 256, y * 256, 256, 256, 1);
    // Schmutzschlieren
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(60,55,50,${rand(0.02, 0.06)})`; ctx.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(20, 90)); }
  });
  TEX.panel.wrapS = TEX.panel.wrapT = THREE.RepeatWrapping; TEX.panel.anisotropy = 4;
  // Endor: Waldboden (Nadeln, Erde, Moos) als Höhenfeld -> Farbe + Normalen
  const fh = new Float32Array(S * S), moss = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tfbm(x / S * P * 2, y / S * P * 2, P * 2, 4);
    fh[y * S + x] = n * 0.6 + Math.random() * 0.4;
    moss[y * S + x] = smooth(0.45, 0.62, tfbm(x / S * 4 + 3, y / S * 4, 4, 4));
  }
  // Nadeln/Zweige als kurze Striche
  const needles = new Float32Array(S * S);
  for (let k = 0; k < 2600; k++) {
    let x = Math.random() * S, y = Math.random() * S; const a = Math.random() * TAU, l = rand(3, 9), v = rand(0.3, 1);
    for (let t = 0; t < l; t++) { const i = ((Math.floor(y) + S) % S) * S + ((Math.floor(x) + S) % S); needles[i] = Math.max(needles[i], v); x += Math.cos(a); y += Math.sin(a); }
  }
  TEX.forest = dataTexture(S, (d) => {
    for (let i = 0; i < S * S; i++) {
      const h = fh[i], m = moss[i], nd = needles[i];
      let r = 74 + h * 46, g = 54 + h * 32, b = 36 + h * 18;                 // Erde
      r = lerp(r, 58 + h * 30, m * 0.8); g = lerp(g, 74 + h * 38, m * 0.8); b = lerp(b, 34 + h * 14, m * 0.8);   // Moos
      r = lerp(r, 128, nd * 0.45); g = lerp(g, 78, nd * 0.45); b = lerp(b, 46, nd * 0.45);     // rötliche Nadeln
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }, true);
  TEX.forestN = dataTexture(S, (d) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const h = (xx, yy) => { const k = ((yy + S) % S) * S + ((xx + S) % S); return fh[k] + needles[k] * 0.8; };
      const nx = (h(x - 1, y) - h(x + 1, y)) * 2.2, ny = (h(x, y - 1) - h(x, y + 1)) * 2.2;
      const l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }, false);
  // Geonosis: rötlicher Sand mit Windrippeln und Geröll
  const sh2 = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tfbm(x / S * P, y / S * P, P, 4);
    const rip = Math.sin((y / S * 24 + n * 3.5) * TAU) * 0.5 + 0.5;
    sh2[y * S + x] = n * 0.6 + rip * 0.25 + (Math.random() < 0.012 ? 0.5 : 0);
  }
  TEX.sand = dataTexture(S, (d) => {
    for (let i = 0; i < S * S; i++) {
      const h = sh2[i], v = (Math.random() - 0.5) * 10;
      d[i * 4] = 200 + h * 40 + v; d[i * 4 + 1] = 126 + h * 30 + v; d[i * 4 + 2] = 78 + h * 20 + v; d[i * 4 + 3] = 255;
    }
  }, true);
  TEX.sandN = dataTexture(S, (d) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const h = (xx, yy) => sh2[((yy + S) % S) * S + ((xx + S) % S)];
      const nx = (h(x - 1, y) - h(x + 1, y)) * 2.5, ny = (h(x, y - 1) - h(x, y + 1)) * 2.5;
      const l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }, false);
  // Rinde der Mammutbäume: senkrechte Faserstreifen
  TEX.bark = canvasTex(256, (ctx, s2) => {
    ctx.fillStyle = '#8a5a3e'; ctx.fillRect(0, 0, s2, s2);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * s2, w = rand(1, 7), l = rand(40, 256), y = Math.random() * s2;
      ctx.fillStyle = Math.random() < 0.55 ? `rgba(40,22,14,${rand(0.15, 0.45)})` : `rgba(190,130,95,${rand(0.08, 0.25)})`;
      ctx.fillRect(x, y, w, l); ctx.fillRect(x, y - s2, w, l);
    }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(20,12,8,${rand(0.3, 0.6)})`; ctx.fillRect(Math.random() * s2, Math.random() * s2, rand(1, 2.5), rand(60, 200)); }
  });
  TEX.bark.wrapS = TEX.bark.wrapT = THREE.RepeatWrapping; TEX.bark.anisotropy = 4;
  TEX.scorch = canvasTex(128, (ctx, s) => {
    const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(18,16,15,0.95)'); gr.addColorStop(0.45, 'rgba(40,36,34,0.7)'); gr.addColorStop(1, 'rgba(60,60,64,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), r = rand(20, 60);
      ctx.fillStyle = `rgba(25,22,20,${rand(0.1, 0.4)})`; ctx.beginPath(); ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rand(2, 7), 0, TAU); ctx.fill();
    }
  });
}

// ---------------------------------------------------------------- Materialien
const MAT = {};
function buildMaterials() {
  MAT.vehicle = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.panel, roughness: 0.62, metalness: 0.2, envMapIntensity: 0.75 });
  MAT.building = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.panel, roughness: 0.7, metalness: 0.2, envMapIntensity: 0.7 });
  MAT.soldier = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05, envMapIntensity: 0.6 });
  MAT.rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true, envMapIntensity: 0.35 });
  MAT.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.snow, normalMap: TEX.snowN, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.82, metalness: 0, envMapIntensity: 0.5 });
  MAT.gun = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.panel, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.45 });
  MAT.forest = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.forest, normalMap: TEX.forestN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, metalness: 0, envMapIntensity: 0.4 });
  MAT.sand = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.sand, normalMap: TEX.sandN, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.9, metalness: 0, envMapIntensity: 0.45 });
  MAT.bark = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.bark, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
  MAT.leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.4 });
  MAT.glow = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(6, 2.2, 0.6), toneMapped: true });
  // Einfache Lambert-Varianten für die Grafikstufe "Niedrig" (schwache Handys)
  for (const k of ['vehicle', 'building', 'soldier', 'rock', 'terrain', 'gun', 'forest', 'bark', 'leaf', 'sand']) {
    const m = MAT[k];
    MAT_HI[k] = m;
    MAT_LO[k] = new THREE.MeshLambertMaterial({ vertexColors: true, map: m.map, flatShading: m.flatShading, side: m.side });
  }
}
const MAT_HI = {}, MAT_LO = {};
function setMaterialQuality(scene, low) {
  const src = low ? MAT_LO : MAT_HI, swap = new Map();
  for (const k in src) { swap.set(MAT_HI[k], src[k]); swap.set(MAT_LO[k], src[k]); MAT[k] = src[k]; }
  scene.traverse(o => { if (o.material && swap.has(o.material)) o.material = swap.get(o.material); });
}

function buildTerrainMesh() {
  const rows = [], cols = [];
  for (let v = -WORLD.size; v < -80; v += 14) rows.push(v);
  for (let v = -80; v < -6; v += 2) rows.push(v);
  for (let v = -6; v < 3; v += 0.25) rows.push(v);
  for (let v = 3; v < 80; v += 2) rows.push(v);
  for (let v = 80; v <= WORLD.size; v += 14) rows.push(v);
  for (let x = -WORLD.size; x < -240; x += 12) cols.push(x);
  for (let x = -240; x < 240; x += 4) cols.push(x);
  for (let x = 240; x <= WORLD.size; x += 12) cols.push(x);
  const nr = rows.length, nc = cols.length;
  const pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3), uv = new Float32Array(nr * nc * 2);
  const trenchMask = new Float32Array(nr * nc);
  for (let j = 0; j < nr; j++) {
    const v = rows[j], w = 1 - smooth(30, 80, Math.abs(v));
    for (let i = 0; i < nc; i++) {
      const x = cols[i], z = v + trenchZ(x) * w, k = j * nc + i;
      pos[k * 3] = x; pos[k * 3 + 1] = heightAt(x, z); pos[k * 3 + 2] = z;
      uv[k * 2] = x / 6; uv[k * 2 + 1] = z / 6;
      trenchMask[k] = (v > -2.2 && v < 2.0) ? trenchFactor(x) : 0;
    }
  }
  const idx = new Uint32Array((nr - 1) * (nc - 1) * 6);
  let p = 0;
  for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nc - 1; i++) {
    const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const nrm = g.attributes.normal.array;
  for (let k = 0; k < nr * nc; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const n = (vnoise(x * 0.05, z * 0.05) - 0.5) * 0.06 + (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.03;
    let r = 0.92 + n, gg = 0.94 + n, b = 0.98 + n * 0.5;
    const ny = nrm[k * 3 + 1];
    const rock = y > 10 ? smooth(0.8, 0.55, ny) * (0.6 + 0.4 * vnoise(x * 0.1, z * 0.1)) : 0;
    r = lerp(r, 0.42, rock); gg = lerp(gg, 0.45, rock); b = lerp(b, 0.5, rock);
    const t = trenchMask[k];
    r -= t * 0.2; gg -= t * 0.18; b -= t * 0.12;                 // aufgewühlter Schnee im Graben
    col[k * 3] = srgb2lin(clamp(r, 0, 1)); col[k * 3 + 1] = srgb2lin(clamp(gg, 0, 1)); col[k * 3 + 2] = srgb2lin(clamp(b, 0, 1));
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, MAT.terrain);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- Geometrie-Helfer
function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function gBox(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(x, y, z); return paint(g, color);
}
function gCyl(rt, rb, h, seg, x, y, z, color, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz);
  g.translate(x, y, z); return paint(g, color);
}
function gSph(r, x, y, z, color, sx = 1, sy = 1, sz = 1, seg = 12, half = false) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1), 0, TAU, 0, half ? Math.PI / 2 : Math.PI);
  g.scale(sx, sy, sz); g.translate(x, y, z); return paint(g, color);
}
function gCap(r, len, x, y, z, color, rx = 0, rz = 0, sx = 1, sz = 1) {
  const g = new THREE.CapsuleGeometry(r, len, 3, 10);
  g.scale(sx, 1, sz);
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz);
  g.translate(x, y, z); return paint(g, color);
}
// Profil (2D-Punkte) extrudieren. axis 'z': Profil in x/y, Tiefe entlang z.
// axis 'x': Profil als Seitenansicht (u = vorne/z, v = oben/y), Breite entlang x.
function gProfile(pts, depth, axis, color, x, y, z, bevel = 0) {
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  if (axis === 'x') g.rotateY(-Math.PI / 2);
  g.translate(x, y, z); return paint(g, color);
}
// Zusammenführen + gleichmäßige Box-Projektion der Texturkoordinaten (Paneel-Textur ~2,4 m)
function mergeGeos(list, texScale = 1 / 6) {
  let total = 0;
  const parts = list.map(g => { const ng = g.index ? g.toNonIndexed() : g; total += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  for (let i = 0; i < total; i++) {
    const ax = Math.abs(nrm[i * 3]), ay = Math.abs(nrm[i * 3 + 1]), az = Math.abs(nrm[i * 3 + 2]);
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (ax >= ay && ax >= az) { uv[i * 2] = z * texScale; uv[i * 2 + 1] = y * texScale; }
    else if (ay >= az) { uv[i * 2] = x * texScale; uv[i * 2 + 1] = z * texScale; }
    else { uv[i * 2] = x * texScale; uv[i * 2 + 1] = y * texScale; }
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.computeBoundingSphere();
  return m;
}
function vcMesh(list, mat) {
  const m = new THREE.Mesh(mergeGeos(list), mat || MAT.vehicle);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function shadowify(obj) { obj.traverse(o => { if (o.isMesh && o.material !== MAT.glow) { o.castShadow = true; o.receiveShadow = true; } }); return obj; }

// ---------------------------------------------------------------- Himmel & Kulisse
const SKY_SHADER = {
  uniforms: { sunDir: { value: SUN_DIR }, desat: { value: 0 } },
  vertexShader: `varying vec3 vDir;
    void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 sunDir; uniform float desat; uniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 zenith = zen, horizon = hor, ground = gnd;
      vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
      col = mix(col, ground, smoothstep(0.0, -0.08, h));
      float s = max(dot(d, sunDir), 0.0);
      col += vec3(1.0, 0.86, 0.66) * (pow(s, 6.0) * 0.18 + pow(s, 60.0) * 0.55);
      col += vec3(30.0, 26.0, 20.0) * smoothstep(0.9993, 0.9997, s) * (1.0 - desat);
      col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.97, 1.08), desat);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
};
function skyMesh(radius, desat = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR }, desat: { value: desat }, zen: { value: SKY_COL.zen }, hor: { value: SKY_COL.hor }, gnd: { value: SKY_COL.gnd } }, vertexShader: SKY_SHADER.vertexShader, fragmentShader: SKY_SHADER.fragmentShader,
    side: THREE.BackSide, depthWrite: false,
  }));
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}
// Umgebungs-Reflexionen (PBR) aus dem Himmel erzeugen
function buildEnvironment(renderer, scene) {
  const env = new THREE.Scene();
  const sky = skyMesh(100, 0.6); env.add(sky);
  const gc = MAP.look.envGround;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(gc[0], gc[1], gc[2]) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -5; env.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  if (scene.environment) scene.environment.dispose();
  scene.environment = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  sky.geometry.dispose(); sky.material.dispose(); ground.geometry.dispose(); ground.material.dispose();
}

function buildSky(scene) {
  scene.add(skyMesh(2400));
  if (MAP.id === 'geonosis') { buildGeonosisSky(scene); return; }
  if (MAP.id !== 'hoth') return;
  const cloudTex = canvasTex(256, (ctx) => {
    for (let i = 0; i < 26; i++) {
      const x = rand(50, 206), y = rand(100, 170), r = rand(22, 60);
      const gr = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.6, 'rgba(238,243,250,0.45)'); gr.addColorStop(1, 'rgba(220,230,242,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  });
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, opacity: rand(0.55, 0.9), color: new THREE.Color().setRGB(1.25, 1.27, 1.32) }));
    const a = rand(0, TAU), d = rand(1300, 1900);
    s.position.set(Math.sin(a) * d, rand(250, 650), Math.cos(a) * d);
    const sc = rand(600, 1100); s.scale.set(sc, sc * 0.55, 1);
    s.renderOrder = -9;
    scene.add(s);
  }
  // Sternzerstörer (im Dunst)
  const sh = new THREE.Shape();
  sh.moveTo(0, 160); sh.lineTo(70, -110); sh.lineTo(-70, -110); sh.lineTo(0, 160);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 14, bevelEnabled: true, bevelThickness: 6, bevelSize: 4, bevelSegments: 1 });
  hull.rotateX(-Math.PI / 2); paint(hull, 0xc3cad3);
  const sd = mergeGeos([hull,
    gBox(56, 12, 60, 0, 24, -70, 0xb6bec8), gBox(30, 14, 24, 0, 37, -84, 0xaab2bc),
    gBox(58, 5, 9, 0, 47, -90, 0xb2bac4), gSph(4.5, -17, 51, -90, 0xa0a8b2), gSph(4.5, 17, 51, -90, 0xa0a8b2),
    gBox(6, 3, 30, 0, 18, 40, 0x9aa2ac)], 1 / 30);
  const sdMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.panel, roughness: 0.6, metalness: 0.3, fog: false, transparent: true, opacity: 0.82 });
  [[-380, 560, -1500, 1.0, 0.3], [520, 700, -1800, 0.8, -0.2]].forEach(([x, y, z, s, r]) => {
    const m = new THREE.Mesh(sd, sdMat);
    m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(-0.08, r, 0.04);
    m.renderOrder = -8;
    scene.add(m);
  });
}

function buildBaseProps(scene) {
  const group = new THREE.Group();
  // Schildgenerator
  const gy = heightAt(WORLD.gen.x, WORLD.gen.z);
  const gen = vcMesh([gSph(14, 0, 0, 0, 0xaab0b8, 1, 1, 1, 36, true),
    gCyl(14.8, 15.4, 1.4, 36, 0, 0.4, 0, 0x5f656d), gCyl(14.3, 14.3, 0.4, 36, 0, 4.5, 0, 0x7a8088),
    gCyl(2.2, 3.2, 6, 16, 0, 16, 0, 0x7d838a), gCyl(6.5, 0.8, 2.2, 24, 0, 19.6, 0, 0xb4bac1), gCyl(0.3, 0.3, 4, 8, 0, 21.5, 0, 0x50565e),
    gBox(1.4, 7, 1, 4.5, 12.5, 7, 0x6d737b), gBox(1.4, 7, 1, -4.5, 12.5, 7, 0x6d737b), gBox(5, 3, 4, 0, 1.5, 15, 0x50565e)], MAT.building);
  gen.position.set(WORLD.gen.x, gy - 0.5, WORLD.gen.z);
  group.add(gen);
  WORLD.gen.y = gy;

  // Hangar von Echo Base
  const hy = heightAt(WORLD.hangar.x, WORLD.hangar.z);
  const hangar = vcMesh([
    gBox(46, 20, 26, 0, 10, 0, 0xd2d6db), gBox(36, 13, 1, 0, 6.5, -13.2, 0x24272c),
    gBox(48, 2, 28, 0, 20.5, 0, 0xb8bcc2), gBox(4, 20, 2, -21, 10, -13.5, 0xa9adb3), gBox(4, 20, 2, 21, 10, -13.5, 0xa9adb3),
    gBox(30, 1, 1, 0, 13.8, -13.6, 0xe0a030), gBox(10, 4, 8, -14, 22, 4, 0x9aa0a6), gCyl(3, 3, 1, 16, 12, 22, 4, 0x8a9096),
  ], MAT.building);
  hangar.position.set(WORLD.hangar.x, hy - 2, WORLD.hangar.z);
  group.add(hangar);

  // Ionenkanone
  const ion = vcMesh([gSph(9, 0, 12, 0, 0xa8aeb5, 1, 1, 1, 24), gCyl(4, 6, 8, 18, 0, 3, 0, 0x8a9097), gCyl(9.5, 9.5, 1, 24, 0, 12, 0, 0x6e747b),
    gCyl(1.4, 1.4, 14, 12, 0, 21, 5, 0x6e747b, 0.7)], MAT.building);
  ion.position.set(110, heightAt(110, 240) - 0.5, 240);
  group.add(ion);

  // Landeplattform mit Leuchtstreifen
  const py = heightAt(WORLD.pad.x, WORLD.pad.z);
  const pad = vcMesh([gCyl(16, 16.5, 0.6, 40, 0, 0.1, 0, 0x7c828a), gCyl(13, 13, 0.62, 40, 0, 0.12, 0, 0x9aa0a8),
    gBox(1, 0.64, 26, 0, 0.12, 0, 0xd9541e), gBox(26, 0.64, 1, 0, 0.12, 0, 0xd9541e)], MAT.building);
  pad.position.set(WORLD.pad.x, py, WORLD.pad.z);
  group.add(pad);
  const lights = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; lights.push(gCyl(0.25, 0.25, 0.2, 8, Math.cos(a) * 15.3, 0.45, Math.sin(a) * 15.3, 0xffffff)); }
  const pl = new THREE.Mesh(mergeGeos(lights), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 2.4, 0.6) }));
  pl.position.copy(pad.position); group.add(pl);

  // Kisten, Stromverteiler, Radarschüsseln entlang des Grabens
  const crates = [];
  for (let i = 0; i < 46; i++) {
    const x = rand(-TR.len + 5, TR.len - 5), z = trenchZ(x) + rand(3.5, 14);
    const y = heightAt(x, z), s = rand(0.7, 1.2);
    crates.push(gBox(1.1 * s, 0.8 * s, 0.9 * s, x, y + 0.35 * s, z, Math.random() < 0.5 ? 0x4a4f57 : 0x6a6f77, 0, rand(0, 3)));
  }
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 60 + rand(-10, 10), z = trenchZ(x) + rand(22, 40), y = heightAt(x, z);
    crates.push(gCyl(0.25, 0.4, 2.2, 8, x, y + 1.1, z, 0x6a7077));
    crates.push(gCyl(1.6, 0.2, 0.7, 18, x, y + 2.4, z + 0.3, 0xc5cbd2, -0.7));
  }
  group.add(vcMesh(crates, MAT.building));

  // Felsen
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const x = rand(-320, 320), z = rand(-650, -40);
    if (Math.abs(z - trenchZ(x)) < 20) continue;
    const s = rand(1, 4.5), g = new THREE.DodecahedronGeometry(s, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const f = 0.75 + 0.5 * hash2(p.getX(k) * 3 + i, p.getZ(k) * 3); p.setXYZ(k, p.getX(k) * f, p.getY(k) * f, p.getZ(k) * f); }
    g.scale(1, rand(0.4, 0.8), 1); g.translate(x, heightAt(x, z) + s * 0.05, z);
    rocks.push(paint(g, Math.random() < 0.6 ? 0x6f767f : 0xe8eef5));
  }
  group.add(vcMesh(rocks, MAT.rock));
  scene.add(group);
}

// ---------------------------------------------------------------- Partikel (HDR, ein Draw-Call pro System)
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.seed = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.aSeed = new THREE.BufferAttribute(new Float32Array(max), 1);
    [this.aPos, this.aCol, this.aSize, this.aAlpha, this.aSeed].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol);
    g.setAttribute('psize', this.aSize); g.setAttribute('palpha', this.aAlpha); g.setAttribute('pseed', this.aSeed);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; attribute float pseed; uniform float scale;
        varying vec3 vC; varying float vA; varying float vS;
        void main(){ vC=pcolor; vA=palpha; vS=pseed; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = clamp(psize*scale/max(0.1,-mv.z), 1.0, 900.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; varying float vS;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + vS*91.7) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0;
          float puff = n(c*5.0+vS*7.0)*0.6 + n(c*11.0-vS*3.0)*0.4;
          float a = smoothstep(1.0, 0.25, d + (puff-0.5)*0.55);
          if (a <= 0.0) discard;
          gl_FragColor = vec4(vC * (0.75 + puff*0.5), a*vA);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
    this.life[i] = this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.grav[i] = grav; this.drag[i] = drag; this.seed[i] = Math.random();
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
  copy(dst, src) {
    for (let k = 0; k < 3; k++) { this.p[dst * 3 + k] = this.p[src * 3 + k]; this.v[dst * 3 + k] = this.v[src * 3 + k]; this.c[dst * 3 + k] = this.c[src * 3 + k]; }
    this.life[dst] = this.life[src]; this.maxLife[dst] = this.maxLife[src]; this.s0[dst] = this.s0[src]; this.s1[dst] = this.s1[src];
    this.a0[dst] = this.a0[src]; this.grav[dst] = this.grav[src]; this.drag[dst] = this.drag[src]; this.seed[dst] = this.seed[src];
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.n--; if (i !== this.n) this.copy(i, this.n); continue; }
      const f = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= f; this.v[i * 3 + 1] = this.v[i * 3 + 1] * f - this.grav[i] * dt; this.v[i * 3 + 2] *= f;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      i++;
    }
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array, A = this.aAlpha.array, SE = this.aSeed.array;
    for (let j = 0; j < this.n; j++) {
      const t = 1 - this.life[j] / this.maxLife[j];
      P[j * 3] = this.p[j * 3]; P[j * 3 + 1] = this.p[j * 3 + 1]; P[j * 3 + 2] = this.p[j * 3 + 2];
      C[j * 3] = this.c[j * 3]; C[j * 3 + 1] = this.c[j * 3 + 1]; C[j * 3 + 2] = this.c[j * 3 + 2];
      S[j] = lerp(this.s0[j], this.s1[j], 1 - (1 - t) * (1 - t));
      A[j] = this.a0[j] * (t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92);
      SE[j] = this.seed[j];
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = this.aSeed.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}

const FX = {
  fire: null, smoke: null, lights: [], decals: null, decalN: 0, shake: 0, lightsOn: true,
  init(scene) {
    this.smoke = new Particles(2500, false); this.fire = new Particles(2500, true);
    this.smoke.points.renderOrder = 5; this.fire.points.renderOrder = 6;
    scene.add(this.smoke.points); scene.add(this.fire.points);
    // Lichtblitze (feste Anzahl, damit keine Shader neu kompiliert werden müssen)
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff8040, 0, 45, 2); l.userData = { life: 0, max: 1, peak: 0 };
      scene.add(l); this.lights.push(l);
    }
    // Brandspuren am Boden
    const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
    this.decals = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ map: TEX.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 160);
    this.decals.count = 0; this.decals.frustumCulled = false; this.decals.renderOrder = 1;
    scene.add(this.decals);
  },
  setLights(on) { this.lightsOn = on; this.lights.forEach(l => { l.visible = on; l.intensity = 0; }); },
  setScale(px) { this.smoke.mat.uniforms.scale.value = px; this.fire.mat.uniforms.scale.value = px; },
  clear() { this.fire.clear(); this.smoke.clear(); this.decals.count = 0; this.decalN = 0; this.lights.forEach(l => { l.intensity = 0; l.userData.life = 0; }); },
  update(dt) {
    this.fire.update(dt); this.smoke.update(dt);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.life > 0) { u.life -= dt; l.intensity = Math.max(0, u.life / u.max) ** 2 * u.peak; } else l.intensity = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  },
  flash(p, r, g, b, peak, dur) {
    if (!this.lightsOn) return;
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.life < best.userData.life) best = l;
    if (best.userData.life > 0 && best.userData.peak > peak) return;
    best.position.set(p.x, p.y + 1, p.z); best.color.setRGB(r, g, b);
    best.userData.life = best.userData.max = dur; best.userData.peak = peak;
  },
  scorch(p, size) {
    const i = this.decalN++ % 160;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.03, p.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU)), new THREE.Vector3(size, 1, size));
    this.decals.setMatrixAt(i, m);
    this.decals.count = Math.min(160, this.decalN);
    this.decals.instanceMatrix.needsUpdate = true;
  },
  addShake(p, size) {
    const d = p.distanceTo(SFX.listener);
    this.shake = Math.min(1, this.shake + size * 6 / (10 + d));
  },
  sparks(p, n, r, g, b) {
    for (let i = 0; i < n; i++) this.fire.spawn(p.x, p.y, p.z, rand(-5, 5), rand(0, 6), rand(-5, 5), rand(0.15, 0.45), 0.18, 0.04, r * 4, g * 4, b * 4, 1, 9, 1);
  },
  snowPuff(p, big) {
    const n = big ? 12 : 5;
    const c = MAP.look.dust;
    for (let i = 0; i < n; i++) this.smoke.spawn(p.x, p.y + 0.1, p.z, rand(-1.8, 1.8), rand(1, 3.5), rand(-1.8, 1.8), rand(0.5, 1.1), 0.35, big ? 2.8 : 1.2, c[0], c[1], c[2], 0.8, 3, 2);
  },
  impact(p, f) {
    const [r, g, b] = boltCol(f);
    this.sparks(p, 6, r, g, b);
    this.fire.spawn(p.x, p.y + 0.1, p.z, 0, 0, 0, 0.12, 1.2, 0.3, r * 3, g * 3, b * 3, 1);
    this.snowPuff(p, false);
    if (Math.random() < 0.5) this.scorch(p, rand(0.5, 0.9));
  },
  muzzle(p, f, big) {
    const [r, g, b] = boltCol(f);
    this.fire.spawn(p.x, p.y, p.z, 0, 0, 0, 0.07, big ? 1.4 : 0.55, 0.2, r * 4, g * 4, b * 2, 1);
  },
  explosion(p, size) {
    const n = Math.min(46, 10 + size * 6);
    this.fire.spawn(p.x, p.y + size * 0.3, p.z, 0, 0, 0, 0.14, size * 2.6, size * 4, 2.6, 1.3, 0.45, 1);    // Blitz
    for (let i = 0; i < n; i++) {
      const s = size * 1.6;
      this.fire.spawn(p.x, p.y, p.z, rand(-s, s) * 1.5, rand(0, s * 1.9), rand(-s, s) * 1.5, rand(0.35, 0.9), size * 1.0, size * 2.6, rand(2.4, 3.4), rand(0.6, 1.1), 0.12, 1, 2, 2.5);
    }
    for (let i = 0; i < n * 0.6; i++) this.fire.spawn(p.x, p.y + 0.3, p.z, rand(-14, 14), rand(6, 18), rand(-14, 14), rand(0.5, 1.2), 0.25, 0.08, 5, 2, 0.4, 1, 18, 0.5);
    for (let i = 0; i < n * 0.8; i++) {
      this.smoke.spawn(p.x + rand(-1, 1), p.y + rand(0, 1), p.z + rand(-1, 1), rand(-2.5, 2.5), rand(1.5, 4.5) * Math.sqrt(size), rand(-2.5, 2.5), rand(2, 4.5), size * 1.3, size * 4.5, 0.09, 0.085, 0.085, 0.8, -0.35, 0.7);
    }
    const dc = MAP.look.dust;
    for (let i = 0; i < 14; i++) {    // Schnee- bzw. Erdstaub-Ring
      const a = i / 14 * TAU;
      this.smoke.spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * size * 4, rand(0.5, 2), Math.sin(a) * size * 4, rand(0.9, 1.6), size * 0.8, size * 3, dc[0] * 0.9, dc[1] * 0.92, dc[2] * 0.93, 0.7, 1, 2.2);
    }
    this.flash(p, 1, 0.55, 0.25, 6 + size * 5, 0.5 + size * 0.1);
    if (p.y - heightAt(p.x, p.z) < 3) this.scorch(p, size * 2.2);
    this.addShake(p, size);
  },
  smokeColumn(p, intensity) {
    this.smoke.spawn(p.x + rand(-1, 1), p.y, p.z + rand(-1, 1), rand(-0.5, 0.5) + 1.2, rand(2, 4), rand(-0.5, 0.5), rand(3, 5.5), 1.5 * intensity, 7 * intensity, 0.05, 0.05, 0.055, 0.7, -0.2, 0.2);
    if (Math.random() < 0.5) this.fire.spawn(p.x + rand(-0.6, 0.6), p.y, p.z + rand(-0.6, 0.6), 0, rand(1, 2.5), 0, 0.5, 1.4 * intensity, 0.4, 5, 1.8, 0.4, 0.9);
  },
};

// Schneefall rund um die Kamera
class SnowFall {
  constructor(scene, n) {
    this.n = n; this.box = 50;
    this.off = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.off[i * 3] = rand(-25, 25); this.off[i * 3 + 1] = rand(-10, 25); this.off[i * 3 + 2] = rand(-25, 25); }
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    const tex = canvasTex(32, (ctx) => { const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 32, 32); });
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.1, map: tex, transparent: true, depthWrite: false, opacity: 0.9, color: new THREE.Color().setRGB(1.3, 1.35, 1.45) }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0; this.fall = 1.6; this.drift = 1.8;
  }
  // Hoth: Schneefall, Endor: Pollen und Staub, die langsam im Sonnenlicht schweben
  // Geonosis: vom Wind getriebener roter Staub
  setStyle(id) {
    const S = { hoth: [1.6, 1.8, 0.1, [1.3, 1.35, 1.45], 0.9], endor: [0.12, 0.25, 0.05, [2.2, 1.9, 1.3], 0.7], geonosis: [0.5, 7, 0.06, [1.5, 0.8, 0.45], 0.55] }[id] || [1.6, 1.8, 0.1, [1.3, 1.35, 1.45], 0.9];
    this.fall = S[0]; this.drift = S[1];
    this.points.material.size = S[2];
    this.points.material.color.setRGB(...S[3]);
    this.points.material.opacity = S[4];
  }
  update(dt, cam) {
    this.t += dt;
    const a = this.attr.array, o = this.off, B = this.box, H = B / 2;
    for (let i = 0; i < this.n; i++) {
      o[i * 3 + 1] -= dt * this.fall; o[i * 3] += dt * this.drift;
      if (o[i * 3 + 1] < -10) o[i * 3 + 1] += 35;
      const x = ((o[i * 3] - cam.x) % B + B) % B - H, z = ((o[i * 3 + 2] - cam.z) % B + B) % B - H;
      a[i * 3] = cam.x + x + Math.sin(this.t + i) * 0.3; a[i * 3 + 1] = cam.y + o[i * 3 + 1]; a[i * 3 + 2] = cam.z + z;
    }
    this.attr.needsUpdate = true;
  }
}
