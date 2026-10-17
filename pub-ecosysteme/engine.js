// Pub « écosystème » — même moteur et même identité que la vidéo promo (noir & blanc éditorial).
// renderFrame(t) dessine l'image à l'instant t (secondes), de façon déterministe.
(() => {
  'use strict';
  const C = window.CONTENT;
  const W = 1080, H = 1920, FPS = C.fps;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ---------- palette & utilitaires (identiques à la vidéo promo) ----------
  const WHITE = '#f6f6f4', G1 = 'rgba(246,246,244,.66)', G2 = 'rgba(246,246,244,.40)', LINE = 'rgba(246,246,244,.24)', LINE2 = 'rgba(246,246,244,.12)';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, s, d) => clamp((t - s) / d);
  const E = {
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outCubic: x => 1 - Math.pow(1 - x, 3),
    outQuart: x => 1 - Math.pow(1 - x, 4),
    inCubic: x => x * x * x,
  };
  const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const PF = (s, w = 400, it = false) => `${it ? 'italic ' : ''}${w} ${s}px PF, Georgia, serif`;
  const MS = (s, w = 400) => `${w} ${s}px MS, Arial, sans-serif`;

  function T(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
    const ls = o.ls || 0; ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(str).width;
    const cx = o.align === 'center' ? x + ls / 2 : x;
    ctx.globalAlpha *= o.alpha ?? 1; ctx.fillStyle = o.fill || WHITE;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 24; }
    ctx.fillText(str, cx, y); ctx.restore(); return w;
  }
  function fit(str, maxW, size, fontFn, ls = 0) {
    ctx.save(); ctx.letterSpacing = ls + 'px'; let s = size;
    for (; s > 16; s -= 2) { ctx.font = fontFn(s); if (ctx.measureText(str).width <= maxW) break; }
    ctx.restore(); return s;
  }
  function measure(str, font, ls = 0) { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; }
  function wrapText(str, maxW, font) {
    ctx.save(); ctx.font = font; const words = str.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); ctx.restore(); return lines;
  }
  function rise(fn, y, lh, p) {
    if (p <= 0) return; const e = E.outQuart(p);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - lh * 0.58, W, lh * 1.16); ctx.clip();
    ctx.translate(0, (1 - e) * lh * 0.85); ctx.globalAlpha *= clamp(p * 2.5); fn(); ctx.restore();
  }
  const hair = (x, y, w, p, a = 1, lw = 1.5) => { if (p <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = WHITE; ctx.fillRect(x, y, w * p, lw); ctx.restore(); };
  const parseIt = str => str.split('*').map((s, i) => ({ s, it: i % 2 === 1 })).filter(x => x.s);
  function mixed(str, x, y, size, o = {}) {
    let cx = x; parseIt(str).forEach(sg => { cx += T(sg.s, cx, y, { ...o, font: PF(size, o.w || 400, sg.it), align: 'left' }); });
    return cx - x;
  }
  const plainOf = s => s.replace(/\*/g, '');
  const hasIt = s => s.includes('*');

  // ---------- chronologie ----------
  const scenes = [], events = []; let cur = 0;
  const addScene = (name, dur, draw, opt = {}) => {
    scenes.push({ name, t0: cur, t1: cur + dur, draw, label: opt.label || '', idx: scenes.length });
    (opt.events || []).forEach(([lt, type, n]) => events.push({ t: cur + lt, type, n: n || 0 })); cur += dur;
  };

  // Acte 1 : un « tic » par jour, un trait de rature, puis la phrase de chute
  const DAY0 = 0.5, DAYSTEP = 0.6;
  const loopEvents = [[0, 'drone', 0]];
  C.loop.days.forEach((_, i) => { const st = DAY0 + i * DAYSTEP; loopEvents.push([st, 'tick', i], [st + 0.55, 'swish', 0]); });
  loopEvents.push([4.3, 'low', 0]);
  addScene('boucle', 5.8, drawLoop, { label: '', events: loopEvents });
  // Acte 2 : le constat
  addScene('constat', 4.8, drawStatement, { events: [[0.2, 'low', 1], [0.55, 'tap'], [0.9, 'tap'], [1.7, 'chime', 0]] });
  // Acte 3 : l'écosystème (le son « s'ouvre » : piano et nappes entrent ici)
  addScene('ecosysteme', 7.8, drawEcosystem, { label: C.ecosystem.label, events: [[0.1, 'open', 0], [0.25, 'chime', 1], [1.5, 'chime', 2], [3.1, 'chime', 3], [4.7, 'chime', 4], [1.7, 'tap'], [3.3, 'tap'], [4.9, 'tap']] });
  // Acte 4 : appel à agir
  addScene('cta', 7.2, drawCta, { label: C.cta.label, events: [[0.2, 'tap'], [0.85, 'swish', 0], [1.45, 'chime', 5], [1.45, 'resolve', 0], [2.45, 'tap'], [3.1, 'chime', 3]] });
  const TOTAL = cur;
  window.TIMELINE = { total: TOTAL, fps: FPS, scenes: scenes.map(s => ({ name: s.name, t0: s.t0, t1: s.t1 })), events };
  const sceneAt = t => { for (const s of scenes) if (t < s.t1) return s; return scenes[scenes.length - 1]; };

  // ---------- décor : lumière diffuse, poussière, grain, cadre (identique à la vidéo promo) ----------
  const rs = mulberry32(5);
  const dust = Array.from({ length: 90 }, () => ({ x: rs() * W, y: rs() * (H + 200), sp: 6 + rs() * 16, r: 0.8 + rs() * 2.0, ph: rs() * 6.28, fx: 0.15 + rs() * 0.4, amp: 8 + rs() * 24, a: 0.10 + rs() * 0.28 }));
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const g = grain.getContext('2d'), im = g.createImageData(256, 256), r = mulberry32(99);
    for (let i = 0; i < 65536; i++) { const v = (r() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); }

  function drawBackground(t) {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    [[0.5 + 0.12 * Math.sin(t * 0.18), 0.34 + 0.05 * Math.cos(t * 0.13), 980, 0.075], [0.3 + 0.1 * Math.cos(t * 0.11), 0.82 + 0.04 * Math.sin(t * 0.16), 820, 0.05]].forEach(([ox, oy, r, a]) => {
      const cx = W * ox, cy = H * oy, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    for (const p of dust) {
      const y = (((p.y - t * p.sp) % (H + 200)) + (H + 200)) % (H + 200) - 100, x = p.x + Math.sin(t * p.fx + p.ph) * p.amp, a = p.a * (0.6 + 0.4 * Math.sin(t * 0.9 + p.ph));
      ctx.fillStyle = `rgba(255,255,255,${a * 0.2})`; ctx.beginPath(); ctx.arc(x, y, p.r * 3.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawChrome(t, s) {
    const a = E.outCubic(prog(t, 0.4, 1.2)); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const x0 = 46, y0 = 46, w = W - 92, h = H - 92, L = 2 * (w + h), p = E.inOut(prog(t, 0.3, 2.2));
    ctx.strokeStyle = LINE2; ctx.lineWidth = 1.5; ctx.setLineDash([L * p, L]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
    T(C.brand.name, 90, 104, { font: MS(20, 500), ls: 10, fill: G1 });
    if (s.label) T(s.label, W - 90, 104, { font: MS(20, 500), ls: 10, fill: G2, align: 'right' });
    ctx.fillStyle = LINE2; ctx.fillRect(90, 140, W - 180, 1.5); ctx.fillStyle = WHITE; ctx.globalAlpha = a * 0.85; ctx.fillRect(90, 140, (W - 180) * (t / TOTAL), 1.5);
    ctx.restore();
  }

  function drawFinish(t) {
    const v = ctx.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const f = Math.round(t * FPS); ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.translate(-Math.floor(hash(f) * 256), -Math.floor(hash(f + 91) * 256)); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
    const fo = prog(t, TOTAL - 1.2, 1.2); if (fo > 0) { ctx.fillStyle = `rgba(5,5,5,${E.inOut(fo)})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - prog(t, 0, 0.2); if (fi > 0) { ctx.fillStyle = `rgba(5,5,5,${fi})`; ctx.fillRect(0, 0, W, H); }
  }

  // ====================== SCÈNES ======================

  // ---- ACTE 1 : « demain » rayé, cinq jours de suite, et une petite horloge qui tique ----
  function drawLoop(lt) {
    const L = C.loop, x0 = 110;
    rise(() => T(L.intro, x0 - 3, 290, { font: PF(92, 400, true) }), 290, 108, prog(lt, 0.05, 0.7));
    hair(x0, 372, 860, E.inOut(prog(lt, 0.15, 0.8)), 0.7);
    // horloge : anneau fin + aiguille qui avance d'un cran à chaque jour
    { const cx = 940, cy = 292, r = 44, ap = E.outCubic(prog(lt, 0.1, 0.5));
      ctx.save(); ctx.globalAlpha *= ap; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
      let steps = 0; for (let i = 0; i < L.days.length; i++) { const d = prog(lt, DAY0 + i * DAYSTEP, 0.14); steps += E.outCubic(d); }
      const ang = -Math.PI / 2 + steps * (Math.PI * 2 / 5);
      ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * (r - 12), cy + Math.sin(ang) * (r - 12)); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, 6.283); ctx.fill(); ctx.restore(); }
    const size = fit(L.word, 760, 150, z => PF(z, 400, true)), ww = measure(L.word, PF(size, 400, true));
    L.days.forEach((d, i) => {
      const st = DAY0 + i * DAYSTEP, y = 600 + i * 226, p = prog(lt, st, 0.8), ty = y + 20;
      T(d, x0, y - 78, { font: MS(26, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, st, 0.5)) });
      const sp = prog(lt, st + 0.55, 0.32);
      ctx.save(); ctx.globalAlpha *= 1 - 0.62 * E.outCubic(sp);
      rise(() => T(L.word, x0 - 4, ty, { font: PF(size, 400, true) }), ty, size * 1.15, p);
      ctx.restore();
      if (sp > 0) { ctx.save(); ctx.fillStyle = WHITE; ctx.globalAlpha *= 0.95; ctx.fillRect(x0 - 16, ty - size * 0.075 - 2, (ww + 40) * E.inOut(sp), 4); ctx.restore(); }
      hair(x0, y + 92, 860, E.inOut(prog(lt, st + 0.1, 0.9)), 0.25, 1);
    });
    T(L.punch, x0, 1740, { font: PF(56, 400, true), fill: G1, alpha: E.outCubic(prog(lt, 4.3, 0.9)) });
  }

  // ---- ACTE 2 : le constat ----
  function drawStatement(lt) {
    const S = C.statement, n = S.length;
    const size = Math.min(...S.map(s => fit(plainOf(s), 860, 128, z => PF(z, 400, hasIt(s))))), lh = size * 1.22, y0 = H * 0.47 - (n * lh) / 2 + lh / 2;
    const times = [0.15, 0.5, 0.85, 1.7];
    const oa = 1 - E.inCubic(prog(lt, 4.3, 0.5));
    ctx.save(); ctx.globalAlpha *= oa;
    T('02', 110, y0 - lh * 0.95, { font: MS(24, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, 0, 0.5)) });
    hair(210, y0 - lh * 0.95 - 1, 760, E.inOut(prog(lt, 0.05, 0.9)), 0.7);
    S.forEach((ln, i) => rise(() => mixed(ln, 110, y0 + i * lh, size), y0 + i * lh, lh, prog(lt, times[i], 0.85)));
    hair(110, y0 + (n - 1) * lh + lh * 0.66, 860, E.inOut(prog(lt, 2.4, 1.0)), 0.8);
    ctx.restore();
  }

  // ---- ACTE 3 : l'écosystème ----
  function drawEcosystem(lt) {
    const X = C.ecosystem, x0 = 110;
    const size = Math.min(...X.lines.map(s => fit(plainOf(s), 860, 168, z => PF(z, 400, hasIt(s)))));
    X.lines.forEach((s, i) => { const y = 360 + i * (size * 1.12); rise(() => mixed(s, x0 - 4, y, size), y, size * 1.15, prog(lt, 0.2 + i * 0.28, 1.0)); });
    T(C.brand.sub, x0, 360 + 2 * size * 1.12 - 10, { font: MS(fit(C.brand.sub, 860, 23, z => MS(z, 400), 12), 400), ls: 12, fill: G1, alpha: E.outCubic(prog(lt, 1.0, 0.8)) });
    const hy = 360 + 2 * size * 1.12 + 50;
    hair(x0, hy, 860, E.inOut(prog(lt, 1.0, 1.0)), 0.8);
    const y0 = hy + 190, step = 320;
    X.pillars.forEach((p, i) => {
      const st = 1.5 + i * 1.6, y = y0 + i * step, pp = prog(lt, st, 0.9);
      T(String(i + 1).padStart(2, '0'), x0, y - 20, { font: MS(26, 300), ls: 6, fill: G2, alpha: E.outCubic(prog(lt, st, 0.6)) });
      const sz = fit(p.t, 720, 82, z => PF(z, 400, false));
      rise(() => T(p.t, x0 + 112, y - 22, { font: PF(sz, 400, false) }), y - 22, sz * 1.2, pp);
      const lines = wrapText(p.d, 740, MS(32, 300)).slice(0, 3);
      lines.forEach((ln, k) => T(ln, x0 + 112, y + 44 + k * 44, { font: MS(32, 300), fill: G1, alpha: E.outCubic(prog(lt, st + 0.25, 0.8)) }));
      hair(x0, y + 44 + lines.length * 44 + 22, 860, E.inOut(prog(lt, st + 0.1, 0.9)), 0.35, 1);
    });
  }

  // ---- ACTE 4 : « demain » est rayé, place à « aujourd'hui » ----
  function drawCta(lt) {
    const K = C.cta, x0 = 110;
    const sz1 = 210, ty = 430, w1 = measure(K.struck, PF(sz1, 400, true));
    ctx.save(); ctx.globalAlpha *= 1 - 0.62 * E.outCubic(prog(lt, 0.85, 0.32));
    rise(() => T(K.struck, x0 - 4, ty, { font: PF(sz1, 400, true) }), ty, sz1 * 1.15, prog(lt, 0.15, 0.9));
    ctx.restore();
    const sp = prog(lt, 0.85, 0.32);
    if (sp > 0) { ctx.save(); ctx.fillStyle = WHITE; ctx.globalAlpha *= 0.95; ctx.fillRect(x0 - 16, ty - sz1 * 0.075 - 2, (w1 + 40) * E.inOut(sp), 5); ctx.restore(); }
    const size = fit(plainOf(K.now), 860, 200, z => PF(z, 400, true)), ny = 690;
    ctx.save(); const gp = E.outCubic(prog(lt, 1.45, 1.0));
    rise(() => mixed(K.now, x0 - 4, ny, size, { glow: 'rgba(255,255,255,.35)', glowBlur: 36 * gp }), ny, size * 1.15, prog(lt, 1.45, 1.0));
    ctx.restore();
    hair(x0, 850, 860, E.inOut(prog(lt, 1.9, 1.0)), 0.8);
    // bouton : pastille blanche, texte noir, flèche qui respire
    const bp = E.outCubic(prog(lt, 2.4, 0.9)), bw = 860, bh = 132, by = 1010;
    if (bp > 0) {
      ctx.save(); ctx.globalAlpha *= bp; ctx.translate(0, (1 - bp) * 24);
      ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = 40 + 14 * Math.sin(lt * 2.2); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.roundRect(x0, by - bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      const bs = fit(K.button, 640, 33, z => MS(z, 600), 10);
      const tw = T(K.button, x0 + bw / 2 - 30, by + 1, { font: MS(bs, 600), ls: 10, fill: '#050505', align: 'center' });
      const ax = x0 + bw / 2 - 30 + tw / 2 + 48 + 5 * Math.sin(lt * 2.2);
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(ax - 24, by + 1); ctx.lineTo(ax + 18, by + 1); ctx.moveTo(ax + 4, by - 14); ctx.lineTo(ax + 20, by + 1); ctx.lineTo(ax + 4, by + 16); ctx.stroke();
      ctx.restore();
    }
    const url = C.brand.url, us = fit(url, 860, 112, z => PF(z, 400, true)), up = prog(lt, 3.2, 1.3);
    rise(() => T(url, x0 - 4, 1250, { font: PF(us, 400, true) }), 1250, us * 1.2, up);
    hair(x0, 1322, 860 * 0.5, E.inOut(prog(lt, 3.8, 1.0)), 0.8);
    T(C.brand.name, x0, 1385, { font: MS(21, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, 4.1, 0.8)) });
    T(C.brand.sub, x0, 1432, { font: MS(fit(C.brand.sub, 860, 20, z => MS(z, 400), 10), 400), ls: 10, fill: G2, alpha: E.outCubic(prog(lt, 4.3, 0.8)) });
    wrapText(K.legal, 860, MS(23, 300)).forEach((ln, k) => T(ln, x0, 1560 + k * 34, { font: MS(23, 300), fill: G2, alpha: E.outCubic(prog(lt, 4.6, 0.9)) }));
  }

  // ---------- rendu principal ----------
  window.renderFrame = t => {
    t = clamp(t, 0, TOTAL - 1e-3);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
    const s = sceneAt(t), lt = t - s.t0, dur = s.t1 - s.t0;
    drawBackground(t);
    ctx.save();
    const zoom = 1 + 0.028 * (lt / dur), fin = s.idx === 0 ? 1 : E.outCubic(prog(lt, 0, 0.7)), fout = s.idx === scenes.length - 1 ? 1 : 1 - E.inOut(prog(lt, dur - 0.45, 0.45));
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2 + (1 - fin) * 26);
    ctx.globalAlpha = fin * fout; s.draw(lt, dur);
    ctx.restore();
    ctx.globalAlpha = 1; drawChrome(t, s); drawFinish(t);
  };

  window.ready = Promise.all([
    document.fonts.load('400 100px PF'), document.fonts.load('italic 400 100px PF'), document.fonts.load('500 100px PF'), document.fonts.load('italic 500 100px PF'),
    document.fonts.load('300 30px MS'), document.fonts.load('400 30px MS'), document.fonts.load('500 30px MS'), document.fonts.load('600 30px MS'),
  ]).then(() => { window.renderFrame(0); return true; });
})();
