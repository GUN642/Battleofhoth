'use strict';
// ============================================================================
//  Battle of Hoth - Nachbearbeitung: HDR-Rendering, Bloom (Leuchten von
//  Lasern, Explosionen, Sonne), ACES-Filmic-Tonemapping, Farbkorrektur, Vignette
// ============================================================================

class PostFX {
  constructor(renderer) {
    this.r = renderer;
    this.enabled = false;
    this.exposure = 0.9;
    this.supported = renderer.capabilities.isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const mk = (uniforms, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.brightMat = mk({ tex: { value: null }, threshold: { value: 1.35 } }, `
      uniform sampler2D tex; uniform float threshold; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(max(c.r, c.g), c.b);
        float k = smoothstep(threshold, threshold * 2.0, l);
        gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0); }`);
    this.blurMat = mk({ tex: { value: null }, dir: { value: new THREE.Vector2() } }, `
      uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tex, vUv).rgb * 0.227027;
        c += (texture2D(tex, vUv + dir * 1.3846).rgb + texture2D(tex, vUv - dir * 1.3846).rgb) * 0.316216;
        c += (texture2D(tex, vUv + dir * 3.2308).rgb + texture2D(tex, vUv - dir * 3.2308).rgb) * 0.070270;
        gl_FragColor = vec4(c, 1.0); }`);
    this.copyMat = mk({ tex: { value: null } }, `uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv); }`);
    this.compMat = mk({
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null },
      strength: { value: 0.9 }, exposure: { value: 1.0 }, time: { value: 0 }, red: { value: 0 },
    }, `
      uniform sampler2D tScene, tB1, tB2; uniform float strength, exposure, time, red; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec3 c = texture2D(tScene, vUv).rgb;
        vec3 b = texture2D(tB1, vUv).rgb * 0.75 + texture2D(tB2, vUv).rgb * 0.9;
        c += b * strength;
        c *= exposure;
        c = aces(c * 0.95);
        // leichte Farbgebung: kühle Schatten, warme Lichter
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c * vec3(0.94, 0.98, 1.06), c * vec3(1.03, 1.0, 0.96), smoothstep(0.2, 0.8, l));
        c = toSRGB(c);
        vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * 0.55;
        c *= v;
        c = mix(c, vec3(0.55, 0.05, 0.03), red * (0.25 + dot(d, d)));
        float g = fract(sin(dot(vUv * 913.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        c += g * 0.012;
        gl_FragColor = vec4(c, 1.0); }`);
    this.rtMain = null;
  }
  configure(enabled, msaa, w, h) {
    this.enabled = enabled && this.supported;
    this.dispose();
    if (!this.enabled) return;
    const opt = { type: THREE.HalfFloatType, depthBuffer: true };
    this.rtMain = new THREE.WebGLRenderTarget(w, h, Object.assign({ samples: msaa }, opt));
    const ro = { type: THREE.HalfFloatType, depthBuffer: false };
    const w2 = Math.max(1, w >> 2), h2 = Math.max(1, h >> 2), w3 = Math.max(1, w >> 3), h3 = Math.max(1, h >> 3);
    this.a1 = new THREE.WebGLRenderTarget(w2, h2, ro); this.b1 = new THREE.WebGLRenderTarget(w2, h2, ro);
    this.a2 = new THREE.WebGLRenderTarget(w3, h3, ro); this.b2 = new THREE.WebGLRenderTarget(w3, h3, ro);
  }
  dispose() { ['rtMain', 'a1', 'b1', 'a2', 'b2'].forEach(k => { if (this[k]) { this[k].dispose(); this[k] = null; } }); }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  blur(src, tmp, w, h) {
    this.blurMat.uniforms.tex.value = src.texture; this.blurMat.uniforms.dir.value.set(1 / w, 0); this.pass(this.blurMat, tmp);
    this.blurMat.uniforms.tex.value = tmp.texture; this.blurMat.uniforms.dir.value.set(0, 1 / h); this.pass(this.blurMat, src);
  }
  render(scene, camera, time, red) {
    if (!this.enabled) { this.r.setRenderTarget(null); this.r.render(scene, camera); return; }
    this.r.setRenderTarget(this.rtMain);
    this.r.render(scene, camera);
    this.brightMat.uniforms.tex.value = this.rtMain.texture; this.pass(this.brightMat, this.a1);
    this.blur(this.a1, this.b1, this.a1.width, this.a1.height);
    this.copyMat.uniforms.tex.value = this.a1.texture; this.pass(this.copyMat, this.a2);
    this.blur(this.a2, this.b2, this.a2.width, this.a2.height);
    this.blur(this.a2, this.b2, this.a2.width, this.a2.height);
    const u = this.compMat.uniforms;
    u.tScene.value = this.rtMain.texture; u.tB1.value = this.a1.texture; u.tB2.value = this.a2.texture;
    u.exposure.value = this.exposure; u.time.value = time % 100; u.red.value = red;
    this.pass(this.compMat, null);
  }
}
