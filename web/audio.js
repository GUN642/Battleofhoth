'use strict';
// ============================================================================
//  Battle of Hoth - Sound
//
//  Der Original-Blastersound aus Star Wars entstand, als Ben Burtt mit einem
//  Hammer gegen das gespannte Stahlseil eines Funkmasts schlug. Im Draht laufen
//  hohe Frequenzen schneller als tiefe (Dispersion von Biegewellen), deshalb
//  kommt beim Zuhörer ein fallender "Chirp" an: zuerst das helle "P", dann das
//  absinkende "iuuu". Für Biegewellen gilt v ~ sqrt(f), also Laufzeit ~ 1/sqrt(f)
//  bzw. f(t) = f0 * (t0 / (t + t0))^2. Genau diesen Verlauf erzeugen wir hier
//  synthetisch, inklusive Echo vom Seilende und metallischem Nachklingen.
// ============================================================================

// Dispersiver Chirp in den Puffer addieren
function addChirp(out, sr, start, amp, f0, t0, decay, metal) {
  let ph = 0, ph2 = 0;
  const s0 = Math.floor(start * sr);
  for (let i = s0; i < out.length; i++) {
    const t = (i - s0) / sr;
    const f = f0 * (t0 / (t + t0)) * (t0 / (t + t0));
    ph += TAU * f / sr;
    ph2 += TAU * f * 2.76 / sr;                         // inharmonischer Draht-Oberton
    const env = amp * (1 - Math.exp(-t * 1400)) * Math.exp(-t / decay);
    if (t > 0.03 && env < 1e-4) break;
    out[i] += env * (Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.7) + metal * Math.sin(ph2) * Math.exp(-t * 18));
  }
}
function addNoise(out, sr, start, amp, decay, lp) {
  const s0 = Math.floor(start * sr);
  let y = 0;
  for (let i = s0; i < out.length; i++) {
    const t = (i - s0) / sr, env = amp * Math.exp(-t / decay);
    if (t > 0.02 && env < 1e-4) break;
    y += (Math.random() * 2 - 1 - y) * lp;
    out[i] += y * env;
  }
}
function addSweep(out, sr, start, amp, f0, f1, dur, decay) {
  let ph = 0;
  const s0 = Math.floor(start * sr);
  for (let i = s0; i < out.length; i++) {
    const t = (i - s0) / sr;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / dur));
    ph += TAU * f / sr;
    const env = amp * (1 - Math.exp(-t * 300)) * Math.exp(-t / decay);
    if (t > 0.03 && env < 1e-4) break;
    out[i] += env * Math.sin(ph);
  }
}
function finish(out, drive, hpA = 0.995) {
  let prev = 0, hp = 0, peak = 0;
  for (let i = 0; i < out.length; i++) {           // Hochpass (DC bzw. Dröhnen entfernen)
    hp = hpA * (hp + out[i] - prev); prev = out[i]; out[i] = hp;
    peak = Math.max(peak, Math.abs(hp));
  }
  const g = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * g * drive) / Math.tanh(drive);
  const fade = Math.min(out.length, 256);           // Klickfreies Ende
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

const SFX = {
  ctx: null, master: null, bufs: null, listener: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0),
  budget: 0, enabled: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.build();
      // Wind von Hoth
      const w = this.ctx.createBufferSource(); w.buffer = this.bufs.wind; w.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
      const wg = this.ctx.createGain(); wg.gain.value = 0.07;
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.035;
      lfo.connect(lg); lg.connect(wg.gain); lfo.start();
      w.connect(bp); bp.connect(wg); wg.connect(this.master); w.start();
    } catch (e) { this.ctx = null; }
  },
  build() {
    const sr = this.ctx.sampleRate;
    const mk = (dur, fn, drive = 1.4, hpHz = 30) => {
      const out = new Float32Array(Math.floor(dur * sr)); fn(out); finish(out, drive, Math.exp(-TAU * hpHz / sr));
      const b = this.ctx.createBuffer(1, out.length, sr); b.getChannelData(0).set(out); return b;
    };
    const variants = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
    this.bufs = {
      // Rebellen-Blaster (DH-17 / A280): hell, klares "Pew" mit Echo
      reb: variants(3, i => mk(0.42, o => {
        const f0 = 5200 + i * 300;
        addChirp(o, sr, 0, 1, f0, 0.06, 0.085, 0.25);
        addChirp(o, sr, 0.03 + i * 0.004, 0.4, f0 * 0.93, 0.058, 0.075, 0.2);
        addChirp(o, sr, 0.066, 0.16, f0 * 0.9, 0.055, 0.07, 0.1);
        addNoise(o, sr, 0, 0.35, 0.006, 0.9);
      }, 1.5, 280)),
      // Imperiale E-11: etwas tiefer, kürzer und härter
      imp: variants(3, i => mk(0.36, o => {
        const f0 = 4000 + i * 250;
        addChirp(o, sr, 0, 1, f0, 0.052, 0.07, 0.35);
        addChirp(o, sr, 0.024, 0.36, f0 * 0.9, 0.05, 0.065, 0.2);
        addNoise(o, sr, 0, 0.4, 0.005, 0.85);
      }, 1.8, 220)),
      // AT-ST-Doppelkanone
      atst: variants(2, i => mk(0.6, o => {
        addChirp(o, sr, 0, 1, 2500 + i * 200, 0.07, 0.2, 0.4);
        addChirp(o, sr, 0.045, 0.4, 2200, 0.07, 0.15, 0.3);
        addSweep(o, sr, 0, 0.45, 160, 60, 0.25, 0.12);
        addNoise(o, sr, 0, 0.35, 0.03, 0.3);
      }, 1.8)),
      // Geschützturm: schwerer, langer Laser
      turret: variants(2, i => mk(0.85, o => {
        addChirp(o, sr, 0, 1, 2900 + i * 200, 0.09, 0.28, 0.45);
        addChirp(o, sr, 0.05, 0.45, 2500, 0.09, 0.22, 0.3);
        addSweep(o, sr, 0, 0.6, 140, 45, 0.35, 0.18);
        addNoise(o, sr, 0, 0.45, 0.05, 0.2);
      }, 2)),
      // AT-AT-Schwerlaser: tiefes, wuchtiges "Bwuumm"
      atat: variants(2, i => mk(1.4, o => {
        addChirp(o, sr, 0, 0.9, 1300 + i * 120, 0.12, 0.4, 0.5);
        addSweep(o, sr, 0, 1, 110, 32, 0.6, 0.35);
        addNoise(o, sr, 0, 0.7, 0.18, 0.06);
        addChirp(o, sr, 0.09, 0.35, 1100, 0.12, 0.3, 0.3);
      }, 2.4)),
      // Schneegleiter-Laserkanonen: schnell und spitz
      speeder: variants(2, i => mk(0.28, o => {
        addChirp(o, sr, 0, 1, 6000 + i * 400, 0.05, 0.06, 0.2);
        addChirp(o, sr, 0.02, 0.3, 5400, 0.045, 0.05, 0.1);
        addNoise(o, sr, 0, 0.3, 0.004, 0.9);
      }, 1.5, 350)),
      boom: variants(3, () => mk(2.6, o => {
        addNoise(o, sr, 0, 1, 0.55, 0.035);
        addNoise(o, sr, 0, 0.6, 0.12, 0.25);
        addSweep(o, sr, 0, 0.9, 70, 28, 0.8, 0.5);
        for (let k = 0; k < 40; k++) addNoise(o, sr, rand(0.05, 1.3), rand(0.1, 0.4), 0.004, 0.7);   // Knistern
      }, 2.5)),
      step: [mk(0.9, o => {
        addSweep(o, sr, 0, 1, 58, 40, 0.3, 0.22);
        for (const [f, a, d] of [[183, 0.25, 0.25], [267, 0.2, 0.2], [411, 0.15, 0.16], [593, 0.1, 0.12], [877, 0.06, 0.08]]) addSweep(o, sr, 0.005, a, f, f * 0.98, 0.5, d);
        addNoise(o, sr, 0.09, 0.25, 0.18, 0.5);                 // Hydraulik-Zischen
      }, 1.6)],
      impact: variants(2, () => mk(0.18, o => { addNoise(o, sr, 0, 1, 0.03, 0.6); addChirp(o, sr, 0, 0.3, 3000, 0.02, 0.03, 0); })),
      wind: mk(4, o => { addNoise(o, sr, 0, 1, 1e6, 0.5); }, 1),
    };
  },
  setListener(cam) {
    this.listener.copy(cam.position);
    this.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
  },
  tick(dt) { this.budget = Math.min(16, this.budget + dt * 45); },
  play(buf, p, vol, rate, lowpass) {
    if (!this.ctx || !this.enabled || !buf) return;
    let v = vol, pan = 0, dist = 0;
    if (p) {
      dist = p.distanceTo(this.listener);
      v = vol / (1 + dist / 16);
      if (dist > 0.5) pan = clamp(((p.x - this.listener.x) * this.right.x + (p.y - this.listener.y) * this.right.y + (p.z - this.listener.z) * this.right.z) / dist, -1, 1) * 0.8;
    }
    if (!(v >= 0.02) || !isFinite(pan)) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = v;
    let node = src;
    if (lowpass && dist > 40) {            // Ferne Geräusche dumpfer
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(400, 9000 * 40 / dist);
      node.connect(f); node = f;
    }
    node.connect(g);
    if (this.ctx.createStereoPanner) { const pn = this.ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(this.master); }
    else g.connect(this.master);
    src.start(t);
  },
  // kind: 0 Blaster, 1 AT-ST, 2 AT-AT, 3 Turm, 4 Schneegleiter
  shot(p, kind, f) {
    if (!this.ctx || this.budget < 1) return;
    this.budget -= 1;
    const B = this.bufs;
    const set = kind === 0 ? (f === REB ? B.reb : B.imp) : kind === 1 ? B.atst : kind === 2 ? B.atat : kind === 3 ? B.turret : B.speeder;
    const vol = [0.55, 0.8, 1.2, 0.85, 0.5][kind];
    this.play(pick(set), p, vol, rand(0.94, 1.06), kind === 2);
  },
  boom(p, size) { if (this.ctx) this.play(pick(this.bufs.boom), p, Math.min(1.6, 0.5 + size * 0.4), rand(0.85, 1.1) * (size > 2.5 ? 0.8 : 1), true); },
  thump(p) { if (this.ctx) this.play(this.bufs.step[0], p, 1.6, rand(0.95, 1.05), true); },
  impact(p) { if (this.ctx && this.budget >= 1) { this.budget -= 0.5; this.play(pick(this.bufs.impact), p, 0.25, rand(0.8, 1.2)); } },
  click() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.08);
  },
};
