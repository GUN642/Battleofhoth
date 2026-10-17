'use strict';
// ============================================================================
//  Battle of Hoth - Karte "Endor": Wald des Mondes Endor mit dem imperialen
//  Bunker, Mammutbäumen, Farnen und Ewok-Baumstammfallen. Dazu die Einheiten
//  der Karte: Han Solo, Chewbacca, R2-D2, C-3PO und die Ewoks.
// ============================================================================

// Reproduzierbarer Zufall: Host und Clients bauen denselben Wald
function srng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function linCol(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

// Geometrie-Sammler für viele kleine Teile (Bäume, Farne) in einem Draw-Call
class GeoBuf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.ix = []; this.v = 0; }
  vert(x, y, z, nx, ny, nz, u, v, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]); return this.v++; }
  tri(a, b, c) { this.ix.push(a, b, c); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? new Uint32Array(this.ix) : new Uint16Array(this.ix), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- Gelände
function buildForestTerrain() {
  const S = WORLD.size, xs = [], zs = [];
  for (let v = -S; v < -300; v += 16) xs.push(v);
  for (let v = -300; v < 300; v += 4) xs.push(v);
  for (let v = 300; v <= S; v += 16) xs.push(v);
  for (let v = -S; v < -480; v += 16) zs.push(v);
  for (let v = -480; v < 140; v += 4) zs.push(v);
  for (let v = 140; v <= S; v += 16) zs.push(v);
  const nc = xs.length, nr = zs.length;
  const pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3), uv = new Float32Array(nr * nc * 2);
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    const x = xs[i], z = zs[j], k = j * nc + i;
    pos[k * 3] = x; pos[k * 3 + 1] = baseHeight(x, z); pos[k * 3 + 2] = z;
    uv[k * 2] = x / 5; uv[k * 2 + 1] = z / 5;
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
  const nrm = g.attributes.normal.array, line = TR.len + 15;
  for (let k = 0; k < nr * nc; k++) {
    const x = pos[k * 3], z = pos[k * 3 + 2];
    const n = (vnoise(x * 0.04, z * 0.04) - 0.5) * 0.25;
    // Waldwege (festgetretene Erde), Lichtung vor dem Bunker, Verteidigungslinie
    let path = 0;
    if (z < trenchZ(x) - 6 && z > -480) for (const l of ENDOR.lanes) path = Math.max(path, 1 - smooth(2.2, 5.5, Math.abs(x - l) + (vnoise(z * 0.1, l) - 0.5) * 2));
    const cx = x - ENDOR.bunker.x, cz = (z - 22) * 1.4;
    path = Math.max(path, (1 - smooth(16, 34, Math.hypot(cx, cz))) * 0.85);
    if (Math.abs(x) < line) path = Math.max(path, (1 - smooth(2, 7, Math.abs(z - trenchZ(x)))) * 0.6);
    const moss = smooth(0.35, 0.75, vnoise(x * 0.025 + 9, z * 0.025)) * (1 - path) * 0.6;
    let r = 1 + n, gg = 1 + n, b = 1 + n;
    r = lerp(r, 0.78, moss); gg = lerp(gg, 1.05, moss); b = lerp(b, 0.7, moss);
    r = lerp(r, 1.25, path); gg = lerp(gg, 1.08, path); b = lerp(b, 0.9, path);
    const steep = smooth(0.92, 0.7, nrm[k * 3 + 1]);
    r *= 1 - steep * 0.3; gg *= 1 - steep * 0.2; b *= 1 - steep * 0.3;
    col[k * 3] = r * 0.8; col[k * 3 + 1] = gg * 0.8; col[k * 3 + 2] = b * 0.8;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, MAT.forest);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- Waldaufbau (Positionen)
function forestLayout() {
  const rng = srng(4711), trees = [], logs = [];
  const traps = ENDOR.lanes.map((l, i) => ({ x: l, z: i % 2 ? -82 : -118 }));
  const near = (x, z, r) => trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + r) ** 2);
  // Zwei Bäume an jeder Falle, zwischen denen die Stämme hängen
  for (const t of traps) for (const sd of [-1, 1]) trees.push({ x: t.x + sd * 11, z: t.z + (rng() - 0.5) * 3, r: 1.6 + rng() * 0.5, h: 66 + rng() * 14 });
  for (let gx = -250; gx <= 250; gx += 21) for (let gz = -470; gz <= 200; gz += 21) {
    const x = gx + (rng() - 0.5) * 16, z = gz + (rng() - 0.5) * 16, big = rng() < 0.12;
    const r = big ? 2.3 + rng() * 0.9 : 0.8 + rng() * 1.3, h = 50 + rng() * 30 + (big ? 14 : 0), pr = rng();
    const tz = trenchZ(x), ax = Math.abs(x);
    if (ax < 42 && z > -14 && z < 78) continue;                                   // Bunker und Lichtung
    if (ax < 92 && Math.abs(z - tz) < 9) continue;                                // Verteidigungslinie
    if (z < tz - 6 && z > -480 && ENDOR.lanes.some(l => Math.abs(x - l) < 7 + r)) continue;   // Waldwege
    if (z > -34 && z < tz && ax < 90 && pr < 0.55) continue;                     // offenes Vorfeld
    if (near(x, z, r + 5)) continue;
    trees.push({ x, z, r, h });
  }
  // Deckung: liegende Stämme vor der Verteidigungslinie (mit Lücken)
  for (let x = -TR.len - 2; x < TR.len; x += 11.5) {
    const x0 = x, x1 = x + 8.5 + rng() * 1.2;
    logs.push({ x0, z0: trenchZ(x0) - 1.8, x1, z1: trenchZ(x1) - 1.8, r: 0.5 + rng() * 0.08, cover: true });
  }
  // umgestürzte Bäume im Wald
  for (let i = 0; i < 46; i++) {
    const x = (rng() - 0.5) * 560, z = -470 + rng() * 440, a = rng() * TAU, l = 9 + rng() * 14, r = 0.55 + rng() * 0.5;
    const x1 = x + Math.cos(a) * l, z1 = z + Math.sin(a) * l;
    const tz = trenchZ(x);
    if (Math.abs(x) < 95 && z > tz - 14) continue;
    if (ENDOR.lanes.some(ln => Math.min(Math.abs(x - ln), Math.abs(x1 - ln)) < 9 || (x - ln) * (x1 - ln) < 0)) continue;
    logs.push({ x0: x, z0: z, x1, z1, r });
  }
  return { trees, logs, traps };
}

// ---------------------------------------------------------------- Bausteine
const BARK = linCol(0x9a6a4c), BARK_DARK = linCol(0x5c3b2a), MOSS = linCol(0x55602e);
function addTrunk(B, x, y, z, R, H, seed, seg) {
  const rings = [[-1.4, 2.0], [0.6, 1.6], [2.2, 1.2], [6, 1.04], [H * 0.3, 0.94], [H * 0.55, 0.78], [H * 0.8, 0.58], [H, 0.28]];
  const lx = (hash2(seed, 1.3) - 0.5) * 0.014, lz = (hash2(seed, 2.7) - 0.5) * 0.014;
  const tint = 0.8 + hash2(seed, 3.1) * 0.35, base = B.v, rep = Math.max(2, Math.round(R * TAU / 2.5));
  for (const [h, m] of rings) {
    const mossK = (1 - smooth(0, 4.5, h)) * 0.7;
    const c = [lerp(BARK[0] * tint, MOSS[0], mossK), lerp(BARK[1] * tint, MOSS[1], mossK), lerp(BARK[2] * tint, MOSS[2], mossK)];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const butt = h < 1 ? 0.5 * Math.max(0, Math.sin(a * 4 + seed)) ** 2 : 0;
      const rr = R * (m + butt) * (1 + 0.05 * Math.sin(a * 7 + seed * 3));
      B.vert(x + ca * rr + lx * h, y + h, z + sa * rr + lz * h, ca, 0.1, sa, i / seg * rep, h / 5, c);
    }
  }
  const n = seg + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
    const a = base + k * n + i, b = a + 1, u = a + n, v = u + 1;
    B.tri(a, u, b); B.tri(b, u, v);
  }
}
// Laubbüschel: verzerrter Doppelkegel (8 Punkte)
function addBlob(B, cx, cy, cz, rx, ry, rz, top, bot, seed) {
  const t = B.vert(cx, cy + ry, cz, 0, 1, 0, 0, 0, top), ring = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + hash2(seed, i) * 0.6, k = 0.75 + hash2(i, seed) * 0.5;
    const mid = [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2];
    ring.push(B.vert(cx + Math.cos(a) * rx * k, cy + (hash2(seed + i, 3) - 0.5) * ry * 0.7, cz + Math.sin(a) * rz * k, Math.cos(a), 0.25, Math.sin(a), 0, 0, mid));
  }
  const b = B.vert(cx, cy - ry * 0.55, cz, 0, -1, 0, 0, 0, bot);
  for (let i = 0; i < 6; i++) { const r0 = ring[i], r1 = ring[(i + 1) % 6]; B.tri(t, r1, r0); B.tri(b, r0, r1); }
}
// liegender Zylinder (Baumstamm) von p0 nach p1
function addLog(B, x0, y0, z0, x1, y1, z1, r, seed) {
  const seg = 9, dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
  const ax = new THREE.Vector3(dx, dy, dz).normalize();
  const u = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
  const tint = 0.8 + hash2(seed, 5) * 0.3, steps = Math.max(1, Math.round(L / 3));
  const base = B.v;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, cxp = x0 + dx * t, cyp = y0 + dy * t, czp = z0 + dz * t;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const nx = u.x * ca + w.x * sa, ny = u.y * ca + w.y * sa, nz = u.z * ca + w.z * sa;
      const top = ny > 0.3 ? 0.5 : 0, c = [lerp(BARK[0] * tint, MOSS[0], top), lerp(BARK[1] * tint, MOSS[1], top), lerp(BARK[2] * tint, MOSS[2], top)];
      B.vert(cxp + nx * r, cyp + ny * r, czp + nz * r, nx, ny, nz, i / seg * 2, t * L / 5, c);
    }
  }
  const n = seg + 1;
  for (let k = 0; k < steps; k++) for (let i = 0; i < seg; i++) {
    const a = base + k * n + i, b = a + 1, c = a + n, d = c + 1;
    B.tri(a, b, c); B.tri(b, d, c);
  }
  // Schnittflächen (helles Holz)
  for (const [px, py, pz, s] of [[x0, y0, z0, -1], [x1, y1, z1, 1]]) {
    const wood = linCol(0xb08a5c), c0 = B.vert(px, py, pz, ax.x * s, ax.y * s, ax.z * s, 0.5, 0.5, wood), ring = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      ring.push(B.vert(px + (u.x * ca + w.x * sa) * r, py + (u.y * ca + w.y * sa) * r, pz + (u.z * ca + w.z * sa) * r, ax.x * s, ax.y * s, ax.z * s, 0.5 + ca * 0.5, 0.5 + sa * 0.5, wood));
    }
    for (let i = 0; i < seg; i++) { if (s > 0) B.tri(c0, ring[i], ring[(i + 1) % seg]); else B.tri(c0, ring[(i + 1) % seg], ring[i]); }
  }
}
// Farn: Wedel als gebogene, spitz zulaufende Streifen
const FERN = (() => {
  const p = [], c = [], ix = [], dark = linCol(0x2e4a1a), light = linCol(0x86b444);
  const rng = srng(99);
  for (let f = 0; f < 6; f++) {
    const a = f / 6 * TAU + (rng() - 0.5) * 0.5, L = 0.8 + rng() * 0.6, ca = Math.cos(a), sa = Math.sin(a), steps = 4, b = p.length / 3;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, d = L * t, y = L * (0.8 * t - 0.72 * t * t) + 0.04, w = 0.2 * L * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.02));
      const col = [lerp(dark[0], light[0], t), lerp(dark[1], light[1], t), lerp(dark[2], light[2], t)];
      p.push(ca * d - sa * w, y, sa * d + ca * w, ca * d + sa * w, y, sa * d - ca * w);
      c.push(...col, ...col);
    }
    for (let k = 0; k < steps; k++) { const i = b + k * 2; ix.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  }
  return { p, c, ix };
})();
function addFern(B, x, y, z, s, yaw, tint) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), base = B.v;
  for (let i = 0; i < FERN.p.length; i += 3) {
    const px = FERN.p[i] * s, pz = FERN.p[i + 2] * s;
    B.vert(x + px * cy - pz * sy, y + FERN.p[i + 1] * s, z + px * sy + pz * cy, 0, 1, 0, 0, 0, [FERN.c[i] * tint[0], FERN.c[i + 1] * tint[1], FERN.c[i + 2] * tint[2]]);
  }
  for (const k of FERN.ix) B.ix.push(base + k);
}
// Ewok-Plattform rund um einen Stamm
function addPlatform(B, x, y, z, r0, r1) {
  const seg = 14, wood = linCol(0x8a6440), base = B.v;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
    B.vert(x + ca * r0, y, z + sa * r0, 0, 1, 0, i / seg * 6, 0, wood);
    B.vert(x + ca * r1, y, z + sa * r1, 0, 1, 0, i / seg * 6, 1, wood);
    B.vert(x + ca * r1, y - 0.45, z + sa * r1, ca, 0, sa, i / seg * 6, 1.1, wood);
    B.vert(x + ca * r0, y - 0.45, z + sa * r0, 0, -1, 0, i / seg * 6, 0, wood);
  }
  for (let i = 0; i < seg; i++) {
    const a = base + i * 4, b = a + 4;
    B.tri(a, b, a + 1); B.tri(a + 1, b, b + 1);              // oben
    B.tri(a + 1, b + 1, a + 2); B.tri(a + 2, b + 1, b + 2);  // Rand
    B.tri(a + 3, a + 2, b + 3); B.tri(b + 3, a + 2, b + 2);  // unten
  }
}

// ---------------------------------------------------------------- Bunker
function bunkerMesh() {
  const B = ENDOR.bunker, H = Math.PI / 2;
  const C1 = 0x8a8f86, C2 = 0x737a72, C3 = 0x5a6058, DK = 0x121412, G = [];
  const slope = Math.atan2(2.2, 5.4);
  G.push(gBox(9, 5.8, B.d, 0, 2.9, B.d / 2, C1));                                 // Mittelteil mit Tor
  G.push(gBox(4.6, 3.7, 0.6, 0, 1.85, -0.1, DK));                                // Toröffnung
  G.push(gBox(0.55, 4.1, 0.8, -2.6, 2.05, -0.15, C2), gBox(0.55, 4.1, 0.8, 2.6, 2.05, -0.15, C2), gBox(5.8, 0.7, 0.8, 0, 4.05, -0.15, C2));
  G.push(gBox(4.4, 0.25, 0.2, 0, 3.5, -0.42, 0x3a3f3a));                        // halb hochgezogenes Schott
  for (const sx of [-1, 1]) {
    G.push(gProfile([[0.4, 0], [B.d, 0], [B.d, 5.4], [2.6, 5.4]], 7.2, 'x', C1, sx * 8.1, 0, 0));   // schräge Flügel
    for (let k = 0; k < 5; k++) {                                                // Lamellen
      const f = 0.14 + k * 0.17;
      G.push(gBox(6.2, 0.36, 0.16, sx * 8.1, 5.4 * f, 0.4 + 2.2 * f - 0.07, C3, slope));
      G.push(gBox(6.0, 0.12, 0.1, sx * 8.1, 5.4 * f - 0.26, 0.4 + 2.2 * (f - 0.048) - 0.1, DK, slope));
    }
    G.push(gBox(0.7, 5.4, 5.5, sx * 12.3, 2.7, 2.2, C2, 0, sx * 0.55));           // abgewinkelte Enden
    G.push(gBox(1.2, 0.5, 0.15, sx * 1.45, 4.85, -0.25, 0x2c302c));               // Nummernschilder
    for (let k = 0; k < 3; k++) G.push(gBox(0.22, 0.32, 0.06, sx * 1.45 + (k - 1) * 0.32, 4.85, -0.34, 0xc9c9c0));
  }
  G.push(gBox(0.7, 0.9, 0.2, 3.45, 1.35, -0.2, 0x2a2e2a), gBox(0.5, 0.12, 0.05, 3.45, 1.55, -0.32, 0x3a7a3a), gBox(0.5, 0.12, 0.05, 3.45, 1.3, -0.32, 0xa04020));   // Schaltpult
  G.push(gProfile([[-0.9, 5.3], [B.d + 0.5, 5.3], [B.d + 0.5, 6.4], [0.5, 6.4], [-0.9, 5.85]], 27.5, 'x', C2, 0, 0, 0));     // Dach
  G.push(gBox(3.0, 0.8, 2.2, -2, 6.8, 11, C3), gBox(1.6, 0.6, 1.6, 9.5, 6.7, 12, C3), gCyl(0.25, 0.25, 2.2, 8, 3.5, 7.5, 13, 0x4a4f4a));
  const m = vcMesh(G, MAT.building);
  m.position.set(B.x, WORLD.gen.y, B.z);
  return m;
}

// ---------------------------------------------------------------- Lichtstrahlen durch das Blätterdach
function lightShafts() {
  const tex = canvasTex(64, (ctx, s) => {
    const g1 = ctx.createLinearGradient(0, 0, 0, s);
    g1.addColorStop(0, 'rgba(255,255,255,0)'); g1.addColorStop(0.35, 'rgba(255,255,255,0.9)'); g1.addColorStop(0.75, 'rgba(255,255,255,0.7)'); g1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'destination-in';
    const g2 = ctx.createLinearGradient(0, 0, s, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
  });
  const rng = srng(31), parts = [], q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN_DIR);
  for (let i = 0; i < 34; i++) {
    const x = (rng() - 0.5) * 300, z = -230 + rng() * 280, w = 2.5 + rng() * 5, len = 70;
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(w, len);
      g.rotateY(k * Math.PI / 2 + rng());
      g.translate(0, len / 2, 0);
      g.applyQuaternion(q);
      g.translate(x, heightAt(x, z) - 2, z);
      parts.push(g);
    }
  }
  const geo = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(parts) : mergePlain(parts);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(0.3, 0.24, 0.14), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  m.renderOrder = 4;
  return m;
}
function mergePlain(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), ix = [];
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    for (const k of g.index.array) ix.push(k + o);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- Endor aufbauen
function buildEndor(root, quality) {
  root.add(buildForestTerrain());
  const L = forestLayout();
  ENDOR.trapSpots = L.traps;
  const CH = 160, chunks = new Map();
  const chunk = (x, z) => {
    const k = Math.floor(x / CH) * 100 + Math.floor(z / CH);
    let c = chunks.get(k); if (!c) chunks.set(k, c = { bark: new GeoBuf(), leaf: new GeoBuf() });
    return c;
  };
  const seg = quality === 0 ? 7 : 10;
  const leafTop = linCol(0x34552a), leafBot = linCol(0x142010);
  L.trees.forEach((t, i) => {
    const y = baseHeight(t.x, t.z), c = chunk(t.x, t.z);
    addTrunk(c.bark, t.x, y, t.z, t.r, t.h, i + 1, seg);
    OBST.add(t.x, t.z, t.r * 1.05, y - 2, t.h);
    // Äste mit Laub, erst in großer Höhe (typisch für Mammutbäume)
    const nb = 6 + (i % 4);
    for (let k = 0; k < nb; k++) {
      const f = 0.38 + 0.6 * k / nb, a = hash2(i, k) * TAU, rad = 3.5 + hash2(k, i) * 4.5 * (1 - f * 0.55);
      const d = t.r * (1 - f * 0.6) + rad * 0.6, s = 0.7 + hash2(i + k, 7) * 0.55, hue = hash2(k, i + 3) * 0.25;
      addBlob(c.leaf, t.x + Math.cos(a) * d, y + t.h * f, t.z + Math.sin(a) * d, rad * 1.25, rad * 0.7, rad * 1.1,
        [leafTop[0] * s * (1 + hue), leafTop[1] * s, leafTop[2] * s * (1 - hue)], leafBot, i * 13 + k);
    }
    addBlob(c.leaf, t.x, y + t.h + 1.5, t.z, 3, 4, 3, leafTop, leafBot, i * 7);
  });
  // Baumstämme am Boden
  L.logs.forEach((l, i) => {
    const y0 = baseHeight(l.x0, l.z0) + l.r * 0.8, y1 = baseHeight(l.x1, l.z1) + l.r * 0.8;
    addLog(chunk(l.x0, l.z0).bark, l.x0, y0, l.z0, l.x1, y1, l.z1, l.r, i + 3);
    const len = Math.hypot(l.x1 - l.x0, l.z1 - l.z0), n = Math.ceil(len / 0.9);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = lerp(l.x0, l.x1, t), z = lerp(l.z0, l.z1, t);
      OBST.add(x, z, l.r, lerp(y0, y1, t) - l.r * 1.6, l.r * 2.4, i % 2 ? 1 : -1);   // ganzer Stamm: gleiche Gleitrichtung
    }
  });
  // Ewok-Plattformen in den Bäumen nahe der Front
  let plat = 0;
  for (const t of L.trees) {
    if (plat >= 12 || Math.abs(t.x) > 150 || t.z < -150 || t.z > 45 || t.r < 1.1) continue;
    const y = baseHeight(t.x, t.z);
    addPlatform(chunk(t.x, t.z).bark, t.x, y + 9 + (plat % 3) * 2.5, t.z, t.r * 0.9, t.r + 2.6);
    plat++;
  }
  // Farne und Sträucher
  const rng = srng(77), nf = [700, 1800, 2600][quality | 0] || 1800;
  const fernBuf = new Map();
  const fchunk = (x, z) => { const k = Math.floor(x / CH) * 100 + Math.floor(z / CH); let b = fernBuf.get(k); if (!b) fernBuf.set(k, b = new GeoBuf()); return b; };
  for (let i = 0; i < nf; i++) {
    let x, z;
    if (i % 3 === 0 && L.trees.length) { const t = L.trees[(rng() * L.trees.length) | 0], a = rng() * TAU, d = t.r + 1 + rng() * 6; x = t.x + Math.cos(a) * d; z = t.z + Math.sin(a) * d; }
    else { x = (rng() - 0.5) * 520; z = -430 + rng() * 520; }
    const s = 1.1 + rng() * 1.3, yaw = rng() * TAU, tv = 0.75 + rng() * 0.45, ty = rng();
    if (Math.abs(x) < 16 && z > 40 && z < 51) continue;                         // vor dem Tor frei
    if (z < trenchZ(x) - 6 && ENDOR.lanes.some(l => Math.abs(x - l) < 3.5)) continue;
    if (Math.abs(x) < TR.len + 5 && Math.abs(z - trenchZ(x)) < 2.2) continue;
    addFern(fchunk(x, z), x, baseHeight(x, z) - 0.05, z, s, yaw, [tv * (0.9 + ty * 0.25), tv, tv * 0.85]);
  }
  // Farne auf dem Bunkerdach
  for (let i = 0; i < 26; i++) {
    const x = (rng() - 0.5) * 24, z = ENDOR.bunker.z + 1.5 + rng() * 6;
    addFern(fchunk(x, z), x, WORLD.gen.y + 6.4, z, 0.8 + rng() * 0.8, rng() * TAU, [1, 1, 0.9]);
  }
  for (const c of chunks.values()) {
    if (c.bark.v) { const m = new THREE.Mesh(c.bark.geometry(), MAT.bark); m.castShadow = m.receiveShadow = true; root.add(m); }
    if (c.leaf.v) { const m = new THREE.Mesh(c.leaf.geometry(), MAT.leaf); m.castShadow = true; m.receiveShadow = true; root.add(m); }
  }
  for (const b of fernBuf.values()) { const m = new THREE.Mesh(b.geometry(), MAT.leaf); m.receiveShadow = true; root.add(m); }
  // Bunker (Kollision als Quader)
  root.add(bunkerMesh());
  const B = ENDOR.bunker;
  OBST.addBox(B.x - B.w / 2 - 1, B.x + B.w / 2 + 1, B.z - 0.5, B.z + B.d, WORLD.gen.y - 2, WORLD.gen.y + B.h);
  ENDOR.shafts = lightShafts();
  ENDOR.shafts.visible = quality > 0;
  root.add(ENDOR.shafts);
}
// Bunkerdach als begehbarer Boden
function bunkerRoofAt(x, z) {
  const B = ENDOR.bunker;
  return Math.abs(x - B.x) < B.w / 2 + 1 && z > B.z - 0.5 && z < B.z + B.d ? WORLD.gen.y + B.h : -1e9;
}

// ============================================================================
//  Einheiten
// ============================================================================

// ---------------------------------------------------------------- Ewoks
function ewokGeos() {
  const H = Math.PI / 2, fur = 0x7a5a3e, light = 0xb39470, hood = 0xc89c6c, dark = 0x1a120c;
  return {
    body: mergeGeos([
      gCap(0.19, 0.2, 0, 0.5, 0, fur, 0, 0, 1.15, 1.05),                  // Körper
      gSph(0.14, 0, 0.47, 0.1, light, 1, 1.2, 0.6),                        // Bauch
      gSph(0.19, 0, 0.86, 0.02, fur),                                      // Kopf
      gSph(0.085, 0, 0.82, 0.16, light, 1, 0.8, 1),                        // Schnauze
      gSph(0.03, 0, 0.85, 0.24, dark), gSph(0.028, -0.075, 0.92, 0.16, dark), gSph(0.028, 0.075, 0.92, 0.16, dark),
      gSph(0.215, 0, 0.9, -0.015, hood, 1, 1, 1, 12, true),                // Kapuze
      gCyl(0.16, 0.25, 0.32, 10, 0, 0.72, -0.06, hood),
      gSph(0.06, -0.13, 1.07, -0.02, fur, 1, 1.2, 0.7), gSph(0.06, 0.13, 1.07, -0.02, fur, 1, 1.2, 0.7),   // Ohren
      gCap(0.055, 0.2, -0.19, 0.55, 0.08, fur, 0.9), gCap(0.055, 0.2, 0.19, 0.55, 0.08, fur, 0.9),
      gCyl(0.014, 0.014, 1.5, 5, 0.19, 0.78, 0.12, 0x6b4a2a, 0.25),       // Speer
      gCyl(0.0, 0.03, 0.14, 5, 0.19, 1.52, 0.31, 0x8a8a84, 0.25),
    ]),
    leg: mergeGeos([gCap(0.07, 0.12, 0, -0.14, 0, fur), gSph(0.075, 0, -0.27, 0.04, 0x5a4230, 1, 0.6, 1.3)]),
  };
}
class EwokRenderer {
  constructor(max) {
    const g = ewokGeos();
    this.body = new THREE.InstancedMesh(g.body, MAT.soldier, max);
    this.legL = new THREE.InstancedMesh(g.leg, MAT.soldier, max);
    this.legR = new THREE.InstancedMesh(g.leg, MAT.soldier, max);
    const tints = [[1, 1, 1], [0.6, 0.58, 0.56], [1.18, 1.12, 1.05], [0.88, 0.76, 0.66], [0.5, 0.42, 0.38], [1.05, 0.95, 0.8]];
    const c = new THREE.Color();
    for (const m of [this.body, this.legL, this.legR]) {
      m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.castShadow = true; m.receiveShadow = true;
      for (let i = 0; i < max; i++) { const t = tints[i % tints.length]; m.setColorAt(i, c.setRGB(t[0], t[1], t[2])); }
    }
    this.max = max;
  }
  addTo(scene) { scene.add(this.body); scene.add(this.legL); scene.add(this.legR); }
  update(list) {
    let n = 0;
    for (const s of list) {
      if (s.special !== 'ewok' || n >= this.max) continue;
      const i = n++;
      const hop = s.moving && s.alive ? Math.abs(Math.sin(s.phase)) * 0.13 : 0;
      _e.set(-s.fall * 1.45, s.yaw, 0, 'YXZ'); _q.setFromEuler(_e);
      _v3.set(s.pos.x, s.pos.y + hop, s.pos.z);
      _m.compose(_v3, _q, _one);
      this.body.setMatrixAt(i, _m);
      const sw = s.moving && s.alive ? Math.sin(s.phase) * 0.7 : 0;
      for (let k = 0; k < 2; k++) {
        _e.set(k ? -sw : sw, 0, 0); _q.setFromEuler(_e);
        _v1.set(k ? 0.09 : -0.09, 0.3, 0);
        _m2.compose(_v1, _q, _one); _m2.premultiply(_m);
        (k ? this.legR : this.legL).setMatrixAt(i, _m2);
      }
    }
    for (const m of [this.body, this.legL, this.legR]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
  }
}

function makeEwok(x, z) {
  const s = new Soldier(REB, x, z, 2);
  s.special = 'ewok'; s.r = 0.3; s.h = 1.1; s.ah = 0.85;
  s.home = new V3(x, 0, z); s.yaw = Math.PI; s.fireCd = rand(1, 4);
  return s;
}
function updateEwok(s, dt) {
  if (!s.alive) {
    if (s.fall < 1) s.fall = Math.min(1, s.fall + dt * 2.5);
    s.deadT += dt;
    if (s.livesLeft > 0 && s.deadT > 18) {        // weitere Ewoks kommen aus dem Wald
      s.livesLeft--; s.alive = true; s.fall = 0; s.deadT = 0; s.target = null; s.state = 'hold'; s.stateT = rand(1, 3);
      s.pos.set(s.home.x + rand(-15, 15), 0, s.home.z - rand(0, 20)); s.pos.y = heightAt(s.pos.x, s.pos.z);
    }
    return;
  }
  s.thinkCd -= dt;
  if (s.thinkCd <= 0) { s.thinkCd = rand(0.7, 1.4); s.target = soldierTarget(s, 60); }
  if (s.target && !targetAlive(s.target)) s.target = null;
  s.moving = false; s.stateT -= dt;
  if (s.state === 'advance') {
    const dx = s.goal.x - s.pos.x, dz = s.goal.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.4 || s.stateT <= 0) { s.state = 'hold'; s.stateT = s.target ? rand(1.5, 4) : rand(2, 6); }
    else { const sp = 3.3 * dt; s.pos.x += dx / d * sp; s.pos.z += dz / d * sp; s.moving = true; if (!s.target) s.yaw = Math.atan2(dx, dz); }
  } else if (s.stateT <= 0) {
    s.state = 'advance'; s.stateT = rand(2, 4);
    if (s.target && s.target.pos.distanceTo(s.pos) > 30) {     // aus dem Hinterhalt näher heran
      const a = Math.atan2(s.target.pos.x - s.pos.x, s.target.pos.z - s.pos.z) + rand(-0.6, 0.6);
      s.goal.set(s.pos.x + Math.sin(a) * 8, 0, s.pos.z + Math.cos(a) * 8);
    } else s.goal.set(s.pos.x + rand(-10, 10), 0, s.pos.z + rand(-10, 10));
    // nicht zu weit von der eigenen Stellung entfernen
    const hx = s.goal.x - s.home.x, hz = s.goal.z - s.home.z, hd = Math.hypot(hx, hz);
    if (hd > 35) { s.goal.x = s.home.x + hx / hd * 35; s.goal.z = s.home.z + hz / hd * 35; }
  }
  if (OBST.n) pushOutWorld(s.pos, 0.3);
  s.pos.y = heightAt(s.pos.x, s.pos.z);
  if (s.moving) s.phase += dt * 13;
  if (s.target) {
    const dx = s.target.pos.x - s.pos.x, dz = s.target.pos.z - s.pos.z;
    s.yaw += angDiff(s.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 7);
    s.fireCd -= dt;
    if (s.fireCd <= 0 && dx * dx + dz * dz < 44 * 44) {
      s.fireCd = rand(2.2, 4.2);
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      _v1.set(s.pos.x + sn * 0.4, s.pos.y + 0.85, s.pos.z + c * 0.4);
      aimPoint(s.target, _v2); _v2.y += Math.hypot(dx, dz) * 0.02;
      fireBolt(7, REB, _v1, _v2, 0.04, s);
    }
  } else s.fireCd = Math.max(s.fireCd - dt, 0.4);
}

// ---------------------------------------------------------------- Helden
function heroGeos(kind) {
  const H = Math.PI / 2;
  if (kind === 'chewie') {
    const fur = 0x6e4a2c, fur2 = 0x5a3b22, face = 0x8a6a48, belt = 0x3a2a1a, dark = 0x1a1410;
    return {
      hip: 1.12, legGap: 0.17,
      body: mergeGeos([
        gCap(0.28, 0.62, 0, 1.6, 0, fur, 0, 0, 1.15, 0.9),                 // Körper
        gCyl(0.3, 0.34, 0.35, 10, 0, 1.15, 0, fur2),
        gSph(0.19, 0, 2.15, 0.02, fur, 1, 1.12, 1),                         // Kopf
        gSph(0.11, 0, 2.08, 0.15, face, 1, 0.9, 0.8), gSph(0.04, 0, 2.11, 0.25, dark),
        gSph(0.025, -0.07, 2.2, 0.17, dark), gSph(0.025, 0.07, 2.2, 0.17, dark),
        gBox(0.09, 0.95, 0.06, 0, 1.6, 0.27, belt, 0, 0, 0.62), gBox(0.09, 0.95, 0.06, 0, 1.6, -0.27, belt, 0, 0, 0.62),   // Patronengurt
        gBox(0.06, 0.07, 0.04, 0.08, 1.72, 0.3, 0x9a9a92), gBox(0.06, 0.07, 0.04, -0.1, 1.5, 0.3, 0x9a9a92),
        gCap(0.08, 0.42, -0.31, 1.62, 0.18, fur, H * 0.9), gCap(0.08, 0.42, 0.31, 1.62, 0.18, fur, H * 0.9),   // Arme
        gBox(0.08, 0.14, 0.75, 0.04, 1.62, 0.5, 0x4a3828), gBox(0.4, 0.06, 0.06, 0.04, 1.69, 0.72, 0x3a2a1a),    // Bogenspanner
        gCyl(0.03, 0.03, 0.2, 6, 0.04, 1.62, 0.95, dark, H),
      ]),
      leg: mergeGeos([gCap(0.12, 0.72, 0, -0.5, 0, fur), gSph(0.12, 0, -1.06, 0.05, fur2, 1.1, 0.6, 1.4)]),
    };
  }
  const shirt = 0xe6dfcc, vest = 0x1d1d20, pants = 0x2a3248, skin = 0xd9a37c, hair = 0x5a3a22, dark = 0x1a1a1a;
  return {
    hip: 0.92, legGap: 0.12,
    body: mergeGeos([
      gCap(0.19, 0.36, 0, 1.25, 0, shirt, 0, 0, 1.2, 0.85),
      gBox(0.17, 0.5, 0.06, -0.12, 1.27, 0.15, vest), gBox(0.17, 0.5, 0.06, 0.12, 1.27, 0.15, vest), gBox(0.42, 0.52, 0.06, 0, 1.27, -0.16, vest),
      gCyl(0.24, 0.24, 0.07, 12, 0, 0.98, 0, 0x3a2a1c),                     // Gürtel
      gBox(0.1, 0.24, 0.12, -0.22, 0.86, 0.05, 0x3a2a1c),                   // Holster
      gSph(0.12, 0, 1.66, 0.01, skin, 1, 1.1, 1),
      gSph(0.128, 0, 1.7, -0.02, hair, 1, 0.9, 1.05, 12, true),
      gCap(0.06, 0.28, -0.2, 1.32, 0.16, shirt, H), gCap(0.06, 0.26, 0.2, 1.32, 0.15, shirt, H),
      gSph(0.05, -0.1, 1.32, 0.36, skin), gSph(0.05, 0.12, 1.31, 0.33, skin),
      gBox(0.05, 0.12, 0.3, 0.12, 1.33, 0.45, dark), gCyl(0.03, 0.03, 0.18, 6, 0.12, 1.36, 0.62, dark, H),   // DL-44
    ]),
    leg: mergeGeos([gCap(0.085, 0.58, 0, -0.38, 0, pants), gBox(0.02, 0.6, 0.02, 0.085, -0.35, 0, 0xa02a20), gBox(0.18, 0.3, 0.27, 0, -0.76, 0.03, 0x2a1d14)]),
  };
}
class HeroMesh {
  constructor(kind, name) {
    const g = heroGeos(kind);
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.root.add(new THREE.Mesh(g.body, MAT.soldier));
    this.legs = [-1, 1].map(sd => {
      const p = new THREE.Group(); p.position.set(sd * g.legGap, g.hip, 0);
      p.add(new THREE.Mesh(g.leg, MAT.soldier)); this.root.add(p); return p;
    });
    shadowify(this.root);
    G.dyn.add(this.root);
    this.sprite = nameSprite(name, REB); this.sprite.scale.multiplyScalar(0.8);
    G.dyn.add(this.sprite);
    this.top = kind === 'chewie' ? 2.75 : 2.2;
  }
  sync(s) {
    this.root.position.copy(s.pos);
    this.root.rotation.set(-s.fall * 1.45, s.yaw, 0);
    const sw = s.moving && s.alive ? Math.sin(s.phase) * 0.55 : 0;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.sprite.visible = s.alive && s.pos.distanceTo(SFX.listener) < 70;
    this.sprite.position.set(s.pos.x, s.pos.y + this.top, s.pos.z);
  }
}
function makeHero(kind, x) {
  const s = new Soldier(REB, x, trenchZ(x) + rand(-0.4, 0.1), 3);
  s.special = 'hero'; s.heroKind = kind; s.name = kind === 'chewie' ? 'Chewbacca' : 'Han Solo';
  if (kind === 'chewie') { s.h = 2.3; s.ah = 2.0; s.r = 0.45; }
  s.mesh = new HeroMesh(kind, s.name);
  return s;
}

// ---------------------------------------------------------------- R2-D2 und C-3PO am Bunkertor
let GOLD = null;
class Droids {
  constructor() {
    const H = Math.PI / 2, gy = WORLD.gen.y, B = ENDOR.bunker;
    if (!GOLD) GOLD = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.2 });
    // R2-D2 arbeitet am Schaltpult neben dem Tor
    const W = 0xe8ecf0, BL = 0x2a52b0, S = 0xc4c8ce;
    this.r2 = new THREE.Group(); this.r2.position.set(B.x + 3.4, gy, B.z - 0.95); this.r2.rotation.y = 0;
    this.r2body = vcMesh([gCyl(0.25, 0.25, 0.6, 16, 0, 0.55, 0, W), gBox(0.18, 0.28, 0.05, 0, 0.6, 0.23, BL), gBox(0.08, 0.2, 0.05, -0.15, 0.55, 0.19, BL, 0, 0.6),
      gBox(0.08, 0.2, 0.05, 0.15, 0.55, 0.19, BL, 0, -0.6), gBox(0.12, 0.06, 0.05, 0, 0.36, 0.24, S),
      gBox(0.1, 0.62, 0.16, -0.31, 0.42, 0, W), gBox(0.1, 0.62, 0.16, 0.31, 0.42, 0, W), gBox(0.11, 0.3, 0.1, -0.32, 0.5, 0.01, BL), gBox(0.11, 0.3, 0.1, 0.32, 0.5, 0.01, BL),
      gBox(0.16, 0.08, 0.26, -0.31, 0.06, 0.02, S), gBox(0.16, 0.08, 0.26, 0.31, 0.06, 0.02, S), gCyl(0.06, 0.09, 0.2, 8, 0, 0.12, 0, S)], MAT.vehicle);
    this.r2.add(this.r2body);
    this.dome = new THREE.Group(); this.dome.position.y = 0.85;
    this.dome.add(vcMesh([gSph(0.25, 0, 0, 0, S, 1, 1, 1, 16, true), gBox(0.1, 0.08, 0.05, 0, 0.12, 0.22, BL), gBox(0.08, 0.06, 0.05, 0.12, 0.08, 0.19, BL, 0, 0.5),
      gSph(0.05, 0, 0.13, 0.21, 0x101010), gBox(0.2, 0.04, 0.05, 0, 0.03, 0.235, BL)], MAT.vehicle));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(5, 0.4, 0.3) }));
    eye.position.set(-0.1, 0.06, 0.22); this.dome.add(eye);
    this.r2.add(this.dome);
    // C-3PO steht aufgeregt daneben
    const Au = 0xd8ac3e, Ag = 0xc2c6cc, dk = 0x3a2c18;
    this.c3 = new THREE.Group(); this.c3.position.set(B.x - 2.2, gy, B.z - 2.2); this.c3.rotation.y = Math.PI;
    this.c3.add(new THREE.Mesh(mergeGeos([gCap(0.17, 0.32, 0, 1.28, 0, Au, 0, 0, 1.2, 0.85), gCyl(0.1, 0.14, 0.2, 10, 0, 0.98, 0, dk),
      gCyl(0.17, 0.19, 0.16, 12, 0, 0.88, 0, Au), gCyl(0.06, 0.06, 0.12, 8, 0, 1.56, 0, dk),
      gCap(0.06, 0.38, -0.1, 0.45, 0, Au), gCap(0.06, 0.38, 0.1, 0.45, 0, Ag), gBox(0.14, 0.07, 0.24, -0.1, 0.05, 0.04, Au), gBox(0.14, 0.07, 0.24, 0.1, 0.05, 0.04, Au)]), GOLD));
    this.head = new THREE.Group(); this.head.position.y = 1.68;
    this.head.add(new THREE.Mesh(mergeGeos([gSph(0.13, 0, 0, 0, Au, 1, 1.05, 1), gBox(0.03, 0.03, 0.05, 0, -0.05, 0.12, dk)]), GOLD));
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 2.6, 0.5) }));
      e.position.set(sx * 0.045, 0.02, 0.12); this.head.add(e);
    }
    this.c3.add(this.head);
    this.arms = [-1, 1].map(sx => {
      const a = new THREE.Group(); a.position.set(sx * 0.24, 1.45, 0);
      a.add(new THREE.Mesh(mergeGeos([gCap(0.05, 0.42, 0, -0.27, 0, Au)]), GOLD)); this.c3.add(a); return a;
    });
    for (const g of [this.r2, this.c3]) { shadowify(g); G.dyn.add(g); }
    this.t = 0; this.beepT = rand(2, 5); this.talkT = 7; this.wave = 0; this.lastGen = G.genHP;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    // R2: Kuppel dreht, Körper wippt, ab und zu Funken am Schaltpult
    this.dome.rotation.y = Math.sin(t * 0.7) * 1.2 + Math.sin(t * 2.3) * 0.2;
    this.r2body.rotation.z = Math.sin(t * 5) * 0.03;
    this.beepT -= dt;
    if (this.beepT <= 0) {
      this.beepT = rand(3, 8);
      SFX.r2(this.r2.position);
      if (Math.random() < 0.4) FX.sparks(_v1.set(this.r2.position.x + 0.05, this.r2.position.y + 1.35, this.r2.position.z + 0.6), 6, 0.5, 0.7, 1);
    }
    // C-3PO: schaut hin und her, wedelt bei Gefahr mit den Armen
    if (G.genHP < this.lastGen - 0.01) this.wave = 3;
    this.lastGen = G.genHP;
    this.wave = Math.max(0, this.wave - dt);
    this.head.rotation.y = Math.sin(t * 0.9) * 0.7;
    const up = this.wave > 0 ? 1 : 0.15;
    this.arms[0].rotation.x = -up * (1.6 + Math.sin(t * 9) * 0.5); this.arms[1].rotation.x = -up * (1.5 + Math.cos(t * 8) * 0.5);
    this.arms[0].rotation.z = -0.2; this.arms[1].rotation.z = 0.2;
    this.talkT -= dt;
    if (this.talkT <= 0 || (this.wave > 2.9 && this.talkT < 40)) {
      this.talkT = rand(45, 80);
      G.msg('C-3PO: ' + pick(this.wave > 0 ? C3PO_PANIC : C3PO_LINES), 'c3po');
    }
  }
}
const C3PO_LINES = ['R2, beeil dich mit der Tür! Wir sind hier vollkommen ungeschützt!', 'Ich bin für Protokoll programmiert, nicht für Gefechte!',
  'Oh je, oh je. Ich habe ein ganz schlechtes Gefühl dabei.', 'Die Ewoks sind auf unserer Seite – welch ein Glück!'];
const C3PO_PANIC = ['Sie schießen auf den Bunker! Wir werden alle zerstört!', 'R2, schneller! Das Tor hält nicht mehr lange!'];

// ---------------------------------------------------------------- Ewok-Baumstammfallen
let LOG_GEO = null;
class LogTrap {
  constructor(i, x, z) {
    this.i = i; this.x = x; this.z = z; this.type = 'trap';
    const gy = heightAt(x, z);
    this.top = gy + 17; this.rope = 10.4;            // Stämme treffen auf Höhe der AT-ST-Kanzel
    this.state = 0; this.t = 0; this.ang = 1.25; this.vel = 0; this.owner = null; this.hitDone = false; this.wait = 0;
    if (!LOG_GEO) {
      const b = new GeoBuf();
      addLog(b, 0, 0, -3.6, 0, 0, 3.6, 0.7, 11);
      LOG_GEO = { log: b.geometry(), rope: mergeGeos([gCyl(0.035, 0.035, 1, 4, 0, 0.5, -2.8, 0xb8a27a), gCyl(0.035, 0.035, 1, 4, 0, 0.5, 2.8, 0xb8a27a)]) };
    }
    this.root = new THREE.Group(); this.root.position.set(x, this.top, z);
    this.arms = [-1, 1].map(sd => {
      const g = new THREE.Group(); g.userData.sd = sd;
      const log = new THREE.Mesh(LOG_GEO.log, MAT.bark); log.position.y = -this.rope; g.add(log);
      const rope = new THREE.Mesh(LOG_GEO.rope, MAT.bark); rope.scale.y = this.rope; rope.position.y = -this.rope; g.add(rope);
      this.root.add(g); return g;
    });
    shadowify(this.root);
    G.dyn.add(this.root);
    this.pose();
  }
  pose() { for (const g of this.arms) g.rotation.z = g.userData.sd * this.ang; }
  get armed() { return this.state === 0; }
  trigger(owner, fromNet) {
    if (this.state !== 0) return;
    this.state = 1; this.t = 0; this.vel = 0; this.owner = owner || null; this.hitDone = false; this.wait = 0;
    if (!fromNet) G.msg('Die Ewoks lösen eine Baumstammfalle aus!', 'trap');
    SFX.horn(_v1.set(this.x, this.top - 6, this.z));
  }
  update(dt) {
    this.t += dt;
    if (this.state === 1 || this.state === 2) {
      // Pendel: beide Stämme schwingen zur Mitte und prallen dort zusammen
      this.vel += -4.2 * Math.sin(this.ang) * dt;
      this.vel *= Math.exp(-dt * (this.state === 2 ? 1.2 : 0.15));
      this.ang += this.vel * dt;
      if (this.ang < 0.07) {
        this.ang = 0.07; this.vel = Math.abs(this.vel) * 0.3;
        if (!this.hitDone) { this.hitDone = true; this.smash(); }
      }
      if (this.state === 1 && this.t > 2.5) { this.state = 2; this.t = 0; }
      if (this.state === 2 && this.t > 40) { this.state = 3; this.t = 0; }
    } else if (this.state === 3) {                     // Ewoks ziehen die Stämme wieder hoch
      this.ang = lerp(this.ang, 1.25, Math.min(1, dt * 0.8));
      if (this.t > 5) { this.ang = 1.25; this.state = 0; }
    }
    this.pose();
    if (this.state === 0 && !G.visualOnly) {
      // Ewoks oben in den Bäumen lösen aus, wenn ein AT-ST darunter läuft – nicht immer rechtzeitig.
      // Solange noch Ewoks in der Schlacht sind; danach nur noch per Hand (Rebellen-Spieler).
      const under = G.atsts.find(w => w.alive && Math.hypot(w.pos.x - this.x, w.pos.z - this.z) < 6.5);
      if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) this.trigger(null); }
      else if (under && under !== this.seen) {
        this.seen = under;
        if (Math.random() < 0.6 && G.rebels.some(s => s.special === 'ewok' && s.alive)) this.wait = rand(0.4, 3);
      }
    }
  }
  smash() {
    _v1.set(this.x, this.top - this.rope, this.z);
    SFX.boom(_v1, 1.6); FX.sparks(_v1, 12, 1, 0.7, 0.3); FX.addShake(_v1, 2);
    if (G.visualOnly) return;
    for (const w of G.atsts) {
      if (!w.alive || Math.hypot(w.pos.x - this.x, w.pos.z - this.z) > 4.5) continue;
      G.msg('Ein AT-ST wurde von einer Ewok-Falle zerschmettert!', 'kill');
      w.damage(99, this.owner);
    }
  }
}

// ---------------------------------------------------------------- Sprengladungen am Bunkertor
function plantCharge(owner, fromNet) {
  const p = new V3(WORLD.gen.x + rand(-1.5, 1.5), WORLD.gen.y + 1.1, WORLD.gen.z - 0.45);
  const mesh = vcMesh([gBox(0.35, 0.25, 0.12, 0, 0, 0, 0x2a2c30), gBox(0.08, 0.06, 0.04, 0.08, 0.06, -0.08, 0xd9541e)], MAT.vehicle);
  mesh.position.copy(p); G.dyn.add(mesh);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(8, 0.5, 0.2) }));
  led.position.set(-0.08, 0.06, -0.07); mesh.add(led);
  G.charges.push({ p, t: 5, owner, mesh, led, beep: 1 });
  if (G.netChargeHook && !fromNet) G.netChargeHook(owner);
  G.msg('Sprengladung am Bunkertor angebracht – noch 5 Sekunden!', 'charge');
}
function updateCharges(dt) {
  for (let i = G.charges.length - 1; i >= 0; i--) {
    const c = G.charges[i];
    c.t -= dt; c.beep -= dt;
    c.led.visible = Math.sin(c.t * (c.t < 1.5 ? 30 : 10)) > 0;
    if (c.beep <= 0) { c.beep = c.t < 1.5 ? 0.25 : 1; if (c.p.distanceTo(SFX.listener) < 40) SFX.click(); }
    if (c.t <= 0) {
      G.dyn.remove(c.mesh); G.charges.splice(i, 1);
      if (G.visualOnly) { FX.explosion(c.p, 3.2); SFX.boom(c.p, 2.5); }
      else { explode(c.p, 4.5, IMP, c.owner, null); damageGenerator(28); }
    }
  }
}

// ---------------------------------------------------------------- Schlacht auf Endor
function setupEndorBattle(cfg) {
  G.genMax = G.genHP = 110;
  const nR = Math.min(cfg.rebels | 0, MAX_REBELS);
  for (let i = 0; i < nR; i++) {
    let x = -TR.len + 6 + (i + 0.5) / nR * (2 * TR.len - 12) + rand(-1.5, 1.5);
    if (Math.abs(x) < 9) x += Math.sign(x || 1) * 6;
    G.rebels.push(new Soldier(REB, x, trenchZ(x) + rand(-0.5, 0.1), clamp(cfg.rebLives | 0 || 1, 1, 5)));
  }
  G.rebels.push(makeHero('han', -4.5), makeHero('chewie', 4.5));
  const nE = clamp(cfg.ewoks | 0, 0, MAX_EWOKS);
  for (let i = 0; i < nE; i++) {
    let x, z;
    // Ewoks lauern an den Fallen und an den Flanken im Wald
    if (i % 3 === 0) { const t = ENDOR.trapSpots[(i / 3 | 0) % ENDOR.trapSpots.length]; x = t.x + rand(-16, 16); z = t.z + rand(-5, 25); }
    else { const side = i % 2 ? 1 : -1; x = side * rand(45, 120); z = rand(-90, -10); }
    G.rebels.push(makeEwok(x, z));
  }
  // Sturmtruppen: eine Welle Verstärkung (jeder Gefallene kehrt einmal zurück)
  for (let i = 0; i < Math.min(cfg.troopers | 0, MAX_TROOPERS); i++) G.imps.push(new Soldier(IMP, rand(-130, 130), rand(-240, -150), 2));
  for (let i = 0; i < (cfg.atst | 0); i++) {
    const lane = ENDOR.lanes[i % ENDOR.lanes.length];
    G.atsts.push(new ATST(lane + rand(-2, 2), rand(-330, -270) - Math.floor(i / 4) * 45));
  }
  const B = ENDOR.bunker, nT = clamp(cfg.bunkerGuns === undefined ? 2 : cfg.bunkerGuns | 0, 0, 2);
  for (let i = 0; i < nT; i++) G.turrets.push(new Turret(B.x + (i ? 7 : -7) * (nT === 1 ? 0 : 1), B.z + 4.5, { roof: true, y: WORLD.gen.y + B.h }));
  G.traps = ENDOR.trapSpots.map((t, i) => new LogTrap(i, t.x, t.z));
  G.droids = new Droids();
  G.charges = [];
}

// Pro Frame: Fallen, Sprengladungen, Droiden, Sturmtruppen am Tor
function updateEndor(dt) {
  for (const t of G.traps) t.update(dt);
  updateCharges(dt);
  if (G.droids) G.droids.update(dt);
  if (!G.visualOnly && G.genHP > 0) {
    // Sturmtruppen, die bis ans Tor durchkommen, sprengen es langsam auf
    let n = 0;
    for (const s of G.imps) if (s.alive && Math.abs(s.pos.x - WORLD.gen.x) < 12 && WORLD.gen.z - s.pos.z < 12) n++;
    if (n) {
      damageGenerator(n * 0.3 * dt);
      G.msg('Sturmtruppen sprengen das Bunkertor auf!', 'sap');
      if (Math.random() < dt * 3) FX.sparks(_v1.set(WORLD.gen.x + rand(-2, 2), WORLD.gen.y + rand(0.5, 2.5), WORLD.gen.z - 0.5), 5, 1, 0.6, 0.2);
    }
  }
}
function drawEndor() {
  if (MAP.id !== 'endor') return;
  ewokR.update(G.rebels);
  for (const s of G.rebels) if (s.special === 'hero') s.mesh.sync(s);
}

// Spieler zu Fuß: Falle auslösen (Rebellen) bzw. Sprengladung anbringen (Imperium)
function endorUse(prompts, use) {
  if (MAP.id !== 'endor') return;
  if (P.faction === REB) {
    let best = null, bd = 15;
    for (const t of G.traps) { const d = Math.hypot(t.x - P.pos.x, t.z - P.pos.z); if (t.armed && d < bd) { bd = d; best = t; } }
    if (!best) return;
    prompts.push('[E] Ewok-Baumstammfalle auslösen');
    if (use) { if (NET.mode === 'client') NET.send({ t: 'trap', i: best.i }); else best.trigger(P); }
  } else if (G.genHP > 0 && Math.abs(P.pos.x - WORLD.gen.x) < 6 && WORLD.gen.z - P.pos.z < 5) {
    if (P.charges <= 0) { prompts.push('Keine Sprengladung mehr (eine pro Leben)'); return; }
    prompts.push('[E] Sprengladung am Bunkertor anbringen');
    if (use) { P.charges--; if (NET.mode === 'client') NET.send({ t: 'charge' }); else plantCharge(P); }
  }
}
