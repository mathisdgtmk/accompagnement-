// Pub « écosystème » en 3D : un téléphone posé sur un bureau en bois, caméra qui plonge en macro, trait de lumière bleue
// qui court sur l'écran puis sur la table, carte qui se dresse, logo qui s'allume. Rendu image par image (WebGL logiciel).
// renderFrame(t) est déterministe : tout dépend uniquement de t (secondes).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as UI from './ui.js';

// les polices doivent être prêtes avant de dessiner les textures (bouton, écrans)
await Promise.all(['400 100px PF', 'italic 400 100px PF', '700 100px PF', 'italic 700 100px PF', 'italic 800 100px PF', '400 30px MS', '500 30px MS', '600 30px MS', '700 30px MS', '800 30px MS'].map(f => document.fonts.load(f)));
await document.fonts.load('30px "Noto Color Emoji"').catch(() => 0);
const Q = new URLSearchParams(location.search);
const SC = parseFloat(Q.get('s') || '1');
const W = Math.round(1080 * SC), H = Math.round(1920 * SC);
export const TOTAL = 21.4;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, s, d) => clamp((t - s) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const E = UI.E;

// ============================================================ chronologie (secondes)
const TL = {
  screens: [0, 4.3, 8.3, 12.3],            // début de chaque écran du téléphone (fondu enchaîné de 0,25 s)
  lineA: [2.15, 4.15],                     // trait de lumière qui parcourt la liste « à faire »
  card: [10.15, 12.3],                     // carte « plan complété » qui se dresse
  lineC: [10.5, 12.0],                     // trait autour de la carte
  lineB: [14.0, 17.3],                     // trait qui quitte le téléphone, traverse la table et allume le logo
  logo: [0, 0],                            // (calculé : le logo s'allume quand le trait le longe)
  button: 0,                               // (calculé)
};
const EV = [];                              // événements sonores (lus par audio.py)
const ev = (t, type, n = 0) => EV.push({ t, type, n });
// ouverture : la liste que l'on repousse
ev(0.30, 'pop'); ev(0.9, 'tick', 0); ev(1.0, 'strike', 0); ev(1.5, 'strike', 1); ev(2.0, 'strike', 2); ev(2.5, 'strike', 3); ev(3.35, 'pop');
ev(1.9, 'riser'); ev(2.15, 'zing'); ev(3.5, 'whoosh'); ev(4.0, 'impact');
// objectif (écran 2 démarre à 4,3 s)
ev(4.30, 'pop'); for (let k = 0; k < 18; k++) ev(4.9 + k * 0.056, 'type'); ev(5.8, 'check', 0); ev(6.15, 'check', 1); ev(6.5, 'check', 2); ev(7.1, 'press'); ev(7.3, 'pop'); ev(7.33, 'ding', 2);
ev(7.6, 'whoosh'); ev(8.0, 'impact');
// plan (écran 3 démarre à 8,3 s)
ev(8.30, 'pop'); ev(9.2, 'check', 0); ev(9.75, 'check', 1); ev(10.3, 'check', 2); ev(10.85, 'check', 3);
ev(9.8, 'riser'); ev(10.15, 'zing'); ev(10.2, 'cardpop'); ev(10.35, 'ding', 4); ev(10.9, 'ding', 5);
ev(11.7, 'whoosh'); ev(12.0, 'impact');
// suivi (écran 4 démarre à 12,3 s)
ev(12.30, 'pop'); ev(13.1, 'check', 3); ev(13.7, 'check', 5); ev(13.6, 'riser'); ev(14.0, 'zing'); ev(15.3, 'whoosh');
const RISERS = [[1.9, 2.15], [9.8, 10.15], [13.6, 14.0]];

// ============================================================ moteur de rendu
const glCv = document.getElementById('gl'); glCv.width = W; glCv.height = H;
const outCv = document.getElementById('c'); outCv.width = W; outCv.height = H; const out2d = outCv.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCv, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
const MAXANI = renderer.capabilities.getMaxAnisotropy();

const HT = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
const rtScene = new THREE.WebGLRenderTarget(W, H, { ...HT, depthBuffer: true, samples: 4 });
const rtDepth = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType) });
const rtDof = new THREE.WebGLRenderTarget(Math.ceil(W / 2), Math.ceil(H / 2), HT);
const rtA = new THREE.WebGLRenderTarget(W, H, HT), rtB = new THREE.WebGLRenderTarget(W, H, HT);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.7, 1.15);
const fsq = new FullScreenQuad(null);
const runPass = (mat, target) => { fsq.material = mat; renderer.setRenderTarget(target); fsq.render(renderer); };

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const NEAR = 0.1, FAR = 60;
const DEPTHLIB = `
uniform sampler2D tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxCoc;
float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float zn = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - zn * (uFar - uNear)); }
float cocOf(float z){ return min(uAperture * abs(z - uFocus) / max(z, 0.001), uMaxCoc); }`;
const common = (extra = {}) => ({ tDepth: { value: rtDepth.depthTexture }, uNear: { value: NEAR }, uFar: { value: FAR }, uFocus: { value: 5 }, uAperture: { value: 40 }, uMaxCoc: { value: 36 * SC }, ...extra });
const dofMat = new THREE.ShaderMaterial({
  uniforms: common({ tColor: { value: rtScene.texture }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uRot: { value: 0 } }), vertexShader: VS, depthTest: false, depthWrite: false,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uTexel; uniform float uRot; ${DEPTHLIB}
  void main(){
    float zc = linZ(vUv), cc = cocOf(zc); vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0;
    if (cc > 0.6) {
      for (int i = 0; i < 40; i++) {
        float fi = float(i), r = sqrt((fi + 0.5) / 40.0), a = fi * 2.39996323 + uRot; vec2 o = vec2(cos(a), sin(a)) * r;
        vec2 uv2 = vUv + o * cc * uTexel; float cs = cocOf(linZ(uv2)); float rp = r * cc;
        float w = smoothstep(rp - 1.0, rp + 0.75, cs); acc += texture2D(tColor, uv2).rgb * w; ws += w;
      }
    }
    gl_FragColor = vec4(acc / ws, 1.0);
  }` });
const compMat = new THREE.ShaderMaterial({
  uniforms: common({ tFull: { value: rtScene.texture }, tDof: { value: rtDof.texture } }), vertexShader: VS, depthTest: false, depthWrite: false,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tFull, tDof; ${DEPTHLIB}
  void main(){ float cc = cocOf(linZ(vUv)); float m = smoothstep(0.5, 2.5, cc); gl_FragColor = vec4(mix(texture2D(tFull, vUv).rgb, texture2D(tDof, vUv).rgb, m), 1.0); }` });
const mbMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rtA.texture }, tDepth: { value: rtDepth.depthTexture }, uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uGain: { value: 2.0 }, uMaxLen: { value: 0.13 }, uJit: { value: 0 } },
  vertexShader: VS, depthTest: false, depthWrite: false,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform mat4 uInvVP, uPrevVP; uniform float uGain, uMaxLen, uJit;
  void main(){
    float d = texture2D(tDepth, vUv).x; vec4 wp = uInvVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); wp /= wp.w;
    vec4 pp = uPrevVP * wp; vec2 puv = pp.xy / pp.w * 0.5 + 0.5; vec2 v = (vUv - puv) * uGain; float l = length(v); if (l > uMaxLen) v *= uMaxLen / l;
    float jit = fract(sin(dot(vUv * 1731.0 + uJit, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 acc = vec3(0.0); for (int i = 0; i < 26; i++) { float k = (float(i) + jit) / 26.0 - 0.5; acc += texture2D(tColor, vUv + v * k).rgb; }
    gl_FragColor = vec4(acc / 26.0, 1.0);
  }` });
const gradeMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rtB.texture }, uTime: { value: 0 }, uExposure: { value: 1.0 }, uRes: { value: new THREE.Vector2(W, H) }, uFade: { value: 1 } }, vertexShader: VS, depthTest: false, depthWrite: false,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform float uTime, uExposure, uFade; uniform vec2 uRes;
  float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main(){
    vec2 cc = vUv - 0.5; float r2 = dot(cc, cc); vec2 off = cc * r2 * 0.010;
    vec3 col = vec3(texture2D(tColor, vUv - off).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv + off).b) * uExposure;
    col = aces(col);
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(vec3(0.94, 0.99, 1.07), vec3(1.05, 1.0, 0.94), smoothstep(0.1, 0.7, lum));              // ombres froides, hautes lumières chaudes
    col = mix(vec3(lum), col, 1.06);
    col *= 1.0 - 0.62 * smoothstep(0.22, 0.78, length(cc * vec2(1.0, 0.72)));
    col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.035;
    col *= uFade; col = pow(max(col, 0.0), vec3(1.0 / 2.2)); gl_FragColor = vec4(col, 1.0);
  }` });

// ============================================================ scène
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04050a); scene.fog = new THREE.FogExp2(0x05060c, 0.042);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.30;
const camera = new THREE.PerspectiveCamera(30, W / H, NEAR, FAR);
const rrShape = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false); return s; };
const softDisc = (stops, size = 128) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// ---- lumières
const key = new THREE.SpotLight(0xffd7ad, 190, 0, 0.52, 1.0, 2); key.position.set(-3.4, 5.4, 4.6); key.target.position.set(0.1, 0.2, 0.5);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012; key.shadow.radius = 7; key.shadow.camera.near = 2; key.shadow.camera.far = 18;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6f8fff, 1.6); rim.position.set(3.5, 2.8, -4.5); rim.target.position.set(0, 0.7, 0); scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(0x1b2440, 0x0a0705, 0.30));

// ---- bureau en bois
const woodTex = await new Promise((res, rej) => new THREE.TextureLoader().load('textures/wood.jpg', res, undefined, rej));
woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(4.5, 4.5); woodTex.anisotropy = MAXANI;
const table = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshPhysicalMaterial({ map: woodTex, bumpMap: woodTex, bumpScale: 0.18, roughness: 0.58, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.45 }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

// ---- fond : rideau très flou + points lumineux (bokeh) + poussière
{
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#201a16'); gr.addColorStop(1, '#0b0908'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 90; i++) { const x = (i / 90) * 1024 + Math.sin(i * 1.7) * 6, w = 8 + (i * 37 % 13); const a = 0.05 + 0.16 * Math.abs(Math.sin(i * 0.9 + 1.3)); g.fillStyle = `rgba(255,214,170,${a})`; g.fillRect(x, 0, w, 256); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(46, 12), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.8, 0.8, 0.8) })); back.position.set(0, 4.5, -10); scene.add(back);
}
const bokehTex = softDisc([[0, 'rgba(255,255,255,1)'], [0.62, 'rgba(255,255,255,.9)'], [0.9, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
const bokeh = new THREE.Group(); scene.add(bokeh);
{
  let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const warm = rnd() < 0.9, m = new THREE.SpriteMaterial({ map: bokehTex, color: warm ? new THREE.Color(1.0, 0.72, 0.42).multiplyScalar(0.35 + rnd() * 0.5) : new THREE.Color(0.45, 0.62, 1.0).multiplyScalar(0.3 + rnd() * 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const sp = new THREE.Sprite(m); const sz = 0.25 + rnd() * 0.75; sp.scale.set(sz, sz, 1); sp.position.set((rnd() - 0.5) * 18, 0.4 + rnd() * 5.5, -4 - rnd() * 5); bokeh.add(sp);
  }
}
const dustPts = []; { let s = 777; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 160; i++) dustPts.push({ x: (rnd() - 0.5) * 6, y: 0.1 + rnd() * 3.2, z: -1.5 + rnd() * 6, ph: rnd() * 6.28, sp: 0.03 + rnd() * 0.06 }); }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustPts.length * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: bokehTex, size: 0.035, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.0, 0.85, 0.65), opacity: 0.55, fog: false })); dust.frustumCulled = false; scene.add(dust);

// ---- téléphone
const BEV = 0.008, PBW = 0.70, PBH = 1.46, PBD = 0.064, SW_ = 0.684, SH_ = 1.444, FRONT = PBD / 2 + BEV;
const phone = new THREE.Group(); phone.rotation.x = -0.17; phone.position.set(0, 0.007, 0); scene.add(phone);
const body = new THREE.Group(); body.position.y = (PBH + 2 * BEV) / 2; phone.add(body);
const bodyGeo = new THREE.ExtrudeGeometry(rrShape(PBW, PBH, 0.10), { depth: PBD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 18 }); bodyGeo.translate(0, 0, -PBD / 2);
const titan = new THREE.MeshPhysicalMaterial({ color: 0x2c3040, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.7 });
const bodyMesh = new THREE.Mesh(bodyGeo, titan); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; body.add(bodyMesh);
for (const [x, y, h] of [[PBW / 2 + BEV, 0.34, 0.2], [-PBW / 2 - BEV, 0.42, 0.11], [-PBW / 2 - BEV, 0.22, 0.11]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, h, 0.034), titan); b.position.set(x, y, 0); b.castShadow = true; body.add(b); }
const glassGeo = new THREE.ShapeGeometry(rrShape(0.694, 1.454, 0.092), 20);
const blackGlass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ color: 0x010103, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 })); blackGlass.position.z = FRONT + 0.0004; body.add(blackGlass);
const scrGeo = new THREE.ShapeGeometry(rrShape(SW_, SH_, 0.085), 20); { const p = scrGeo.attributes.position, uv = scrGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SW_ + 0.5, p.getY(i) / SH_ + 0.5); }
const uiCv = document.createElement('canvas'); uiCv.width = UI.SW * 2; uiCv.height = UI.SH * 2; const uiCtx = uiCv.getContext('2d');
const uiTex = new THREE.CanvasTexture(uiCv); uiTex.colorSpace = THREE.SRGBColorSpace; uiTex.anisotropy = MAXANI; uiTex.generateMipmaps = true; uiTex.minFilter = THREE.LinearMipmapLinearFilter;
const screen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: uiTex, toneMapped: false, color: new THREE.Color(1.0, 1.0, 1.03) })); screen.position.z = FRONT + 0.0009; body.add(screen);
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 512);
  gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(0.35, 'rgba(255,255,255,.04)'); gr.addColorStop(0.6, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.07)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c); const sheen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sheen.position.z = FRONT + 0.0016; body.add(sheen);
}
// conversion pixel de l'écran -> coordonnées locales du téléphone
const uiPt = (x, y, dz = 0.005) => new THREE.Vector3((x / UI.SW - 0.5) * SW_, (0.5 - y / UI.SH) * SH_, FRONT + 0.0009 + dz);
scene.updateMatrixWorld(true);

// ---- traits de lumière (le « wave » de la référence)
class PolyCurve extends THREE.Curve {
  constructor(pts) { super(); this.pts = pts; this.cum = [0]; for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1])); this.total = this.cum[this.cum.length - 1]; }
  getPoint(t, target = new THREE.Vector3()) { const d = clamp(t) * this.total; let i = 1; while (i < this.cum.length - 1 && this.cum[i] < d) i++; const k = (d - this.cum[i - 1]) / Math.max(1e-9, this.cum[i] - this.cum[i - 1]); return target.lerpVectors(this.pts[i - 1], this.pts[i], clamp(k)); }
}
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.30, 0.78, 3.4), fog: false, toneMapped: false });
const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 3.4, 4.6), fog: false, toneMapped: false });
const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 4.6, 5.5), fog: false, toneMapped: false });
class GlowLine {
  constructor(parent, pts, { radius = 0.006, seg = 900, light = 7, tail = 1.0 } = {}) {
    this.parent = parent; this.curve = new PolyCurve(pts); this.seg = seg; this.rad = 6; this.tail = tail; this.group = new THREE.Group(); parent.add(this.group);
    this.m1 = new THREE.Mesh(new THREE.TubeGeometry(this.curve, seg, radius, this.rad, false), glowMat); this.m2 = new THREE.Mesh(new THREE.TubeGeometry(this.curve, seg, radius * 0.42, 5, false), coreMat);
    this.m2idx = 5 * 6; this.head = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.2, 14, 14), headMat);
    this.I = light; this.light = new THREE.PointLight(0x4a8cff, 0, 2.4, 2); scene.add(this.light);      // jamais masquée : le nombre de lumières doit rester constant
    this.group.add(this.m1, this.m2, this.head); [this.m1, this.m2, this.head].forEach(m => { m.frustumCulled = false; });
    this.set(0);
  }
  set(p, s0 = null) {   // p : avancement 0..1 de la tête ; s0 : début de la traîne (par défaut p - tail)
    const e = clamp(p), s = clamp(s0 === null ? e - this.tail : s0), a = Math.floor(s * this.seg), b = Math.ceil(e * this.seg), vis = e > 0.0005 && s < e - 1e-4;
    this.group.visible = vis; if (!vis) { this.light.intensity = 0; return; }
    this.m1.geometry.setDrawRange(a * this.rad * 6, Math.max(0, b - a) * this.rad * 6); this.m2.geometry.setDrawRange(a * this.m2idx, Math.max(0, b - a) * this.m2idx);
    const hp = this.curve.getPoint(e); this.head.position.copy(hp); const on = e < 0.9995; this.head.visible = on;
    this.parent.updateWorldMatrix(true, false); this.light.position.copy(this.parent.localToWorld(hp.clone())); this.light.intensity = on ? this.I : 0;
  }
}
// trait A : serpentin à travers les lignes de la liste « à faire » (coordonnées pixel de l'écran)
const ptsA = []; { const y = i => 236 + i * 138 + 57; ptsA.push(uiPt(-40, 80)); ptsA.push(uiPt(-40, y(0))); for (let i = 0; i < 4; i++) { const L = i % 2 === 0; ptsA.push(uiPt(L ? 30 : 570, y(i))); ptsA.push(uiPt(L ? 570 : 30, y(i))); if (i < 3) ptsA.push(uiPt(L ? 570 : 30, y(i + 1))); } ptsA.push(uiPt(30, y(3) + 0)); ptsA.push(uiPt(-30, y(3) + 60)); }
const lineA = new GlowLine(body, ptsA, { radius: 0.0052, seg: 1100, tail: 0.5, light: 4 });

// ---- carte « plan complété » qui se dresse hors de l'écran
const cardCv = document.createElement('canvas'); cardCv.width = UI.CARD.w; cardCv.height = UI.CARD.h; const cardCtx = cardCv.getContext('2d');
const cardTex = new THREE.CanvasTexture(cardCv); cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.anisotropy = MAXANI;
const CW = 0.66, CH = CW * 0.6; const cardGeo = new THREE.PlaneGeometry(CW, CH); cardGeo.translate(0, CH / 2, 0);
const cardMat = new THREE.MeshBasicMaterial({ map: cardTex, transparent: true, toneMapped: false, depthWrite: false, fog: false, side: THREE.DoubleSide });
const cardMesh = new THREE.Mesh(cardGeo, cardMat); cardMesh.visible = false; cardMesh.renderOrder = 5; scene.add(cardMesh);
const cardBase = body.localToWorld(new THREE.Vector3(0, -0.20, FRONT + 0.003));
// trait C : le long de la base de la carte puis qui s'échappe vers l'arrière-plan
const lineC = (() => { const b = cardBase.clone(), l = b.clone().add(new THREE.Vector3(-CW / 2 - 0.02, 0.0, 0.0)), r = b.clone().add(new THREE.Vector3(CW / 2 + 0.02, 0.0, 0.0)); const out = new THREE.CatmullRomCurve3([r, r.clone().add(new THREE.Vector3(0.12, 0.10, 0.12)), r.clone().add(new THREE.Vector3(0.34, 0.34, 0.5)), r.clone().add(new THREE.Vector3(0.7, 0.78, 1.1))]); const pts = [l.clone().add(new THREE.Vector3(-0.35, -0.02, 0.08)), l, r, ...out.getPoints(24).slice(1)]; return new GlowLine(scene, pts, { radius: 0.0058, seg: 700, tail: 0.6, light: 4 }); })();

// ---- logo lumineux et bouton posés sur la table
const logoCv = document.createElement('canvas'); logoCv.width = UI.LOGO.w; logoCv.height = UI.LOGO.h; const logoCtx = logoCv.getContext('2d');
const logoTex = new THREE.CanvasTexture(logoCv); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = MAXANI;
const LG_W = 1.75, LG_H = LG_W * UI.LOGO.h / UI.LOGO.w, LG_TILT = -0.62, LG_Z = 1.45; const lgGeo = new THREE.PlaneGeometry(LG_W, LG_H); lgGeo.translate(0, LG_H / 2, 0); const logo = new THREE.Mesh(lgGeo, new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, color: new THREE.Color(1.0, 1.0, 1.03), depthWrite: false, fog: false, toneMapped: false }));
logo.rotation.x = LG_TILT; logo.position.set(0.02, 0.004, LG_Z); logo.renderOrder = 4; scene.add(logo);
const btnCv = document.createElement('canvas'); btnCv.width = UI.BTN.w; btnCv.height = UI.BTN.h; UI.drawButton(btnCv.getContext('2d'));
const btnTex = new THREE.CanvasTexture(btnCv); btnTex.colorSpace = THREE.SRGBColorSpace; btnTex.anisotropy = MAXANI;
const BT_W = 1.22; const btnGroup = new THREE.Group(); btnGroup.position.set(0.02, 0.004, 2.75); btnGroup.rotation.y = -0.05; scene.add(btnGroup);
const BT_H = BT_W * UI.BTN.h / UI.BTN.w, btnGeo = new THREE.PlaneGeometry(BT_W, BT_H); btnGeo.translate(0, BT_H / 2, 0);
const btn = new THREE.Mesh(btnGeo, new THREE.MeshBasicMaterial({ map: btnTex, transparent: true, depthWrite: false, fog: false, toneMapped: false })); btn.rotation.x = -0.95; btn.renderOrder = 6; btnGroup.add(btn);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.7), new THREE.MeshBasicMaterial({ map: softDisc([[0, 'rgba(0,0,0,.85)'], [0.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']], 256), transparent: true, depthWrite: false, fog: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = -0.002; blob.renderOrder = 3; btnGroup.add(blob);
// trait B : quitte le téléphone, glisse sur la table et vient allumer le logo (de gauche à droite)
const lineB = (() => {
  const s = body.localToWorld(uiPt(562, 806, 0.02)), up = body.localToWorld(uiPt(660, 700, 0.16));
  const hv = new THREE.CatmullRomCurve3([s, up, new THREE.Vector3(0.62, 0.34, 0.5), new THREE.Vector3(0.85, 0.07, 1.05), new THREE.Vector3(0.25, 0.012, 1.55), new THREE.Vector3(-0.95, 0.01, 1.70)], false, 'centripetal');
  const pts = hv.getPoints(90); const y0 = 0.012, zb = LG_Z + 0.07; const x0 = -LG_W / 2 + 0.02, x1 = LG_W / 2 - 0.02;
  pts.push(new THREE.Vector3(x0, y0, zb), new THREE.Vector3(x1, y0, zb)); return new GlowLine(scene, pts, { radius: 0.0062, seg: 1000, tail: 0.55, light: 3 });
})();
{ const c = lineB.curve, n = c.pts.length; var FRAC_X0 = c.cum[n - 2] / c.total; }          // part de la longueur où le trait atteint le début du logo
{ const d = TL.lineB[1] - TL.lineB[0]; let k = 0; while (k < 1 && E.inOut(k) < FRAC_X0) k += 0.001; TL.logo = [TL.lineB[0] + k * d, TL.lineB[1]]; TL.button = TL.lineB[1] + 0.15; }
// événements sonores de la révélation (calés sur le trait)
ev(TL.logo[0] - 0.55, 'whoosh'); ev(TL.logo[0], 'impact'); ev(TL.logo[0] + 0.02, 'shimmer'); ev(TL.button, 'pop'); ev(TL.button + 0.02, 'ding', 5); ev(TL.button + 0.7, 'ding', 3);

// ============================================================ caméra
function pchip(ts, vs) {
  const n = ts.length, h = [], d = [], m = new Array(n).fill(0); for (let i = 0; i < n - 1; i++) { h.push(ts[i + 1] - ts[i]); d.push((vs[i + 1] - vs[i]) / h[i]); }
  for (let i = 1; i < n - 1; i++) { if (d[i - 1] * d[i] <= 0) m[i] = 0; else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); } }
  return t => { if (t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1]; let i = 0; while (t > ts[i + 1]) i++; const x = (t - ts[i]) / h[i], x2 = x * x, x3 = x2 * x; return (2 * x3 - 3 * x2 + 1) * vs[i] + (x3 - 2 * x2 + x) * h[i] * m[i] + (-2 * x3 + 3 * x2) * vs[i + 1] + (x3 - x2) * h[i] * m[i + 1]; };
}
// clés : t, position, cible, fov, roulis (rad), ouverture (flou de profondeur), décalage de mise au point
const KEYS = [
  { t: 0.0, p: [1.35, 0.85, 6.6], l: [0.06, 0.80, 0.0], fov: 27, roll: 0.0, ap: 70, fo: 0 },
  { t: 1.8, p: [0.95, 0.90, 4.9], l: [0.03, 0.82, 0.0], fov: 27, roll: -0.02, ap: 60, fo: 0 },
  { t: 2.8, p: [0.55, 1.00, 3.1], l: [0.0, 0.95, 0.04], fov: 29, roll: -0.06, ap: 55, fo: 0 },
  { t: 3.5, p: [0.10, 1.02, 1.5], l: [0.0, 0.92, 0.04], fov: 30, roll: -0.18, ap: 50, fo: 0 },
  { t: 4.05, p: [-0.45, 0.90, 1.15], l: [0.1, 0.85, 0.05], fov: 32, roll: -0.42, ap: 45, fo: 0 },
  { t: 4.6, p: [1.15, 0.60, 3.5], l: [0.0, 0.80, 0.04], fov: 29, roll: 0.10, ap: 55, fo: 0 },
  { t: 5.8, p: [0.65, 0.85, 2.2], l: [0.0, 0.86, 0.04], fov: 29, roll: 0.03, ap: 50, fo: 0 },
  { t: 7.2, p: [-0.85, 0.80, 2.9], l: [0.0, 0.78, 0.04], fov: 29, roll: -0.04, ap: 52, fo: 0 },
  { t: 7.9, p: [-1.5, 0.45, 2.2], l: [0.0, 0.60, 0.05], fov: 31, roll: 0.36, ap: 46, fo: 0 },
  { t: 8.8, p: [-1.0, 0.65, 3.5], l: [0.0, 0.80, 0.04], fov: 29, roll: 0.05, ap: 55, fo: 0 },
  { t: 10.0, p: [0.85, 0.95, 3.3], l: [0.0, 0.90, 0.05], fov: 29, roll: -0.04, ap: 55, fo: 0 },
  { t: 11.4, p: [0.12, 1.08, 2.9], l: [0.0, 0.97, 0.10], fov: 29, roll: 0.0, ap: 52, fo: 0 },
  { t: 12.1, p: [-0.8, 1.0, 2.0], l: [0.0, 0.90, 0.06], fov: 31, roll: -0.32, ap: 46, fo: 0 },
  { t: 12.9, p: [0.85, 1.25, 3.0], l: [0.0, 0.85, 0.05], fov: 29, roll: 0.07, ap: 54, fo: 0 },
  { t: 13.9, p: [-0.25, 0.90, 2.2], l: [0.0, 0.90, 0.05], fov: 29, roll: 0.0, ap: 50, fo: 0 },
  { t: 14.9, p: [0.75, 0.50, 2.9], l: [0.25, 0.55, 0.40], fov: 30, roll: 0.05, ap: 52, fo: 0 },
  { t: 15.7, p: [0.90, 0.16, 2.6], l: [0.45, 0.10, 1.35], fov: 32, roll: 0.0, ap: 55, fo: 0 },
  { t: 16.5, p: [0.55, 0.90, 5.2], l: [0.10, 0.35, 1.10], fov: 34, roll: 0.0, ap: 28, fo: -0.2 },
  { t: 17.6, p: [0.10, 1.40, 7.0], l: [0.0, 0.42, 1.15], fov: 36, roll: 0.0, ap: 11, fo: -0.2 },
  { t: 21.4, p: [-0.08, 1.35, 6.6], l: [0.0, 0.42, 1.2], fov: 36, roll: 0.0, ap: 10, fo: -0.2 },
];
const track = f => pchip(KEYS.map(k => k.t), KEYS.map(f));
const TR = { px: track(k => k.p[0]), py: track(k => k.p[1]), pz: track(k => k.p[2]), lx: track(k => k.l[0]), ly: track(k => k.l[1]), lz: track(k => k.l[2]), fov: track(k => k.fov), roll: track(k => k.roll), ap: track(k => k.ap), fo: track(k => k.fo) };
const shake = (t, a) => Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1 + 1.3) * 0.3 + Math.sin(t * 5.3 + 0.4) * 0.1;
const camTarget = new THREE.Vector3();
function setCamera(t) {
  const sx = 0.0035 * shake(t, 1), sy = 0.0035 * shake(t + 9, 1);
  camera.position.set(TR.px(t) + sx, TR.py(t) + sy, TR.pz(t)); camTarget.set(TR.lx(t), TR.ly(t), TR.lz(t));
  camera.fov = TR.fov(t); camera.updateProjectionMatrix(); camera.lookAt(camTarget); camera.rotateZ(TR.roll(t) + 0.0025 * shake(t + 4, 1));
  camera.updateMatrixWorld(true); return { focus: camera.position.distanceTo(camTarget) + TR.fo(t), ap: TR.ap(t) };
}
const vpMatrix = () => new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

// ============================================================ rendu d'une image
const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
const screenAt = t => { let i = 0; for (let k = 0; k < TL.screens.length; k++) if (t >= TL.screens[k]) i = k; return i; };
let lastFrame = -1;
window.renderFrame = t => {
  t = clamp(t, 0, TOTAL - 1e-3);
  // ----- écran du téléphone (fondu enchaîné de 0,25 s entre deux écrans)
  const si = screenAt(t), sl = t - TL.screens[si];
  uiCtx.setTransform(1, 0, 0, 1, 0, 0); uiCtx.clearRect(0, 0, uiCv.width, uiCv.height); uiCtx.scale(2, 2);
  if (si > 0 && sl < 0.25) { UI.drawScreen(uiCtx, si - 1, t - TL.screens[si - 1], 1); UI.drawScreen(uiCtx, si, sl, E.inOut(sl / 0.25)); } else UI.drawScreen(uiCtx, si, sl, 1);
  uiTex.needsUpdate = true;
  // ----- carte, logo
  const cp = (t - TL.card[0]); const cardOn = t >= TL.card[0] && t < TL.card[1] + 0.35; cardMesh.visible = cardOn;
  if (cardOn) {
    UI.drawCard(cardCtx, Math.max(0, cp)); cardTex.needsUpdate = true;
    const grow = E.outBack(prog(t, TL.card[0], 0.7)), fade = 1 - E.inCubic(prog(t, TL.card[1] - 0.1, 0.4));
    cardMesh.position.copy(cardBase).add(new THREE.Vector3(0, 0, 0.02 + 0.05 * E.outCubic(prog(t, TL.card[0], 0.9)) + 0.012 * Math.sin(t * 2.0)));
    cardMesh.rotation.set(-0.30 - 0.04 * Math.sin(t * 1.3), 0, 0); cardMesh.scale.set(1, Math.max(0.001, grow), 1); cardMat.opacity = clamp(prog(t, TL.card[0], 0.25)) * fade;
  }
  const kB = prog(t, TL.lineB[0], TL.lineB[1] - TL.lineB[0]), eB = E.inOut(kB), lp = clamp((eB - FRAC_X0) / (1 - FRAC_X0)); logo.visible = lp > 0; if (lp > 0) { UI.drawLogo(logoCtx, lp); logoTex.needsUpdate = true; }
  const bp = prog(t, TL.button, 0.55); btnGroup.visible = bp > 0; if (bp > 0) { const e = E.outBack(bp); btnGroup.scale.set(0.7 + 0.3 * e, 1, 0.7 + 0.3 * e); btn.material.opacity = clamp(bp * 2); blob.material.opacity = clamp(bp * 2); }
  // ----- traits de lumière
  { const k = prog(t, TL.lineA[0], TL.lineA[1] - TL.lineA[0]), e = E.inOut(k); lineA.set(e, k < 1 ? null : lerp(e - lineA.tail, 1, E.inOut(prog(t, TL.lineA[1], 0.32)))); }
  { const k = prog(t, TL.lineC[0], TL.lineC[1] - TL.lineC[0]), e = E.inOut(k); lineC.set(e, k < 1 ? null : lerp(e - lineC.tail, 1, E.inOut(prog(t, TL.lineC[1], 0.4)))); }
  { const after = prog(t, TL.lineB[1], 0.9); lineB.set(eB, kB < 1 ? null : lerp(clamp(eB - 0.55), FRAC_X0 - 0.02, E.inOut(after))); }
  // ----- poussière flottante
  { const a = dustGeo.attributes.position; dustPts.forEach((d, i) => a.setXYZ(i, d.x + Math.sin(t * d.sp * 3 + d.ph) * 0.25, d.y + Math.sin(t * d.sp * 2 + d.ph * 2) * 0.18 + t * 0.012 % 0.3, d.z + Math.cos(t * d.sp * 2.4 + d.ph) * 0.2)); a.needsUpdate = true; }
  // ----- caméra (position précédente pour le flou de mouvement)
  const dtm = 0.6 / 30; setCamera(t - dtm); const prevVP = vpMatrix(); const cam = setCamera(t); const vp = vpMatrix();
  mbMat.uniforms.uPrevVP.value.copy(prevVP); mbMat.uniforms.uInvVP.value.copy(vp).invert(); mbMat.uniforms.uJit.value = (Math.round(t * 30) % 11) * 0.37;
  for (const m of [dofMat, compMat]) { m.uniforms.uFocus.value = cam.focus; m.uniforms.uAperture.value = cam.ap * SC; }
  dofMat.uniforms.uRot.value = (Math.round(t * 30) % 7) * 0.9;
  // ----- 1) profondeur  2) scène  3) flou de profondeur  4) flou de mouvement  5) halo lumineux  6) étalonnage
  bokeh.visible = false; dust.visible = false; scene.overrideMaterial = depthMat; renderer.setRenderTarget(rtDepth); renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null; bokeh.visible = true; dust.visible = true;
  renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
  runPass(dofMat, rtDof); runPass(compMat, rtA); runPass(mbMat, rtB);
  bloom.render(renderer, null, rtB, 0, false);
  gradeMat.uniforms.uTime.value = t; gradeMat.uniforms.uFade.value = 1;
  runPass(gradeMat, null);
  // ----- calque 2D final : image 3D + bulles de texte
  out2d.setTransform(1, 0, 0, 1, 0, 0); out2d.drawImage(glCv, 0, 0); UI.drawCaptions(out2d, t, SC); UI.drawLegal(out2d, t, SC);
  // fondu au noir / depuis le noir appliqué aussi aux textes
  const fade = E.inOut(prog(t, 0, 0.5)) * (1 - E.inOut(prog(t, TOTAL - 0.9, 0.9))); if (fade < 1) { out2d.fillStyle = `rgba(0,0,0,${1 - fade})`; out2d.fillRect(0, 0, W, H); }
};

window.probe = t => { setCamera(t); const P = (n, v) => { const q = v.clone().project(camera); return [n, +((q.x + 1) / 2).toFixed(3), +((1 - q.y) / 2).toFixed(3)]; }; return [P('phoneTop', body.localToWorld(new THREE.Vector3(0, 0.73, 0.04))), P('phoneMid', body.localToWorld(new THREE.Vector3(0, 0, 0.04))), P('phoneBot', body.localToWorld(new THREE.Vector3(0, -0.73, 0.04))), P('logo', logo.position.clone().add(new THREE.Vector3(0, LG_H / 2 * Math.cos(LG_TILT), 0))), P('button', btnGroup.position)]; };
window.probeCam = (p, l, fov) => { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...l)); camera.rotateZ(0); camera.updateMatrixWorld(true); const P = (n, v) => { const q = v.clone().project(camera); return [n, +((q.x + 1) / 2).toFixed(3), +((1 - q.y) / 2).toFixed(3)]; }; return [P('top', body.localToWorld(new THREE.Vector3(0, 0.73, 0.04))), P('bot', body.localToWorld(new THREE.Vector3(0, -0.73, 0.04))), P('logo', logo.position.clone().add(new THREE.Vector3(0, LG_H / 2 * Math.cos(LG_TILT), 0))), P('btn', btnGroup.position)]; };
window.TIMELINE = { total: TOTAL, fps: 30, events: EV, risers: RISERS, logo: TL.logo, button: TL.button, lineA: TL.lineA, lineB: TL.lineB, card: TL.card, screens: TL.screens };
bloom.threshold = 1.15; bloom.strength = 0.9; bloom.radius = 0.7;
window.renderFrame(0); window.ready = true;
