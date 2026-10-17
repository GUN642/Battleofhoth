'use strict';
// ============================================================================
//  Battle of Hoth - Spieler, Steuerung, HUD, Menüs und Hauptschleife
// ============================================================================

const $ = (id) => document.getElementById(id);
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const MAX_REBELS = 60, MAX_TROOPERS = 150, MAX_EWOKS = 40;

// ---------------------------------------------------------------- Einstellungen
//  map: Einstellung gilt nur auf dieser Karte (sonst ausgeblendet)
const SETTINGS = [
  { key: 'map', group: 'Schlachtfeld', label: 'Karte', min: 0, max: 1, def: 0, names: ['Hoth', 'Endor'], wide: true },
  { key: 'faction', label: 'Du kämpfst für', min: 0, max: 1, def: 0, names: ['Rebellen', 'Imperium'], wide: true },
  { key: 'rebels', group: 'Truppen', label: 'Rebellen', min: 0, max: MAX_REBELS, def: 20 },
  { key: 'rebLives', label: 'Leben pro Rebell (KI)', min: 1, max: 5, def: 3 },
  { key: 'ewoks', label: 'Ewoks', min: 0, max: MAX_EWOKS, def: 18, map: 1 },
  { key: 'troopers', label: 'Sturmtruppen', min: 0, max: MAX_TROOPERS, def: 40 },
  { key: 'atst', label: 'AT-ST', min: 0, max: 10, def: 3 },
  { key: 'atat', label: 'AT-AT', min: 0, max: 6, def: 2, map: 0 },
  { key: 'aiSpeeders', label: 'Schneegleiter (KI)', min: 0, max: 8, def: 2, map: 0 },
  { key: 'turrets', label: 'Geschütztürme', min: 0, max: 12, def: 6, map: 0 },
  { key: 'bunkerGuns', label: 'Geschütze auf dem Bunker', min: 0, max: 2, def: 2, map: 1 },
  { key: 'lives', group: 'Spiel', label: 'Deine Leben', min: 1, max: 10, def: 3 },
  { key: 'diff', label: 'Schwierigkeit', min: 0, max: 2, def: 1, names: ['Leicht', 'Normal', 'Schwer'] },
  { key: 'sens', label: 'Blick-Empfindlichkeit', min: 1, max: 10, def: 5 },
  { key: 'gfx', label: 'Grafik', min: 0, max: 2, def: 1, names: ['Niedrig', 'Mittel', 'Hoch'] },
  { key: 'padLayout', label: 'Controller-Tasten', min: 0, max: 1, def: 0, names: ['Nintendo', 'Xbox / PlayStation'], wide: true },
];
const CFG = {};
SETTINGS.forEach(s => (CFG[s.key] = s.def));
try { Object.assign(CFG, JSON.parse(localStorage.getItem('hothCfg') || '{}')); } catch (e) { /* kein Speicher */ }
function saveCfg() { try { localStorage.setItem('hothCfg', JSON.stringify(CFG)); } catch (e) { /* egal */ } }

function buildSettingsUI() {
  const root = $('settings');
  root.innerHTML = '';
  const mapNo = CFG.map === 1 ? 1 : 0;
  for (const s of SETTINGS) {
    if (s.map !== undefined && s.map !== mapNo) continue;
    if (s.group) { const g = document.createElement('div'); g.className = 'group'; g.textContent = s.group; root.append(g); }
    const div = document.createElement('div'); div.className = 'set' + (s.wide ? ' wide' : '');
    if (s.names) {          // Auswahl als Segment-Schalter
      const lab = document.createElement('label'); lab.textContent = s.label;
      const seg = document.createElement('div'); seg.className = 'seg';
      CFG[s.key] = clamp(+CFG[s.key] | 0, s.min, s.max);
      s.names.forEach((n, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.tabIndex = -1;
        b.classList.toggle('on', CFG[s.key] === i);
        b.addEventListener('click', () => {
          CFG[s.key] = i; saveCfg();
          seg.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i));
          if (s.key === 'gfx') applyGfx();
          if (s.key === 'map') onMapSetting();
        });
        seg.append(b);
      });
      // Controller/Fernbedienung: links/rechts wechselt die Auswahl, OK schaltet weiter
      div._step = (d, wrap) => {
        let i = (CFG[s.key] | 0) + d;
        if (wrap) i = (i - s.min + (s.max - s.min + 1)) % (s.max - s.min + 1) + s.min;
        i = clamp(i, s.min, s.max);
        if (i !== CFG[s.key]) seg.children[i - s.min].click();
      };
      div.append(lab, seg); root.append(div);
      continue;
    }
    const lab = document.createElement('label');
    const name = document.createElement('span'); name.textContent = s.label;
    const val = document.createElement('b');
    lab.append(name, val);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = 1; inp.value = clamp(+CFG[s.key], s.min, s.max);
    if (+CFG[s.key] !== +inp.value) CFG[s.key] = +inp.value;
    const show = () => {
      CFG[s.key] = +inp.value; val.textContent = s.names ? s.names[CFG[s.key]] : CFG[s.key];
      inp.style.setProperty('--p', ((CFG[s.key] - s.min) / (s.max - s.min) * 100).toFixed(1) + '%');
    };
    inp.addEventListener('input', () => { show(); saveCfg(); if (s.key === 'gfx') applyGfx(); });
    // Regler dürfen keinen Tastatur-Fokus bekommen (sonst "fangen" sie die Pfeiltasten)
    inp.tabIndex = -1;
    inp.addEventListener('focus', () => inp.blur());
    div._step = (d, wrap) => {
      if (wrap) return;
      const v = clamp(+inp.value + d, s.min, s.max);
      if (v !== +inp.value) { inp.value = v; inp.dispatchEvent(new Event('input')); }
    };
    show();
    div.append(lab, inp); root.append(div);
  }
}

// ---------------------------------------------------------------- Renderer & Szene
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new PostFX(renderer);
const scene = new THREE.Scene();
scene.background = HORIZON.clone();
scene.fog = new THREE.Fog(HORIZON.clone(), 120, 1100);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 5000);
camera.rotation.order = 'YXZ';
scene.add(camera);
const hemi = new THREE.HemisphereLight(new THREE.Color().setRGB(0.55, 0.65, 0.85), new THREE.Color().setRGB(0.55, 0.58, 0.62), 0.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1.0, 0.93, 0.82), 1.45);
sun.position.copy(SUN_DIR).multiplyScalar(200);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

buildTextures();
buildMaterials();
setMap(CFG.map === 1 ? 'endor' : 'hoth');
FX.init(scene);
const snow = new SnowFall(scene, 900);
G.scene = scene;
G.dyn = new THREE.Group(); scene.add(G.dyn);
const rebR = new SoldierRenderer(REB, MAX_REBELS), impR = new SoldierRenderer(IMP, MAX_TROOPERS);
rebR.addTo(scene); impR.addTo(scene);
const ewokR = new EwokRenderer(MAX_EWOKS);
ewokR.addTo(scene);

// ---------------------------------------------------------------- Karten laden (Hoth / Endor)
const worldRoot = new THREE.Group(); scene.add(worldRoot);
let loadedMap = null;
function disposeTree(root) {
  const keep = new Set([...Object.values(MAT_HI), ...Object.values(MAT_LO)]);
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !keep.has(o.material)) { if (o.material.map && !Object.values(TEX).includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); }
  });
  root.clear();
}
function loadMap(id) {
  id = id === 'endor' || id === 1 ? 'endor' : 'hoth';
  if (loadedMap === id) return;
  clearBattle();
  disposeTree(worldRoot);
  if (loadedMap !== null || MAP.id !== id) setMap(id);
  loadedMap = id;
  const L = MAP.look;
  buildEnvironment(renderer, scene);
  scene.background.copy(HORIZON); scene.fog.color.copy(HORIZON); scene.fog.near = L.fog[0]; scene.fog.far = L.fog[1];
  sun.color.setRGB(...L.sunCol); sun.intensity = L.sunI;
  hemi.color.setRGB(...L.hemiSky); hemi.groundColor.setRGB(...L.hemiGnd);
  renderer.toneMappingExposure = L.exposure;
  if (id === 'endor') { buildSky(worldRoot); buildEndor(worldRoot, CFG.gfx | 0); }
  else { worldRoot.add(buildTerrainMesh()); buildSky(worldRoot); buildBaseProps(worldRoot); }
  snow.setStyle(id === 'endor');
  restyleSoldiers();
  applyGfx();
  updateMenuText();
}
// Menütexte passend zur Karte
function updateMenuText() {
  const e = MAP.id === 'endor';
  document.querySelector('#menu .kicker').textContent = e ? 'Rebellen-Allianz · Endor' : 'Rebellen-Allianz · Echo Base';
  document.querySelector('#menu h1').innerHTML = e ? 'Battle<br>of Endor' : 'Battle<br>of Hoth';
  document.querySelector('#menu .sub').textContent = e
    ? 'Auf dem Waldmond Endor verteidigen Rebellen, Han Solo, Chewbacca und die Ewoks den Bunkereingang gegen Sturmtruppen und AT-STs.'
    : 'Die imperiale Armee landet auf Hoth. Verteidige als Rebell den Schützengraben – oder führe als Imperialer die AT-ATs gegen Echo Base.';
}
function onMapSetting() {
  buildSettingsUI();
  if (state === 'menu') startDemo();
}
const boltRed = new BoltRenderer(3.2, 0.06, 0.03, 500), boltGreen = new BoltRenderer(0.12, 3.0, 0.06, 500);
boltRed.addTo(scene); boltGreen.addTo(scene);

// Grafikstufen: 0 Niedrig (keine Schatten/kein Bloom), 1 Mittel, 2 Hoch (große Schatten, Kantenglättung)
const GFX = [
  { pr: 0.75, shadow: 0, bloom: false, msaa: 0, lights: false, low: true },
  { pr: 1.25, shadow: 1024, bloom: true, msaa: 0, lights: true, low: false },
  { pr: 2.0, shadow: 2048, bloom: true, msaa: 4, lights: true, low: false },
];
let gfx = GFX[1];
function applyGfx() {
  gfx = GFX[CFG.gfx | 0] || GFX[1];
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, gfx.pr));
  sun.castShadow = gfx.shadow > 0;
  if (gfx.shadow) {
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(gfx.shadow, gfx.shadow);
    const S = gfx.shadow > 1024 ? 85 : 60, c = sun.shadow.camera;
    c.left = -S; c.right = S; c.top = S; c.bottom = -S; c.near = 1; c.far = 500; c.updateProjectionMatrix();
  }
  FX.setLights(gfx.lights);
  setMaterialQuality(scene, gfx.low);
  hemi.intensity = gfx.low ? 0.75 : MAP.look.hemi;
  if (ENDOR.shafts) ENDOR.shafts.visible = !gfx.low && MAP.id === 'endor';
  onResize();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  FX.setScale(buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
  post.configure(gfx.bloom, gfx.msaa, buf.x, buf.y);
}
// Schattenkamera folgt dem Spieler (auf Texel gerastert, damit nichts flimmert)
const _shadowFocus = new THREE.Vector3();
function updateSun() {
  if (!sun.castShadow) return;
  camera.getWorldDirection(_shadowFocus);
  _shadowFocus.y = 0; _shadowFocus.normalize().multiplyScalar(sun.shadow.camera.right * 0.6).add(camera.position);
  const step = sun.shadow.camera.right * 2 / sun.shadow.mapSize.x * 4;
  _shadowFocus.x = Math.round(_shadowFocus.x / step) * step; _shadowFocus.z = Math.round(_shadowFocus.z / step) * step;
  _shadowFocus.y = heightAt(_shadowFocus.x, _shadowFocus.z);
  sun.target.position.copy(_shadowFocus);
  sun.position.copy(SUN_DIR).multiplyScalar(220).add(_shadowFocus);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------- Waffen
//  kind = Lasertyp (KIND in units.js), rate = Sekunden zwischen Schüssen, heat = Hitze pro Schuss,
//  hip/ads = Streuung aus der Hüfte / mit Visier, zoom = Sichtfeld beim Zielen, scope = Zielfernrohr-Bild
const WEAPONS = [
  { names: ['A280-Blastergewehr', 'E-11-Blastergewehr'], short: 'Gewehr', kind: 0, rate: 0.17, heat: 0.075, hip: 0.012, ads: 0.0008, zoom: 28, scope: true, range: 320, cool: 1.6 },
  { names: ['Z-6-Rotationsblaster', 'DLT-19-Repetierblaster'], short: 'Repetierer', kind: 6, rate: 0.075, heat: 0.042, hip: 0.03, ads: 0.014, zoom: 50, scope: false, range: 260, cool: 2.4 },
  { names: ['DLT-20A-Präzisionsgewehr', 'E-11s-Präzisionsgewehr'], short: 'Präzision', kind: 5, rate: 0.9, heat: 0.3, hip: 0.03, ads: 0, zoom: 11, scope: true, range: 650, cool: 2 },
  { names: ['Thermaldetonator', 'Thermaldetonator'], short: 'Detonator', nade: true, rate: 0.9, zoom: 72 },
];
const NADES_PER_LIFE = 3;

// Ego-Ansicht: ein Modell je Seite und Waffe; tip = Laufmündung
const gun = new THREE.Group();
const gunModels = [[], []];
{
  const H = Math.PI / 2;
  const mk = (parts, tip) => { const m = vcMesh(parts, MAT.gun); m.castShadow = false; m.visible = false; m.userData.tip = tip; gun.add(m); return m; };
  const nade = (glove) => mk([gSph(0.075, 0.0, -0.02, -0.2, 0x55595f, 1, 1, 1, 14), gCyl(0.077, 0.077, 0.025, 14, 0, -0.02, -0.2, 0x2a2c30),
    gBox(0.03, 0.02, 0.02, 0, 0.055, -0.2, 0xd9541e), gBox(0.11, 0.08, 0.17, -0.02, -0.07, -0.06, glove), gSph(0.05, -0.02, -0.07, -0.16, glove)], -0.2);
  // Rebellen
  gunModels[REB] = [
    mk([gBox(0.065, 0.085, 0.42, 0, 0, -0.06, 0x2a2c30), gBox(0.05, 0.12, 0.2, 0, -0.06, 0.18, 0x4a3a2c),
      gCyl(0.028, 0.028, 0.36, 12, 0, 0.012, -0.44, 0x1c1d20, H), gCyl(0.018, 0.018, 0.08, 10, 0, 0.012, -0.66, 0x111214, H),
      gBox(0.02, 0.03, 0.02, 0, 0.05, -0.56, 0x1c1d20), gCyl(0.018, 0.018, 0.18, 10, 0, 0.07, -0.08, 0x3a3d42, H),
      gBox(0.03, 0.05, 0.16, -0.045, -0.01, -0.18, 0x1c1d20), gBox(0.04, 0.085, 0.045, 0, -0.08, -0.12, 0x26282b),
      gBox(0.016, 0.02, 0.06, 0.04, 0.03, -0.25, 0xd9541e), gBox(0.1, 0.075, 0.18, -0.025, -0.07, 0.06, 0xcfc3a6), gSph(0.045, -0.025, -0.09, 0.12, 0x6b5a48)], -0.72),
    mk([gBox(0.1, 0.11, 0.38, 0, -0.01, -0.02, 0x34373c), gCyl(0.05, 0.05, 0.12, 14, 0, 0.0, -0.26, 0x24262a, H),
      gBox(0.03, 0.06, 0.2, 0, 0.09, -0.04, 0x24262a), gBox(0.08, 0.1, 0.12, 0, -0.1, 0.06, 0x5a4632), gBox(0.04, 0.09, 0.05, 0, -0.09, -0.1, 0x24262a),
      gBox(0.11, 0.075, 0.18, -0.03, -0.07, 0.1, 0xcfc3a6), gSph(0.045, -0.03, -0.09, 0.16, 0x6b5a48)], -0.78),
    mk([gBox(0.055, 0.08, 0.5, 0, 0, -0.02, 0x3a2f24), gBox(0.05, 0.11, 0.2, 0, -0.05, 0.24, 0x4a3a2c),
      gCyl(0.02, 0.02, 0.62, 12, 0, 0.012, -0.58, 0x1c1d20, H), gCyl(0.03, 0.03, 0.06, 12, 0, 0.012, -0.9, 0x111214, H),
      gCyl(0.028, 0.028, 0.3, 12, 0, 0.085, -0.1, 0x2a2c30, H), gCyl(0.034, 0.034, 0.03, 12, 0, 0.085, -0.26, 0x101418, H),
      gBox(0.04, 0.085, 0.045, 0, -0.08, -0.08, 0x26282b), gBox(0.1, 0.075, 0.18, -0.025, -0.07, 0.1, 0xcfc3a6), gSph(0.045, -0.025, -0.09, 0.16, 0x6b5a48)], -0.95),
    nade(0xcfc3a6),
  ];
  // Imperium (schwarze Waffen, weißer Panzerhandschuh)
  gunModels[IMP] = [
    mk([gBox(0.06, 0.08, 0.36, 0, 0, -0.08, 0x18191b), gCyl(0.032, 0.032, 0.3, 12, 0, 0.01, -0.36, 0x222326, H),
      gCyl(0.02, 0.02, 0.06, 10, 0, 0.01, -0.54, 0x0e0e0f, H), gCyl(0.017, 0.017, 0.2, 10, 0, 0.068, -0.1, 0x3a3d42, H),
      gBox(0.022, 0.07, 0.07, -0.042, -0.035, -0.12, 0x18191b), gBox(0.04, 0.09, 0.045, 0, -0.08, -0.04, 0x18191b),
      gBox(0.02, 0.02, 0.18, 0, -0.02, 0.12, 0x2a2b2e), gBox(0.1, 0.08, 0.17, -0.025, -0.07, 0.05, 0xf2f2f2), gSph(0.045, -0.025, -0.09, 0.0, 0x1a1a1a)], -0.58),
    mk([gBox(0.07, 0.09, 0.5, 0, 0, -0.1, 0x18191b), gCyl(0.03, 0.03, 0.45, 12, 0, 0.01, -0.55, 0x222326, H),
      gCyl(0.04, 0.04, 0.02, 12, 0, 0.01, -0.4, 0x3a3d42, H), gCyl(0.04, 0.04, 0.02, 12, 0, 0.01, -0.5, 0x3a3d42, H), gCyl(0.04, 0.04, 0.02, 12, 0, 0.01, -0.6, 0x3a3d42, H),
      gBox(0.012, 0.12, 0.012, 0.03, -0.07, -0.7, 0x2a2b2e, 0.3), gBox(0.012, 0.12, 0.012, -0.03, -0.07, -0.7, 0x2a2b2e, 0.3),
      gBox(0.04, 0.09, 0.045, 0, -0.08, -0.05, 0x18191b), gBox(0.1, 0.08, 0.17, -0.025, -0.07, 0.07, 0xf2f2f2), gSph(0.045, -0.025, -0.09, 0.02, 0x1a1a1a)], -0.8),
    mk([gBox(0.06, 0.08, 0.4, 0, 0, -0.08, 0x18191b), gCyl(0.024, 0.024, 0.55, 12, 0, 0.01, -0.5, 0x222326, H),
      gCyl(0.03, 0.03, 0.05, 10, 0, 0.01, -0.8, 0x0e0e0f, H), gCyl(0.03, 0.03, 0.3, 12, 0, 0.085, -0.12, 0x2a2c30, H),
      gCyl(0.036, 0.036, 0.03, 12, 0, 0.085, -0.28, 0x101418, H), gBox(0.04, 0.09, 0.045, 0, -0.08, -0.04, 0x18191b),
      gBox(0.1, 0.08, 0.17, -0.025, -0.07, 0.05, 0xf2f2f2), gSph(0.045, -0.025, -0.09, 0.0, 0x1a1a1a)], -0.85),
    nade(0xf2f2f2),
  ];
  // Rotierende Laufgruppe des Z-6
  const barrels = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; barrels.push(gCyl(0.012, 0.012, 0.45, 8, Math.cos(a) * 0.028, Math.sin(a) * 0.028, -0.5, 0x1a1b1d, H)); }
  barrels.push(gCyl(0.045, 0.045, 0.02, 12, 0, 0, -0.68, 0x2a2c30, H));
  const spin = new THREE.Mesh(mergeGeos(barrels), MAT.gun); spin.castShadow = false;
  gunModels[REB][1].add(spin); gunModels[REB][1].userData.spin = spin;
}
gun.position.set(0.13, -0.12, -0.3); gun.scale.setScalar(IS_TOUCH ? 0.34 : 0.4); gun.rotation.y = 0.06;
const gunTip = new THREE.Object3D(); gunTip.position.set(0, 0.012, -0.72); gun.add(gunTip);
function setGunModel(f, w) {
  gunModels.forEach((list, ff) => list.forEach((m, ww) => { m.visible = ff === f && ww === w; }));
  gunTip.position.z = gunModels[f][w].userData.tip;
}
function setGunFaction(f) { setGunModel(f, P.weapon); }
camera.add(gun);

// ---------------------------------------------------------------- Spieler
const P = G.player = {
  type: 'player', faction: REB, mode: 'spectate', alive: false, pos: new V3(), yaw: 0, pitch: 0, vy: 0, onGround: true, walker: null,
  lives: 0, kills: 0, heat: 0, overheat: 0, fireCd: 0, respawnT: 0, turret: null, speeder: null,
  weapon: 0, heats: [0, 0, 0, 0], overheats: [0, 0, 0, 0], nades: NADES_PER_LIFE, switchT: 0, spin: 0, charges: 1,
  bob: 0, recoil: 0, god: 0, deathCause: '',
  exitTurret(destroyed) {
    const t = this.turret; if (!t) return;
    t.manned = false; t.mannedBy = null; this.turret = null; this.mode = 'foot';
    const back = trenchZ(t.pos.x) < t.pos.z ? 3 : -3;
    if (t.roof) this.pos.set(t.pos.x * 0.5, 0, ENDOR.bunker.z - 2);          // vom Bunkerdach vor das Tor
    else this.pos.set(t.pos.x + 1, 0, t.pos.z + back);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.yaw = t.aimYaw - Math.PI; this.pitch = 0;
    if (destroyed) G.msg('Du wurdest aus dem zerstörten Turm geschleudert!', 'turret2');
  },
  speederDestroyed() { const sp = this.speeder; this.speeder = null; killPlayer('Schneegleiter abgeschossen', sp ? sp.pos : null); },
  exitWalker() {
    const w = this.walker; if (!w) return;
    w.pilot = null; w.ctrl.fire = false; w.ctrl.fwd = 0; w.target = null; w.thinkCd = 0;
    if (w.goal) { w.goal.copy(w.pos); w.goalT = 0; }
    this.walker = null; this.mode = 'foot';
    const side = w.type === 'atat' ? 9 : 3.5;
    this.pos.set(w.pos.x + Math.cos(w.yaw) * side, 0, w.pos.z - Math.sin(w.yaw) * side);
    this.pos.y = heightAt(this.pos.x, this.pos.z); this.onGround = true; this.pitch = 0;
  },
};
const WALKER_NAME = { atst: 'AT-ST', atat: 'AT-AT' };

function spawnPlayer(first) {
  if (P.faction === IMP) {
    // Imperium: neben einem freien Läufer absetzen (AT-ST bevorzugt), sonst hinter den Sturmtruppen
    const free = G.atsts.concat(G.atats).filter(w => w.alive && !w.pilot && !w.tangled);
    const w = free.find(v => v.type === 'atst') || free[0];
    if (w) {
      const side = (w.type === 'atat' ? 9 : 3.3) * (Math.random() < 0.5 ? 1 : -1);
      P.pos.set(w.pos.x + Math.cos(w.yaw) * side, 0, w.pos.z - Math.sin(w.yaw) * side - 1.5);
      if (w.goal) { w.goal.copy(w.pos); w.goalT = 8; }          // Läufer wartet kurz auf seinen Piloten
    } else {
      const zs = G.imps.filter(s => s.alive).map(s => s.pos.z);
      P.pos.set(rand(-30, 30), 0, (zs.length ? Math.min(...zs) : -250) - 15);
    }
    P.yaw = Math.PI;
  } else {
    const x = first ? 0 : rand(-25, 25);
    P.pos.set(x, 0, trenchZ(x) + 0.2);
    P.yaw = 0;
  }
  P.pos.y = heightAt(P.pos.x, P.pos.z);
  P.pitch = 0.03; P.vy = 0; P.mode = 'foot'; P.alive = true; P.heat = 0; P.overheat = 0;
  P.heats.fill(0); P.overheats.fill(0); P.nades = NADES_PER_LIFE; P.switchT = 0; P.charges = 1;
  P.god = first ? 0 : 2.5; P.turret = null; P.speeder = null; P.walker = null;
  input.zoomToggle = false;
  $('dead').classList.add('hidden');
}

// Waffe wechseln (0..3); Hitze und Überhitzung bleiben je Waffe erhalten
function selectWeapon(w) {
  w = ((w % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  if (w === P.weapon) return;
  P.heats[P.weapon] = P.heat; P.overheats[P.weapon] = P.overheat;
  P.weapon = w; P.heat = P.heats[w]; P.overheat = P.overheats[w];
  P.switchT = 0.35; P.fireCd = Math.max(P.fireCd, 0.3);
  input.zoomToggle = false;
  setGunModel(P.faction, w);
  SFX.click();
}

function killPlayer(cause, where) {
  if (!P.alive) return;
  if (P.mode === 'turret' && P.turret) P.turret.manned = false;
  if (P.speeder && P.speeder.mode === 'player') { P.speeder.mode = 'gone'; P.speeder.respawnT = 3; P.speeder.alive = false; }
  if (P.walker) { P.walker.pilot = null; P.walker.ctrl.fire = false; }
  P.alive = false; P.lives--; P.deathCause = cause;
  P.mode = 'dead'; P.respawnT = 4; P.turret = null; P.speeder = null; P.walker = null; input.zoomToggle = false;
  if (where) P.pos.copy(where);
  $('dead').classList.remove('hidden');
  $('deadTitle').textContent = cause === 'Blastertreffer' ? 'Getroffen!' : cause + '!';
  SFX.boom(null, 0.6);
}
G.onPlayerHit = (pl, cause) => {
  if (pl && pl.remote) { if (!pl.god) NET.remoteDie(pl, cause); return; }
  if (P.god > 0 || !P.alive) return;
  killPlayer(cause);
};
G.onKill = (pl) => { G.creditKill(pl); };
G.onSpecialDown = (s) => {
  if (s.special === 'hero') G.msg(s.name + ' ist gefallen!' + (s.livesLeft > 0 ? ' Gleich ist er zurück an der Linie.' : ''), 'hero' + s.heroKind);
};
G.onPilotDown = (w) => {
  if (P.walker === w) killPlayer(WALKER_NAME[w.type] + ' zerstört', camera.position);
  else if (w.pilot && w.pilot.remote) NET.remoteDie(w.pilot, WALKER_NAME[w.type] + ' zerstört');
};
G.onRemoteDown = (av, cause) => NET.remoteDie(av, cause);
G.onRemoteEject = (av) => NET.sendTo(av.id, { t: 'eject' });
let hitTimer = 0;
G.hitMarker = (owner) => {
  if (owner && owner.remote) { if (G.time - owner.hitT > 0.1) { owner.hitT = G.time; NET.sendTo(owner.id, { t: 'hit' }); } return; }
  $('hit').classList.add('on'); hitTimer = 0.15; SFX.click();
};

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
const input = { keys: {}, mouseFire: false, touchFire: false, lookDX: 0, lookDY: 0, joyX: 0, joyY: 0, use: false, jump: false, harpoon: false, zoomHeld: false, zoomToggle: false, weaponSel: -1, weaponStep: 0 };
let pointerLocked = false;

window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (state !== 'playing') { if (e.code === 'Escape' && state === 'paused') resume(); return; }
  if (e.code === 'KeyE') input.use = true;
  if (e.code === 'KeyF') input.harpoon = true;
  if (e.code === 'KeyQ') input.zoomToggle = !input.zoomToggle;
  if (/^Digit[1-4]$/.test(e.code)) input.weaponSel = +e.code.slice(5) - 1;
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
  if (e.button === 2) input.zoomHeld = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseFire = false; if (e.button === 2) input.zoomHeld = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => { if (pointerLocked) { input.lookDX += e.movementX; input.lookDY += e.movementY; } });
window.addEventListener('wheel', (e) => { if (state === 'playing' && Math.abs(e.deltaY) > 1) input.weaponStep += Math.sign(e.deltaY); }, { passive: true });
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
    if (id === 'bZoom') { input.zoomToggle = !input.zoomToggle; touches[t.identifier] = { kind: 'btn' }; continue; }
    const slot = t.target.closest && t.target.closest('.wslot');
    if (slot) { input.weaponSel = +slot.dataset.w; touches[t.identifier] = { kind: 'btn' }; continue; }
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
  input.use = input.jump = input.harpoon = false; input.keys = {}; input.zoomHeld = false; input.weaponSel = -1; input.weaponStep = 0;
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
  if (OBST.n) { const t = OBST.seg(o.x, o.y, o.z, d.x * best, d.y * best, d.z * best); if (t <= 1) best *= Math.max(t, 0.01); }
  const sphere = (c, r) => {
    _tmp.subVectors(c, o); const t = _tmp.dot(d); if (t <= 0 || t > best) return;
    if (_tmp.addScaledVector(d, -t).lengthSq() < r * r) best = t;
  };
  if (P.faction === IMP) {
    for (const s of G.rebels) {
      if (!s.alive) continue;
      _tmp.set(s.pos.x - o.x, s.pos.y + 1 - o.y, s.pos.z - o.z);
      const t = _tmp.dot(d); if (t <= 0 || t > best) continue;
      if (_tmp.addScaledVector(d, -t).lengthSq() < 0.6) best = t;
    }
    for (const tu of G.turrets) if (tu.alive) sphere(_tmp2.set(tu.pos.x, tu.pos.y + tu.hy * 0.8, tu.pos.z), 2.2);
    for (const sp of G.speeders) if (sp.alive && sp.mode !== 'gone') sphere(sp.pos, 2.6);
    if (G.genHP > 0) { const t = genSeg(o.x, o.y, o.z, d.x * best, d.y * best, d.z * best); if (t >= 0) best *= t; }
    return best;
  }
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
  if (P.faction === IMP) {
    for (const w of G.atsts.concat(G.atats)) {
      if (!w.alive || w.pilot || w.tangled) continue;
      const d = Math.hypot(w.pos.x - P.pos.x, w.pos.z - P.pos.z), r = w.type === 'atat' ? 11 : 5;
      if (d < r && d < bd) { bd = d; best = w; }
    }
    return best;
  }
  for (const t of G.turrets) {
    if (!t.alive || t.manned) continue;
    const d = Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z);
    if (d < (t.roof ? 8 : 4.5) && d < bd) { bd = d; best = t; }      // Bunkergeschütz: vom Boden vor dem Tor erreichbar
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

// Visier/Zoom: 0 = normal, 1 = voll gezoomt
let zoomT = 0;
const BASE_FOV = 72;
function updateZoom(dt) {
  const can = (P.mode === 'foot' && !WEAPONS[P.weapon].nade) || P.mode === 'turret' || P.mode === 'walker' || P.mode === 'speeder';
  if (!can) input.zoomToggle = false;
  const want = can && (input.zoomHeld || input.zoomToggle || PAD.zoom());
  zoomT = clamp(zoomT + (want ? dt * 7 : -dt * 7), 0, 1);
  const zf = P.mode === 'foot' ? WEAPONS[P.weapon].zoom : P.mode === 'speeder' ? 52 : 22;
  const fov = lerp(BASE_FOV, zf, smooth(0, 1, zoomT));
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov; camera.updateProjectionMatrix();
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    FX.setScale(buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)));
  }
}

function updatePlayer(dt) {
  updateZoom(dt);
  const sens = 0.00045 * CFG.sens * (IS_TOUCH ? 1.2 : 1) * (camera.fov / BASE_FOV);
  // Controller: rechter Stick = Blick (wie Mausbewegung in Pixeln pro Sekunde)
  const pa = PAD.axes();
  input.lookDX += pa.rx * dt * 1150; input.lookDY += pa.ry * dt * 800;
  const lookX = input.lookDX * sens, lookY = input.lookDY * sens;
  input.lookDX = input.lookDY = 0;
  const k = input.keys;
  const fwdIn = clamp((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + input.joyY - pa.ly, -1, 1);
  const strIn = clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.joyX + pa.lx, -1, 1);
  const firing = input.mouseFire || input.touchFire || PAD.fire();
  // Controller-Tasten: A springen, B benutzen/einsteigen, Y Schleppkabel, X Visier umschalten, Start/Select Pause
  if (PAD.take('x')) input.zoomToggle = !input.zoomToggle;
  if (PAD.take('start') || PAD.take('select')) { pause(); return; }
  const padY = PAD.take('y');
  const use = input.use || PAD.take('b'), jump = input.jump || PAD.take('a'), harpoon = input.harpoon || (padY && P.mode === 'speeder');
  // Waffenwahl: 1-4, Mausrad, Y oder Steuerkreuz links/rechts, Antippen in der Waffenleiste
  const dR = PAD.take('dright'), dL = PAD.take('dleft');
  if (P.mode === 'foot') {
    if (input.weaponSel >= 0) selectWeapon(input.weaponSel);
    if (input.weaponStep) selectWeapon(P.weapon + Math.sign(input.weaponStep));
    if (padY || dR) selectWeapon(P.weapon + 1);
    if (dL) selectWeapon(P.weapon - 1);
  }
  input.weaponSel = -1; input.weaponStep = 0;
  input.use = input.jump = input.harpoon = false;
  P.god = Math.max(0, P.god - dt);
  P.fireCd -= dt;
  if (P.overheat > 0) { P.overheat -= dt; if (P.overheat <= 0) P.heat = 0.3; }
  P.heat = Math.max(0, P.heat - dt * (firing ? 0.18 : 0.45));
  for (let w = 0; w < WEAPONS.length; w++) if (w !== P.weapon) {    // nicht getragene Waffen kühlen ab
    P.heats[w] = Math.max(0, P.heats[w] - dt * 0.45);
    if (P.overheats[w] > 0) { P.overheats[w] -= dt; if (P.overheats[w] <= 0) P.heats[w] = 0.3; }
  }
  P.switchT = Math.max(0, P.switchT - dt);
  P.recoil = Math.max(0, P.recoil - dt * 6);
  const prompts = [];

  if (P.mode === 'dead') {
    P.respawnT -= dt;
    const left = Math.max(0, P.lives);
    $('deadText').textContent = left > 0 ? `Noch ${left} ${left === 1 ? 'Leben' : 'Leben'} – Rückkehr in ${Math.ceil(P.respawnT)} s`
      : NET.inGame ? 'Keine Leben mehr – du schaust der Schlacht zu' : 'Keine Leben mehr';
    if (left <= 0 && NET.inGame && P.respawnT < -2) { $('dead').classList.add('hidden'); menuCamera(dt, true); }
    else {
      camera.position.y = Math.max(heightAt(camera.position.x, camera.position.z) + 0.4, camera.position.y - dt * 1.5);
      camera.rotation.z = Math.min(0.5, camera.rotation.z + dt * 0.4);
    }
    gun.visible = false;
    if (P.respawnT <= 0 && P.lives > 0) spawnPlayer(false);
    setPrompt(prompts);
    return;
  }
  camera.rotation.z = 0;

  if (P.mode === 'foot') {
    P.yaw -= lookX; P.pitch = clamp(P.pitch - lookY, -1.45, 1.45);
    const sprint = k.ShiftLeft || k.ShiftRight || Math.hypot(input.joyX, input.joyY) > 0.95 || PAD.sprint();
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
    pushOutWorld(P.pos, MAP.id === 'hoth' ? 1 : 0.4);
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
    camera.position.set(P.pos.x, P.pos.y + 1.62 + bobY * (1 - zoomT), P.pos.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
    // Waffe beim Zielen zur Bildmitte (über Kimme und Korn), voll gezoomt blickt man durchs Zielfernrohr
    const z = smooth(0, 1, zoomT), W = WEAPONS[P.weapon];
    const sw = P.switchT / 0.35;          // Waffenwechsel: Waffe kurz absenken
    gun.visible = zoomT < 0.85 || !W.scope;
    gun.position.set(lerp(0.13, 0.0, z) + Math.cos(P.bob * 0.5) * 0.005 * (1 - z), lerp(-0.12, -0.075, z) + bobY * 0.15 - sw * sw * 0.12,
      lerp(-0.3, -0.24, z) + P.recoil * (W.kind === 5 ? 0.06 : 0.025));
    gun.rotation.set(P.recoil * (W.kind === 5 ? 0.3 : 0.12) - sw * 0.6, lerp(0.06, 0, z), 0);
    const spin = gunModels[P.faction][P.weapon].userData.spin;
    P.spin = firing && !W.nade ? Math.min(1, P.spin + dt * 4) : Math.max(0, P.spin - dt * 1.5);
    if (spin) spin.rotation.z += P.spin * dt * 30;
    if (W.nade) {
      // Thermaldetonator werfen (Bogenwurf, Zünder ~2,4 s)
      if (firing && P.fireCd <= 0 && P.switchT <= 0) {
        if (P.nades > 0) {
          P.fireCd = W.rate; P.nades--; P.recoil = 1;
          camForward(_fwd);
          _tmp.copy(camera.position).addScaledVector(_fwd, 0.5); _tmp.y -= 0.15;
          _tmp2.copy(_fwd).multiplyScalar(12.5); _tmp2.y += 4;
          throwGrenade(P.faction, _tmp, _tmp2, P);
        } else if (P.fireCd <= 0) { P.fireCd = 0.6; G.msg('Keine Thermaldetonatoren mehr – nach dem Wiedereinstieg hast du wieder ' + NADES_PER_LIFE + '.', 'nonade'); }
      }
    } else if (firing && P.fireCd <= 0 && P.overheat <= 0 && P.switchT <= 0) {
      // Feuern (aus der Hüfte ungenauer als mit Visier)
      P.fireCd = W.rate; P.heat += W.heat; P.recoil = 1;
      if (P.heat >= 1) { P.heat = 1; P.overheat = W.cool; G.msg(W.names[P.faction] + ' überhitzt!', 'heat'); }
      camera.updateMatrixWorld(true);
      camForward(_fwd);
      const dist = aimDistance(camera.position, _fwd, W.range);
      _tmp2.copy(camera.position).addScaledVector(_fwd, dist);
      if (zoomT > 0.85 && W.scope) _tmp.copy(camera.position).addScaledVector(_fwd, 0.6).y -= 0.08;
      else gunTip.getWorldPosition(_tmp);
      fireBolt(W.kind, P.faction, _tmp, _tmp2, lerp(W.hip, W.ads, z), P);
    }
    const u = nearestUsable();
    if (!u) endorUse(prompts, use);
    if (u) {
      prompts.push(u.type === 'turret' ? (u.roof ? '[E] Bunkergeschütz bemannen' : '[E] Geschützturm bemannen') : u.type === 'speeder' ? '[E] In den Schneegleiter steigen' : '[E] ' + WALKER_NAME[u.type] + ' steuern');
      if (use) {
        if (u.type === 'atst' || u.type === 'atat') {
          P.mode = 'walker'; P.walker = u; u.pilot = P;
          P.yaw = u.yaw - Math.PI; P.pitch = 0;
          G.msg(u.type === 'atat' ? 'AT-AT übernommen! Feuere auf Geschütztürme und den Schildgenerator. Vorsicht vor Schleppkabeln!'
            : MAP.id === 'endor' ? 'AT-ST übernommen! Zerstöre das Bunkertor – Vorsicht vor den Baumstammfallen der Ewoks über den Waldwegen!'
            : 'AT-ST übernommen! Räume den Schützengraben und zerstöre die Geschütztürme.', 'win');
        } else if (u.type === 'turret') {
          P.mode = 'turret'; P.turret = u; u.manned = true; u.mannedBy = P;
          P.yaw = u.aimYaw - Math.PI; P.pitch = clamp(u.aimPitch, -0.35, 0.6);
          G.msg(u.roof ? 'Bunkergeschütz bemannt – nur Geschütze und Ewok-Fallen stoppen die AT-STs!' : 'Geschützturm bemannt – ziele auf die Läufer!', 'tin');
        } else {
          P.mode = 'speeder'; P.speeder = u; u.mode = 'player'; u.pilot = P; u.speed = 20; u.pitch = 0.35;
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
    // Gezoomt: Blick direkt über die Läufe
    camera.position.set(t.pos.x, t.pos.y + t.hy + lerp(3.5, 2.55, zoomT), t.pos.z).addScaledVector(_fwd, lerp(-6.5, 1.0, zoomT));
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
  } else if (P.mode === 'walker') {
    const w = P.walker, isAtat = w.type === 'atat';
    // Drehen per Blick oder Joystick/A-D, Laufen per Joystick/W-S
    P.yaw -= lookX * 0.8 + strIn * dt * (isAtat ? 0.4 : 1.2);
    P.pitch = clamp(P.pitch - lookY * 0.8, isAtat ? -0.35 : -0.4, isAtat ? 0.3 : 0.35);
    camForward(_fwd);
    w.head.getWorldPosition(_tmp2);
    if (isAtat) camera.position.copy(_tmp2).addScaledVector(_fwd, lerp(-32, 5.5, zoomT)).y += lerp(12, 0.4, zoomT);
    else camera.position.copy(_tmp2).addScaledVector(_fwd, lerp(-10, 1.9, zoomT)).y += lerp(4.6, 0.9, zoomT);
    const ch = heightAt(camera.position.x, camera.position.z) + 1;
    if (camera.position.y < ch) camera.position.y = ch;
    camera.rotation.set(P.pitch, P.yaw, 0);
    gun.visible = false;
    camera.updateMatrixWorld(true);
    const dist = aimDistance(camera.position, _fwd, 450);
    w.ctrl.aim.copy(camera.position).addScaledVector(_fwd, dist);
    w.ctrl.fwd = fwdIn; w.ctrl.yaw = P.yaw + Math.PI; w.ctrl.pitch = P.pitch; w.ctrl.fire = firing;
    P.heat = clamp(w.fireCd / (isAtat ? 1.3 : 0.38), 0, 1); P.overheat = 0;
    P.pos.copy(w.pos);
    if (w.tangled) prompts.push('Die Beine sind mit einem Schleppkabel gefesselt!');
    prompts.push('[E] Aussteigen');
    if (use) P.exitWalker();
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
      if (harpoon) { if (NET.mode === 'client') NET.requestTow(sp, a); else sp.startTow(a); }
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
  for (const p of list) {
    const sp = document.createElement('span');
    sp.textContent = PAD.connected ? p.replace('[E]', 'Ⓑ').replace('[F]', 'Ⓨ') : IS_TOUCH ? p.replace('[E]', 'E:').replace('[F]', 'KABEL:') : p;
    el.append(sp);
  }
}

// ---------------------------------------------------------------- HUD
let hudT = 0, radarT = 0, lastWeaponKey = '#', wnameT = 0;
$('weapons').addEventListener('click', (e) => { const sl = e.target.closest('.wslot'); if (sl && state === 'playing') input.weaponSel = +sl.dataset.w; });
const radarCtx = $('radar').getContext('2d');
function updateHUD(dt) {
  if (hitTimer > 0) { hitTimer -= dt; if (hitTimer <= 0) $('hit').classList.remove('on'); }
  const heat = $('heat');
  $('heatArc').style.strokeDashoffset = (100 - P.heat * 100).toFixed(1);
  heat.classList.toggle('over', P.overheat > 0);
  heat.style.opacity = (P.mode === 'foot' ? !WEAPONS[P.weapon].nade : P.mode === 'turret' || P.mode === 'walker') && P.heat > 0.01 ? '1' : '0';
  // Waffenleiste
  const wb = $('weapons'), onFoot = P.mode === 'foot';
  wb.style.display = onFoot ? '' : 'none';
  const wkey = onFoot ? P.faction + ':' + P.weapon + ':' + P.nades + ':' + PAD.connected : '-';
  if (wkey !== lastWeaponKey) {
    const fi = P.faction === IMP ? 1 : 0;
    if (onFoot && lastWeaponKey !== '#' && !lastWeaponKey.startsWith(P.faction + ':' + P.weapon + ':')) { $('wname').textContent = WEAPONS[P.weapon].names[fi]; $('wname').classList.add('on'); wnameT = 1.4; }
    lastWeaponKey = wkey;
    wb.classList.toggle('pad', PAD.connected);
    wb.querySelectorAll('.wslot').forEach((el, i) => {
      el.classList.toggle('on', i === P.weapon);
      const W = WEAPONS[i];
      el.title = W.names[fi];
      el.querySelector('small').textContent = W.nade ? '×' + P.nades : '';
      el.classList.toggle('empty', !!W.nade && P.nades <= 0);
    });
  }
  if (wnameT > 0) { wnameT -= dt; if (wnameT <= 0) $('wname').classList.remove('on'); }
  const scoped = P.mode === 'foot' && zoomT > 0.85 && WEAPONS[P.weapon].scope;
  $('scope').style.opacity = scoped ? '1' : '0';
  $('cross').className = P.mode === 'speeder' || P.mode === 'turret' || P.mode === 'walker' ? 'big' : '';
  $('cross').style.visibility = P.mode === 'dead' || scoped ? 'hidden' : 'visible';
  $('bHarp').classList.toggle('hidden', P.mode !== 'speeder');
  $('bJump').classList.toggle('hidden', P.mode !== 'foot');
  $('bZoom').classList.toggle('on', input.zoomToggle);
  $('bZoom').classList.toggle('hidden', P.mode === 'dead');
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.2;
    const reb = G.rebels.filter(s => s.alive && s.special !== 'ewok').length, imp = G.imps.filter(s => s.alive).length;
    const impRes = G.imps.reduce((a, s) => a + Math.max(0, s.livesLeft), 0);
    const res = G.rebels.reduce((a, s) => a + (s.special === 'ewok' ? 0 : Math.max(0, s.livesLeft)), 0);
    const st = G.atsts.filter(s => s.alive).length, at = G.atats.filter(s => s.alive).length;
    const rc = P.faction === IMP ? 'foe' : 'friend', ic = P.faction === IMP ? 'friend' : 'foe';
    const chip = (c, name, val) => `<div class="chip ${c}"><span>${name}</span><b>${val}</b></div>`;
    let html = chip(rc, 'Rebellen', reb + (res ? `<small>+${res}</small>` : ''));
    if (MAP.id === 'endor') html += chip(rc, 'Ewoks', G.rebels.filter(s => s.alive && s.special === 'ewok').length);
    html += chip(ic, 'Sturmtruppen', imp + (impRes ? `<small>+${impRes}</small>` : '')) + chip(ic, 'AT-ST', st);
    if (MAP.id === 'hoth') html += chip(ic, 'AT-AT', at);
    $('stats').innerHTML = html;
    $('lives').innerHTML = `<div class="chip"><span>Leben</span><b class="hearts">${'<i></i>'.repeat(Math.max(0, P.lives))}</b></div><div class="chip"><span>Abschüsse</span><b>${P.kills}</b></div>`;
    $('genFill').style.width = (100 * G.genHP / G.genMax).toFixed(1) + '%';
    $('genPct').textContent = Math.round(100 * G.genHP / G.genMax) + '%';
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
  const friend = '#7dff8a', foe = '#ff5040', imp = P.faction === IMP;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const px = camera.position.x, pz = camera.position.z;
  const dot = (x, z, r, col, sq) => {
    const dx = x - px, dz = z - pz;
    const rx = (dx * cs - dz * sn) / range * R, ry = (dx * sn + dz * cs) / range * R;
    if (rx * rx + ry * ry > R * R) return;
    c.fillStyle = col;
    if (sq) c.fillRect(rx - r, ry - r, r * 2, r * 2); else { c.beginPath(); c.arc(rx, ry, r, 0, TAU); c.fill(); }
  };
  dot(WORLD.gen.x, WORLD.gen.z, 5, imp ? '#ffcc33' : '#4fc3ff', MAP.id === 'endor');
  for (const t of G.traps) dot(t.x, t.z, 2.4, t.armed ? '#c08a4a' : 'rgba(192,138,74,0.35)', true);
  for (const t of G.turrets) if (t.alive) dot(t.pos.x, t.pos.z, 2.5, imp ? '#ff8a6a' : '#9ad0ff', true);
  for (const s of G.rebels) if (s.alive) dot(s.pos.x, s.pos.z, s.special === 'ewok' ? 1.2 : s.special === 'hero' ? 2.2 : 1.6, imp ? foe : friend);
  for (const s of G.speeders) if (s.mode === 'ai' || s.mode === 'tow' || s.mode === 'parked') dot(s.pos.x, s.pos.z, 2.5, imp ? '#ff7a3a' : '#ffb340');
  for (const s of G.imps) if (s.alive) dot(s.pos.x, s.pos.z, 1.6, imp ? friend : foe);
  for (const w of G.atsts) if (w.alive) dot(w.pos.x, w.pos.z, 3.5, imp ? '#5fe07a' : '#ff7a3a', true);
  for (const w of G.atats) if (w.alive) dot(w.pos.x, w.pos.z, 5, imp ? '#3fc060' : '#ff3020', true);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- Spielablauf
let state = 'menu', endTimer = 0, demo = true, menuT = 0, battleT = 0;

function clearBattle() {
  for (const ch of G.dyn.children.slice()) {
    if (ch.isLine) ch.geometry.dispose();
    if (ch.isSprite) { ch.material.map.dispose(); ch.material.dispose(); }
    G.dyn.remove(ch);
  }
  G.rebels = []; G.imps = []; G.atats = []; G.atsts = []; G.turrets = []; G.speeders = [];
  G.traps = []; G.charges = []; G.droids = null;
  for (const b of G.bolts) boltPool.push(b);
  G.bolts.length = 0; G.grenades.length = 0; FX.clear(); G.time = 0;
}

function setupBattle(cfg) {
  clearBattle();
  G.genMax = G.genHP = 150;
  G.diff = [{ spread: 0.06, rate: 0.75 }, { spread: 0.048, rate: 1 }, { spread: 0.028, rate: 1.3 }][cfg.diff | 0];
  if (MAP.id === 'endor') { setupEndorBattle(cfg); return; }
  const nR = Math.min(cfg.rebels, MAX_REBELS);
  for (let i = 0; i < nR; i++) {
    let x = -TR.len + 8 + (i + 0.5) / nR * (2 * TR.len - 16) + rand(-2, 2);
    if (Math.abs(x) < 2.5) x += 4;
    G.rebels.push(new Soldier(REB, x, trenchZ(x) + rand(-0.6, 0.2), clamp(cfg.rebLives | 0 || 1, 1, 5)));
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

// opts (Mehrspieler): { cfg: Schlacht-Einstellungen des Hosts, faction, mp: 'host' | 'client' }
function newGame(opts) {
  demo = false;
  const mp = opts && opts.mp;
  const cfg = mp ? Object.assign({}, CFG, opts.cfg) : CFG;
  if (!mp && NET.active) NET.leave();
  loadMap(cfg.map === 1 ? 'endor' : 'hoth');
  setupBattle(cfg);
  G.players = [P];
  P.faction = mp ? opts.faction : (CFG.faction === 1 ? IMP : REB);
  setGunFaction(P.faction);
  P.lives = cfg.lives; P.kills = 0; spawnPlayer(true);
  state = 'playing'; endTimer = 0; battleT = 0; document.title = 'Hoth';
  resetInput();
  ['menu', 'over', 'pause', 'mp'].forEach(id => $(id).classList.add('hidden'));
  $('againBtn').classList.remove('hidden'); $('overWait').classList.add('hidden');
  $('quitBtn').textContent = mp ? 'Spiel verlassen' : 'Hauptmenü';
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !IS_TOUCH);
  $('joyHint').style.display = '';
  $('msgs').innerHTML = '';
  lastPrompt = '#'; lastWeaponKey = '#';
  SFX.init();
  const endor = MAP.id === 'endor';
  $('genName').textContent = (P.faction === IMP ? 'Ziel: ' : '') + (endor ? 'Bunkertor' : 'Schildgenerator');
  if (endor) G.msg(P.faction === IMP ? 'Zerstört das Bunkertor! Steig mit E in ein AT-ST oder bring eine Sprengladung am Tor an.'
    : 'Das Imperium greift an! Haltet die Linie vor dem Bunker – die Ewoks kämpfen an eurer Seite!', 'start');
  else G.msg(P.faction === IMP ? 'Zerstört den Schildgenerator! Steig mit E in ein AT-ST oder AT-AT.'
    : 'Das Imperium greift an! Halte den Graben und schütze den Schildgenerator!', 'start');
  if (endor && cfg.ewoks > 0) setTimeout(() => { if (state === 'playing') SFX.horn(null); }, 1500);
  if (!IS_TOUCH && canvas.requestPointerLock) canvas.requestPointerLock();
}

function startDemo() {
  demo = true; G.players = [P];
  loadMap(CFG.map === 1 ? 'endor' : 'hoth');
  setupBattle(MAP.id === 'endor' ? { rebels: 16, rebLives: 2, troopers: 40, atst: 3, ewoks: 18, bunkerGuns: 2, diff: 1 }
    : { rebels: 24, rebLives: 2, troopers: 45, atst: 3, atat: 3, aiSpeeders: 3, turrets: 6, diff: 1 });
  P.mode = 'spectate'; P.alive = false; P.lives = 0; P.faction = REB; P.walker = null;
}

// opts.mp: zurück in die Mehrspieler-Lobby statt ins Hauptmenü
function showMenu(opts) {
  const toMp = opts && opts.mp;
  NET.endNetGame();
  if (NET.active && !toMp) NET.leave();
  state = 'menu'; document.title = 'Hoth-Menu';
  if (document.pointerLockElement) document.exitPointerLock();
  ['over', 'pause', 'hud', 'touch', 'dead'].forEach(id => $(id).classList.add('hidden'));
  $(toMp ? 'mp' : 'menu').classList.remove('hidden');
  if (toMp) $('menu').classList.add('hidden');
  if (toMp && NET.active) NET.showLobby();
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
  $('overText').innerHTML = reason +
    `<div class="stats2"><div><span>Abschüsse</span><b>${P.kills}</b></div><div><span>Rebellen übrig</span><b>${reb}/${G.rebels.length}</b></div>` +
    `<div><span>Schildgenerator</span><b>${Math.round(100 * G.genHP / G.genMax)}%</b></div><div><span>Dauer</span><b>${m}:${String(s).padStart(2, '0')}</b></div></div>`;
}
window.hothPause = () => pause();
// Zurück-Taste (Android): true = vom Spiel verarbeitet, false = App darf sich schließen
window.hothBack = () => {
  if (!$('updModal').classList.contains('hidden')) { $('updLater').click(); return true; }
  if (state === 'playing') { pause(); return true; }
  if (state === 'paused') { resume(); return true; }
  if (state === 'over') { showMenu(); return true; }
  return false;
};

$('startBtn').addEventListener('click', () => { SFX.init(); newGame(); });
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => { if (NET.mode === 'client') { NET.leave(); showMenu({ mp: true }); } else showMenu(); });
$('againBtn').addEventListener('click', () => { if (NET.mode === 'host') NET.startGame(); else newGame(); });
$('menuBtn').addEventListener('click', () => showMenu({ mp: NET.active }));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

const END_TEXT = {
  hoth: { impGen: 'Der Schildgenerator ist zerstört. Echo Base ist gefallen – Sieg für das Imperium!', impWipe: 'Die Verteidiger von Echo Base sind ausgelöscht – Sieg für das Imperium!',
    rebWin: 'Der Angriff des Imperiums wurde abgewehrt. Echo Base ist gerettet!', rebGen: 'Der Schildgenerator wurde zerstört – Echo Base ist gefallen.' },
  endor: { impGen: 'Das Bunkertor ist gesprengt. Der Schildgenerator auf Endor bleibt in imperialer Hand – Sieg für das Imperium!',
    impWipe: 'Die Rebellen und ihre Ewok-Verbündeten sind geschlagen – Sieg für das Imperium!',
    rebWin: 'Die imperialen Truppen sind geschlagen! Han Solo kann den Bunker sprengen – der Schild fällt!', rebGen: 'Das Bunkertor wurde gesprengt – die Mission auf Endor ist gescheitert.' },
};
function checkEnd(dt) {
  const impAlive = G.imps.some(s => s.alive || s.livesLeft > 0) || G.atsts.some(s => s.alive) || G.atats.some(s => s.alive);
  const rebAlive = G.rebels.some(s => s.alive || s.livesLeft > 0) || G.turrets.some(t => t.alive);
  const out = P.lives <= 0 && !P.alive;
  let res = null;
  const T = END_TEXT[MAP.id];
  if (P.faction === IMP) {
    if (G.genHP <= 0) res = [true, T.impGen];
    else if (!rebAlive) res = [true, T.impWipe];
    else if (!impAlive && !P.walker) res = [false, 'Die imperiale Angriffsstreitmacht wurde vernichtet.'];
    else if (out) res = [false, 'Du bist gefallen und hast keine Leben mehr.'];
  } else {
    if (!impAlive) res = [true, T.rebWin];
    else if (G.genHP <= 0) res = [false, T.rebGen];
    else if (out) res = [false, 'Du bist gefallen und hast keine Leben mehr.'];
  }
  if (!res) { endTimer = 0; return; }
  endTimer += dt;
  if (endTimer > (res[0] ? 2 : 3)) endGame(res[0], res[1]);
}

// ---------------------------------------------------------------- Hauptschleife
function simulate(dt) {
  if (!(dt > 0)) return;
  G.time += dt;
  SFX.tick(dt);
  for (const s of G.rebels) updateSoldier(s, dt);
  for (const s of G.imps) updateSoldier(s, dt);
  for (const w of G.atats) w.update(dt);
  for (const w of G.atsts) w.update(dt);
  for (const t of G.turrets) t.update(dt);
  for (const s of G.speeders) s.update(dt);
  updateBolts(dt);
  updateGrenades(dt);
  if (MAP.id === 'endor') updateEndor(dt);
}
// Client: Spiellogik läuft beim Host, hier nur Darstellung + eigenes Fahrzeug
function clientSimulate(dt) {
  if (!(dt > 0)) return;
  G.time += dt;
  SFX.tick(dt);
  for (const s of G.rebels) updateSoldierNet(s, dt);
  for (const s of G.imps) updateSoldierNet(s, dt);
  for (const w of G.atats) w.update(dt);
  for (const w of G.atsts) w.update(dt);
  for (const t of G.turrets) t.update(dt);
  for (const s of G.speeders) s.update(dt);
  updateBolts(dt);
  updateGrenades(dt);
  if (MAP.id === 'endor') updateEndor(dt);
}
function drawDynamic() {
  boltRed.begin(); boltGreen.begin();
  for (const b of G.bolts) (b.f === REB ? boltRed : boltGreen).add(b);
  boltRed.end(); boltGreen.end();
  rebR.update(G.rebels); impR.update(G.imps);
  if (MAP.id === 'endor') drawEndor(); else ewokR.update([]);
  NET.drawAvatars(lastDt);
}

function menuCamera(dt, spectate) {
  menuT += dt * 0.05;
  if (MAP.id === 'endor') {
    const x = Math.sin(menuT * 1.3) * 60;
    camera.position.set(x, heightAt(x, 30) + 5.5, 30);
    camera.lookAt(x * 0.5, 5, -90);
  } else {
    const x = Math.sin(menuT) * 130;
    camera.position.set(x, heightAt(x, 40) + 16, 40);
    camera.lookAt(x * 0.4, 12, -160);
  }
  gun.visible = false;
  // Demo-Schlacht neu starten, wenn sie vorbei ist
  const enemies = G.imps.some(s => s.alive) || G.atsts.some(s => s.alive) || G.atats.some(s => s.alive);
  if (!spectate && (!enemies || G.genHP <= 0 || G.time > 420)) startDemo();
}

let last = performance.now(), lastDt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now; lastDt = dt;
  const running = state === 'playing' || (state === 'paused' && NET.inGame);   // im Mehrspieler läuft die Schlacht weiter
  if (running) {
    battleT += dt;
    if (state === 'playing') updatePlayer(dt);
    if (NET.mode === 'client' && NET.inGame) clientSimulate(dt); else simulate(dt);
    if (state === 'playing') updateHUD(dt);
    if (NET.inGame) { if (NET.mode === 'host') NET.checkEnd(dt); }
    else checkEnd(dt);
  } else if (state === 'menu') {
    simulate(dt);
    menuCamera(dt);
  }
  NET.tick(dt);
  if (running || state === 'menu') FX.update(dt);
  // Kamera-Wackeln bei nahen Explosionen
  const sh = FX.shake * FX.shake * 0.35;
  if (sh > 0.001 && state === 'playing') { camera.position.x += rand(-sh, sh); camera.position.y += rand(-sh, sh); camera.rotation.z += rand(-sh, sh) * 0.15; }
  camera.updateMatrixWorld();
  SFX.setListener(camera);
  drawDynamic();
  snow.update(dt, camera.position);
  updateSun();
  post.render(scene, camera, now / 1000, P.mode === 'dead' ? 0.6 : 0);
}

// Debug-/Testschnittstelle
window.__hoth = { G, P, CFG, NET, newGame, showMenu, simulate, setupBattle, get state() { return state; }, input, renderer, scene, camera };

applyGfx();
NET.initUI();
showMenu();
requestAnimationFrame(frame);
