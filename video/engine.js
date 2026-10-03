// Moteur d'animation déterministe : renderFrame(t) dessine l'image à l'instant t (secondes).
(() => {
  'use strict';
  const C = window.CONTENT;
  const W = 1080, H = 1920, FPS = C.fps, BEAT = 60 / C.bpm;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ---------- palette ----------
  const P = {
    bg: '#05010b', violet: '#7c3aed', violet2: '#a855f7', lilac: '#d8b4fe', pale: '#f3e8ff',
    magenta: '#d946ef', indigo: '#6366f1', gold: '#f3d98b', gold2: '#c79a3b', ink: '#12061f',
  };

  // ---------- utilitaires ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, s, d) => clamp((t - s) / d);
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  };
  const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const beatPulse = t => Math.exp(-((t % BEAT) / BEAT) * 4.5);
  const PF = (s, w = 900, it = true) => `${it ? 'italic ' : ''}${w} ${s}px PF, Georgia, serif`;
  const MS = (s, w = 600) => `${w} ${s}px MS, Arial, sans-serif`;

  function glow(color, blur, fn) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }

  // Texte avec crénage, dégradé, lueur, ombre portée. Retourne la largeur.
  function T(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    const ls = o.ls || 0;
    ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(str).width;
    const cx = o.align === 'left' ? x : o.align === 'right' ? x : x + ls / 2;
    const left = o.align === 'left' ? x : o.align === 'right' ? x - w : cx - w / 2;
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.grad) {
      const g = ctx.createLinearGradient(left + (o.gShift || 0), y - (o.size || 100) * 0.5, left + w + (o.gShift || 0), y + (o.size || 100) * 0.5);
      o.grad.forEach(([p, c]) => g.addColorStop(p, c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = o.fill || '#fff';
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 30; }
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
    ctx.fillText(str, cx, y);
    if (o.glow2) { ctx.shadowBlur = (o.glowBlur ?? 30) * 2; ctx.fillText(str, cx, y); }
    if (o.stroke) { ctx.shadowBlur = 0; ctx.lineWidth = o.stroke.w; ctx.strokeStyle = o.stroke.c; ctx.strokeText(str, cx, y); }
    ctx.restore();
    return w;
  }

  // Réduit la taille jusqu'à ce que le texte tienne dans maxW
  function fit(str, maxW, size, fontFn, ls = 0) {
    ctx.save();
    ctx.letterSpacing = ls + 'px';
    let s = size;
    for (; s > 20; s -= 2) { ctx.font = fontFn(s); if (ctx.measureText(str).width <= maxW) break; }
    ctx.restore();
    return s;
  }

  function around(x, y, sx, sy, rot, fn) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-x, -y); fn(); ctx.restore(); }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function checkIcon(x, y, r, a = 1) {
    ctx.save(); ctx.globalAlpha *= a;
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, P.violet2); g.addColorStop(1, P.magenta);
    glow(P.violet2, 22, () => { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.34); ctx.lineTo(x + r * 0.45, y - r * 0.28); ctx.stroke();
    ctx.restore();
  }

  function sparkles(cx, cy, t0, lt, n, seed, maxD, color, life = 1.2) {
    const rnd = mulberry32(seed); const age = lt - t0; if (age < 0 || age > life) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, v = 0.35 + rnd() * 0.65, r = 1.5 + rnd() * 3.5;
      const d = maxD * v * E.outCubic(age / life);
      const al = (1 - age / life);
      ctx.fillStyle = rgba(color, al * 0.9);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * al + 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- chronologie ----------
  const scenes = []; let cur = 0;
  const addScene = (name, dur, draw, soft = false) => { scenes.push({ name, t0: cur, t1: cur + dur, draw, soft }); cur += dur; };
  addScene('hook', 3, drawHook);
  addScene('brand', 4, drawBrand);
  if (C.promise && C.promise.lines.length) addScene('promise', 4, drawPromise);
  (C.methods || []).forEach((m, i) => addScene('method' + (i + 1), 4, lt => drawMethod(i, lt), i > 0));
  C.formulas.forEach((f, i) => addScene('formula' + (i + 1), 7, (lt, d) => drawFormula(i, lt, d), i > 0));
  if (C.stats && C.stats.length) addScene('stats', 4, drawStats);
  addScene('cta', 5, drawCta);
  const TOTAL = cur;
  window.TIMELINE = { total: TOTAL, fps: FPS, bpm: C.bpm, scenes: scenes.map(s => ({ name: s.name, t0: s.t0, t1: s.t1 })) };

  // ---------- fond animé ----------
  const rndBg = mulberry32(7);
  const parts = Array.from({ length: 150 }, () => ({ x: rndBg() * W, y: rndBg() * (H + 200), sp: 18 + rndBg() * 60, r: 1 + rndBg() * 3.2, ph: rndBg() * 6.28, fx: 0.3 + rndBg() * 0.8, amp: 10 + rndBg() * 40, tw: 1 + rndBg() * 3 }));
  const blobs = [
    { c: '124,58,237', r: 780, ox: 0.2, oy: 0.25, sx: 0.07, sy: 0.09, ph: 0, a: 0.36 },
    { c: '217,70,239', r: 640, ox: 0.82, oy: 0.55, sx: 0.06, sy: 0.1, ph: 2, a: 0.2 },
    { c: '79,70,229', r: 860, ox: 0.5, oy: 0.88, sx: 0.08, sy: 0.05, ph: 4, a: 0.3 },
    { c: '168,85,247', r: 520, ox: 0.72, oy: 0.1, sx: 0.1, sy: 0.07, ph: 1, a: 0.2 },
  ];
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const g = grain.getContext('2d'); const im = g.createImageData(256, 256); const r = mulberry32(99);
    for (let i = 0; i < 256 * 256; i++) { const v = (r() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); }

  function drawBackground(t, energy) {
    const pulse = beatPulse(t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const cx = W * (b.ox + 0.2 * Math.sin(t * b.sx * 6.28 + b.ph));
      const cy = H * (b.oy + 0.12 * Math.cos(t * b.sy * 6.28 + b.ph * 1.7));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
      const a = b.a * (0.8 + 0.35 * pulse * energy);
      g.addColorStop(0, `rgba(${b.c},${a})`); g.addColorStop(1, `rgba(${b.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // faisceaux diagonaux
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.42);
    for (let i = 0; i < 3; i++) {
      const x = ((t * (30 + i * 14) + i * 520) % 2400) - 1200;
      const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
      g.addColorStop(0, 'rgba(168,85,247,0)'); g.addColorStop(0.5, `rgba(196,150,255,${0.05 + 0.03 * pulse})`); g.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 160, -1600, 320, 3200);
    }
    ctx.restore();
    // anneaux qui pulsent depuis le centre
    for (let k = 0; k < 2; k++) {
      const age = (((t + k * BEAT * 2) % (BEAT * 4)) / (BEAT * 4));
      ctx.strokeStyle = `rgba(190,130,255,${(1 - age) * 0.14})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.47, 120 + age * 1100, 0, Math.PI * 2); ctx.stroke();
    }
    // particules
    for (const p of parts) {
      const y = (((p.y - t * p.sp) % (H + 200)) + (H + 200)) % (H + 200) - 100;
      const x = p.x + Math.sin(t * p.fx + p.ph) * p.amp;
      const a = (0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph))) * (0.8 + 0.5 * pulse * energy);
      ctx.fillStyle = `rgba(216,180,254,${a * 0.22})`; ctx.beginPath(); ctx.arc(x, y, p.r * 3.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(243,232,255,${a})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFinish(t) {
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // grain
    const f = Math.round(t * FPS);
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
    const ox = Math.floor(hash(f) * 256), oy = Math.floor(hash(f + 91) * 256);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
    if (C.draft) {
      T('APERÇU DU STYLE · TEXTES PROVISOIRES', W / 2, 78, { font: MS(20, 600), ls: 5, fill: 'rgba(243,232,255,.55)' });
    }
  }

  // ---------- scènes ----------
  function drawHook(lt) {
    const lines = C.hook;
    const sizes = lines.map((s, i) => fit(s, 940, i === lines.length - 1 ? 250 : 210, z => PF(z, 900, i === lines.length - 1), 4));
    const gap = 26, total = sizes.reduce((a, b) => a + b * 1.0, 0) + gap * (lines.length - 1);
    let y = H * 0.47 - total / 2;
    const f = Math.round(lt * FPS);
    lines.forEach((s, i) => {
      const size = sizes[i], cy = y + size * 0.5; y += size + gap;
      const start = 0.1 + i * BEAT * 1.5, p = prog(lt, start, 0.55), e = E.outExpo(p);
      if (p <= 0) return;
      const last = i === lines.length - 1;
      const sc = 1 + (1 - e) * 0.85;
      const ghost = (1 - e) * 46 + (lt - start < 0.2 ? 6 + hash(f + i * 7) * 16 : 0);
      around(W / 2, cy, sc, sc, (1 - e) * (i % 2 ? 0.06 : -0.06), () => {
        ctx.save(); ctx.globalAlpha *= clamp(p * 3);
        ctx.globalCompositeOperation = 'lighter';
        if (ghost > 3) {
          T(s, W / 2 - ghost, cy, { font: PF(size, 900, last), ls: last ? 0 : 4, fill: 'rgba(255,40,214,.75)', size });
          T(s, W / 2 + ghost, cy, { font: PF(size, 900, last), ls: last ? 0 : 4, fill: 'rgba(60,110,255,.75)', size });
        }
        ctx.globalCompositeOperation = 'source-over';
        const bp = beatPulse(lt);
        if (last) T(s, W / 2, cy, { font: PF(size, 900, true), ls: 4, size, grad: [[0, '#ffffff'], [0.35, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 50 + 30 * bp, glow2: true });
        else T(s, W / 2, cy, { font: PF(size, 900, false), ls: 4, size, fill: '#fff', glow: 'rgba(168,85,247,.55)', glowBlur: 30, shadow: false });
        ctx.restore();
      });
      if (last) {
        const lp = E.outExpo(prog(lt, start + 0.45, 0.6)), w = 760 * lp;
        const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
        g.addColorStop(0, 'rgba(243,217,139,0)'); g.addColorStop(0.5, P.gold); g.addColorStop(1, 'rgba(243,217,139,0)');
        ctx.fillStyle = g; glow(P.gold, 18, () => ctx.fillRect(W / 2 - w / 2, cy + size * 0.58, w, 4));
      }
    });
  }

  function drawBrand(lt) {
    const cx = W / 2, cy = 720, B = C.brand;
    // rayons
    const ra = E.outCubic(prog(lt, 0, 1.2));
    ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(lt * 0.18);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI * 2 / 16);
      const len = i % 2 ? 760 : 1000;
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(168,85,247,${0.22 * ra})`); g.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -36); ctx.lineTo(len, 36); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // anneaux
    const rings = [{ r: 175, w: 6, dir: 1, sp: 0.55, len: 1 }, { r: 222, w: 3, dir: -1, sp: 0.38, len: 0.78 }, { r: 268, w: 2, dir: 1, sp: 0.26, len: 0.55 }];
    rings.forEach((g, i) => {
      const p = E.outCubic(prog(lt, 0.1 + i * 0.18, 1)); if (p <= 0) return;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(g.dir * lt * g.sp - Math.PI / 2);
      const gr = ctx.createLinearGradient(-g.r, 0, g.r, 0); gr.addColorStop(0, P.pale); gr.addColorStop(0.5, P.violet2); gr.addColorStop(1, P.violet);
      ctx.strokeStyle = gr; ctx.lineWidth = g.w; ctx.lineCap = 'round'; ctx.shadowColor = P.violet2; ctx.shadowBlur = 28;
      ctx.beginPath(); ctx.arc(0, 0, g.r, 0, Math.PI * 2 * g.len * p); ctx.stroke(); ctx.restore();
    });
    // anneau pointillé + graduations
    const dp = E.outCubic(prog(lt, 0.3, 1));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-lt * 0.12); ctx.globalAlpha *= dp;
    ctx.setLineDash([3, 17]); ctx.strokeStyle = 'rgba(216,180,254,.65)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 312, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, l = i % 6 === 0 ? 26 : 11, s = prog(lt, 0.5 + i * 0.006, 0.4);
      ctx.strokeStyle = `rgba(243,217,139,${(i % 6 === 0 ? 0.9 : 0.4) * s})`; ctx.lineWidth = i % 6 === 0 ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 345, Math.sin(a) * 345); ctx.lineTo(Math.cos(a) * (345 + l), Math.sin(a) * (345 + l)); ctx.stroke();
    }
    ctx.restore();
    // monogramme
    const mp = E.outBack(prog(lt, 0.35, 0.7)), bp = beatPulse(lt);
    if (mp > 0) around(cx, cy + 6, mp * (1 + 0.025 * bp), mp * (1 + 0.025 * bp), 0, () => {
      T(B.monogram, cx, cy + 6, { font: PF(260, 900, true), size: 260, grad: [[0, '#fff'], [0.5, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 46, glow2: true });
    });
    sparkles(cx, cy, 0.35, lt, 46, 11, 520, P.lilac, 1.4);
    // nom
    const NLS = 16, nameSize = fit(B.name, 920, 150, z => MS(z, 800), NLS), nm = B.name;
    ctx.save(); ctx.font = MS(nameSize, 800); ctx.letterSpacing = NLS + 'px';
    const tw = ctx.measureText(nm).width - NLS; ctx.restore();
    const x = W / 2 - tw / 2;
    for (let i = 0; i < nm.length; i++) {
      ctx.save(); ctx.font = MS(nameSize, 800); ctx.letterSpacing = NLS + 'px';
      const pre = ctx.measureText(nm.slice(0, i)).width; ctx.restore();
      const p = E.outBack(prog(lt, 1.0 + i * 0.07, 0.45));
      if (p > 0) T(nm[i], x + pre, 1135 + (1 - p) * 60, { font: MS(nameSize, 800), align: 'left', size: nameSize, alpha: clamp(p * 2), grad: [[0, '#fff'], [1, P.lilac]], glow: 'rgba(168,85,247,.7)', glowBlur: 30 });
    }
    // sous-titre et ligne dorée
    const sp = E.outCubic(prog(lt, 1.6, 0.8));
    const subSize = fit(B.sub, 930, 46, z => MS(z, 600), 12);
    if (sp > 0) T(B.sub, W / 2, 1270, { font: MS(subSize, 600), ls: 12 + 10 * (1 - sp), alpha: sp, fill: P.pale, glow: 'rgba(168,85,247,.6)', glowBlur: 20 });
    const lw = 360 * E.outExpo(prog(lt, 2.0, 0.7));
    const gl = ctx.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0); gl.addColorStop(0, 'rgba(243,217,139,0)'); gl.addColorStop(0.5, P.gold); gl.addColorStop(1, 'rgba(243,217,139,0)');
    ctx.fillStyle = gl; ctx.fillRect(W / 2 - lw / 2, 1335, lw, 3);
    const tp = E.outCubic(prog(lt, 2.3, 0.7));
    if (tp > 0) T(B.tagline, W / 2, 1395, { font: MS(fit(B.tagline, 900, 30, z => MS(z, 500), 14), 500), ls: 14, alpha: tp, fill: P.gold });
  }

  function parseHL(str) { return str.split('*').map((s, i) => ({ s, hl: i % 2 === 1 })).filter(x => x.s); }

  function drawPromise(lt) {
    const Pm = C.promise;
    const kp = E.outCubic(prog(lt, 0, 0.5));
    T(Pm.kicker, W / 2, 330, { font: MS(32, 600), ls: 18, alpha: kp, fill: P.gold });
    const n = Pm.lines.length, step = 270, y0 = H * 0.5 - ((n - 1) * step) / 2 + 30;
    Pm.lines.forEach((line, i) => {
      const segs = parseHL(line), start = 0.35 + i * 0.9, p = E.outExpo(prog(lt, start, 0.7)), y = y0 + i * step;
      if (p <= 0) return;
      const plain = segs.map(s => s.s).join('');
      const size = fit(plain, 940, 104, z => PF(z, 700, true));
      ctx.save(); ctx.font = PF(size, 700, true);
      const widths = segs.map(s => ctx.measureText(s.s).width), total = widths.reduce((a, b) => a + b, 0); ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y - 120, W * p, 240); ctx.clip();
      T(String(i + 1).padStart(2, '0'), W / 2, y - 100, { font: MS(28, 600), ls: 10, fill: 'rgba(243,217,139,.85)' });
      let x = W / 2 - total / 2 + (1 - p) * -80;
      segs.forEach((sg, k) => {
        if (sg.hl) T(sg.s, x, y, { font: PF(size, 700, true), align: 'left', size, grad: [[0, P.gold], [0.5, '#fff6d6'], [1, P.gold2]], glow: 'rgba(243,217,139,.45)', glowBlur: 26 });
        else T(sg.s, x, y, { font: PF(size, 700, true), align: 'left', size, fill: '#fff', glow: 'rgba(168,85,247,.35)', glowBlur: 18 });
        x += widths[k];
      });
      ctx.restore();
    });
  }

  const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  function wrapText(str, maxW, font) {
    ctx.save(); ctx.font = font;
    const words = str.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); ctx.restore(); return lines;
  }

  function drawMethod(idx, lt) {
    const m = C.methods[idx], cx = W / 2;
    T(m.kicker, cx, 215, { font: MS(32, 600), ls: 18, fill: P.gold, alpha: E.outCubic(prog(lt, 0, 0.4)) });
    const tp = E.outExpo(prog(lt, 0.1, 0.7)), size = fit(m.title, 900, 150, z => PF(z, 900, true));
    around(cx, 340, 0.85 + 0.15 * tp, 0.85 + 0.15 * tp, 0, () => T(m.title, cx, 340, { font: PF(size, 900, true), size, alpha: tp, grad: [[0, '#fff'], [1, P.lilac]], glow: P.violet2, glowBlur: 40, glow2: true }));
    const sub = wrapText(m.sub, 840, MS(34, 500)), sa = E.outCubic(prog(lt, 0.45, 0.5));
    sub.forEach((l, i) => T(l, cx, 450 + i * 48, { font: MS(34, 500), fill: 'rgba(243,232,255,.82)', alpha: sa }));
    const x0 = 150, y0 = 740, step = 240, bp = beatPulse(lt);
    m.steps.forEach((s, i) => {
      const y = y0 + i * step, start = 0.9 + i * 0.55, p = prog(lt, start, 0.5), e = E.outBack(p);
      if (i < m.steps.length - 1) { // connecteur
        const lp = E.outCubic(prog(lt, start + 0.25, 0.45)), ya = y + 50, yb = y + step - 50;
        const g = ctx.createLinearGradient(0, ya, 0, yb); g.addColorStop(0, 'rgba(168,85,247,.9)'); g.addColorStop(1, 'rgba(168,85,247,.25)');
        ctx.fillStyle = g; ctx.fillRect(x0 - 1.5, ya, 3, (yb - ya) * lp);
      }
      if (p <= 0) return;
      ctx.save(); ctx.translate(x0, y); ctx.scale(e, e);
      glow(P.violet2, 26 + 14 * bp, () => { ctx.fillStyle = 'rgba(22,8,44,.95)'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.283); ctx.fill(); });
      const rg = ctx.createLinearGradient(-46, -46, 46, 46); rg.addColorStop(0, P.pale); rg.addColorStop(0.5, P.violet2); rg.addColorStop(1, P.magenta);
      ctx.strokeStyle = rg; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.283); ctx.stroke();
      ctx.restore();
      T(String(i + 1).padStart(2, '0'), x0, y + 1, { font: MS(30, 800), fill: '#fff', alpha: clamp(p * 2) });
      const dx = (1 - E.outCubic(p)) * 50, ta = clamp(p * 2);
      T(s.t, 250 + dx, y - 26, { font: PF(fit(s.t, 760, 72, z => PF(z, 900, true)), 900, true), align: 'left', size: 72, alpha: ta, fill: '#fff', glow: 'rgba(168,85,247,.5)', glowBlur: 22 });
      const dl = wrapText(s.d, 740, MS(34, 500));
      dl.slice(0, 2).forEach((l, k) => T(l, 250 + dx, y + 40 + k * 46, { font: MS(34, 500), align: 'left', fill: 'rgba(233,213,255,.8)', alpha: ta }));
    });
  }

  function drawFormula(idx, lt, dur) {
    const f = C.formulas[idx], n = C.formulas.length, last = idx === n - 1, pr = f.prices;
    T(C.formulasTitle, W / 2, 205, { font: MS(36, 600), ls: 22, fill: P.pale, glow: 'rgba(168,85,247,.7)', glowBlur: 20, alpha: E.outCubic(prog(lt, 0, 0.4)) });
    for (let k = 0; k < n; k++) {
      const x = W / 2 + (k - (n - 1) / 2) * 44, on = k === idx;
      ctx.save(); ctx.fillStyle = on ? P.gold : 'rgba(216,180,254,.35)';
      if (on) { ctx.shadowColor = P.gold; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(x, 270, on ? 9 : 6, 0, 6.283); ctx.fill(); ctx.restore();
    }
    const inP = E.outExpo(prog(lt, 0, 0.7)), outP = last ? 0 : E.inCubic(prog(lt, dur - 0.35, 0.35));
    const cxx = W / 2 + (1 - inP) * 900 - outP * 1000, cy = 905;
    const sx = 0.7 + 0.3 * inP - 0.15 * outP, rot = (1 - inP) * 0.14 - outP * 0.1;
    ctx.save(); ctx.translate(cxx, cy); ctx.rotate(rot); ctx.scale(sx, 1);
    const bp = beatPulse(lt), CW = 900, CH = 1180, X = -CW / 2, Y = -CH / 2;

    glow(f.featured ? 'rgba(217,70,239,.55)' : 'rgba(124,58,237,.55)', 70 + 25 * bp, () => {
      const g = ctx.createLinearGradient(0, Y, 0, Y + CH); g.addColorStop(0, 'rgba(58,20,108,.78)'); g.addColorStop(1, 'rgba(12,4,26,.9)');
      ctx.fillStyle = g; rr(X, Y, CW, CH, 52); ctx.fill();
    });
    ctx.save();
    const cg = ctx.createConicGradient(lt * 1.2, 0, 0);
    cg.addColorStop(0, P.violet2); cg.addColorStop(0.25, 'rgba(168,85,247,.08)'); cg.addColorStop(0.5, f.featured ? P.gold : P.lilac); cg.addColorStop(0.75, 'rgba(168,85,247,.08)'); cg.addColorStop(1, P.violet2);
    ctx.strokeStyle = cg; ctx.lineWidth = f.featured ? 6 : 3.5; rr(X, Y, CW, CH, 52); ctx.stroke(); ctx.restore();
    ctx.save(); rr(X, Y, CW, CH, 52); ctx.clip();
    const sw = X - 300 + (CW + 900) * E.inOut(prog(lt, 0.9, 1.0));
    const sg = ctx.createLinearGradient(sw - 120, Y, sw + 120, Y + 300); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.09)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(X, Y, CW, CH); ctx.restore();

    if (f.badge) {
      const bs = 1 + 0.04 * bp, bpv = E.outBack(prog(lt, 0.5, 0.5));
      around(0, Y, bs * bpv, bs * bpv, 0, () => {
        const bw = 560, g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, P.gold2); g.addColorStop(0.5, '#fff1bf'); g.addColorStop(1, P.gold2);
        glow('rgba(243,217,139,.7)', 30, () => { ctx.fillStyle = g; rr(-bw / 2, Y - 38, bw, 76, 38); ctx.fill(); });
        T(f.badge, 0, Y + 2, { font: MS(25, 800), ls: 5, fill: P.ink });
      });
    }
    T(f.tag, 0, Y + 85, { font: MS(28, 600), ls: 16, fill: P.gold, alpha: E.outCubic(prog(lt, 0.35, 0.5)) });
    const ns = fit(f.name, 780, 140, z => PF(z, 900, true)), np = E.outBack(prog(lt, 0.45, 0.6));
    if (np > 0) around(0, Y + 185, np, np, 0, () => T(f.name, 0, Y + 185, { font: PF(ns, 900, true), size: ns, grad: [[0, '#fff'], [1, P.lilac]], glow: 'rgba(168,85,247,.7)', glowBlur: 34, alpha: clamp(np) }));
    T(f.sub, 0, Y + 265, { font: MS(26, 600), ls: 10, fill: 'rgba(243,232,255,.8)', alpha: E.outCubic(prog(lt, 0.6, 0.5)) });
    const dw = 640 * E.outExpo(prog(lt, 0.65, 0.6)), dg = ctx.createLinearGradient(-dw / 2, 0, dw / 2, 0);
    dg.addColorStop(0, 'rgba(216,180,254,0)'); dg.addColorStop(0.5, 'rgba(216,180,254,.8)'); dg.addColorStop(1, 'rgba(216,180,254,0)');
    ctx.fillStyle = dg; ctx.fillRect(-dw / 2, Y + 305, dw, 2);

    // prix qui défilent (compteur)
    const starts = [1.3, 3.0, 4.7];
    let k = 0; pr.forEach((_, i) => { if (lt >= (starts[i] ?? 99)) k = i; });
    const cur = pr[k], prevV = k > 0 ? pr[k - 1].value : 0, tk = prog(lt, starts[k], k === 0 ? 1.1 : 0.7);
    const val = prevV + (cur.value - prevV) * E.outExpo(tk), pA = E.outCubic(prog(lt, 1.2, 0.4)), py = Y + 430;
    const numStr = fmtNum(val), finalStr = fmtNum(cur.value), PS = 170;
    ctx.save(); ctx.font = MS(PS, 800); const finalW = ctx.measureText(finalStr).width;
    ctx.font = MS(86, 800); const uW = ctx.measureText('€').width;
    ctx.font = MS(26, 600); ctx.letterSpacing = '6px'; const perW = ctx.measureText(cur.per).width; ctx.restore();
    const totalW = finalW + 18 + Math.max(uW, perW), left = -totalW / 2;
    const pk = k > 0 ? 1 + 0.07 * (1 - E.outCubic(prog(lt, starts[k], 0.4))) : 1;
    if (pA > 0) around(0, py, pk * (1 + 0.012 * bp), pk * (1 + 0.012 * bp), 0, () => {
      ctx.save(); ctx.globalAlpha *= pA;
      T(numStr, left + finalW, py, { font: MS(PS, 800), align: 'right', size: PS, grad: [[0, P.gold2], [0.4, '#fff3c4'], [0.65, P.gold], [1, P.gold2]], glow: 'rgba(243,217,139,.5)', glowBlur: 40 });
      T('€', left + finalW + 18, py - 42, { font: MS(86, 800), align: 'left', size: 86, grad: [[0, P.gold], [1, P.gold2]], glow: 'rgba(243,217,139,.4)', glowBlur: 24 });
      T(cur.per, left + finalW + 18, py + 56, { font: MS(26, 600), ls: 6, align: 'left', fill: P.pale, alpha: 0.9 });
      ctx.restore();
    });
    // pastilles de mode de paiement
    const pa = E.outCubic(prog(lt, 1.0, 0.5)), pyl = Y + 570, pw = pr.map(p => (p.label.length > 10 ? 330 : 220)), gap = 18;
    const totalP = pw.reduce((a, b) => a + b, 0) + gap * (pr.length - 1);
    let px = -totalP / 2;
    pr.forEach((p, i) => {
      const w = pw[i], on = i === k, pop = on && k > 0 ? 1 + 0.06 * (1 - E.outCubic(prog(lt, starts[k], 0.35))) : 1;
      around(px + w / 2, pyl, pop, pop, 0, () => {
        ctx.save(); ctx.globalAlpha *= pa;
        if (on) { const g = ctx.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, P.gold2); g.addColorStop(0.5, '#fff1bf'); g.addColorStop(1, P.gold2); glow('rgba(243,217,139,.55)', 24, () => { ctx.fillStyle = g; rr(px, pyl - 32, w, 64, 32); ctx.fill(); }); }
        else { ctx.strokeStyle = 'rgba(216,180,254,.4)'; ctx.lineWidth = 2; rr(px, pyl - 32, w, 64, 32); ctx.stroke(); }
        T(p.label, px + w / 2, pyl + 1, { font: MS(fit(p.label, w - 30, 22, z => MS(z, 800), 3), 800), ls: 3, fill: on ? P.ink : 'rgba(243,232,255,.7)' });
        ctx.restore();
      });
      px += w + gap;
    });
    // commission
    const ca = E.outCubic(prog(lt, 1.6, 0.5)), cyc = Y + 685;
    ctx.save(); ctx.globalAlpha *= ca;
    ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(-400, cyc - 44, 800, 88, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(216,180,254,.28)'; ctx.lineWidth = 2; rr(-400, cyc - 44, 800, 88, 28); ctx.stroke();
    T('COMMISSION', -370, cyc + 1, { font: MS(22, 600), ls: 6, align: 'left', fill: 'rgba(243,217,139,.9)' });
    ctx.font = MS(46, 800); const cvw = ctx.measureText(f.commission.value).width;
    T(f.commission.value, -150, cyc + 2, { font: MS(46, 800), align: 'left', size: 46, grad: [[0, P.gold], [1, '#fff3c4']], glow: 'rgba(243,217,139,.4)', glowBlur: 18 });
    T(f.commission.note, -150 + cvw + 22, cyc + 2, { font: MS(fit(f.commission.note, 390 - cvw, 26, z => MS(z, 500)), 500), align: 'left', fill: P.pale });
    ctx.restore();
    // avantages
    f.bullets.forEach((b, i) => {
      const bpz = prog(lt, 2.1 + i * 0.42, 0.5); if (bpz <= 0) return;
      const y = Y + 805 + i * 72, dy = (1 - E.outCubic(bpz)) * 30;
      checkIcon(-375, y + dy, 22, clamp(bpz * 2.5));
      T(b, -332, y + dy, { font: MS(fit(b, 730, 36, z => MS(z, 600)), 600), align: 'left', fill: P.pale, alpha: clamp(bpz * 2.5) });
    });
    ctx.restore();
  }

  function drawStats(lt) {
    const S = C.stats, n = S.length, step = 420, y0 = H * 0.5 - ((n - 1) * step) / 2;
    S.forEach((s, i) => {
      const start = 0.2 + i * 0.7, p = prog(lt, start, 1.4), e = E.outExpo(p), a = E.outCubic(prog(lt, start, 0.4));
      if (a <= 0) return;
      const val = Math.round(s.value * e), txt = `${s.prefix || ''}${val}${s.suffix || ''}`, y = y0 + i * step;
      const size = fit(txt, 900, 260, z => MS(z, 800));
      around(W / 2, y, 0.9 + 0.1 * a, 0.9 + 0.1 * a, 0, () => T(txt, W / 2, y, { font: MS(size, 800), size, alpha: a, grad: [[0, P.gold2], [0.4, '#fff3c4'], [1, P.gold]], glow: 'rgba(243,217,139,.5)', glowBlur: 40 }));
      T(s.label, W / 2, y + size * 0.62, { font: MS(32, 600), ls: 14, fill: P.pale, alpha: a });
    });
  }

  function drawCta(lt, dur) {
    const L = C.cta, bp = beatPulse(lt);
    L.lines.forEach((s, i) => {
      const p = E.outExpo(prog(lt, 0.15 + i * 0.35, 0.6)); if (p <= 0) return;
      const size = fit(s, 880, i ? 215 : 195, z => PF(z, 900, i === 1)), y = 560 + i * 215;
      around(W / 2, y, 1 + (1 - p) * 0.6, 1 + (1 - p) * 0.6, 0, () => {
        ctx.save(); ctx.globalAlpha *= clamp(p * 3);
        if (i === 1) T(s, W / 2, y, { font: PF(size, 900, true), size, grad: [[0, '#fff'], [0.4, P.lilac], [1, P.violet2]], glow: P.violet2, glowBlur: 50 + 20 * bp, glow2: true });
        else T(s, W / 2, y, { font: PF(size, 900, false), ls: 4, size, fill: '#fff', glow: 'rgba(168,85,247,.5)', glowBlur: 28 });
        ctx.restore();
      });
    });
    if (L.sub) T(L.sub, W / 2, 900, { font: MS(32, 500), ls: 12, fill: P.gold, alpha: E.outCubic(prog(lt, 1.0, 0.5)) });
    // bouton
    const by = 1090, bw = 800, bh = 170, bpp = E.outBack(prog(lt, 0.9, 0.6));
    // ondes
    for (let k = 0; k < 3; k++) {
      const age = (((lt - 1.2 - k * BEAT) % (BEAT * 4)) / (BEAT * 4));
      if (lt > 1.2 + k * BEAT && age >= 0) { ctx.save(); ctx.strokeStyle = `rgba(196,150,255,${(1 - age) * 0.5})`; ctx.lineWidth = 3; rr(W / 2 - bw / 2 - age * 150, by - bh / 2 - age * 150, bw + age * 300, bh + age * 300, 85 + age * 150); ctx.stroke(); ctx.restore(); }
    }
    if (bpp > 0) around(W / 2, by, bpp * (1 + 0.03 * bp), bpp * (1 + 0.03 * bp), 0, () => {
      const g = ctx.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0); g.addColorStop(0, P.violet); g.addColorStop(0.5, P.violet2); g.addColorStop(1, P.magenta);
      glow(P.violet2, 60 + 30 * bp, () => { ctx.fillStyle = g; rr(W / 2 - bw / 2, by - bh / 2, bw, bh, 85); ctx.fill(); });
      ctx.save(); rr(W / 2 - bw / 2, by - bh / 2, bw, bh, 85); ctx.clip();
      const sw = -400 + 1800 * ((lt * 0.55) % 1);
      const sg = ctx.createLinearGradient(sw - 90, 0, sw + 90, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(W / 2 - bw / 2, by - bh / 2, bw, bh); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; rr(W / 2 - bw / 2, by - bh / 2, bw, bh, 85); ctx.stroke();
      const tw = T(L.button, W / 2 - 40, by + 2, { font: MS(60, 800), ls: 8, fill: '#fff', shadow: true });
      // flèche dessinée
      const ax = W / 2 - 40 + tw / 2 + 56 + 8 * bp;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax - 28, by + 2); ctx.lineTo(ax + 22, by + 2); ctx.moveTo(ax + 4, by - 20); ctx.lineTo(ax + 24, by + 2); ctx.lineTo(ax + 4, by + 24); ctx.stroke();
    });
    // URL tapée
    const url = C.brand.url, nChars = Math.floor(clamp((lt - 1.7) / 1.4) * url.length);
    if (lt > 1.6) {
      const shown = url.slice(0, nChars), size = fit(url, 940, 38, z => MS(z, 600), 1);
      const caret = Math.floor(lt * 2.5) % 2 === 0 || nChars < url.length;
      T(shown + (caret ? '|' : ''), W / 2, 1330, { font: MS(size, 600), ls: 1, fill: P.pale, glow: 'rgba(168,85,247,.55)', glowBlur: 18 });
      const lw = 880 * E.outExpo(prog(lt, 1.6, 0.8)); const gl = ctx.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0);
      gl.addColorStop(0, 'rgba(243,217,139,0)'); gl.addColorStop(0.5, P.gold); gl.addColorStop(1, 'rgba(243,217,139,0)');
      ctx.fillStyle = gl; ctx.fillRect(W / 2 - lw / 2, 1368, lw, 3);
    }
    if (L.legal) { const ls = wrapText(L.legal, 860, MS(24, 500)); ls.forEach((l, i) => T(l, W / 2, 1565 + i * 34, { font: MS(24, 500), fill: 'rgba(233,213,255,.62)', alpha: E.outCubic(prog(lt, 2.8, 0.6)) })); }
    // signature
    T(C.brand.name, W / 2, 1480, { font: MS(26, 600), ls: 14, fill: 'rgba(216,180,254,.7)', alpha: E.outCubic(prog(lt, 2.4, 0.6)) });
  }

  // ---------- rendu principal ----------
  function sceneAt(t) { for (const s of scenes) if (t < s.t1) return s; return scenes[scenes.length - 1]; }

  window.renderFrame = t => {
    t = clamp(t, 0, TOTAL - 1 / FPS / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
    const s = sceneAt(t), lt = t - s.t0, dur = s.t1 - s.t0, bp = beatPulse(t);
    drawBackground(t, 1);

    ctx.save();
    const inE = s.soft ? 0.04 : 0.1, zoom = 1 + inE * (1 - E.outExpo(prog(lt, 0, 0.55))) + 0.012 * bp + 0.02 * (t / TOTAL);
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = s.soft ? 1 : E.outCubic(prog(lt, 0, 0.14));
    s.draw(lt, dur);
    ctx.restore();

    // flash + trait de lumière sur chaque coupe
    if (s.t0 > 0) {
      const fl = Math.exp(-lt * (s.soft ? 14 : 9)) * (s.soft ? 0.22 : 0.62);
      if (fl > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1300); g.addColorStop(0, `rgba(233,213,255,${fl})`); g.addColorStop(1, 'rgba(120,60,220,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const sp = prog(lt, 0, 0.4), x = -300 + (W + 600) * E.outExpo(sp);
        const sg = ctx.createLinearGradient(x - 200, 0, x + 200, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${(s.soft ? 0.2 : 0.55) * (1 - sp)})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    drawFinish(t);
    // fondu final
    const fo = prog(t, TOTAL - 0.7, 0.7);
    if (fo > 0) { ctx.fillStyle = `rgba(5,1,11,${E.inCubic(fo)})`; ctx.fillRect(0, 0, W, H); }
    // fondu d'entrée
    const fi = 1 - prog(t, 0, 0.12); if (fi > 0) { ctx.fillStyle = `rgba(5,1,11,${fi})`; ctx.fillRect(0, 0, W, H); }
  };

  window.ready = Promise.all([
    document.fonts.load('italic 900 100px PF'), document.fonts.load('italic 700 100px PF'), document.fonts.load('900 100px PF'),
    document.fonts.load('500 30px MS'), document.fonts.load('600 30px MS'), document.fonts.load('800 30px MS'),
  ]).then(() => { window.renderFrame(0); return true; });
})();
