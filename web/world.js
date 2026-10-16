'use strict';
// ============================================================================
//  Battle of Hoth - Welt: Hilfsfunktionen, Gelände, Himmel, Kulissen,
//  Partikel und Sound
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
  gen: new THREE.Vector3(0, 0, 190),          // Schildgenerator
  pad: new THREE.Vector3(45, 0, 62),           // Landeplattform der Schneegleiter
  hangar: new THREE.Vector3(-70, 0, 262),
};
const TR = { depth: 1.05, half: 1.25, berm: 0.3, bermW: 3.2, len: 175 };   // Schützengraben

function trenchZ(x) { return 3.5 * Math.sin(x * 0.027) + 1.8 * Math.sin(x * 0.083 + 1.3); }

function baseHeightRaw(x, z) {
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
  if (Math.abs(x) < TR.len + 8) {
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
  return true;
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
  const pos = new Float32Array(nr * nc * 3), col = new Float32Array(nr * nc * 3);
  const trenchMask = new Float32Array(nr * nc);
  for (let j = 0; j < nr; j++) {
    const v = rows[j], w = 1 - smooth(30, 80, Math.abs(v));
    for (let i = 0; i < nc; i++) {
      const x = cols[i], z = v + trenchZ(x) * w, k = j * nc + i;
      pos[k * 3] = x; pos[k * 3 + 1] = heightAt(x, z); pos[k * 3 + 2] = z;
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const nrm = g.attributes.normal.array;
  for (let k = 0; k < nr * nc; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const n = vnoise(x * 0.08, z * 0.08) * 0.05;
    let r = 0.9 + n, gg = 0.93 + n, b = 0.98 + n * 0.5;
    const ny = nrm[k * 3 + 1];
    const rock = y > 12 ? smooth(0.82, 0.6, ny) : 0;
    r = lerp(r, 0.5, rock); gg = lerp(gg, 0.53, rock); b = lerp(b, 0.58, rock);
    const t = trenchMask[k] * 0.22;
    r -= t; gg -= t * 0.85; b -= t * 0.6;
    col[k * 3] = r; col[k * 3 + 1] = gg; col[k * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

// ---------------------------------------------------------------- Geometrie-Helfer
const VCMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
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
function mergeGeos(list) {
  let total = 0;
  const parts = list.map(g => { const ng = g.index ? g.toNonIndexed() : g; total += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere();
  return m;
}
function vcMesh(list) { return new THREE.Mesh(mergeGeos(list), VCMAT); }

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); return t;
}

// ---------------------------------------------------------------- Himmel & Kulisse
function buildSky(scene) {
  const g = new THREE.SphereGeometry(2400, 32, 16);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const top = new THREE.Color(0x5f8fc8), hor = new THREE.Color(0xd5e1ec), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = clamp(p.getY(i) / 2400, 0, 1);
    c.copy(hor).lerp(top, Math.pow(t, 0.55));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  const cloudTex = canvasTex(128, (ctx, s) => {
    for (let i = 0; i < 14; i++) {
      const x = rand(30, 98), y = rand(50, 80), r = rand(16, 34);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  });
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, opacity: rand(0.6, 0.95) }));
    const a = rand(0, TAU), d = rand(1300, 1900);
    s.position.set(Math.sin(a) * d, rand(250, 650), Math.cos(a) * d);
    const sc = rand(500, 1000); s.scale.set(sc, sc * 0.6, 1);
    s.renderOrder = -9;
    scene.add(s);
  }

  // Sternenzerstörer
  const sh = new THREE.Shape();
  sh.moveTo(0, 160); sh.lineTo(70, -110); sh.lineTo(-70, -110); sh.lineTo(0, 160);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 22, bevelEnabled: false });
  hull.rotateX(-Math.PI / 2); paint(hull, 0xb9c1cb);
  const sd = mergeGeos([hull,
    gBox(60, 14, 70, 0, 28, -70, 0xaeb6c0), gBox(34, 14, 26, 0, 42, -86, 0xa7afb9),
    gBox(60, 6, 10, 0, 52, -92, 0xb2bac4), gCyl(5, 5, 5, 10, -18, 57, -92, 0xa0a8b2), gCyl(5, 5, 5, 10, 18, 57, -92, 0xa0a8b2)]);
  const sdMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, emissive: 0x5d6670 });
  [[-380, 560, -1500, 1.0, 0.3], [520, 700, -1800, 0.8, -0.2]].forEach(([x, y, z, s, r]) => {
    const m = new THREE.Mesh(sd, sdMat);
    m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(-0.08, r, 0.04);
    m.renderOrder = -8;
    scene.add(m);
  });
}

function buildBaseProps(scene) {
  const group = new THREE.Group();
  // Schildgenerator (Kuppel mit Antenne)
  const gy = heightAt(WORLD.gen.x, WORLD.gen.z);
  const dome = new THREE.SphereGeometry(14, 28, 12, 0, TAU, 0, Math.PI / 2); paint(dome, 0x9ba1a8);
  const gen = vcMesh([dome,
    gCyl(14.6, 15.2, 1.2, 28, 0, 0.3, 0, 0x6e747b),
    gCyl(2.2, 3, 6, 12, 0, 16, 0, 0x7d838a),
    gCyl(6, 0.6, 2.5, 18, 0, 19.5, 0, 0xa8aeb5),
    gBox(1.2, 6, 0.8, 4, 12.5, 7, 0x7d838a), gBox(1.2, 6, 0.8, -4, 12.5, 7, 0x7d838a),
    gBox(30, 0.5, 0.6, 0, 6, 13.4, 0x5e646b, 0.4),
  ]);
  gen.position.set(WORLD.gen.x, gy - 0.5, WORLD.gen.z);
  group.add(gen);
  WORLD.gen.y = gy;

  // Hangar von Echo Base im Berg
  const hy = heightAt(WORLD.hangar.x, WORLD.hangar.z);
  const hangar = vcMesh([
    gBox(46, 20, 26, 0, 10, 0, 0xcfd3d8), gBox(36, 13, 1, 0, 6.5, -13.2, 0x2a2d33),
    gBox(48, 2, 28, 0, 20.5, 0, 0xb8bcc2), gBox(4, 20, 2, -21, 10, -13.5, 0xa9adb3), gBox(4, 20, 2, 21, 10, -13.5, 0xa9adb3),
  ]);
  hangar.position.set(WORLD.hangar.x, hy - 2, WORLD.hangar.z);
  group.add(hangar);

  // Ionenkanone
  const ion = vcMesh([new THREE.SphereGeometry(9, 18, 12).translate(0, 12, 0), gCyl(4, 6, 8, 14, 0, 3, 0, 0x8a9097),
    gCyl(1.4, 1.4, 14, 10, 0, 21, 5, 0x6e747b, 0.7)].map((g, i) => (i === 0 ? paint(g, 0xa3a9b0) : g)));
  ion.position.set(110, heightAt(110, 240) - 0.5, 240);
  group.add(ion);

  // Landeplattform
  const py = heightAt(WORLD.pad.x, WORLD.pad.z);
  const pad = vcMesh([gCyl(16, 16.5, 0.6, 32, 0, 0.1, 0, 0x8c9299), gCyl(13, 13, 0.62, 32, 0, 0.12, 0, 0xa6acb3),
    gBox(1, 0.64, 26, 0, 0.12, 0, 0xd9541e), gBox(26, 0.64, 1, 0, 0.12, 0, 0xd9541e)]);
  pad.position.set(WORLD.pad.x, py, WORLD.pad.z);
  group.add(pad);

  // Radarschüssel & Kisten entlang des Grabens
  const crates = [];
  for (let i = 0; i < 46; i++) {
    const x = rand(-TR.len + 5, TR.len - 5), z = trenchZ(x) + rand(3.5, 14);
    const y = heightAt(x, z), s = rand(0.7, 1.2);
    crates.push(gBox(1.1 * s, 0.8 * s, 0.9 * s, x, y + 0.35 * s, z, Math.random() < 0.5 ? 0x3d4148 : 0x585d64, 0, rand(0, 3)));
  }
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 60 + rand(-10, 10), z = trenchZ(x) + rand(22, 40), y = heightAt(x, z);
    crates.push(gCyl(0.25, 0.4, 2.2, 8, x, y + 1.1, z, 0x6a7077));
    crates.push(gCyl(1.6, 0.2, 0.7, 14, x, y + 2.4, z + 0.3, 0xb5bbc2, -0.7));
  }
  group.add(vcMesh(crates));

  // Felsen in der Ebene
  const rocks = [];
  for (let i = 0; i < 60; i++) {
    const x = rand(-320, 320), z = rand(-650, -40);
    if (Math.abs(z - trenchZ(x)) < 20) continue;
    const s = rand(1, 4.5), g = new THREE.DodecahedronGeometry(s, 0);
    g.scale(1, rand(0.4, 0.8), 1); g.translate(x, heightAt(x, z) + s * 0.1, z);
    rocks.push(paint(g, Math.random() < 0.6 ? 0x7c838c : 0xe2e8ef));
  }
  group.add(vcMesh(rocks));
  scene.add(group);
}

// ---------------------------------------------------------------- Partikel (ein Draw-Call pro System)
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1);
    [this.aPos, this.aCol, this.aSize, this.aAlpha].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol);
    g.setAttribute('psize', this.aSize); g.setAttribute('palpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float scale;
        varying vec3 vC; varying float vA;
        void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = max(1.0, psize*scale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard;
          float a=(1.0-d); a=a*a*vA; gl_FragColor=vec4(vC,a); }`,
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
    this.grav[i] = grav; this.drag[i] = drag;
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
  copy(dst, src) {
    for (let k = 0; k < 3; k++) { this.p[dst * 3 + k] = this.p[src * 3 + k]; this.v[dst * 3 + k] = this.v[src * 3 + k]; this.c[dst * 3 + k] = this.c[src * 3 + k]; }
    this.life[dst] = this.life[src]; this.maxLife[dst] = this.maxLife[src]; this.s0[dst] = this.s0[src]; this.s1[dst] = this.s1[src];
    this.a0[dst] = this.a0[src]; this.grav[dst] = this.grav[src]; this.drag[dst] = this.drag[src];
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
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array, A = this.aAlpha.array;
    for (let j = 0; j < this.n; j++) {
      const t = 1 - this.life[j] / this.maxLife[j];
      P[j * 3] = this.p[j * 3]; P[j * 3 + 1] = this.p[j * 3 + 1]; P[j * 3 + 2] = this.p[j * 3 + 2];
      C[j * 3] = this.c[j * 3]; C[j * 3 + 1] = this.c[j * 3 + 1]; C[j * 3 + 2] = this.c[j * 3 + 2];
      S[j] = lerp(this.s0[j], this.s1[j], t);
      A[j] = this.a0[j] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}

const FX = {
  fire: null, smoke: null,
  init(scene) {
    this.smoke = new Particles(2500, false); this.fire = new Particles(2500, true);
    this.smoke.points.renderOrder = 5; this.fire.points.renderOrder = 6;
    scene.add(this.smoke.points); scene.add(this.fire.points);
  },
  setScale(px) { this.smoke.mat.uniforms.scale.value = px; this.fire.mat.uniforms.scale.value = px; },
  clear() { this.fire.clear(); this.smoke.clear(); },
  update(dt) { this.fire.update(dt); this.smoke.update(dt); },
  sparks(p, n, r, g, b) {
    for (let i = 0; i < n; i++) this.fire.spawn(p.x, p.y, p.z, rand(-4, 4), rand(0, 5), rand(-4, 4), rand(0.15, 0.4), 0.25, 0.05, r, g, b, 1, 9, 1);
  },
  snowPuff(p, big) {
    const n = big ? 10 : 4;
    for (let i = 0; i < n; i++) this.smoke.spawn(p.x, p.y + 0.1, p.z, rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5), rand(0.5, 1.0), 0.4, big ? 2.5 : 1.2, 0.95, 0.97, 1, 0.8, 3, 2);
  },
  muzzle(p, f) {
    const r = f === REB ? 1 : 0.4, g = f === REB ? 0.4 : 1, b = 0.3;
    this.fire.spawn(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.5, 0.2, r, g, b, 1);
  },
  explosion(p, size) {
    const n = Math.min(40, 8 + size * 5);
    for (let i = 0; i < n; i++) {
      const s = size * 1.5;
      this.fire.spawn(p.x, p.y, p.z, rand(-s, s) * 1.5, rand(0, s * 1.8), rand(-s, s) * 1.5, rand(0.3, 0.8), size * 0.9, size * 2.4, 1, rand(0.45, 0.75), 0.2, 1, 2, 2.5);
    }
    for (let i = 0; i < n * 0.7; i++) {
      this.smoke.spawn(p.x + rand(-1, 1), p.y + rand(0, 1), p.z + rand(-1, 1), rand(-2, 2), rand(1.5, 4) * Math.sqrt(size), rand(-2, 2), rand(1.5, 3.5), size * 1.2, size * 4, 0.22, 0.22, 0.24, 0.75, -0.3, 0.8);
    }
    this.snowPuff(p, true);
  },
  smokeColumn(p, intensity) {
    this.smoke.spawn(p.x + rand(-1, 1), p.y, p.z + rand(-1, 1), rand(-0.5, 0.5) + 1.2, rand(2, 4), rand(-0.5, 0.5), rand(3, 5), 1.5 * intensity, 6 * intensity, 0.12, 0.12, 0.13, 0.6, -0.2, 0.2);
    if (Math.random() < 0.4) this.fire.spawn(p.x + rand(-0.6, 0.6), p.y, p.z + rand(-0.6, 0.6), 0, rand(1, 2), 0, 0.5, 1.2 * intensity, 0.4, 1, 0.5, 0.15, 0.9);
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
    const tex = canvasTex(32, (ctx, s) => { const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 32, 32); });
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, map: tex, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0;
  }
  update(dt, cam) {
    this.t += dt;
    const a = this.attr.array, o = this.off, B = this.box, H = B / 2;
    for (let i = 0; i < this.n; i++) {
      o[i * 3 + 1] -= dt * 1.6; o[i * 3] += dt * 1.8;
      if (o[i * 3 + 1] < -10) o[i * 3 + 1] += 35;
      let x = ((o[i * 3] - cam.x) % B + B) % B - H, z = ((o[i * 3 + 2] - cam.z) % B + B) % B - H;
      a[i * 3] = cam.x + x + Math.sin(this.t + i) * 0.3; a[i * 3 + 1] = cam.y + o[i * 3 + 1]; a[i * 3 + 2] = cam.z + z;
    }
    this.attr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Sound (synthetisch, keine Dateien)
const SFX = {
  ctx: null, master: null, noise: null, listener: new THREE.Vector3(), budget: 0, enabled: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      // Wind
      const w = this.ctx.createBufferSource(); w.buffer = buf; w.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      const wg = this.ctx.createGain(); wg.gain.value = 0.06;
      w.connect(bp); bp.connect(wg); wg.connect(this.master); w.start();
    } catch (e) { this.ctx = null; }
  },
  vol(p) { if (!p) return 1; const d = p.distanceTo(this.listener); return 1 / (1 + d / 18); },
  tick(dt) { this.budget = Math.min(14, this.budget + dt * 40); },
  blaster(p, f, heavy) {
    if (!this.ctx || !this.enabled) return;
    const v = this.vol(p); if (v < 0.04 || this.budget < 1) return; this.budget -= 1;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth';
    const f0 = heavy ? 700 : (f === REB ? 1700 : 1250);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(heavy ? 70 : 150, t + (heavy ? 0.35 : 0.17));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.4 : 0.2));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.45);
  },
  boom(p, size) {
    if (!this.ctx || !this.enabled) return;
    const v = Math.min(1, this.vol(p) * size * 0.6); if (v < 0.03) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(80, t + 1.2);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    s.connect(lp); lp.connect(g); g.connect(this.master); s.start(t); s.stop(t + 1.5);
  },
  thump(p) {
    if (!this.ctx || !this.enabled) return;
    const v = this.vol(p) * 3; if (v < 0.05) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.3);
    g.gain.setValueAtTime(Math.min(0.7, v), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.45);
  },
  click() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = 1800;
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.07);
  },
};
