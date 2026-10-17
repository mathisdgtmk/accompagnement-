// Dessin 2D de tout ce qui devient une texture dans la scène 3D :
// écrans du téléphone, carte qui se dresse, logo lumineux, bouton, bulle de texte (calque final).
const C = window.CONTENT;
export const SW = 600, SH = 1267;                // taille logique de l'écran du téléphone (dessinée en x2)

const WHITE = '#f4f6fb', ICE = '#dfe6ff', BLUE = '120,140,255';
const G1 = 'rgba(232,236,248,.68)', G2 = 'rgba(232,236,248,.42)';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, s, d) => clamp((t - s) / d);
const lerp = (a, b, k) => a + (b - a) * k;
export const E = {
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inCubic: x => x * x * x,
  outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const ease = x => E.inOut(clamp(x));
const PF = (s, w = 400, it = false) => `${it ? 'italic ' : ''}${w} ${s}px PF, Georgia, serif`;
const MS = (s, w = 400) => `${w} ${s}px MS, "Noto Color Emoji", Arial, sans-serif`;

let ctx;
function T(str, x, y, o = {}) {
  ctx.save(); ctx.font = o.font; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
  const ls = o.ls || 0; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width;
  ctx.globalAlpha *= o.alpha ?? 1; ctx.fillStyle = o.fill || WHITE;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 24; }
  ctx.fillText(str, o.align === 'center' ? x + ls / 2 : x, y); ctx.restore(); return w;
}
function fit(str, maxW, size, fontFn, ls = 0) {
  ctx.save(); ctx.letterSpacing = ls + 'px'; let s = size;
  for (; s > 12; s -= 1) { ctx.font = fontFn(s); if (ctx.measureText(str).width <= maxW) break; }
  ctx.restore(); return s;
}
const measure = (str, font, ls = 0) => { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; };
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function glass(x, y, w, h, r, o = {}) {
  ctx.save(); if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 40; }
  rr(x, y, w, h, r); ctx.fillStyle = o.fill || 'rgba(255,255,255,.055)'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = o.stroke || 'rgba(214,224,255,.18)'; ctx.lineWidth = o.lw ?? 1.5; ctx.stroke(); ctx.restore();
}
function check(cx, cy, s, col, lw = 3.2) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy + s * 0.02); ctx.lineTo(cx - s * 0.12, cy + s * 0.4); ctx.lineTo(cx + s * 0.55, cy - s * 0.4); ctx.stroke(); ctx.restore();
}

// ---------- cadre commun des écrans ----------
function frame(lt, title, label) {
  ctx.fillStyle = '#060912'; ctx.fillRect(0, 0, SW, SH);
  const g = ctx.createRadialGradient(SW * 0.75, 120, 0, SW * 0.75, 120, 560); g.addColorStop(0, `rgba(${BLUE},.20)`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  const g2 = ctx.createRadialGradient(80, SH - 120, 0, 80, SH - 120, 520); g2.addColorStop(0, `rgba(${BLUE},.10)`); g2.addColorStop(1, `rgba(${BLUE},0)`); ctx.fillStyle = g2; ctx.fillRect(0, 0, SW, SH);
  T('09:41', 58, 44, { font: MS(23, 700) });
  for (let i = 0; i < 4; i++) { ctx.fillStyle = WHITE; ctx.fillRect(466 + i * 9, 50 - (6 + i * 4), 6, 6 + i * 4); }
  ctx.strokeStyle = G1; ctx.lineWidth = 2; rr(514, 33, 40, 20, 6); ctx.stroke(); ctx.fillStyle = WHITE; rr(517, 36, 28, 14, 4); ctx.fill();
  ctx.fillStyle = '#000'; rr(SW / 2 - 66, 22, 132, 38, 19); ctx.fill();
  const a = E.outCubic(prog(lt, 0, 0.5)); ctx.save(); ctx.globalAlpha *= a;
  T(title, 38, 134, { font: MS(48, 800), ls: -1 }); T(label, 38, 188, { font: MS(17, 700), ls: 5, fill: G2 }); ctx.restore();
  ctx.fillStyle = 'rgba(244,246,251,.55)'; rr(SW / 2 - 78, SH - 26, 156, 6, 3); ctx.fill();
}

// ---------- écran 0 : la liste « à faire » qu'on repousse ----------
function screenTodo(lt) {
  const S = C.todo; frame(lt, S.title, S.label);
  S.items.forEach((it, i) => {
    const y = 236 + i * 138, p = E.outCubic(prog(lt, 0.15 + i * 0.12, 0.5)), sp = ease(prog(lt, 1.0 + i * 0.5, 0.35));
    ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 30, 0);
    glass(26, y, 548, 112, 34, { fill: 'rgba(255,255,255,.055)' });
    ctx.strokeStyle = G2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(78, y + 56, 23, 0, 6.283); ctx.stroke();
    const fs = fit(it, 290, 29, z => MS(z, 600)), tw = measure(it, MS(fs, 600));
    T(it, 124, y + 57, { font: MS(fs, 600), alpha: 1 - 0.5 * sp });
    if (sp > 0) { ctx.save(); ctx.strokeStyle = WHITE; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.shadowColor = `rgba(${BLUE},.9)`; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(118, y + 58); ctx.lineTo(118 + (tw + 14) * sp, y + 58); ctx.stroke(); ctx.restore(); }
    rr(446, y + 34, 112, 44, 22); ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.12 * sp})`; ctx.fill(); ctx.strokeStyle = 'rgba(214,224,255,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    T(S.tag, 502, y + 57, { font: MS(21, 700), align: 'center', ls: 1, fill: G1 });
    ctx.restore();
  });
  const fp = E.outBack(prog(lt, 3.3, 0.5));
  if (fp > 0) { ctx.save(); ctx.globalAlpha *= clamp(fp * 2); ctx.translate(SW / 2, 1010); ctx.scale(0.85 + 0.15 * fp, 0.85 + 0.15 * fp);
    const w = measure(S.footer, MS(24, 700)) + 76; glass(-w / 2, -33, w, 66, 33, { fill: 'rgba(255,255,255,.08)', stroke: 'rgba(214,224,255,.4)' }); T(S.footer, 0, 2, { font: MS(24, 700), align: 'center' }); ctx.restore(); }
}

// ---------- écran 1 : objectif de la semaine ----------
function screenGoal(lt) {
  const S = C.goal; frame(lt, S.title, S.label);
  const cp = E.outCubic(prog(lt, 0.25, 0.6)); ctx.save(); ctx.globalAlpha *= cp; ctx.translate(0, (1 - cp) * 24);
  glass(26, 232, 548, 250, 38, { fill: 'rgba(255,255,255,.06)', stroke: 'rgba(214,224,255,.22)', lw: 1.6 });
  T(S.fieldLabel, 60, 286, { font: MS(18, 700), ls: 5, fill: G2 });
  const n = Math.floor(S.value.length * prog(lt, 0.6, 1.0)), txt = S.value.slice(0, n);
  const tw = T(txt, 58, 368, { font: PF(62, 700, true) });
  if (Math.floor(lt * 2.4) % 2 === 0 || n < S.value.length) { ctx.fillStyle = WHITE; ctx.fillRect(63 + tw, 332, 4, 66); }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(60, 438, 480, 9, 4.5); ctx.fill(); ctx.fillStyle = WHITE; ctx.shadowColor = `rgba(${BLUE},.9)`; ctx.shadowBlur = 12; rr(60, 438, 480 * ease(prog(lt, 0.7, 1.8)), 9, 4.5); ctx.fill();
  ctx.restore();
  S.checks.forEach((c, i) => {
    const y = 560 + i * 112, p = E.outCubic(prog(lt, 0.5 + i * 0.12, 0.5)), ck = prog(lt, 1.5 + i * 0.35, 0.3), e = E.outBack(ck);
    ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 30, 0);
    glass(26, y - 48, 548, 96, 32);
    ctx.strokeStyle = G2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(78, y, 25, 0, 6.283); ctx.stroke();
    if (ck > 0) { ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(78, y, 25 * e, 0, 6.283); ctx.fill(); check(78, y + 1, 27 * e, '#05060c', 4.2); }
    T(c, 126, y + 2, { font: MS(fit(c, 410, 31, z => MS(z, 600)), 600), alpha: 0.55 + 0.45 * ck });
    ctx.restore();
  });
  const bp = E.outCubic(prog(lt, 0.9, 0.6)), press = Math.sin(Math.PI * clamp((lt - 2.7) / 0.28));
  ctx.save(); ctx.globalAlpha *= bp; ctx.translate(SW / 2, 1010); const sc = 1 - 0.05 * press; ctx.scale(sc, sc);
  ctx.shadowColor = `rgba(${BLUE},${0.5 + 0.4 * press})`; ctx.shadowBlur = 30 + 30 * press;
  const gb = ctx.createLinearGradient(0, -60, 0, 60); gb.addColorStop(0, '#ffffff'); gb.addColorStop(1, '#cdd6f6'); ctx.fillStyle = gb; rr(-274, -58, 548, 116, 58); ctx.fill(); ctx.shadowBlur = 0;
  T(S.button, 0, 3, { font: MS(36, 700), align: 'center', fill: '#05060c' }); ctx.restore();
  const pp = E.outBack(prog(lt, 3.0, 0.5));
  if (pp > 0) { ctx.save(); ctx.globalAlpha *= clamp(pp * 2); ctx.translate(SW / 2, 1140); ctx.scale(0.8 + 0.2 * pp, 0.8 + 0.2 * pp);
    const w = measure('Objectif défini', MS(26, 700)) + 120; glass(-w / 2, -38, w, 76, 38, { fill: 'rgba(12,16,32,.9)', stroke: 'rgba(214,224,255,.45)', glow: `rgba(${BLUE},.6)`, glowBlur: 30 });
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(-w / 2 + 40, 0, 20, 0, 6.283); ctx.fill(); check(-w / 2 + 40, 1, 22, '#05060c', 3.8); T('Objectif défini', -w / 2 + 76, 2, { font: MS(26, 700) }); ctx.restore(); }
}

// ---------- écran 2 : plan étape par étape ----------
function screenPlan(lt) {
  const S = C.plan; frame(lt, S.title, S.label);
  const n = S.steps.length, done = S.steps.map((_, k) => ease(prog(lt, 0.9 + k * 0.55, 0.35)));
  const p = done.reduce((a, b) => a + b, 0) / n, cx = 300, cy = 420, R = 142, ra = E.outCubic(prog(lt, 0.2, 0.6));
  ctx.save(); ctx.globalAlpha *= ra; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
  if (p > 0) { ctx.save(); ctx.shadowColor = `rgba(${BLUE},.95)`; ctx.shadowBlur = 34; ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); ctx.stroke(); ctx.restore(); }
  T(Math.round(p * 100) + ' %', cx, cy - 6, { font: MS(88, 800), align: 'center', ls: -3 }); T(S.unit, cx, cy + 64, { font: MS(24, 600), align: 'center', fill: G2, ls: 2 });
  ctx.restore();
  S.steps.forEach((s, k) => {
    const y = 736 + k * 122, st = 0.4 + k * 0.12, pp = E.outCubic(prog(lt, st, 0.5)), d = done[k], cur = d < 0.99 && (k === 0 || done[k - 1] > 0.99);
    ctx.save(); ctx.globalAlpha *= pp; ctx.translate((1 - pp) * 30, 0);
    glass(26, y - 48, 548, 96, 32, { fill: cur ? 'rgba(255,255,255,.11)' : 'rgba(255,255,255,.055)', stroke: cur ? 'rgba(235,240,255,.6)' : 'rgba(214,224,255,.16)', lw: cur ? 2.4 : 1.5 });
    ctx.strokeStyle = G2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(78, y, 24, 0, 6.283); ctx.stroke();
    if (d > 0) { const e = E.outBack(d); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(78, y, 24 * e, 0, 6.283); ctx.fill(); check(78, y + 1, 26 * e, '#05060c', 4); }
    T(String(k + 1).padStart(2, '0'), 126, y + 2, { font: MS(23, 600), ls: 3, fill: G2 }); T(s, 184, y + 2, { font: MS(fit(s, 360, 32, z => MS(z, 600)), 600), alpha: 0.6 + 0.4 * Math.max(d, cur ? 1 : 0) });
    ctx.restore();
  });
}

// ---------- écran 3 : suivi individualisé ----------
function screenFollow(lt) {
  const S = C.follow; frame(lt, S.title, S.label);
  const cw = 66, gap = (548 - 7 * cw) / 6, sel = S.meetings.map((m, i) => ease(prog(lt, 0.8 + i * 0.6, 0.35)));
  S.days.forEach((d, i) => {
    const x = 26 + i * (cw + gap), k = S.meetings.findIndex(m => m.day === i), on = k >= 0 ? sel[k] : 0, p = E.outCubic(prog(lt, 0.2 + i * 0.05, 0.4));
    ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 16);
    rr(x, 232, cw, 118, 26); ctx.fillStyle = on > 0 ? `rgba(244,246,251,${0.12 + 0.88 * on})` : 'rgba(255,255,255,.055)'; ctx.fill(); ctx.strokeStyle = 'rgba(214,224,255,.16)'; ctx.lineWidth = 1.5; ctx.stroke();
    T(d, x + cw / 2, 272, { font: MS(28, 700), align: 'center', fill: on > 0.5 ? '#05060c' : G1 });
    ctx.fillStyle = on > 0.5 ? '#05060c' : 'rgba(232,236,248,.3)'; ctx.beginPath(); ctx.arc(x + cw / 2, 320, 5.5 + 2.5 * on, 0, 6.283); ctx.fill(); ctx.restore();
  });
  S.meetings.forEach((m, i) => {
    const y = 394 + i * 134, p = E.outCubic(prog(lt, 0.9 + i * 0.6, 0.55)), ck = prog(lt, 1.35 + i * 0.6, 0.3);
    ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 40, 0);
    glass(26, y, 548, 114, 34, { fill: 'rgba(255,255,255,.065)', stroke: 'rgba(214,224,255,.22)' });
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(52, y + 26, 62, 62, 18); ctx.fill(); ctx.strokeStyle = G1; ctx.lineWidth = 2.8; rr(63, y + 38, 40, 38, 9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(63, y + 51); ctx.lineTo(103, y + 51); ctx.stroke();
    T(m.t, 136, y + 42, { font: MS(fit(m.t, 330, 29, z => MS(z, 700)), 700) }); T(m.d, 136, y + 80, { font: MS(23, 500), fill: G1 });
    if (ck > 0) { const e = E.outBack(ck); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(528, y + 57, 23 * e, 0, 6.283); ctx.fill(); check(528, y + 58, 25 * e, '#05060c', 4); }
    ctx.restore();
  });
  const lp = E.outCubic(prog(lt, 1.3, 0.5)); ctx.save(); ctx.globalAlpha *= lp;
  T(S.chart, 38, 706, { font: MS(18, 700), ls: 5, fill: G2 });
  const x0 = 38, x1 = 562, y0 = 760, y1 = 1130, pts = [0.82, 0.74, 0.78, 0.6, 0.55, 0.46, 0.4, 0.24, 0.12];
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { const y = y0 + (y1 - y0) * i / 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  const dp = ease(prog(lt, 1.5, 1.1)), seg = pts.length - 1, upto = dp * seg;
  const P = i => ({ x: x0 + (x1 - x0) * i / seg, y: y0 + (y1 - y0) * pts[i] });
  const path = () => { ctx.beginPath(); ctx.moveTo(P(0).x, P(0).y); for (let i = 1; i <= Math.floor(upto); i++) ctx.lineTo(P(i).x, P(i).y); const fi = Math.floor(upto), fr = upto - fi; if (fi < seg) { const a = P(fi), b = P(fi + 1); ctx.lineTo(lerp(a.x, b.x, fr), lerp(a.y, b.y, fr)); } };
  const gf = ctx.createLinearGradient(0, y0, 0, y1); gf.addColorStop(0, `rgba(${BLUE},.35)`); gf.addColorStop(1, `rgba(${BLUE},0)`);
  const fi = Math.min(seg, Math.floor(upto)), nx = Math.min(seg, fi + 1);
  path(); ctx.lineTo(lerp(P(fi).x, P(nx).x, upto - Math.floor(upto)), y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fillStyle = gf; ctx.fill();
  ctx.save(); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WHITE; ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 22; path(); ctx.stroke(); ctx.restore();
  ctx.restore();
}

export const SCREENS = [screenTodo, screenGoal, screenPlan, screenFollow];
export function drawScreen(c, idx, lt, alpha = 1) {
  ctx = c; c.save(); c.globalAlpha = alpha; c.letterSpacing = '0px'; SCREENS[idx](Math.max(0, lt)); c.restore();
}

// ---------- carte qui se dresse hors de l'écran (1000 x 600) ----------
export const CARD = { w: 1000, h: 600 };
export function drawCard(c, lt) {
  ctx = c; c.clearRect(0, 0, CARD.w, CARD.h); c.save(); c.letterSpacing = '0px';
  const K = C.card, a = E.outCubic(prog(lt, 0.15, 0.5));
  ctx.shadowColor = `rgba(${BLUE},.65)`; ctx.shadowBlur = 44; rr(30, 30, 940, 540, 72); ctx.fillStyle = 'rgba(9,13,30,.94)'; ctx.fill(); ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, 30, 940, 570); g.addColorStop(0, 'rgba(120,150,255,.28)'); g.addColorStop(0.6, 'rgba(70,90,200,.10)'); g.addColorStop(1, 'rgba(160,190,255,.16)'); ctx.fillStyle = g; rr(30, 30, 940, 540, 72); ctx.fill();
  ctx.strokeStyle = 'rgba(214,224,255,.55)'; ctx.lineWidth = 3; rr(30, 30, 940, 540, 72); ctx.stroke();
  ctx.save(); ctx.globalAlpha *= a;
  // médaille
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(112, 124, 30, 0, 6.283); ctx.fill(); check(112, 125, 30, '#05060c', 6);
  T(K.label, 164, 124, { font: MS(32, 800), ls: 6 });
  T(K.title, 80, 238, { font: PF(66, 700, true) });
  const vw = T(K.value, 76, 400, { font: MS(176, 800), ls: -6 }); T(K.unit, 76 + vw + 26, 430, { font: MS(54, 700), fill: G1 });
  T(K.sub, 80, 520, { font: MS(fit(K.sub, 840, 34, z => MS(z, 600)), 600), fill: G1 });
  // petite courbe ascendante à droite
  const px = 640, py = 360, pw = 260, ph = 120, pts = [0.9, 0.78, 0.82, 0.55, 0.5, 0.3, 0.12], dp = ease(prog(lt, 0.5, 0.9));
  ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WHITE; ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 18; ctx.beginPath();
  const up = dp * (pts.length - 1); for (let i = 0; i <= Math.floor(up); i++) { const x = px + pw * i / (pts.length - 1), y = py + ph * pts[i]; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  const fi = Math.floor(up); if (fi < pts.length - 1) { const x0 = px + pw * fi / (pts.length - 1), y0 = py + ph * pts[fi], x1 = px + pw * (fi + 1) / (pts.length - 1), y1 = py + ph * pts[fi + 1], fr = up - fi; ctx.lineTo(lerp(x0, x1, fr), lerp(y0, y1, fr)); }
  ctx.stroke();
  ctx.restore(); c.restore();
}

// ---------- logo lumineux posé sur la table (2048 x 640) ----------
export const LOGO = { w: 2048, h: 640 };
export function drawLogo(c, p) {
  ctx = c; c.clearRect(0, 0, LOGO.w, LOGO.h); c.save(); c.letterSpacing = '0px';
  const r = p * (LOGO.w + 260) - 130;
  const mask = () => { const g = ctx.createLinearGradient(r - 130, 0, r + 130, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, LOGO.w, LOGO.h); ctx.restore(); };
  const layer = document.createElement('canvas'); layer.width = LOGO.w; layer.height = LOGO.h; const lc = layer.getContext('2d');
  const save = ctx; ctx = lc; ctx.letterSpacing = '0px';
  // plaque sombre douce sous le logo (lisibilité sur le bois clair)
  { const g = ctx.createRadialGradient(LOGO.w / 2, 330, 80, LOGO.w / 2, 330, 1000); g.addColorStop(0, 'rgba(0,0,0,.72)'); g.addColorStop(0.6, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(0, 330); ctx.scale(1, 0.34); ctx.translate(0, -330); ctx.fillStyle = g; ctx.fillRect(0, -400, LOGO.w, 1600); ctx.restore(); }
  // monogramme dans un carré arrondi
  ctx.save(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#a9bbff'; ctx.shadowBlur = 26; rr(80, 144, 352, 352, 86); ctx.fill(); ctx.restore();
  T(C.brand.monogram, 256, 332, { font: PF(270, 800, true), align: 'center', fill: '#0a0d18' });
  // nom en lettres pleines
  const size = fit(C.brand.name, 1420, 200, z => MS(z, 800), 14);
  ctx.save(); ctx.font = MS(size, 800); ctx.letterSpacing = '14px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.shadowColor = '#a9bbff'; ctx.shadowBlur = 22; ctx.fillStyle = '#ffffff'; ctx.fillText(C.brand.name, 504, 330); ctx.shadowBlur = 0; ctx.fillText(C.brand.name, 504, 330); ctx.restore();
  ctx = save; c.drawImage(layer, 0, 0);
  if (p < 1) mask();
  c.restore();
}

// ---------- bouton « Réserve ton appel » posé sur la table (1100 x 300) ----------
export const BTN = { w: 1100, h: 300 };
export function drawButton(c) {
  ctx = c; c.clearRect(0, 0, BTN.w, BTN.h); c.save(); c.letterSpacing = '0px';
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; rr(50, 50, 1000, 190, 95);
  const g = ctx.createLinearGradient(0, 50, 0, 240); g.addColorStop(0, '#fbfcff'); g.addColorStop(1, '#cfd6ec'); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; rr(52, 52, 996, 186, 93); ctx.stroke();
  const label = C.end.button, fs = fit(label, 700, 82, z => MS(z, 800)), tw = measure(label, MS(fs, 800));
  T(label, 500 - 36, 147, { font: MS(fs, 800), align: 'center', fill: '#0a0d18' });
  const ax = 500 - 36 + tw / 2 + 70; ctx.strokeStyle = '#0a0d18'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(ax - 44, 147); ctx.lineTo(ax + 34, 147); ctx.moveTo(ax + 6, 112); ctx.lineTo(ax + 38, 147); ctx.lineTo(ax + 6, 182); ctx.stroke();
  c.restore();
}

// ---------- texte animé en haut de l'écran (calque final, dessiné par-dessus la 3D) ----------
// Mot par mot : arrivée avec rebond + flou qui devient net, légère dérive pendant que la phrase est affichée, sortie vers le haut.
const IS_EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u23F0-\u23FF]/u;
export function drawCaptions(c, t, s) {
  ctx = c;
  for (const cp of C.captions) {
    if (t < cp.t0 || t > cp.t1 + 0.1) continue;
    c.save(); c.textAlign = 'left'; c.textBaseline = 'middle';
    const lines = cp.lines.map(l => l.split(' '));
    const setFont = fs => { c.font = MS(fs, 800); c.letterSpacing = (-2 * s * fs / (118 * s)) + 'px'; };
    const lineW = (toks, fs) => { setFont(fs); return toks.reduce((w, tk, i) => w + c.measureText(tk).width + (i ? fs * 0.26 : 0), 0); };
    let size = 120 * s; while (size > 40 * s && Math.max(...lines.map(l => lineW(l, size))) > 930 * s) size -= 2 * s;
    const lh = size * 1.1, top = 150 * s; let k = 0;
    lines.forEach((toks, li) => {
      const w = lineW(toks, size), y = top + lh * (li + 0.5); let x = (c.canvas.width - w) / 2; setFont(size);
      const accent = (cp.accent || []).includes(li);
      toks.forEach(tk => {
        const tw = c.measureText(tk).width, st = cp.t0 + 0.11 * k, p = prog(t, st, 0.5), q = prog(t, cp.t1 - 0.42 + 0.06 * k, 0.34), emo = IS_EMOJI.test(tk);
        const e = E.outBack(p), ec = E.outCubic(p), alpha = clamp(p * 2.6) * (1 - E.inCubic(q));
        if (alpha > 0.004) {
          const dy = (1 - ec) * 44 * s - q * 56 * s + (emo ? -Math.abs(Math.sin(t * 3.4 + k)) * 9 * s * (cp.t1 > 50 ? 1 : 0) : Math.sin(t * 1.6 + k * 0.8) * 3 * s);
          const sc = (1.5 - 0.5 * e) * (1 + 0.1 * q) * (1 + 0.012 * Math.max(0, t - st)), blur = (1 - ec) * 16 * s + q * 12 * s;
          let rot = 0; if (emo) { const lt = Math.max(0, t - st); rot = Math.sin(lt * 21) * 0.28 * Math.exp(-lt * 2.2) * (1 - q); }
          c.save(); c.globalAlpha = alpha; c.translate(x + tw / 2, y + dy); c.rotate(rot); c.scale(sc, sc); if (blur > 0.4) c.filter = `blur(${blur}px)`;
          c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 26 * s; c.shadowOffsetY = 7 * s;
          if (accent && !emo) { const g = c.createLinearGradient(-tw / 2, 0, tw / 2, 0), ph = (t * 0.55) % 1.4 - 0.2; g.addColorStop(0, '#9db4ff'); g.addColorStop(clamp(ph), '#ffffff'); g.addColorStop(1, '#9db4ff'); c.fillStyle = g; c.shadowColor = 'rgba(120,150,255,.65)'; c.shadowBlur = 34 * s; c.shadowOffsetY = 0; } else c.fillStyle = '#ffffff';
          c.fillText(tk, -tw / 2, 0); c.restore();
        }
        x += tw + size * 0.26; k++;
      });
    });
    c.restore();
  }
}
// petit texte légal en bas d'écran (comme la légende sous la vidéo de référence)
export function drawLegal(c, t, s, t0 = 16.6) {
  const p = E.outCubic(prog(t, t0, 0.8)), q = 1 - E.inCubic(prog(t, 20.2, 0.7)); if (p <= 0 || q <= 0) return; ctx = c;
  c.save(); c.letterSpacing = '0px'; c.globalAlpha = p * q * 0.88; c.font = MS(25 * s, 600); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 10 * s;
  const words = C.end.legal.split(' '), lines = []; let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > 880 * s && line) { lines.push(line); line = w; } else line = test; } lines.push(line);
  lines.forEach((l, i) => c.fillText(l, c.canvas.width / 2, (1760 + i * 36) * s)); c.restore();
}
