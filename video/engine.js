// Moteur d'animation v2 : renderFrame(t) dessine l'image à l'instant t (secondes), de façon déterministe.
// Flou de mouvement réel : chaque image = moyenne de 3 sous-images.
(() => {
  'use strict';
  const C = window.CONTENT;
  const W = 1080, H = 1920, FPS = C.fps, BEAT = 60 / C.bpm;
  const cv = document.getElementById('c');
  const mainCtx = cv.getContext('2d');
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const layerCtx = layer.getContext('2d');
  let ctx = mainCtx;

  // ---------- palette & utilitaires ----------
  const P = { bg: '#04010a', violet: '#7c3aed', violet2: '#a855f7', lilac: '#d8b4fe', pale: '#f3e8ff', magenta: '#d946ef', gold: '#f3d98b', gold2: '#c79a3b', ink: '#12061f' };
  const GOLD = [[0, P.gold2], [0.4, '#fff3c4'], [0.65, P.gold], [1, P.gold2]];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, s, d) => clamp((t - s) / d);
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3), inCubic: x => x * x * x, inQuad: x => x * x,
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outBack2: x => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  };
  const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const beatPulse = t => Math.exp(-((t % BEAT) / BEAT) * 4.5);
  const PF = (s, w = 900, it = true) => `${it ? 'italic ' : ''}${w} ${s}px PF, Georgia, serif`;
  const MS = (s, w = 600) => `${w} ${s}px MS, Arial, sans-serif`;
  const glow = (color, blur, fn) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); };
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const around = (x, y, sx, sy, rot, fn) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-x, -y); fn(); ctx.restore(); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // Texte : crénage, dégradé, lueur, contour. Retourne la largeur.
  function T(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    const ls = o.ls || 0; ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(str).width;
    const cx = o.align === 'left' || o.align === 'right' ? x : x + ls / 2;
    const left = o.align === 'left' ? x : o.align === 'right' ? x - w : cx - w / 2;
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.grad) {
      const g = ctx.createLinearGradient(left, y - (o.size || 100) * 0.5, left + w, y + (o.size || 100) * 0.5);
      o.grad.forEach(([p, c]) => g.addColorStop(p, c)); ctx.fillStyle = g;
    } else ctx.fillStyle = o.fill || '#fff';
    if (o.strokeOnly) { ctx.strokeStyle = o.fill || '#fff'; ctx.lineWidth = o.lw || 2; ctx.strokeText(str, cx, y); ctx.restore(); return w; }
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 30; }
    ctx.fillText(str, cx, y);
    if (o.glow2) { ctx.shadowBlur = (o.glowBlur ?? 30) * 2; ctx.fillText(str, cx, y); }
    ctx.restore(); return w;
  }
  function fit(str, maxW, size, fontFn, ls = 0) {
    ctx.save(); ctx.letterSpacing = ls + 'px'; let s = size;
    for (; s > 20; s -= 2) { ctx.font = fontFn(s); if (ctx.measureText(str).width <= maxW) break; }
    ctx.restore(); return s;
  }
  function wrapText(str, maxW, font) {
    ctx.save(); ctx.font = font; const words = str.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); ctx.restore(); return lines;
  }
  // texte avec séparation chromatique (RGB split) pendant les impacts
  function TC(str, x, y, o, amt) {
    if (amt > 1.5) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      T(str, x - amt, y, { ...o, grad: null, glow: null, glow2: false, fill: 'rgba(255,40,214,.85)' });
      T(str, x + amt, y, { ...o, grad: null, glow: null, glow2: false, fill: 'rgba(50,110,255,.85)' });
      ctx.restore();
    }
    return T(str, x, y, o);
  }
  function shock(cx, cy, age, maxR = 900, color = '216,180,254', w = 7, life = 0.7) {
    if (age < 0 || age > life) return; const p = age / life;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${color},${(1 - p) * 0.85})`; ctx.lineWidth = w * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, E.outCubic(p) * maxR, 0, 6.283); ctx.stroke(); ctx.restore();
  }
  function burst(cx, cy, age, n, seed, maxD, color = '243,217,139', life = 1.0) {
    if (age < 0 || age > life) return; const rnd = mulberry32(seed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, v = 0.3 + rnd() * 0.7, r = 1.5 + rnd() * 3.5, p = age / life, d = maxD * v * E.outCubic(p), al = 1 - p;
      ctx.fillStyle = `rgba(${color},${al * 0.95})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + 60 * p * p, r * al + 0.5, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  function checkIcon(x, y, r, a = 1) {
    ctx.save(); ctx.globalAlpha *= a;
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, P.violet2); g.addColorStop(1, P.magenta);
    glow(P.violet2, 22, () => { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.34); ctx.lineTo(x + r * 0.45, y - r * 0.28); ctx.stroke(); ctx.restore();
  }

  // ---------- chronologie ----------
  const scenes = [], events = []; let cur = 0;
  const addScene = (name, dur, draw, opt = {}) => {
    const s = { name, t0: cur, t1: cur + dur, draw, soft: !!opt.soft, idx: scenes.length, energy: opt.energy ?? 1 };
    scenes.push(s); (opt.events || []).forEach(([lt, type]) => events.push({ t: cur + lt, type })); cur += dur;
  };
  addScene('hook', 4, drawHook, { energy: 1.4, events: [[0, 'slam'], [1, 'slam'], [2, 'slam']] });
  addScene('brand', 4, drawBrand, { events: [[0.05, 'whoosh'], [0.35, 'slam'], [1.0, 'tick'], [1.2, 'tick'], [1.4, 'tick'], [2.7, 'ding']] });
  addScene('methods', 4, drawMethods, { energy: 1.1, events: [0, 2].flatMap(h => [[h, 'whoosh'], ...[0.35, 0.75, 1.15, 1.55].map(x => [h + x, 'tick'])]) });
  addScene('phones', 4, drawPhones, { events: [[0.05, 'whoosh'], [0.8, 'slam']] });
  C.formulas.forEach((f, i) => addScene('formula' + (i + 1), f.dur, (lt, d) => drawFormula(i, lt, d), {
    energy: 1.2,
    events: [[0.1, 'slam'], ...f.times.map(t => [t, 'ding']), ...f.bullets.map((_, k) => [1.5 + k * 0.3, 'tick'])],
  }));
  addScene('cta', 5, drawCta, { energy: 1.3, events: [[0.15, 'slam'], [0.55, 'slam'], [1.0, 'ding'], [1.6, 'tick'], [1.75, 'tick'], [1.9, 'tick']] });
  const TOTAL = cur;
  const cuts = scenes.slice(1).map(s => s.t0);
  window.TIMELINE = { total: TOTAL, fps: FPS, bpm: C.bpm, scenes: scenes.map(s => ({ name: s.name, t0: s.t0, t1: s.t1 })), events };

  // ---------- tunnel de vitesse 3D ----------
  const impulses = [...cuts.map(t => ({ t, A: 2.6 })), ...events.filter(e => e.type === 'slam' || e.type === 'whoosh').map(e => ({ t: e.t, A: e.type === 'slam' ? 1.3 : 1.8 }))];
  const warpD = t => { let d = 0.10 * t; for (const i of impulses) if (t > i.t) d += i.A * 0.45 * (1 - Math.exp(-(t - i.t) / 0.45)); return d; };
  const warpV = t => { let v = 0.10; for (const i of impulses) if (t > i.t) v += i.A * Math.exp(-(t - i.t) / 0.45); return v; };
  const rs = mulberry32(21);
  const stars = Array.from({ length: 230 }, () => ({ x: rs() * 2 - 1, y: rs() * 2 - 1, z0: rs(), sp: 0.6 + rs() * 0.8, h: rs() }));
  function drawStars(t) {
    const D = warpD(t), V = warpV(t);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const s of stars) {
      const z = (((s.z0 - D * s.sp) % 1) + 1) % 1; if (z < 0.03) continue;
      const zp = Math.min(1.4, z + V * 0.016 * s.sp);
      const k = 340, x1 = W / 2 + (s.x * k) / z, y1 = H / 2 + (s.y * k * 1.7) / z, x0 = W / 2 + (s.x * k) / zp, y0 = H / 2 + (s.y * k * 1.7) / zp;
      if ((x1 < -50 && x0 < -50) || (x1 > W + 50 && x0 > W + 50) || (y1 < -50 && y0 < -50) || (y1 > H + 50 && y0 > H + 50)) continue;
      const a = Math.pow(1 - z, 1.3), col = s.h < 0.18 ? '255,228,160' : s.h < 0.5 ? '232,150,255' : '214,186,255';
      ctx.strokeStyle = `rgba(${col},${a * 0.9})`; ctx.lineWidth = 0.8 + (1 - z) * 2.8;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  }

  const blobs = [
    { c: '124,58,237', r: 780, ox: 0.2, oy: 0.25, sx: 0.07, sy: 0.09, ph: 0, a: 0.36 },
    { c: '217,70,239', r: 640, ox: 0.82, oy: 0.55, sx: 0.06, sy: 0.1, ph: 2, a: 0.2 },
    { c: '79,70,229', r: 860, ox: 0.5, oy: 0.88, sx: 0.08, sy: 0.05, ph: 4, a: 0.3 },
    { c: '168,85,247', r: 520, ox: 0.72, oy: 0.1, sx: 0.1, sy: 0.07, ph: 1, a: 0.2 },
  ];
  function drawBackground(t, energy) {
    const pulse = beatPulse(t);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const cx = W * (b.ox + 0.2 * Math.sin(t * b.sx * 6.28 + b.ph)), cy = H * (b.oy + 0.12 * Math.cos(t * b.sy * 6.28 + b.ph * 1.7));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r), a = b.a * (0.8 + 0.4 * pulse * energy);
      g.addColorStop(0, `rgba(${b.c},${a})`); g.addColorStop(1, `rgba(${b.c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.42);
    for (let i = 0; i < 3; i++) {
      const x = ((t * (40 + i * 18) + i * 520) % 2400) - 1200, g = ctx.createLinearGradient(x - 170, 0, x + 170, 0);
      g.addColorStop(0, 'rgba(168,85,247,0)'); g.addColorStop(0.5, `rgba(196,150,255,${0.06 + 0.04 * pulse})`); g.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 170, -1700, 340, 3400);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    drawStars(t);
  }

  // ---------- grain & finition (sur l'image finale) ----------
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const g = grain.getContext('2d'), im = g.createImageData(256, 256), r = mulberry32(99);
    for (let i = 0; i < 65536; i++) { const v = (r() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); }
  function drawFinish(t) {
    const m = mainCtx; m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.globalCompositeOperation = 'source-over';
    const v = m.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    m.fillStyle = v; m.fillRect(0, 0, W, H);
    const f = Math.round(t * FPS); m.save(); m.globalAlpha = 0.05; m.globalCompositeOperation = 'overlay';
    m.fillStyle = m.createPattern(grain, 'repeat'); m.translate(-Math.floor(hash(f) * 256), -Math.floor(hash(f + 91) * 256)); m.fillRect(0, 0, W + 256, H + 256); m.restore();
    ctx = m;
    if (C.draft) T('APERÇU DU STYLE · TEXTES PROVISOIRES', W / 2, 78, { font: MS(20, 600), ls: 5, fill: 'rgba(243,232,255,.55)' });
    const fo = prog(t, TOTAL - 0.7, 0.7); if (fo > 0) { m.fillStyle = `rgba(4,1,10,${E.inCubic(fo)})`; m.fillRect(0, 0, W, H); }
    const fi = 1 - prog(t, 0, 0.1); if (fi > 0) { m.fillStyle = `rgba(4,1,10,${fi})`; m.fillRect(0, 0, W, H); }
  }

  // ====================== SCÈNES ======================

  // ---- ACCROCHE : 3 phrases en frappe ----
  function drawHook(lt) {
    const ph = C.hook, starts = [0, 1.0, 2.0];
    let i = 0; starts.forEach((s, k) => { if (lt >= s) i = k; });
    const pl = lt - starts[i], p = ph[i], cx = W / 2, cy = H * 0.45, bp = beatPulse(lt);
    shock(cx, cy, pl, 1100); shock(cx, cy, pl - 0.12, 800, '243,217,139', 4);
    const last = i === ph.length - 1, zoomOut = last ? E.inCubic(prog(lt, 3.55, 0.45)) * 3.2 : 0;
    ctx.save(); if (zoomOut > 0) { ctx.translate(cx, cy); ctx.scale(1 + zoomOut, 1 + zoomOut); ctx.translate(-cx, -cy); }
    const isB2B = p.big.length <= 4;
    const size = fit(p.big, 960, isB2B ? 470 : 330, z => PF(z, 900, last ? true : false), last ? 3 : 4);
    const bigFont = PF(size, 900, last);
    // mot géant en filigrane (contour) qui glisse derrière
    T(p.big, cx + (pl - 0.5) * 60, cy, { font: PF(size * 1.7, 900, last), size, fill: 'rgba(216,180,254,.10)', strokeOnly: true, lw: 3, ls: 3, alpha: clamp(pl * 6) });
    // petit mot doré qui tombe d'en haut
    const sp = E.outBack(prog(pl, 0.08, 0.3));
    T(p.small, cx, cy - size * 0.78 - 40 + (1 - sp) * -220, { font: MS(54, 800), ls: 28, fill: P.gold, glow: 'rgba(243,217,139,.7)', glowBlur: 24, alpha: clamp(pl * 8) });
    if (i === 0) { // frappe d'échelle
      const e = E.outExpo(prog(pl, 0, 0.32)), sc = 1 + (1 - e) * 2.4;
      around(cx, cy, sc, sc, (1 - e) * -0.05, () => TC(p.big, cx, cy, { font: bigFont, size, ls: 4, fill: '#fff', glow: 'rgba(168,85,247,.8)', glowBlur: 40 + 30 * bp, alpha: clamp(pl * 10) }, (1 - e) * 50 + (pl < 0.16 ? 8 : 0)));
    } else if (i === 1) { // lettres qui convergent de trois directions
      ctx.save(); ctx.font = bigFont; ctx.letterSpacing = '4px';
      const ws = [...p.big].map(ch => ctx.measureText(ch).width + 4), tw = ws.reduce((a, b) => a + b, 0); ctx.restore();
      let x = cx - tw / 2;
      [...p.big].forEach((ch, k) => {
        const e = E.outBack2(prog(pl, k * 0.06, 0.34)), dir = [[-1, 0], [0, -1], [1, 0]][k % 3];
        const ox = dir[0] * (1 - e) * 900, oy = dir[1] * (1 - e) * 1300;
        TC(ch, x + ws[k] / 2 + ox, cy + oy, { font: bigFont, size, ls: 0, fill: '#fff', glow: 'rgba(168,85,247,.85)', glowBlur: 45 + 30 * bp, alpha: clamp(pl * 12 - k * 0.3) }, (1 - e) * 60);
        x += ws[k];
      });
    } else { // lettres en cascade
      ctx.save(); ctx.font = bigFont; ctx.letterSpacing = '3px';
      const chars = [...p.big], ws = chars.map(ch => ctx.measureText(ch).width + 3), tw = ws.reduce((a, b) => a + b, 0); ctx.restore();
      let x = cx - tw / 2;
      chars.forEach((ch, k) => {
        const e = E.outBack2(prog(pl, 0.05 + k * 0.045, 0.4)), oy = (1 - e) * -700;
        TC(ch, x + ws[k] / 2, cy + oy + Math.sin(lt * 3 + k * 0.6) * 4 * e, { font: bigFont, size, ls: 0, grad: [[0, '#fff'], [0.45, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 50 + 30 * bp, glow2: true, alpha: clamp((pl - k * 0.045) * 14) }, (1 - e) * 45);
        x += ws[k];
      });
      const lp = E.outExpo(prog(pl, 0.7, 0.6)), lw = 800 * lp, g = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
      g.addColorStop(0, 'rgba(243,217,139,0)'); g.addColorStop(0.5, P.gold); g.addColorStop(1, 'rgba(243,217,139,0)');
      ctx.fillStyle = g; glow(P.gold, 18, () => ctx.fillRect(cx - lw / 2, cy + size * 0.55, lw, 5));
      burst(cx, cy, pl - 0.3, 40, 5, 600, '216,180,254', 1.3);
    }
    ctx.restore();
    if (last) { const f = prog(lt, 3.85, 0.15); if (f > 0) { ctx.fillStyle = `rgba(243,232,255,${f})`; ctx.fillRect(0, 0, W, H); } }
  }

  // ---- MARQUE : gyroscope, monogramme, nom ----
  function drawBrand(lt) {
    const cx = W / 2, cy = 690, B = C.brand, bp = beatPulse(lt);
    shock(cx, cy, lt - 0.3, 1000); shock(cx, cy, lt - 0.45, 700, '243,217,139', 4); shock(cx, cy, lt - 0.6, 500, '232,150,255', 3);
    // rayons
    const ra = E.outCubic(prog(lt, 0.2, 1.0));
    ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(lt * 0.2);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI * 2 / 18); const len = i % 2 ? 780 : 1050, g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(168,85,247,${0.24 * ra})`); g.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -38); ctx.lineTo(len, 38); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // gyroscope : anneaux qui tournent en 3D
    const ringsDef = [{ r: 200, w: 7, sp: 0.9, tilt: 1.2, ph: 0 }, { r: 250, w: 4, sp: -0.7, tilt: 1.6, ph: 1.3 }, { r: 300, w: 3, sp: 0.5, tilt: 2.1, ph: 2.4 }];
    ringsDef.forEach((g, i) => {
      const pr = E.outCubic(prog(lt, 0.25 + i * 0.12, 0.7)); if (pr <= 0) return;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(lt * g.sp + g.ph); ctx.scale(1, 0.12 + 0.88 * Math.abs(Math.cos(lt * g.tilt + g.ph)));
      const gr = ctx.createLinearGradient(-g.r, 0, g.r, 0); gr.addColorStop(0, P.pale); gr.addColorStop(0.5, P.violet2); gr.addColorStop(1, P.magenta);
      ctx.strokeStyle = gr; ctx.lineWidth = g.w; ctx.shadowColor = P.violet2; ctx.shadowBlur = 30; ctx.globalAlpha *= pr;
      ctx.beginPath(); ctx.arc(0, 0, g.r * (0.6 + 0.4 * pr), 0, 6.283); ctx.stroke(); ctx.restore();
    });
    // graduations dorées
    const dp = E.outCubic(prog(lt, 0.5, 0.8)); ctx.save(); ctx.translate(cx, cy); ctx.rotate(-lt * 0.15); ctx.globalAlpha *= dp;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * 6.283, l = i % 6 === 0 ? 28 : 12; ctx.strokeStyle = `rgba(243,217,139,${i % 6 === 0 ? 0.95 : 0.45})`; ctx.lineWidth = i % 6 === 0 ? 3.5 : 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 350, Math.sin(a) * 350); ctx.lineTo(Math.cos(a) * (350 + l), Math.sin(a) * (350 + l)); ctx.stroke(); }
    ctx.restore();
    // monogramme
    const mp = E.outBack2(prog(lt, 0.3, 0.55));
    if (mp > 0) around(cx, cy + 8, mp * (1 + 0.04 * bp), mp * (1 + 0.04 * bp), (1 - mp) * 0.5, () => TC(B.monogram, cx, cy + 8, { font: PF(300, 900, true), size: 300, grad: [[0, '#fff'], [0.5, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 55, glow2: true }, (1 - mp) * 40));
    burst(cx, cy, lt - 0.3, 70, 11, 620, '216,180,254', 1.5);
    // nom : lettres qui claquent depuis le haut / le bas
    const NLS = 16, ns = fit(B.name, 930, 150, z => MS(z, 800), NLS), nm = B.name;
    ctx.save(); ctx.font = MS(ns, 800); ctx.letterSpacing = NLS + 'px'; const tw = ctx.measureText(nm).width - NLS; ctx.restore();
    const x0 = cx - tw / 2;
    for (let i = 0; i < nm.length; i++) {
      ctx.save(); ctx.font = MS(ns, 800); ctx.letterSpacing = NLS + 'px'; const pre = ctx.measureText(nm.slice(0, i)).width; ctx.restore();
      const e = E.outBack2(prog(lt, 0.95 + i * 0.045, 0.35)), oy = (i % 2 ? 1 : -1) * (1 - e) * 500;
      if (e > 0) TC(nm[i], x0 + pre, 1130 + oy, { font: MS(ns, 800), align: 'left', size: ns, grad: [[0, '#fff'], [1, P.lilac]], glow: 'rgba(168,85,247,.8)', glowBlur: 32, alpha: clamp(e * 3) }, (1 - e) * 35);
    }
    const sp = E.outCubic(prog(lt, 1.6, 0.6)), ss = fit(B.sub, 930, 44, z => MS(z, 600), 12);
    if (sp > 0) T(B.sub, cx, 1240, { font: MS(ss, 600), ls: 12 + 10 * (1 - sp), alpha: sp, fill: P.pale, glow: 'rgba(168,85,247,.6)', glowBlur: 20 });
    const lw = 420 * E.outExpo(prog(lt, 1.9, 0.6)), gl = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
    gl.addColorStop(0, 'rgba(243,217,139,0)'); gl.addColorStop(0.5, P.gold); gl.addColorStop(1, 'rgba(243,217,139,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - lw / 2, 1296, lw, 3);
    const tp = E.outCubic(prog(lt, 2.1, 0.5)); if (tp > 0) T(B.tagline, cx, 1352, { font: MS(fit(B.tagline, 900, 30, z => MS(z, 500), 14), 500), ls: 14, alpha: tp, fill: P.gold });
    // pastille du site
    const up = E.outBack2(prog(lt, 2.7, 0.4));
    if (up > 0) around(cx, 1500, up, up, 0, () => {
      const uw = 640, g = ctx.createLinearGradient(cx - uw / 2, 0, cx + uw / 2, 0); g.addColorStop(0, P.violet); g.addColorStop(1, P.magenta);
      glow(P.violet2, 40 + 25 * bp, () => { ctx.fillStyle = g; rr(cx - uw / 2, 1450, uw, 100, 50); ctx.fill(); });
      T(B.url, cx, 1501, { font: MS(fit(B.url, uw - 80, 48, z => MS(z, 800), 3), 800), ls: 3, fill: '#fff' });
    });
    shock(cx, 1500, lt - 2.7, 500, '232,150,255', 4, 0.6);
  }

  // ---- MÉTHODES : une étape par temps fort ----
  function drawMethods(lt) {
    const half = lt < 2 ? 0 : 1, hl = lt - half * 2, m = C.methods[half], cx = W / 2, bp = beatPulse(lt);
    shock(cx, 380, hl, 900);
    T(m.kicker, cx, 215, { font: MS(32, 600), ls: 18, fill: P.gold, alpha: E.outCubic(prog(hl, 0, 0.25)) });
    const tp = E.outExpo(prog(hl, 0, 0.3)), tsz = fit(m.title, 920, 190, z => PF(z, 900, true));
    around(cx, 370, 1 + (1 - tp) * 1.6, 1 + (1 - tp) * 1.6, 0, () => TC(m.title, cx, 370, { font: PF(tsz, 900, true), size: tsz, grad: [[0, '#fff'], [1, P.lilac]], glow: P.violet2, glowBlur: 50 + 20 * bp, glow2: true, alpha: clamp(hl * 10) }, (1 - tp) * 55));
    // ligne verticale lumineuse
    const lineP = prog(hl, 0.3, 1.5), x0 = 140, y0 = 690, step = 230;
    const lg = ctx.createLinearGradient(0, y0, 0, y0 + step * 3); lg.addColorStop(0, 'rgba(232,150,255,.95)'); lg.addColorStop(1, 'rgba(124,58,237,.35)');
    glow(P.violet2, 14, () => { ctx.fillStyle = lg; ctx.fillRect(x0 - 2, y0, 4, step * 3 * lineP); });
    m.steps.forEach((s, i) => {
      const st = 0.35 + i * 0.4, p = prog(hl, st, 0.28), e = E.outExpo(p), y = y0 + i * step;
      if (p <= 0) return;
      shock(x0, y, hl - st, 220, '243,217,139', 3, 0.5);
      const dir = i % 2 ? 1 : -1, dx = dir * (1 - e) * 760, cur = hl >= st && hl < st + 0.4;
      ctx.save(); ctx.translate(x0, y); ctx.scale(0.4 + 0.6 * E.outBack2(p), 0.4 + 0.6 * E.outBack2(p));
      glow(P.violet2, 30 + 20 * (cur ? bp : 0), () => { ctx.fillStyle = 'rgba(22,8,44,.95)'; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 6.283); ctx.fill(); });
      const rg = ctx.createLinearGradient(-52, -52, 52, 52); rg.addColorStop(0, P.pale); rg.addColorStop(0.5, P.violet2); rg.addColorStop(1, P.magenta);
      ctx.strokeStyle = rg; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 6.283); ctx.stroke(); ctx.restore();
      T(String(i + 1).padStart(2, '0'), x0, y + 1, { font: MS(34, 800), alpha: clamp(p * 3) });
      const sz = fit(s, 780, 108, z => PF(z, 900, true));
      TC(s, 235 + dx, y - 4, { font: PF(sz, 900, true), size: sz, align: 'left', fill: '#fff', glow: cur ? 'rgba(243,217,139,.8)' : 'rgba(168,85,247,.55)', glowBlur: cur ? 36 : 22, alpha: clamp(p * 4) * (cur ? 1 : 0.88) }, (1 - e) * 45);
    });
    // coupure entre les deux méthodes
    if (half === 1 && hl < 0.2) { ctx.fillStyle = `rgba(243,232,255,${(1 - hl / 0.2) * 0.8})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---- TÉLÉPHONES 3D avec les vraies captures du site ----
  const imgs = {};
  const SW = 480, SH = 858, BZ = 14;
  function rrPoints(w, h, r, n = 9) {
    const pts = [], hw = w / 2, hh = h / 2, c = [[hw - r, -hh + r, -90], [hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180]];
    c.forEach(([ccx, ccy, a0]) => { for (let k = 0; k <= n; k++) { const a = ((a0 + (k / n) * 90) * Math.PI) / 180; pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]); } });
    return pts;
  }
  function drawPhone(img, label, o) {
    const { cx, cy, sc, th, roll, scroll = 0, t } = o, D = 1500, c = Math.cos(th), s = Math.sin(th);
    const proj = (u, v) => { const z = u * s * sc, f = D / (D + z); return [cx + u * c * sc * f, cy + v * sc * f, f]; };
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll); ctx.translate(-cx, -cy);
    // halo
    const hg = ctx.createRadialGradient(cx, cy, 50, cx, cy, 650 * sc); hg.addColorStop(0, 'rgba(168,85,247,.42)'); hg.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg; ctx.fillRect(cx - 700, cy - 800, 1400, 1600); ctx.globalCompositeOperation = 'source-over';
    // châssis
    const body = rrPoints(SW + BZ * 2, SH + BZ * 2, 66).map(([u, v]) => proj(u, v));
    ctx.beginPath(); body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const bg = ctx.createLinearGradient(cx - 260 * sc, cy - 440 * sc, cx + 260 * sc, cy + 440 * sc); bg.addColorStop(0, '#2a1850'); bg.addColorStop(0.5, '#0b0518'); bg.addColorStop(1, '#2a1850');
    glow('rgba(168,85,247,.8)', 45, () => { ctx.fillStyle = bg; ctx.fill(); }); ctx.strokeStyle = 'rgba(216,180,254,.75)'; ctx.lineWidth = 3; ctx.stroke();
    // écran
    const scr = rrPoints(SW, SH, 54).map(([u, v]) => proj(u, v));
    ctx.save(); ctx.beginPath(); scr.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#0a0a0d'; ctx.fillRect(cx - 400, cy - 600, 800, 1200);
    if (img) {
      const n = 100, PAD = 74, winH = (img.width * (SH - PAD)) / SW, sy = clamp(scroll, 0, Math.max(0, img.height - winH)), srcH = Math.min(winH, img.height - sy), dFrac = srcH / winH;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      for (let j = 0; j < n; j++) {
        const u0 = -SW / 2 + (j * SW) / n, u1 = u0 + SW / n, p0 = proj(u0, 0), p1 = proj(u1, 0), fm = (p0[2] + p1[2]) / 2, top = cy + (-SH / 2 + PAD) * sc * fm, dh = (SH - PAD) * sc * fm;
        ctx.drawImage(img, (j * img.width) / n, sy, img.width / n + 0.5, srcH, p0[0], top, p1[0] - p0[0] + 0.8, dh * dFrac);
      }
    }
    // reflet qui balaie l'écran
    const sw = ((t * 0.55) % 1.6) - 0.3, rg = ctx.createLinearGradient(cx - 300 + sw * 700, cy - 500, cx - 100 + sw * 700, cy + 500);
    rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(cx - 400, cy - 600, 800, 1200); ctx.restore();
    // îlot dynamique
    const isl = rrPoints(130, 38, 19).map(([u, v]) => proj(u, v - SH / 2 + 38));
    ctx.beginPath(); isl.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
    T(label, cx, cy + (SH / 2 + 90) * sc, { font: MS(36, 800), ls: 18, fill: P.pale, glow: 'rgba(168,85,247,.8)', glowBlur: 24, alpha: clamp((t - o.t0) * 2) });
  }
  function drawPhones(lt) {
    const cx = W / 2, bp = beatPulse(lt), P0 = C.phones;
    T(C.phonesKicker, cx, 215, { font: MS(36, 800), ls: 14, fill: P.gold, glow: 'rgba(243,217,139,.6)', glowBlur: 20, alpha: E.outCubic(prog(lt, 0.2, 0.4)) });
    shock(cx, 960, lt - 0.7, 1100);
    P0.forEach((ph, i) => {
      const e = E.outExpo(prog(lt, 0.0 + i * 0.12, 0.85)), side = i === 0 ? -1 : 1;
      const th = side * -0.0 + (i === 0 ? 1 : -1) * (0.36 + (1 - e) * 1.2), bob = Math.sin(lt * 2.2 + i * 1.7) * 14;
      drawPhone(imgs[ph.img], ph.label, {
        cx: side < 0 ? 272 : 808, cy: 1000 + (1 - e) * 1100 + bob, sc: 1.12 + 0.02 * bp + (i === 1 ? 0.03 : 0),
        th, roll: side * (1 - e) * 0.25 + Math.sin(lt * 1.3 + i) * 0.015, t: lt, t0: 0.9,
        scroll: i === 1 ? 2200 * E.inOut(prog(lt, 1.1, 2.4)) : 0,
      });
    });
  }

  // ---- compteur à rouleaux (odomètre) ----
  function odometer(prev, cur, tp, cx, cy, size) {
    const nd = String(cur).length; ctx.save(); ctx.font = MS(size, 800); const cw = ctx.measureText('0').width * 1.04; ctx.restore();
    const gapW = size * 0.15, groups = Math.floor((nd - 1) / 3), totalW = nd * cw + groups * gapW, xr = cx + totalW / 2, lh = size * 1.06;
    for (let k = 0; k < nd; k++) {
      const xc = xr - k * cw - Math.floor(k / 3) * gapW - cw / 2, pk = Math.pow(10, k);
      const d0 = Math.floor(prev / pk) % 10, d1 = Math.floor(cur / pk) % 10, had = prev >= pk || k === 0;
      const turns = k === 0 ? 3 : k === 1 ? 2 : 1;
      const delta = prev === cur ? 0 : ((d1 - d0 + 10) % 10) + 10 * turns * (had ? 1 : 0.5);
      const fin = 1 - 0.38 * (k / Math.max(nd - 1, 1)), ek = E.outCubic(clamp(tp / fin)), Pp = d0 + delta * ek, base = Math.floor(Pp), frac = Pp - base, a = had ? 1 : ek;
      ctx.save(); ctx.beginPath(); ctx.rect(xc - cw / 2 - 3, cy - lh * 0.5, cw + 6, lh); ctx.clip();
      for (let d = -1; d <= 2; d++) {
        const g = (((base + d) % 10) + 10) % 10, y = cy + (d - frac) * lh, al = clamp(1 - Math.abs(y - cy) / (lh * 0.62));
        if (al > 0.02) T(String(g), xc, y, { font: MS(size, 800), size, grad: GOLD, alpha: a * al });
      }
      ctx.restore();
    }
    return { left: cx - totalW / 2, right: cx + totalW / 2 };
  }

  // ---- FORMULES ----
  function drawFormula(idx, lt, dur) {
    const f = C.formulas[idx], pr = f.prices, cx = W / 2, bp = beatPulse(lt), y0 = f.badge ? 55 : 0;
    // mot géant en filigrane
    T(f.name.toUpperCase(), cx - 120 + lt * 25, 960, { font: PF(520, 900, true), size: 400, fill: f.featured ? 'rgba(243,217,139,.10)' : 'rgba(216,180,254,.08)', strokeOnly: true, lw: 3 });
    shock(cx, 420 + y0, lt - 0.1, 1000, f.featured ? '243,217,139' : '216,180,254');
    T(f.tag, cx, 215, { font: MS(30, 800), ls: 20, fill: P.gold, glow: 'rgba(243,217,139,.6)', glowBlur: 16, alpha: E.outCubic(prog(lt, 0, 0.25)) });
    if (f.badge) {
      const bpv = E.outBack2(prog(lt, 0.12, 0.35));
      around(cx, 300, bpv * (1 + 0.03 * bp), bpv * (1 + 0.03 * bp), 0, () => {
        const bw = 600, g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0); g.addColorStop(0, P.gold2); g.addColorStop(0.5, '#fff1bf'); g.addColorStop(1, P.gold2);
        glow('rgba(243,217,139,.8)', 34, () => { ctx.fillStyle = g; rr(cx - bw / 2, 262, bw, 76, 38); ctx.fill(); });
        T(f.badge, cx, 301, { font: MS(26, 800), ls: 6, fill: P.ink });
      });
    }
    // nom : frappe
    const ns = fit(f.name, 900, 250, z => PF(z, 900, true)), e = E.outExpo(prog(lt, 0.08, 0.34)), sc = 1 + (1 - e) * 2.2, ny = 420 + y0;
    around(cx, ny, sc, sc, (1 - e) * -0.06, () => TC(f.name, cx, ny, {
      font: PF(ns, 900, true), size: ns, ls: 2, grad: f.featured ? [[0, '#fff'], [0.5, '#fff3c4'], [1, P.gold]] : [[0, '#fff'], [1, P.lilac]],
      glow: f.featured ? 'rgba(243,217,139,.8)' : P.violet2, glowBlur: 50 + 25 * bp, glow2: true, alpha: clamp(lt * 10),
    }, (1 - e) * 55 + (lt < 0.2 ? 9 : 0)));
    burst(cx, ny, lt - 0.12, 50, 3 + idx, 560, f.featured ? '243,217,139' : '216,180,254', 1.2);
    // sous-titre qui s'écrit
    const sub = f.sub.slice(0, Math.floor(clamp((lt - 0.45) / 0.5) * f.sub.length));
    T(sub, cx, 545 + y0, { font: MS(28, 600), ls: 11, fill: 'rgba(243,232,255,.85)' });

    // prix (odomètre) — le dernier prix atteint
    let k = 0; f.times.forEach((t, i) => { if (lt >= t) k = i; });
    const tp = prog(lt, f.times[k], 0.95), prevV = k > 0 ? pr[k - 1].value : 0, cur = pr[k], py = 800 + y0, PS = 224;
    const tNow = lt - f.times[k];
    if (lt >= f.times[0]) {
      const pop = 1 + 0.09 * (1 - E.outCubic(prog(tNow, 0.7, 0.35))) * (tNow > 0.7 ? 1 : 0) + 0.012 * bp;
      shock(cx, py, tNow - 0.65, 700, '243,217,139', 6, 0.6);
      burst(cx, py, tNow - 0.65, 36, 40 + k, 460, '243,217,139', 0.9);
      around(cx, py, pop, pop, 0, () => {
        const g = ctx.createRadialGradient(cx, py, 10, cx, py, 520); g.addColorStop(0, 'rgba(243,217,139,.20)'); g.addColorStop(1, 'rgba(243,217,139,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, py - 520, W, 1040); ctx.globalCompositeOperation = 'source-over';
        const box = odometer(prevV, cur.value, tp, cx - 92, py, PS);
        T('€', box.right + 16, py - 36, { font: MS(100, 800), align: 'left', size: 100, grad: GOLD, glow: 'rgba(243,217,139,.5)', glowBlur: 26 });
        T(cur.per, box.right + 16, py + 66, { font: MS(26, 800), align: 'left', ls: 6, fill: P.pale, alpha: clamp(tNow * 6) });
      });
    }
    // pastilles de mode de paiement : le surlignage glisse
    const pyl = 1010 + y0, pa = E.outCubic(prog(lt, f.times[0] + 0.3, 0.4)), pw = pr.map(p => (p.label.length > 10 ? 340 : 230)), gap = 16, totalP = pw.reduce((a, b) => a + b, 0) + gap * 2;
    const xs = []; let px = cx - totalP / 2; pw.forEach(w => { xs.push(px); px += w + gap; });
    ctx.save(); ctx.globalAlpha *= pa;
    pr.forEach((p, i) => { ctx.strokeStyle = 'rgba(216,180,254,.35)'; ctx.lineWidth = 2; rr(xs[i], pyl - 33, pw[i], 66, 33); ctx.stroke(); });
    const kp = k > 0 ? k - 1 : 0, mv = E.outExpo(prog(tNow, 0, 0.3)), hx = xs[kp] + (xs[k] - xs[kp]) * mv, hw = pw[kp] + (pw[k] - pw[kp]) * mv;
    const hg = ctx.createLinearGradient(hx, 0, hx + hw, 0); hg.addColorStop(0, P.gold2); hg.addColorStop(0.5, '#fff1bf'); hg.addColorStop(1, P.gold2);
    glow('rgba(243,217,139,.7)', 26, () => { ctx.fillStyle = hg; rr(hx, pyl - 33, hw, 66, 33); ctx.fill(); });
    pr.forEach((p, i) => { const on = i === k && mv > 0.5; T(p.label, xs[i] + pw[i] / 2, pyl + 1, { font: MS(fit(p.label, pw[i] - 32, 23, z => MS(z, 800), 3), 800), ls: 3, fill: on ? P.ink : 'rgba(243,232,255,.75)' }); });
    ctx.restore();
    // commission
    const cp = E.outBack(prog(lt, f.times[0] + 0.5, 0.35)), cyc = 1125 + y0;
    if (cp > 0) around(cx, cyc, cp, cp, 0, () => {
      ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(cx - 420, cyc - 46, 840, 92, 30); ctx.fill(); ctx.strokeStyle = 'rgba(216,180,254,.32)'; ctx.lineWidth = 2; rr(cx - 420, cyc - 46, 840, 92, 30); ctx.stroke();
      T('COMMISSION', cx - 390, cyc + 1, { font: MS(23, 700), ls: 6, align: 'left', fill: 'rgba(243,217,139,.95)' });
      ctx.save(); ctx.font = MS(50, 800); const cvw = ctx.measureText(f.commission.value).width; ctx.restore();
      T(f.commission.value, cx - 150, cyc + 2, { font: MS(50, 800), align: 'left', size: 50, grad: GOLD, glow: 'rgba(243,217,139,.5)', glowBlur: 18 });
      T(f.commission.note, cx - 150 + cvw + 22, cyc + 2, { font: MS(fit(f.commission.note, 390 - cvw, 27, z => MS(z, 500)), 500), align: 'left', fill: P.pale });
    });
    // avantages : « tampons » qui arrivent des deux côtés
    f.bullets.forEach((b, i) => {
      const st = 1.5 + i * 0.3, p = prog(lt, st, 0.3), e2 = E.outExpo(p), y = 1255 + y0 + i * 82;
      if (p <= 0) return;
      const dx = (i % 2 ? 1 : -1) * (1 - e2) * 1000;
      ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha *= clamp(p * 4);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(110, y - 34, 860, 68, 34); ctx.fill(); ctx.strokeStyle = 'rgba(216,180,254,.24)'; ctx.lineWidth = 2; rr(110, y - 34, 860, 68, 34); ctx.stroke();
      checkIcon(160, y, 22); T(b, 205, y + 1, { font: MS(fit(b, 730, 38, z => MS(z, 600)), 600), align: 'left', fill: P.pale });
      ctx.restore();
      shock(i % 2 ? 970 : 110, y, lt - st - 0.28, 200, '216,180,254', 3, 0.35);
    });
    if (f.featured) burst(cx, 1000, (lt * 0.5) % 1.2, 22, 77, 700, '243,217,139', 1.2);
  }

  // ---- APPEL À L'ACTION ----
  function drawCta(lt, dur) {
    const L = C.cta, cx = W / 2, bp = beatPulse(lt);
    L.lines.forEach((s, i) => {
      const st = 0.15 + i * 0.4, p = prog(lt, st, 0.33), e = E.outExpo(p), y = 500 + i * 215, italic = i === 1;
      shock(cx, y, lt - st, 900, i ? '232,150,255' : '243,217,139');
      if (p <= 0) return;
      const size = fit(s, 900, i ? 225 : 205, z => PF(z, 900, italic), 3), sc = 1 + (1 - e) * 2.2;
      around(cx, y, sc, sc, (1 - e) * (i ? 0.06 : -0.06), () => TC(s, cx, y, italic
        ? { font: PF(size, 900, true), size, ls: 3, grad: [[0, '#fff'], [0.4, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 55 + 25 * bp, glow2: true, alpha: clamp(p * 6) }
        : { font: PF(size, 900, false), size, ls: 3, fill: '#fff', glow: 'rgba(168,85,247,.7)', glowBlur: 36, alpha: clamp(p * 6) }, (1 - e) * 50));
    });
    // bouton
    const by = 940, bw = 800, bh = 170, bpp = E.outBack2(prog(lt, 1.0, 0.4));
    for (let k = 0; k < 3; k++) {
      const age = ((lt - 1.3 - k * BEAT) % (BEAT * 4)) / (BEAT * 4);
      if (lt > 1.3 + k * BEAT && age >= 0) { ctx.save(); ctx.strokeStyle = `rgba(196,150,255,${(1 - age) * 0.55})`; ctx.lineWidth = 3; rr(cx - bw / 2 - age * 170, by - bh / 2 - age * 170, bw + age * 340, bh + age * 340, 85 + age * 170); ctx.stroke(); ctx.restore(); }
    }
    if (bpp > 0) around(cx, by, bpp * (1 + 0.035 * bp), bpp * (1 + 0.035 * bp), 0, () => {
      const g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0); g.addColorStop(0, P.violet); g.addColorStop(0.5, P.violet2); g.addColorStop(1, P.magenta);
      glow(P.violet2, 60 + 30 * bp, () => { ctx.fillStyle = g; rr(cx - bw / 2, by - bh / 2, bw, bh, 85); ctx.fill(); });
      ctx.save(); rr(cx - bw / 2, by - bh / 2, bw, bh, 85); ctx.clip();
      const sw = -400 + 1800 * ((lt * 0.6) % 1), sg = ctx.createLinearGradient(sw - 90, 0, sw + 90, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.38)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(cx - bw / 2, by - bh / 2, bw, bh); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; rr(cx - bw / 2, by - bh / 2, bw, bh, 85); ctx.stroke();
      const tw = T(L.button, cx - 40, by + 2, { font: MS(60, 800), ls: 8, fill: '#fff' }), ax = cx - 40 + tw / 2 + 56 + 10 * bp;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax - 28, by + 2); ctx.lineTo(ax + 22, by + 2); ctx.moveTo(ax + 4, by - 20); ctx.lineTo(ax + 24, by + 2); ctx.lineTo(ax + 4, by + 24); ctx.stroke();
    });
    // adresse du site : grosse, tapée
    const url = C.brand.url, nCh = Math.floor(clamp((lt - 1.6) / 0.9) * url.length);
    if (lt > 1.55) {
      const us = fit(url, 900, 104, z => MS(z, 800), 2), caret = Math.floor(lt * 3) % 2 === 0 || nCh < url.length;
      shock(cx, 1215, lt - 2.5, 600, '243,217,139', 4, 0.5);
      T(url.slice(0, nCh) + (caret ? '|' : ''), cx, 1215, { font: MS(us, 800), size: us, ls: 2, grad: GOLD, glow: 'rgba(243,217,139,.55)', glowBlur: 34 });
      const lw = 880 * E.outExpo(prog(lt, 1.6, 0.8)), gl = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0); gl.addColorStop(0, 'rgba(243,217,139,0)'); gl.addColorStop(0.5, P.gold); gl.addColorStop(1, 'rgba(243,217,139,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - lw / 2, 1280, lw, 4);
    }
    T(C.brand.name, cx, 1395, { font: MS(30, 700), ls: 18, fill: 'rgba(216,180,254,.8)', alpha: E.outCubic(prog(lt, 2.4, 0.5)) });
    if (L.legal) wrapText(L.legal, 860, MS(25, 500)).forEach((l, i) => T(l, cx, 1500 + i * 36, { font: MS(25, 500), fill: 'rgba(233,213,255,.66)', alpha: E.outCubic(prog(lt, 2.8, 0.6)) }));
  }

  // ---------- rendu principal ----------
  const sceneAt = t => { for (const s of scenes) if (t < s.t1) return s; return scenes[scenes.length - 1]; };

  function drawWorld(t) {
    t = clamp(t, 0, TOTAL - 1e-3);
    ctx = layerCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
    const s = sceneAt(t), lt = t - s.t0, dur = s.t1 - s.t0, bp = beatPulse(t), f = Math.floor(t * 60);
    drawBackground(t, s.energy);
    ctx.save();
    // caméra : zoom à l'entrée, coup de fouet latéral, secousse sur les temps forts
    const cut = s.idx === 0 ? 0 : 1, zoom = 1 + (s.soft ? 0.05 : 0.16) * cut * (1 - E.outExpo(prog(lt, 0, 0.45))) + 0.014 * bp * s.energy + 0.02 * (t / TOTAL);
    const whip = cut * (1 - E.outExpo(prog(lt, 0, 0.3))) * 220 * (s.idx % 2 ? 1 : -1), amp = 5 * bp * s.energy;
    ctx.translate(W / 2 + whip + (hash(f * 1.7) - 0.5) * amp, H / 2 + (hash(f * 2.3) - 0.5) * amp); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = s.idx === 0 ? 1 : E.outCubic(prog(lt, 0, 0.1));
    s.draw(lt, dur);
    ctx.restore();
    // flash + traînée lumineuse + ligne de scan à chaque coupe
    if (s.idx > 0) {
      const fl = Math.exp(-lt * 11) * (s.soft ? 0.3 : 0.7);
      if (fl > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1300); g.addColorStop(0, `rgba(233,213,255,${fl})`); g.addColorStop(1, 'rgba(120,60,220,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const sp = prog(lt, 0, 0.35), x = -300 + (W + 600) * E.outExpo(sp), sg = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${0.6 * (1 - sp)})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  window.renderFrame = t => {
    const N = 3, shutter = 0.55 / FPS;
    for (let s = 0; s < N; s++) {
      drawWorld(t + (s / (N - 1) - 0.5) * shutter);
      mainCtx.setTransform(1, 0, 0, 1, 0, 0); mainCtx.globalCompositeOperation = 'source-over'; mainCtx.globalAlpha = 1 / (s + 1); mainCtx.drawImage(layer, 0, 0);
    }
    mainCtx.globalAlpha = 1; drawFinish(t);
  };

  window.ready = Promise.all([
    document.fonts.load('italic 900 100px PF'), document.fonts.load('900 100px PF'), document.fonts.load('italic 700 100px PF'),
    document.fonts.load('500 30px MS'), document.fonts.load('600 30px MS'), document.fonts.load('800 30px MS'),
    ...(C.phones || []).map(p => new Promise(res => { const im = new Image(); im.onload = () => { imgs[p.img] = im; res(); }; im.onerror = () => res(); im.src = p.img; })),
  ]).then(() => { window.renderFrame(0); return true; });
})();
