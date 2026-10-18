'use strict';
// ============================================================================
//  Battle of Hoth - Karte "Geonosis": Wüste mit Felsnadeln und Tafelbergen.
//  Klonkrieger der Republik (Seite "Rebellen") verteidigen ihre Kommando-
//  zentrale gegen die Droidenarmee (Seite "Imperium") mit AAT-Panzern.
//  LAAT-Kanonenboote kämpfen und bringen Verstärkung; Captain Rex und
//  Commander Cody führen die Klone an.
// ============================================================================

const H90 = Math.PI / 2;

// ---------------------------------------------------------------- Modelle: Klonkrieger und Kampfdroiden
const CLONE_W = 0xeeeeea, CLONE_W2 = 0xd8d8d4, CLONE_DK = 0x1c1c1e;
function cloneBody(mark) {
  const w = CLONE_W, w2 = CLONE_W2, dk = CLONE_DK, parts = [
    gCap(0.2, 0.34, 0, 1.24, 0, w, 0, 0, 1.3, 0.85),
    gBox(0.36, 0.3, 0.12, 0, 1.3, 0.13, w2), gBox(0.28, 0.12, 0.1, 0, 1.1, 0.15, w),
    gCyl(0.262, 0.262, 0.08, 12, 0, 1.0, 0, dk), gBox(0.1, 0.08, 0.05, 0.12, 1.0, 0.25, 0x8a8a90),
    gCyl(0.24, 0.27, 0.18, 12, 0, 0.9, 0, w),
    gSph(0.155, 0, 1.69, 0, w, 1, 1.04, 1.08, 16),                              // Helm
    gBox(0.2, 0.045, 0.05, 0, 1.72, 0.15, dk), gBox(0.055, 0.12, 0.05, 0, 1.655, 0.155, dk),   // T-Visier
    gBox(0.04, 0.05, 0.24, 0, 1.83, -0.01, w2),                                // Helmkamm
    gCyl(0.17, 0.2, 0.08, 14, 0, 1.56, 0, w2),
    gBox(0.32, 0.34, 0.15, 0, 1.3, -0.21, w2),                                 // Rückenpanzer
    gCap(0.065, 0.28, -0.2, 1.32, 0.16, w, H90), gCap(0.065, 0.26, 0.2, 1.32, 0.15, w, H90),
    gSph(0.055, -0.1, 1.32, 0.36, dk), gSph(0.055, 0.12, 1.31, 0.33, dk),
    gBox(0.06, 0.1, 0.7, 0.03, 1.36, 0.45, 0x2a2b2e), gCyl(0.03, 0.03, 0.3, 8, 0.03, 1.38, 0.92, 0x111111, H90),   // DC-15A
  ];
  if (mark) parts.push(
    gBox(0.05, 0.05, 0.3, 0, 1.84, -0.01, mark), gBox(0.21, 0.04, 0.03, 0, 1.76, 0.16, mark),                 // Helmzeichnung
    gSph(0.1, -0.24, 1.47, 0, mark, 1, 0.6, 1.1), gSph(0.1, 0.24, 1.47, 0, CLONE_W, 1, 0.6, 1.1),           // Schulterpanzer
    gBox(0.05, 0.3, 0.06, -0.08, 1.32, 0.19, mark));
  return parts;
}
function cloneLeg(mark) {
  return mergeGeos([gCap(0.09, 0.56, 0, -0.38, 0, CLONE_W), gBox(0.13, 0.12, 0.05, 0, -0.33, 0.08, mark || CLONE_W2),
    gBox(0.2, 0.18, 0.29, 0, -0.81, 0.04, CLONE_W2), gBox(0.21, 0.05, 0.3, 0, -0.88, 0.04, 0x3a3a3e)]);
}
function cloneGeos() { return { body: mergeGeos(cloneBody(null)), leg: cloneLeg(null) }; }
function cloneHeroGeos(kind) {
  const mark = kind === 'rex' ? 0x2c5cc8 : 0xe0781c;
  const parts = cloneBody(mark);
  if (kind === 'cody') parts.push(gCyl(0.012, 0.012, 0.22, 4, -0.15, 1.8, 0.02, 0x2a2a2a), gBox(0.05, 0.05, 0.06, -0.15, 1.72, 0.1, 0x2a2a2a));   // Entfernungsmesser
  else parts.push(gBox(0.32, 0.04, 0.04, 0, 1.0, 0.27, mark), gBox(0.08, 0.2, 0.1, -0.25, 0.86, 0.04, 0x3a2a1c));   // Gürtel, Holster
  return { hip: 0.9, legGap: 0.12, body: mergeGeos(parts), leg: cloneLeg(mark) };
}
const DROID = 0x9c5c3c, DROID2 = 0x7a432a, DROID_J = 0x4a2c1e;
function droidGeos() {
  return {
    body: mergeGeos([
      gBox(0.24, 0.12, 0.14, 0, 0.98, 0, DROID2),                                         // Becken
      gCyl(0.03, 0.03, 0.26, 6, 0, 1.12, -0.02, DROID_J),                                  // Wirbelsäule
      gBox(0.34, 0.3, 0.16, 0, 1.38, 0.01, DROID, -0.18), gBox(0.2, 0.14, 0.04, 0, 1.36, 0.1, DROID2, -0.18),   // Brustkasten
      gBox(0.22, 0.28, 0.14, 0, 1.4, -0.17, DROID2),                                       // Rückenpack
      gCyl(0.024, 0.024, 0.32, 6, 0, 1.64, 0.03, DROID_J, 0.25),                           // Hals
      gCap(0.055, 0.3, 0, 1.79, 0.13, DROID, 1.15, 0, 1.1, 0.75),                          // länglicher Kopf
      gSph(0.05, 0, 1.84, -0.04, DROID2, 1, 0.8, 1.2),
      gSph(0.04, -0.19, 1.47, 0, DROID_J), gSph(0.04, 0.19, 1.47, 0, DROID_J),            // Schultern
      gCyl(0.024, 0.024, 0.3, 6, -0.2, 1.31, 0.02, DROID), gCyl(0.024, 0.024, 0.3, 6, 0.2, 1.31, 0.02, DROID),
      gCyl(0.022, 0.022, 0.3, 6, -0.14, 1.2, 0.17, DROID, H90 * 1.1), gCyl(0.022, 0.022, 0.3, 6, 0.16, 1.2, 0.17, DROID, H90 * 1.1),
      gBox(0.05, 0.09, 0.48, 0.02, 1.23, 0.36, 0x3a3a3e), gCyl(0.02, 0.02, 0.2, 6, 0.02, 1.26, 0.68, 0x222222, H90),   // E-5
    ]),
    leg: mergeGeos([gCyl(0.04, 0.035, 0.44, 6, 0, -0.22, 0, DROID), gSph(0.045, 0, -0.45, 0, DROID_J),
      gCyl(0.035, 0.045, 0.42, 6, 0, -0.67, 0, DROID), gBox(0.1, 0.06, 0.22, 0, -0.9, 0.05, DROID2)]),
  };
}

// ---------------------------------------------------------------- AAT-Panzer der Droidenarmee
let AAT_GEO = null;
function aatGeos() {
  if (AAT_GEO) return AAT_GEO;
  const T = 0xa38a64, T2 = 0x8c7452, R = 0x7a3a26, D = 0x2e2a26;
  const hull = [
    gProfile([[-4.2, 0], [3.4, 0], [4.6, 0.6], [4.3, 1.25], [-2.8, 1.6], [-4.4, 1.0]], 5.6, 'x', T, 0, 0, 0, 0.08),
    gBox(1.3, 0.85, 2.6, 2.75, 0.55, 2.5, T2), gBox(1.3, 0.85, 2.6, -2.75, 0.55, 2.5, T2),           // Seitengondeln
    gCyl(0.11, 0.11, 1.8, 8, 2.75, 0.62, 4.3, D, H90), gCyl(0.11, 0.11, 1.8, 8, -2.75, 0.62, 4.3, D, H90),
    gBox(2.8, 0.3, 0.5, 0, 0.45, 4.55, D),                                                       // Werfer im Bug
    gCyl(0.55, 0.65, 1.3, 12, 1.7, 0.8, -4.5, T2, H90), gCyl(0.55, 0.65, 1.3, 12, -1.7, 0.8, -4.5, T2, H90),
    gCyl(0.45, 0.45, 0.1, 12, 1.7, 0.8, -5.16, D, H90), gCyl(0.45, 0.45, 0.1, 12, -1.7, 0.8, -5.16, D, H90),
    gBox(5.65, 0.08, 0.6, 0, 1.42, -1.2, R), gBox(5.65, 0.08, 0.4, 0, 1.3, 1.6, R), gBox(1.32, 0.1, 2.0, 2.75, 1.0, 2.5, R), gBox(1.32, 0.1, 2.0, -2.75, 1.0, 2.5, R),
    gBox(5.0, 0.12, 7.8, 0, 0.02, 0, 0x3a332c),                                                  // Unterseite
  ];
  const tur = [
    gProfile([[-1.6, 0], [1.6, 0], [2.1, 0.55], [1.2, 1.05], [-1.3, 1.05], [-1.7, 0.5]], 2.6, 'x', T, 0, 0, 0, 0.06),
    gCyl(0.3, 0.3, 0.6, 10, 0, 0.45, 2.1, T2, H90), gCyl(0.15, 0.19, 3.2, 10, 0, 0.45, 3.6, D, H90), gCyl(0.22, 0.22, 0.3, 10, 0, 0.45, 5.1, D, H90),
    gCyl(0.42, 0.42, 0.14, 12, 0, 1.12, -0.3, T2), gBox(2.62, 0.06, 0.4, 0, 0.9, 0.4, R),
  ];
  AAT_GEO = { hull: mergeGeos(hull), turret: mergeGeos(tur) };
  return AAT_GEO;
}

// ---------------------------------------------------------------- LAAT-Kanonenboot der Republik
let LAAT_GEO = null, LAAT_GLOW = null;
function LAAT_GLOW_MAT() { return LAAT_GLOW || (LAAT_GLOW = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.4, 3.2, 5) })); }
function laatGeos() {
  if (LAAT_GEO) return LAAT_GEO;
  const C = 0xd9d0b6, C2 = 0xc2b89c, R = 0x9c2c24, D = 0x2a2826, GL = 0x7a2a22;
  const p = [
    gProfile([[-8, 0.6], [4.6, 0.6], [8.3, 1.7], [8.0, 3.0], [5.2, 4.4], [-3.5, 4.6], [-8.2, 3.6]], 3.7, 'x', C, 0, 0, 0, 0.1),     // Rumpf
    gProfile([[4.2, 4.2], [6.6, 3.3], [7.5, 2.6], [6.4, 4.0]], 3.0, 'x', C2, 0, 0, 0),
    gSph(0.85, 0, 4.55, 4.6, GL, 1, 0.75, 1.4, 12, true), gSph(0.75, 0, 2.95, 7.4, GL, 1, 0.8, 1.2, 12, true),   // Cockpits
    gBox(0.12, 2.3, 4.6, 1.86, 2.3, 0.4, D), gBox(0.12, 2.3, 4.6, -1.86, 2.3, 0.4, D),               // offene Truppentüren
    gBox(3.75, 0.2, 1.2, 0, 4.62, 2.6, R), gBox(3.75, 0.2, 0.5, 0, 0.9, 7.0, R),
    // Flügel (nach außen und unten geneigt) mit roten Streifen und Raketenrohren
    gBox(10, 0.35, 2.4, 6.1, 3.7, -1.2, C, 0, -0.18, -0.28), gBox(10, 0.35, 2.4, -6.1, 3.7, -1.2, C, 0, 0.18, 0.28),
    gBox(9, 0.37, 0.55, 6.1, 3.72, -0.4, R, 0, -0.18, -0.28), gBox(9, 0.37, 0.55, -6.1, 3.72, -0.4, R, 0, 0.18, 0.28),
    gCyl(0.28, 0.28, 3.2, 8, 10.6, 2.45, -1.2, C2, H90), gCyl(0.28, 0.28, 3.2, 8, -10.6, 2.45, -1.2, C2, H90),
    // Kugeltürme unter den Flügelwurzeln
    gSph(0.95, 2.7, 2.2, 2.0, 0xb8b0a0, 1, 1, 1, 12), gSph(0.95, -2.7, 2.2, 2.0, 0xb8b0a0, 1, 1, 1, 12),
    gCyl(0.98, 0.98, 0.15, 12, 2.7, 2.2, 2.0, R), gCyl(0.98, 0.98, 0.15, 12, -2.7, 2.2, 2.0, R),
    gCyl(0.08, 0.08, 1.4, 6, 2.7, 2.2, 3.1, D, H90), gCyl(0.08, 0.08, 1.4, 6, -2.7, 2.2, 3.1, D, H90),
    // hintere Raketenträger
    gCyl(0.24, 0.24, 7, 8, 1.3, 6.4, -4.5, C2, -1.25), gCyl(0.24, 0.24, 7, 8, -1.3, 6.4, -4.5, C2, -1.25),
    gBox(0.5, 0.5, 1.2, 1.3, 7.55, -7.6, R), gBox(0.5, 0.5, 1.2, -1.3, 7.55, -7.6, R),
    gCyl(0.55, 0.7, 1.4, 12, 1.0, 2.4, -8.5, C2, H90), gCyl(0.55, 0.7, 1.4, 12, -1.0, 2.4, -8.5, C2, H90),   // Triebwerke
    gCyl(0.12, 0.12, 1.6, 6, 0, 1.4, 8.6, D, H90),                                                      // Bugkanone
    gBox(0.06, 0.6, 0.6, 1.88, 3.6, 3.2, 0x4a4a4a), gBox(0.06, 0.6, 0.6, -1.88, 3.6, 3.2, 0x4a4a4a),
  ];
  LAAT_GEO = { body: mergeGeos(p), glow: mergeGeos([gCyl(0.48, 0.48, 0.08, 12, 1.0, 2.4, -9.25, 0xffffff, H90), gCyl(0.48, 0.48, 0.08, 12, -1.0, 2.4, -9.25, 0xffffff, H90)]) };
  return LAAT_GEO;
}

// ---------------------------------------------------------------- Welt
function buildGeonosisTerrain() {
  const S = WORLD.size, xs = [], zs = [];
  for (let v = -S; v < -260; v += 16) xs.push(v);
  for (let v = -260; v < 260; v += 4) xs.push(v);
  for (let v = 260; v <= S; v += 16) xs.push(v);
  for (let v = -S; v < -470; v += 16) zs.push(v);
  for (let v = -470; v < 220; v += 4) zs.push(v);
  for (let v = 220; v <= S; v += 16) zs.push(v);
  const nc = xs.length, nr = zs.length;
  const pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3), uv = new Float32Array(nr * nc * 2);
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    const x = xs[i], z = zs[j], k = j * nc + i;
    pos[k * 3] = x; pos[k * 3 + 1] = baseHeight(x, z); pos[k * 3 + 2] = z;
    uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
  }
  const idx = new Uint32Array((nr - 1) * (nc - 1) * 6);
  let q = 0;
  for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nc - 1; i++) {
    const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const nrm = g.attributes.normal.array;
  for (let k = 0; k < nr * nc; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const n = (vnoise(x * 0.03, z * 0.03) - 0.5) * 0.25 + (vnoise(x * 0.2, z * 0.2) - 0.5) * 0.08;
    let r = 1 + n, gg = 1 + n * 0.9, b = 1 + n * 0.8;
    // steile Felswände dunkler und röter, Schichtbänder an den Tafelbergen
    const rock = smooth(0.85, 0.55, nrm[k * 3 + 1]);
    const band = 0.85 + 0.15 * Math.sin(y * 0.9);
    r = lerp(r, 0.78 * band, rock); gg = lerp(gg, 0.55 * band, rock); b = lerp(b, 0.42 * band, rock);
    // helle, festgefahrene Flächen (Geröllfelder)
    const flat = smooth(0.62, 0.8, vnoise(x * 0.012 + 5, z * 0.012)) * (1 - rock) * 0.35;
    r = lerp(r, 1.18, flat); gg = lerp(gg, 1.08, flat); b = lerp(b, 0.95, flat);
    col[k * 3] = r * 0.82; col[k * 3 + 1] = gg * 0.78; col[k * 3 + 2] = b * 0.75;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, MAT.sand);
  mesh.receiveShadow = true;
  return mesh;
}
// Felsnadel im Stil der geonosianischen Bauten: breiter, geriffelter Sockel, lange verdrehte Spitze
function addSpire(B, x, y, z, R, H, seed, seg) {
  const rings = 14, base = B.v, c1 = linCol(0xc87c4c), c2 = linCol(0xa0603a);
  for (let k = 0; k <= rings; k++) {
    const t = k / rings, h = t * H;
    const prof = t < 0.3 ? 1 - t * 1.6 : 0.52 * Math.pow(1 - (t - 0.3) / 0.7, 1.6);
    const tw = t * 3 + seed;
    const sh = 0.82 + 0.22 * hash2(seed, k);
    const c = [lerp(c1[0], c2[0], (k % 2) * 0.6) * sh, lerp(c1[1], c2[1], (k % 2) * 0.6) * sh, lerp(c1[2], c2[2], (k % 2) * 0.6) * sh];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const rr = Math.max(0.15, R * prof * (1 + 0.14 * Math.sin(a * 5 + tw) + 0.1 * Math.sin(k * 2.7 + seed)));
      B.vert(x + ca * rr, y + h - (k === 0 ? 2 : 0), z + sa * rr, ca, 0.3, sa, i / seg * 3, h / 6, c);
    }
  }
  const n = seg + 1;
  for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) {
    const a = base + k * n + i, b = a + 1, u = a + n, v = u + 1;
    B.tri(a, u, b); B.tri(b, u, v);
  }
}
// Felsbrocken (verformter Zwölfflächner) als Deckung
function boulderGeo(x, y, z, r, h, seed) {
  const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const f = 0.78 + 0.45 * hash2(p.getX(k) * 3 + seed, p.getZ(k) * 3 + p.getY(k));
    p.setXYZ(k, p.getX(k) * f, p.getY(k) * f, p.getZ(k) * f);
  }
  g.scale(r, h * 0.62, r * (0.8 + hash2(seed, 2) * 0.4)); g.rotateY(seed * 1.3); g.translate(x, y + h * 0.3, z);
  return paint(g, [0xb8784c, 0xa86a42, 0xc4865a, 0x9c5e3a][seed % 4]);
}

function geonosisLayout() {
  const rng = srng(2002), spires = [], rocks = [];
  const busy = (x, z, r) => {
    if (Math.hypot(x - GEO.cmd.x, z - GEO.cmd.z) < 40 + r || Math.hypot(x - GEO.pad.x, z - GEO.pad.z) < 32 + r) return true;
    if (Math.abs(x) < TR.len + 12 && Math.abs(z - trenchZ(x)) < 10 + r) return true;
    return spires.some(s => Math.hypot(s.x - x, s.z - z) < s.r + r + 8);
  };
  // große Felsnadeln: vor allem am Rand des Schlachtfelds
  for (let i = 0; i < 70 && spires.length < 34; i++) {
    const far = i % 3 !== 0;
    const x = (rng() - 0.5) * (far ? 560 : 360), z = -520 + rng() * (far ? 720 : 560), R = 4 + rng() * 6, H = 22 + rng() * 55;
    if (!far && Math.abs(x) < 70 && z > -330) continue;          // Hauptkampfzone frei halten
    if (busy(x, z, R)) continue;
    spires.push({ x, z, r: R, h: H });
  }
  // Felsbrocken und kleine Formationen als Deckung im Feld
  for (let i = 0; i < 90; i++) {
    const x = (rng() - 0.5) * 300, z = -330 + rng() * 300, r = 1.2 + rng() * 2.6, h = 1.2 + rng() * 2.8;
    if (busy(x, z, r) || rocks.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 1.6)) continue;   // keine engen Spalten
    rocks.push({ x, z, r, h });
  }
  // Deckung der Klone: Felsbrocken vor der Linie
  for (let x = -TR.len + 2; x < TR.len; x += 6.5 + rng() * 3) {
    const z = trenchZ(x) - 2.1 - rng() * 0.6;
    rocks.push({ x, z, r: 0.9 + rng() * 0.6, h: 1.2 + rng() * 0.25, cover: true });
  }
  return { spires, rocks };
}

function commandCenterMesh() {
  // geonosianischer Felsbau, den die Republik als Kommandozentrale nutzt
  const B = new GeoBuf();
  addSpire(B, 0, 0, 0, 15, 48, 3.3, 16);
  const m1 = new THREE.Mesh(B.geometry(), MAT.rock); m1.castShadow = m1.receiveShadow = true;
  const g = new THREE.Group(); g.add(m1);
  const rep = vcMesh([
    gBox(5, 4, 1.2, 0, 2, 14.6, 0x2a2826), gBox(6.2, 0.6, 1.6, 0, 4.2, 14.6, 0xd9d0b6),                  // Tor zur Ebene
    gBox(0.3, 9, 0.3, 9, 14, 6, 0x6a6a6a), gCyl(1.4, 0.2, 0.5, 14, 9, 18.6, 6, 0xd9d0b6, -0.6),           // Antenne + Schüssel
    gBox(0.25, 7, 0.25, -8, 13, 8, 0x6a6a6a), gBox(1.4, 0.4, 0.1, -8, 16.5, 8, 0x9c2c24),
    gBox(4, 0.4, 4, 0, 0.2, 19, 0xc2b89c), gCyl(0.25, 0.25, 0.1, 10, 1.5, 0.45, 19, 0x2c5cc8), gCyl(0.25, 0.25, 0.1, 10, -1.5, 0.45, 19, 0xc23020),
  ], MAT.building);
  rep.rotation.y = Math.PI;                    // Tor zeigt zur Front (nach -z)
  g.add(rep);
  g.position.set(GEO.cmd.x, WORLD.gen.y - 0.5, GEO.cmd.z);
  return g;
}

function buildGeonosis(root, quality) {
  root.add(buildGeonosisTerrain());
  const L = geonosisLayout();
  const B = new GeoBuf(), rocks = [], seg = quality === 0 ? 7 : 10;
  L.spires.forEach((s, i) => {
    const y = baseHeight(s.x, s.z);
    addSpire(B, s.x, y, s.z, s.r, s.h, i * 1.7 + 1, seg);
    const side = i % 2 ? 1 : -1;            // beide Kreise gleiche Gleitrichtung, sonst bleibt man hängen
    OBST.add(s.x, s.z, s.r * 0.95, y - 2, s.h * 0.35, side);
    OBST.add(s.x, s.z, s.r * 0.5, y, s.h * 0.75, side);
  });
  L.rocks.forEach((r, i) => {
    const y = baseHeight(r.x, r.z);
    rocks.push(boulderGeo(r.x, y - 0.2, r.z, r.r, r.h, i + 7));
    OBST.add(r.x, r.z, r.r * 0.85, y - 1, r.h, i % 2 ? 1 : -1);
  });
  const sp = new THREE.Mesh(B.geometry(), MAT.rock); sp.castShadow = sp.receiveShadow = true; root.add(sp);
  root.add(vcMesh(rocks, MAT.rock));
  root.add(commandCenterMesh());
  OBST.add(GEO.cmd.x, GEO.cmd.z, 7, WORLD.gen.y, 48);            // Spitze der Kommandozentrale
  // Landezone: Markierungen, Kisten
  const py = baseHeight(GEO.pad.x, GEO.pad.z), lz = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; lz.push(gCyl(0.25, 0.25, 0.2, 8, Math.cos(a) * 17, 0.1, Math.sin(a) * 17, 0xffffff)); }
  const lights = new THREE.Mesh(mergeGeos(lz), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.2, 2.4, 4) }));
  lights.position.set(GEO.pad.x, py, GEO.pad.z); root.add(lights);
  const crates = [];
  for (let i = 0; i < 14; i++) {
    const x = GEO.pad.x + rand(-22, 22), z = GEO.pad.z + rand(18, 30), s = rand(0.7, 1.2);
    crates.push(gBox(1.2 * s, 0.9 * s, 1.0 * s, x, baseHeight(x, z) + 0.4 * s, z, Math.random() < 0.5 ? 0xc2b89c : 0x8a8478, 0, rand(0, 3)));
  }
  root.add(vcMesh(crates, MAT.building));
}

// ---------------------------------------------------------------- Himmel: Angriffsschiffe der Republik, Kernschiffe der Separatisten
function buildGeonosisSky(scene) {
  const tint = (c) => new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.panel, roughness: 0.7, metalness: 0.2, fog: false, transparent: true, opacity: 0.8, color: new THREE.Color(c) });
  // Acclamator (Keil mit Aufbau)
  const sh = new THREE.Shape(); sh.moveTo(0, 150); sh.lineTo(55, -90); sh.lineTo(-55, -90); sh.lineTo(0, 150);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 18, bevelEnabled: true, bevelThickness: 5, bevelSize: 3, bevelSegments: 1 });
  hull.rotateX(-Math.PI / 2); paint(hull, 0xb8aa94);
  const acc = mergeGeos([hull, gBox(22, 16, 30, 0, 28, -55, 0xa89a84), gBox(40, 4, 8, 0, 37, -62, 0xa89a84), gBox(80, 6, 30, 0, 6, -70, 0x8a7a68),
    gBox(18, 3, 120, 0, 21, 20, 0x9a2c24)], 1 / 30);
  [[-260, 230, 420, 0.9, 0.4], [330, 280, 260, 0.75, -0.3], [-520, 330, -150, 0.8, 0.9], [120, 380, 620, 1.1, 0.1]].forEach(([x, y, z, s, r]) => {
    const m = new THREE.Mesh(acc, tint(0xffc890)); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(-0.05, r, 0.03); m.renderOrder = -8; scene.add(m);
  });
  // Kernschiffe der Handelsföderation (gelandete Kugeln) weit hinter den Droiden
  const core = mergeGeos([gSph(60, 0, 40, 0, 0x8a7a68, 1, 1, 1, 24), gCyl(64, 64, 6, 24, 0, 40, 0, 0x6a5a4a), gCyl(10, 18, 40, 10, 0, 100, 0, 0x7a6a58),
    gCyl(30, 30, 4, 18, 0, 118, 0, 0x7a6a58)], 1 / 30);
  [[-380, -980], [260, -1100], [700, -760], [-820, -700]].forEach(([x, z], i) => {
    const m = new THREE.Mesh(core, tint(0xffb070)); m.position.set(x, -20, z); m.scale.setScalar(0.8 + i * 0.12); m.renderOrder = -8; scene.add(m);
  });
}

// ============================================================================
//  Schlachtablauf
// ============================================================================

// Transportschiff: fliegt Verstärkung an die Linie, setzt sie ab und fliegt wieder weg
class Transport {
  constructor(squad) {
    this.squad = squad;
    const x = clamp(pick(squad).slotX + rand(-10, 10), -TR.len + 15, TR.len - 15);
    this.drop = new V3(x, 0, trenchZ(x) + 11); this.drop.y = baseHeight(this.drop.x, this.drop.z) + 2.6;
    this.pos = new V3(x * 0.6 + rand(-60, 60), 70, 330); this.yaw = Math.PI; this.pitch = 0; this.roll = 0;
    this.state = 'in'; this.t = 0; this.out = 0;
    const g = laatGeos();
    this.mesh = new THREE.Mesh(g.body, MAT.vehicle); this.mesh.rotation.order = 'YXZ'; this.mesh.add(new THREE.Mesh(g.glow, LAAT_GLOW_MAT()));
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    G.dyn.add(this.mesh);
    G.msg(`Kanonenboot im Anflug – ${squad.length} Klonkrieger als Verstärkung!`, 'tp');
  }
  update(dt) {
    this.t += dt;
    const dx = this.drop.x - this.pos.x, dz = this.drop.z - this.pos.z, dh = Math.hypot(dx, dz);
    if (this.state === 'in') {
      const sp = Math.min(38, 4 + dh * 0.5), step = Math.min(sp * dt, dh);
      if (dh > 3) this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 1.5);
      if (dh > 1e-3) { this.pos.x += dx / dh * step; this.pos.z += dz / dh * step; }
      const want = dh < 60 ? this.drop.y + dh * 0.5 : Math.max(55, baseHeight(this.pos.x, this.pos.z) + 40);
      this.pos.y += (want - this.pos.y) * Math.min(1, dt * 1.2);
      this.pitch = -0.08; this.roll = 0;
      if (dh < 1.5 && Math.abs(this.pos.y - this.drop.y) < 0.6) { this.state = 'drop'; this.t = 0; }
    } else if (this.state === 'drop') {
      this.pos.y += (this.drop.y - this.pos.y) * Math.min(1, dt * 3);
      this.yaw += angDiff(this.yaw, Math.PI) * Math.min(1, dt);
      this.pitch = 0;
      // Klone springen nacheinander aus den Seitentüren
      while (this.out < this.squad.length && this.t > 0.6 + this.out * 0.3) {
        const s = this.squad[this.out++], side = this.out % 2 ? 1 : -1;
        if (!G.visualOnly) deployClone(s, this.pos.x + side * rand(3, 5), this.pos.z + rand(-3, 3));
      }
      if (this.t > 1.2 + this.squad.length * 0.3) { this.state = 'away'; this.t = 0; }
    } else {
      this.pitch = 0.18;
      this.pos.y += dt * 9; this.pos.z += dt * Math.min(40, this.t * 14); this.yaw += angDiff(this.yaw, 0) * Math.min(1, dt * 0.8);
      if (this.pos.z > 380) { G.dyn.remove(this.mesh); return false; }
    }
    this.mesh.position.copy(this.pos); this.mesh.rotation.set(-this.pitch, this.yaw, this.roll);
    return true;
  }
}
// Gefallenen Klon an einer Stelle wieder ins Gefecht bringen
function deployClone(s, x, z) {
  s.queued = false;
  if (s.alive) return;
  s.livesLeft--;
  s.slotX = clamp(x, -TR.len - 40, TR.len + 40); s.slotD = clamp(z - trenchZ(x), -60, 25);
  s.pos.set(x, 0, z); s.pos.y = heightAt(x, z);
  s.alive = true; s.fall = 0; s.deadT = 0; s.target = null; s.moving = false; s.state = 'hold'; s.stateT = rand(1, 3); s.fireCd = rand(1, 2.5); s.yaw = Math.PI;
  FX.snowPuff(s.pos, false);
}
// Spieler im Kanonenboot: wartende Klone direkt am Boot absetzen
function dropTroops(pos, maxN) {
  const n = Math.min(maxN, G.dropQueue.length);
  for (let i = 0; i < n; i++) {
    const s = G.dropQueue.shift(), a = i / Math.max(1, n) * TAU;
    deployClone(s, pos.x + Math.cos(a) * 3.5, pos.z + Math.sin(a) * 3.5);
  }
  return n;
}

function setupGeonosisBattle(cfg) {
  G.genMax = G.genHP = 160;
  G.dropQueue = []; G.transport = null; G.lastRun = 0;
  const nR = Math.min(cfg.rebels | 0, MAX_REBELS);
  for (let i = 0; i < nR; i++) {
    let x = -TR.len + 8 + (i + 0.5) / nR * (2 * TR.len - 16) + rand(-2, 2);
    if (Math.abs(x) < 9) x += Math.sign(x || 1) * 7;
    G.rebels.push(new Soldier(REB, x, trenchZ(x) + rand(-0.4, 0.2), clamp(cfg.rebLives | 0 || 1, 1, 5)));
  }
  G.rebels.push(makeHero('rex', -5), makeHero('cody', 5));
  // Droidenarmee mit zwei Nachschubwellen aus den Kernschiffen
  for (let i = 0; i < Math.min(cfg.troopers | 0, MAX_TROOPERS); i++) G.imps.push(new Soldier(IMP, rand(-150, 150), rand(-290, -170), 3));
  for (let i = 0; i < (cfg.atst | 0); i++) G.atsts.push(new ATST(rand(-110, 110), rand(-370, -290)));
  for (let i = 0; i < (cfg.turrets | 0); i++) {
    const x = cfg.turrets === 1 ? 12 : -100 + 200 * i / (cfg.turrets - 1) + rand(-4, 4);
    G.turrets.push(new Turret(Math.abs(x) < 4 ? x + 8 : x, trenchZ(x) + rand(10, 16)));
  }
  for (const dx of [-11, 11]) {
    const x = GEO.pad.x + dx, z = GEO.pad.z;
    const s = new Speeder('parked', x, heightAt(x, z) + 0.15, z, Math.PI);
    s.isPad = true; G.speeders.push(s);
  }
  for (let i = 0; i < (cfg.aiSpeeders | 0); i++) G.speeders.push(new Speeder('ai', rand(-110, 110), rand(45, 65), rand(80, 160), Math.PI + rand(-0.3, 0.3)));
}
// Gefallene Klone warten auf ein Kanonenboot (Helden kehren direkt zurück)
G.reinforce = (s) => {
  if (MAP.id !== 'geonosis' || s.f !== REB || s.special) return false;
  s.queued = true; G.dropQueue.push(s);
  return true;
};

function updateGeonosis(dt) {
  if (G.transport && !G.transport.update(dt)) G.transport = null;
  if (G.visualOnly) return;
  G.dropQueue = G.dropQueue.filter(s => s.queued && !s.alive);
  // Neues Transportschiff, sobald genug Klone warten
  if (!G.transport && G.dropQueue.length && (G.dropQueue.length >= 5 || G.time - G.lastRun > 25)) {
    G.lastRun = G.time;
    G.transport = new Transport(G.dropQueue.splice(0, 8));
  }
}

// Client: Transportschiff folgt dem Spielstand des Hosts
class NetTransport {
  constructor() {
    const g = laatGeos();
    this.pos = new V3(); this.yaw = 0; this.first = true;
    this.mesh = new THREE.Mesh(g.body, MAT.vehicle); this.mesh.rotation.order = 'YXZ'; this.mesh.add(new THREE.Mesh(g.glow, LAAT_GLOW_MAT()));
    this.mesh.castShadow = true; G.dyn.add(this.mesh);
    this.tgt = [0, 0, 0, 0, 0];
  }
  net(a) { this.tgt = a; if (this.first) { this.pos.set(a[0], a[1], a[2]); this.yaw = a[3]; this.first = false; } }
  update(dt) {
    const a = this.tgt, k = Math.min(1, dt * 8);
    this.pos.x += (a[0] - this.pos.x) * k; this.pos.y += (a[1] - this.pos.y) * k; this.pos.z += (a[2] - this.pos.z) * k;
    this.yaw += angDiff(this.yaw, a[3]) * k;
    this.mesh.position.copy(this.pos); this.mesh.rotation.set(-a[4], this.yaw, 0);
    return true;
  }
  remove() { G.dyn.remove(this.mesh); }
}

// ---------------------------------------------------------------- Dauerstrahl der Kugeltürme (grün)
//  Sichtbare Strahlen: der eigene wird jedes Bild neu gesetzt, die anderer Spieler kommen als
//  Treffer-Impulse (Lasertyp 9) und leuchten jeweils kurz nach.
const BEAMS = [];
let BEAM_R = null;
function addBeam(a, b, life) {
  const o = BEAMS.find(x => x.t <= 0) || (BEAMS.length < 24 ? (BEAMS[BEAMS.length] = { a: new V3(), b: new V3(), t: 0 }) : null);
  if (!o) return;
  o.a.copy(a); o.b.copy(b); o.t = life;
}
// Ende eines Strahls (Gelände, Felsen, Läufer) für fremde Strahlen
function beamEnd(from, dir, maxD, out) {
  let best = maxD;
  for (let t = 2; t < maxD; t += 3) if (heightAt(from.x + dir.x * t, from.z + dir.z * t) > from.y + dir.y * t) { best = t; break; }
  if (OBST.n) { const t = OBST.seg(from.x, from.y, from.z, dir.x * best, dir.y * best, dir.z * best); if (t <= 1) best *= t; }
  for (const w of G.atsts) if (w.alive) {
    const s = w.spheres[0]; _v1.subVectors(s, from); const t = _v1.dot(dir);
    if (t > 0 && t < best && _v1.addScaledVector(dir, -t).lengthSq() < s.r * s.r) best = t;
  }
  return out.copy(from).addScaledVector(dir, best);
}
const beamSnd = new Map();
G.onBeam = (from, dir, owner) => {
  const last = beamSnd.get(owner) || -1;
  if (G.time - last > 0.28 || G.time < last) { beamSnd.set(owner, G.time); SFX.beam(from); FX.flash(from, 0.4, 1.4, 0.4, 2, 0.15); }
  if (owner === G.player) return;                 // eigener Strahl wird jedes Bild gezeichnet
  addBeam(from, beamEnd(from, dir, 450, _v2), 0.13);
};
function drawBeams(dt) {
  if (!BEAM_R) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1); geo.rotateX(Math.PI / 2);
    const core = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.35, 2.8, 0.4) }), 24);
    const glow = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.04, 0.85, 0.08), transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false }), 24);
    for (const m of [core, glow]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; G.scene.add(m); }
    glow.renderOrder = 7;
    BEAM_R = { core, glow };
  }
  let n = 0;
  for (const b of BEAMS) {
    if (b.t <= 0) continue;
    b.t -= dt;
    _v1.subVectors(b.b, b.a); const len = _v1.length(); if (len < 0.1) continue;
    _v1.divideScalar(len); _q.setFromUnitVectors(_Z, _v1);
    _v2.copy(b.a).addScaledVector(_v1, len * 0.5);
    const w = 0.13 + Math.random() * 0.05;
    _v3.set(w, w, len); _m.compose(_v2, _q, _v3); BEAM_R.core.setMatrixAt(n, _m);
    _v3.set(w * 4.5, w * 4.5, len); _m.compose(_v2, _q, _v3); BEAM_R.glow.setMatrixAt(n, _m);
    n++;
  }
  for (const m of [BEAM_R.core, BEAM_R.glow]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
}
