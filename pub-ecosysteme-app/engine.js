// Pub « animation d'application » pour l'écosystème MATHISDGTMK — 1080x1920, 23 s.
// renderFrame(t) dessine l'image à l'instant t (secondes), de façon déterministe.
(() => {
  'use strict';
  const C = window.CONTENT;
  const W = 1080, H = 1920, FPS = C.fps, TOTAL = 23.0;
  const cv = document.getElementById('c');
  const mainCtx = cv.getContext('2d');
  let ctx = mainCtx;

  // ---------- palette & utilitaires ----------
  const WHITE = '#f4f6fb', ICE = '#dfe6ff', BLUE = '120,140,255';
  const G1 = 'rgba(232,236,248,.68)', G2 = 'rgba(232,236,248,.42)', LINE = 'rgba(232,236,248,.22)';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, s, d) => clamp((t - s) / d);
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outCubic: x => 1 - Math.pow(1 - x, 3),
    outQuart: x => 1 - Math.pow(1 - x, 4),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inCubic: x => x * x * x,
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
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
    if (o.blur) ctx.filter = `blur(${o.blur}px)`;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 24; }
    ctx.fillText(str, cx, y); ctx.restore(); return w;
  }
  function fit(str, maxW, size, fontFn, ls = 0) {
    ctx.save(); ctx.letterSpacing = ls + 'px'; let s = size;
    for (; s > 16; s -= 2) { ctx.font = fontFn(s); if (ctx.measureText(str).width <= maxW) break; }
    ctx.restore(); return s;
  }
  function measure(str, font, ls = 0) { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  function check(cx, cy, s, col, lw = 3.2) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy + s * 0.02); ctx.lineTo(cx - s * 0.12, cy + s * 0.4); ctx.lineTo(cx + s * 0.55, cy - s * 0.4); ctx.stroke(); ctx.restore();
  }

  // ---------- chronologie (secondes) ----------
  const T_ = {
    header: 0.15, headerOut: 15.0,
    hookIn: 0.45, strike: 1.15, hookOut: 1.72,
    burst: 1.78, wordIn: 2.05, wordOut: 3.5,
    terrainIn: 3.3, arc: 3.5, arcEnd: 4.45, terrainOut: 5.0,
    phoneOutline: 4.7, phoneIn: 5.15, screenB: 8.6, screenC: 11.8, phoneOut: 15.0,
    goal: [5.45, 8.45], plan: [8.7, 11.6], follow: [11.9, 14.8], formulas: [15.3, 17.8],
    cards: 15.25, cardsOut: 17.9, end: 17.85,
  };
  // événements sonores (lus par audio.py)
  const events = [];
  const ev = (t, type, n = 0) => events.push({ t, type, n });
  ev(0.15, 'pop'); ev(0.45, 'pop'); ev(0.9, 'riser', 0); ev(1.15, 'swish'); ev(1.78, 'impact');
  ev(2.05, 'shimmer'); ev(3.3, 'whoosh'); ev(3.5, 'sweep'); ev(3.45, 'pop'); ev(4.4, 'pop');
  ev(4.7, 'whoosh'); ev(5.15, 'hit', 0);
  [T_.goal[0], T_.plan[0], T_.follow[0], T_.formulas[0]].forEach((t, i) => { ev(t, 'punch', i); });
  for (let k = 0; k < 18; k++) ev(6.25 + k * 0.055, 'type');
  [7.0, 7.35, 7.7].forEach((t, i) => ev(t, 'check', i)); ev(8.2, 'press'); ev(8.3, 'pop'); ev(8.33, 'ding', 2);
  ev(8.6, 'whoosh');
  [0, 1, 2, 3].forEach(k => ev(9.35 + k * 0.5, 'check', 2 + k)); ev(11.2, 'pop'); ev(11.23, 'ding', 4);
  ev(11.8, 'whoosh'); ev(12.6, 'check', 3); ev(13.15, 'check', 5); ev(13.3, 'sweep'); ev(14.3, 'pop'); ev(14.33, 'ding', 5);
  ev(15.0, 'whoosh'); ev(15.25, 'whoosh'); ev(16.1, 'ding', 3); ev(16.6, 'ding', 4);
  ev(17.85, 'impact'); ev(18.45, 'tick', 0); ev(18.85, 'tick', 1); ev(19.25, 'tick', 2); ev(20.0, 'pop'); ev(20.05, 'ding', 5); ev(20.6, 'ding', 2);
  window.TIMELINE = { total: TOTAL, fps: FPS, events, risers: [[0.9, 1.78], [3.0, 3.5], [14.5, 15.25], [17.2, 17.85]] };

  // ---------- décor ----------
  const rs = mulberry32(7);
  const dust = Array.from({ length: 80 }, () => ({ x: rs() * W, y: rs() * (H + 200), sp: 8 + rs() * 22, r: 0.8 + rs() * 2.0, ph: rs() * 6.28, fx: 0.15 + rs() * 0.4, amp: 8 + rs() * 24, a: 0.10 + rs() * 0.26 }));
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const g = grain.getContext('2d'), im = g.createImageData(256, 256), r = mulberry32(99);
    for (let i = 0; i < 65536; i++) { const v = (r() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); }

  function drawBackground(t) {
    ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const glows = [[0.5 + 0.1 * Math.sin(t * 0.2), 0.62 + 0.04 * Math.cos(t * 0.15), 1000, 0.085], [0.25 + 0.08 * Math.cos(t * 0.12), 0.2, 700, 0.045], [0.8, 0.9 + 0.03 * Math.sin(t * 0.18), 760, 0.05]];
    glows.forEach(([ox, oy, r, a]) => {
      const cx = W * ox, cy = H * oy, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${BLUE},${a})`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    for (const p of dust) {
      const y = (((p.y - t * p.sp) % (H + 200)) + (H + 200)) % (H + 200) - 100, x = p.x + Math.sin(t * p.fx + p.ph) * p.amp, a = p.a * (0.6 + 0.4 * Math.sin(t * 0.9 + p.ph));
      ctx.fillStyle = `rgba(210,220,255,${a * 0.18})`; ctx.beginPath(); ctx.arc(x, y, p.r * 3.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(230,236,255,${a})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawFinish(t) {
    const v = ctx.createRadialGradient(W / 2, H / 2, 600, W / 2, H / 2, 1350); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const f = Math.round(t * FPS); ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.translate(-Math.floor(hash(f) * 256), -Math.floor(hash(f + 91) * 256)); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
    const fo = prog(t, TOTAL - 0.9, 0.9); if (fo > 0) { ctx.fillStyle = `rgba(3,4,10,${E.inOut(fo)})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - prog(t, 0, 0.18); if (fi > 0) { ctx.fillStyle = `rgba(3,4,10,${fi})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- briques graphiques ----------
  function glass(x, y, w, h, r, o = {}) {
    ctx.save();
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 40; }
    rr(x, y, w, h, r); ctx.fillStyle = o.fill || 'rgba(12,16,32,.82)'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = o.stroke || 'rgba(214,224,255,.34)'; ctx.lineWidth = o.lw ?? 2; ctx.stroke(); ctx.restore();
  }
  function sparks(cx, cy, t0, t, n = 14, spread = 120, seed = 1) {
    const p = (t - t0) / 0.9; if (p <= 0 || p >= 1) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = hash(seed * 31 + i) * 6.283, d = (0.35 + hash(seed * 17 + i * 3) * 0.65) * spread * E.outCubic(p), s = 1.5 + hash(seed + i * 7) * 2.6;
      ctx.globalAlpha = (1 - p) * 0.9; ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d - 20 * p, s, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  // pastille flottante (notification) : renvoie sa largeur
  function pill(main, x, y, t0, t, o = {}) {
    const p = prog(t, t0, 0.5); if (p <= 0) return;
    const e = E.outBack(p), tagW = o.tag ? measure(o.tag, MS(17, 700), 5) + 34 : 0;
    const fs = o.size || 36, tw = measure(main, MS(fs, 700)), w = tw + 130 + tagW, h = o.h || 104;
    const out = o.out ? prog(t, o.out, 0.35) : 0;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2.2) * (1 - E.inCubic(out)); ctx.translate(x, y + (1 - E.outCubic(p)) * 40 - out * 24); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
    glass(-w / 2, -h / 2, w, h, h / 2, { glow: `rgba(${BLUE},.55)`, glowBlur: 46 });
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(-w / 2 + h / 2, 0, h * 0.27, 0, 6.283); ctx.fill();
    check(-w / 2 + h / 2, 1, h * 0.28, '#05060c', 4);
    T(main, -w / 2 + h * 0.9, 2, { font: MS(fs, 700) });
    if (o.tag) { const bx = w / 2 - tagW - 18; ctx.save(); rr(bx, -22, tagW, 44, 22); ctx.strokeStyle = 'rgba(214,224,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); T(o.tag, bx + tagW / 2, 2, { font: MS(17, 700), ls: 5, align: 'center', fill: G1 }); }
    ctx.restore();
    sparks(x, y, t0 + 0.05, t, 12, 150, Math.round(x + y));
  }
  // mot-choc : flou → net, léger rebond
  function word(str, win, t, y = 590) {
    const [a, b] = win; if (t < a || t > b + 0.4) return;
    const pin = prog(t, a, 0.45), pout = prog(t, b, 0.35);
    const size = fit(str, 880, 150, z => MS(z, 800), -5);
    ctx.save(); ctx.globalAlpha *= clamp(pin * 2) * (1 - E.inCubic(pout));
    ctx.translate(W / 2, y + (1 - E.outCubic(pin)) * 36 - pout * 26); const sc = 0.9 + 0.1 * E.outBack(pin); ctx.scale(sc, sc);
    ctx.font = MS(size, 800); ctx.letterSpacing = '-5px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a9b6e0');
    ctx.filter = `blur(${(1 - E.outCubic(pin)) * 14}px)`; ctx.shadowColor = `rgba(${BLUE},.6)`; ctx.shadowBlur = 36; ctx.fillStyle = g; ctx.fillText(str, 0, 0);
    ctx.restore();
  }
  // image plane en perspective (rotation autour de l'axe vertical) : bandes verticales mises à l'échelle
  function tilted(src, cx, cy, sc, rotY, roll = 0, alpha = 1) {
    const w = src.width, h = src.height, d = 2300, c = Math.cos(rotY), s = Math.sin(rotY), step = 4;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll); ctx.globalAlpha *= alpha;
    for (let sx = 0; sx < w; sx += step) {
      const xa = (sx - w / 2) * sc, xb = (sx + step - w / 2) * sc;
      const ka = d / (d + xa * s), kb = d / (d + xb * s), Xa = xa * c * ka, Xb = xb * c * kb, hh = h * sc * (ka + kb) / 2;
      ctx.drawImage(src, sx, 0, step, h, Xa, -hh / 2, Math.abs(Xb - Xa) + 0.9, hh);
    }
    ctx.restore();
  }

  // ====================== ACCROCHE : « Demain. » rayé, puis éclatement de la marque ======================
  function drawHook(t) {
    // petit point lumineux avant l'apparition
    const dotA = E.outCubic(prog(t, 0.0, 0.4)) * (1 - prog(t, T_.hookIn, 0.2));
    if (dotA > 0) { ctx.save(); ctx.globalAlpha *= dotA; ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 40; ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(W / 2, 960, 9, 0, 6.283); ctx.fill(); ctx.restore(); }
    const p = prog(t, T_.hookIn, 0.5), out = prog(t, T_.hookOut - 0.15, 0.4);
    if (p > 0 && out < 1) {
      const e = E.outBack(p), w = 640, h = 230, sc = (0.78 + 0.22 * e) * (1 - 0.8 * E.inCubic(out));
      ctx.save(); ctx.translate(W / 2, 960); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(p * 2) * (1 - E.inCubic(out));
      glass(-w / 2, -h / 2, w, h, h / 2, { glow: `rgba(${BLUE},.5)`, glowBlur: 60 });
      const sp = prog(t, T_.strike, 0.3);
      ctx.save(); ctx.globalAlpha *= 1 - 0.5 * E.outCubic(sp);
      T(C.hook.word, 0, 4, { font: MS(112, 700), align: 'center', ls: -3 }); ctx.restore();
      if (sp > 0) { const tw = measure(C.hook.word, MS(112, 700), -3); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; ctx.fillStyle = WHITE; ctx.fillRect(-tw / 2 - 20, -2, (tw + 40) * E.inOut(sp), 6); ctx.restore(); }
      ctx.restore();
    }
  }
  function drawBurst(t) {
    const lt = t - T_.burst; if (lt < -0.05 || t > T_.wordOut + 0.6) return;
    const cx = W / 2, cy = 960;
    // éclat central
    const fl = 1 - prog(t, T_.burst, 0.7);
    if (fl > 0) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520); g.addColorStop(0, `rgba(255,255,255,${0.75 * fl})`); g.addColorStop(0.3, `rgba(${BLUE},${0.35 * fl})`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // rayons
    const rp = E.outQuart(prog(t, T_.burst, 1.1)), ra = 1 - E.inCubic(prog(t, T_.burst + 0.5, 0.9));
    if (rp > 0 && ra > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 132; i++) {
        const a = (i / 132) * 6.283 + hash(i) * 0.04, len = 180 + hash(i * 3 + 1) * 620, r0 = 70 + hash(i * 5) * 60;
        const s0 = r0 + rp * len * 0.55, s1 = r0 + rp * len;
        ctx.strokeStyle = `rgba(${i % 3 ? '190,205,255' : '255,255,255'},${ra * (0.35 + 0.5 * hash(i * 9))})`; ctx.lineWidth = i % 5 === 0 ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s0, cy + Math.sin(a) * s0); ctx.lineTo(cx + Math.cos(a) * s1, cy + Math.sin(a) * s1); ctx.stroke();
      }
      ctx.restore();
    }
    // nom de marque : flou → net, espacement qui se resserre
    const wp = E.outCubic(prog(t, T_.wordIn, 0.9)), wo = prog(t, T_.wordOut, 0.4);
    if (wp > 0 && wo < 1) {
      const ls = lerp(46, 10, wp), size = fit(C.brand.name, 900, 118, z => MS(z, 800), ls);
      ctx.save(); ctx.globalAlpha *= (1 - E.inCubic(wo)); ctx.translate(0, -wo * 40);
      T(C.brand.name, cx, cy - 8, { font: MS(size, 800), ls, align: 'center', alpha: clamp(wp * 1.6), blur: (1 - wp) * 16, glow: `rgba(${BLUE},.7)`, glowBlur: 44 });
      T(C.brand.sub, cx, cy + 82, { font: MS(fit(C.brand.sub, 880, 24, z => MS(z, 500), 12), 500), ls: 12, align: 'center', fill: G1, alpha: E.outCubic(prog(t, T_.wordIn + 0.5, 0.7)) });
      ctx.restore();
    }
  }

  // ====================== CARTE EN POINTS + ARC LUMINEUX ======================
  const GX = 17, GY = 17, GRID_W = 58, GRID_H = 60, GX0 = 46, GY0 = 600;
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const h = (a, b) => hash(a * 57.1 + b * 113.7); return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
  const dots = [];
  for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) {
    const n = 0.5 * vnoise(i * 0.13, j * 0.13) + 0.3 * vnoise(i * 0.27 + 9, j * 0.27 + 4) + 0.2 * vnoise(i * 0.55 + 3, j * 0.55 + 8);
    if (n > 0.5) dots.push({ x: GX0 + i * GX, y: GY0 + j * GY, k: n });
  }
  const PA = { x: 250, y: 1400 }, PB = { x: 800, y: 880 }, PC = { x: 250, y: 840 };
  const bez = k => ({ x: (1 - k) * (1 - k) * PA.x + 2 * (1 - k) * k * PC.x + k * k * PB.x, y: (1 - k) * (1 - k) * PA.y + 2 * (1 - k) * k * PC.y + k * k * PB.y });
  function drawTerrain(t) {
    const pin = prog(t, T_.terrainIn, 0.7), pout = prog(t, T_.terrainOut - 0.4, 0.5); if (pin <= 0 || pout >= 1) return;
    const arcP = E.inOut(prog(t, T_.arc, T_.arcEnd - T_.arc));
    ctx.save(); ctx.globalAlpha *= pin * (1 - pout);
    const head = bez(arcP);
    for (const d of dots) {
      const fx = Math.min(d.x - 30, W - 30 - d.x) / 200, fy = Math.min(d.y - GY0, GY0 + GRID_H * GY - d.y) / 160, edge = clamp(Math.min(fx, fy));
      const near = Math.exp(-(((d.x - head.x) ** 2 + (d.y - head.y) ** 2) / (2 * 150 * 150)));
      const a = (0.30 + 0.42 * d.k) * edge + 0.6 * near * arcP; if (a < 0.02) continue;
      ctx.fillStyle = near > 0.4 ? `rgba(225,232,255,${a})` : `rgba(150,170,255,${a})`;
      const s = 3.2 + near * 3; ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s);
    }
    // arc : traînée lumineuse + tête
    if (arcP > 0) {
      ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? 3 : 14; ctx.strokeStyle = pass ? 'rgba(235,240,255,.95)' : `rgba(${BLUE},.28)`;
        ctx.beginPath(); for (let i = 0; i <= 60; i++) { const q = bez((i / 60) * arcP); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); } ctx.stroke();
      }
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 30; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head.x, head.y, 9, 0, 6.283); ctx.fill(); ctx.restore();
    }
    // points d'extrémité + étiquettes
    [[PA, C.terrain.from, 3.4], [PB, C.terrain.to, T_.arcEnd - 0.05]].forEach(([P, label, t0], i) => {
      const p = prog(t, t0, 0.45); if (p <= 0) return; const e = E.outBack(p), w = measure(label, MS(32, 700)) + 80, h = 76;
      ctx.save(); ctx.translate(P.x, P.y); ctx.fillStyle = WHITE; ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 26; ctx.beginPath(); ctx.arc(0, 0, 12 * e, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      ctx.translate(i ? -w / 2 + 40 : w / 2 - 40, i ? -86 : 86); ctx.globalAlpha *= clamp(p * 2); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
      glass(-w / 2, -h / 2, w, h, h / 2, { glow: `rgba(${BLUE},.45)`, glowBlur: 34 }); T(label, 0, 2, { font: MS(32, 700), align: 'center' }); ctx.restore();
    });
    ctx.restore();
  }

  // ====================== TÉLÉPHONE (offscreen 560x1010, rendu en perspective) ======================
  const PW = 560, PH = 1010, PHONE = { x: 540, y: 1250 };
  const phoneCv = document.createElement('canvas'); phoneCv.width = PW; phoneCv.height = PH; const pctx = phoneCv.getContext('2d');
  const cardCv = document.createElement('canvas'); cardCv.width = 820; cardCv.height = 340; const cctx = cardCv.getContext('2d');
  const ease = x => E.inOut(clamp(x));

  function uiFrame(lt, title, label) {
    ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, PW, PH);
    const g = ctx.createRadialGradient(PW * 0.7, 140, 0, PW * 0.7, 140, 520); g.addColorStop(0, `rgba(${BLUE},.20)`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    T('09:41', 66, 56, { font: MS(22, 700) });
    for (let i = 0; i < 4; i++) { ctx.fillStyle = WHITE; ctx.fillRect(420 + i * 9, 62 - (6 + i * 4), 6, 6 + i * 4); }
    ctx.strokeStyle = G1; ctx.lineWidth = 2; rr(468, 45, 40, 20, 6); ctx.stroke(); ctx.fillStyle = WHITE; rr(471, 48, 28, 14, 4); ctx.fill();
    const a = E.outCubic(prog(lt, 0, 0.5)); ctx.save(); ctx.globalAlpha *= a;
    T(title, 44, 142, { font: MS(44, 800), ls: -1 }); T(label, 44, 206, { font: MS(18, 700), ls: 5, fill: G2 }); ctx.restore();
  }
  function screenGoal(lt) {
    const S = C.screens.goal; uiFrame(lt, S.nav, S.label);
    // carte objectif + texte qui se tape
    const cp = E.outCubic(prog(lt, 0.25, 0.6)); ctx.save(); ctx.globalAlpha *= cp; ctx.translate(0, (1 - cp) * 24);
    glass(34, 244, 492, 196, 30, { fill: 'rgba(255,255,255,.06)', stroke: 'rgba(214,224,255,.2)', lw: 1.5 });
    T('MON OBJECTIF', 64, 286, { font: MS(17, 700), ls: 5, fill: G2 });
    const n = Math.floor(S.value.length * prog(lt, 0.75, 1.0)), txt = S.value.slice(0, n);
    const tw = T(txt, 64, 356, { font: PF(52, 700, true) });
    if (Math.floor(lt * 2.4) % 2 === 0 || n < S.value.length) { ctx.fillStyle = WHITE; ctx.fillRect(68 + tw, 326, 4, 58); }
    ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(64, 408, 432, 8, 4); ctx.fill(); ctx.fillStyle = WHITE; rr(64, 408, 432 * ease(prog(lt, 0.8, 1.8)), 8, 4); ctx.fill();
    ctx.restore();
    // lignes à cocher (offre réelle : objectifs, produit, boutique / offre B2B)
    S.checks.forEach((c, i) => {
      const st = 0.5 + i * 0.12, y = 520 + i * 96, p = E.outCubic(prog(lt, st, 0.5)), ck = prog(lt, 1.5 + i * 0.35, 0.3), e = E.outBack(ck);
      ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 30, 0);
      glass(34, y - 36, 492, 72, 24, { fill: 'rgba(255,255,255,.05)', stroke: 'rgba(214,224,255,.14)', lw: 1.5 });
      ctx.strokeStyle = G2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(80, y, 22, 0, 6.283); ctx.stroke();
      if (ck > 0) { ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(80, y, 22 * e, 0, 6.283); ctx.fill(); check(80, y + 1, 24 * e, '#05060c', 4); }
      T(c, 124, y + 2, { font: MS(fit(c, 360, 29, z => MS(z, 600)), 600), alpha: 0.55 + 0.45 * ck });
      ctx.restore();
    });
    // bouton principal (appui)
    const bp = E.outCubic(prog(lt, 0.9, 0.6)), press = Math.sin(Math.PI * clamp((lt - 2.7) / 0.28));
    ctx.save(); ctx.globalAlpha *= bp; ctx.translate(PW / 2, 902); const sc = 1 - 0.05 * press; ctx.scale(sc, sc);
    ctx.shadowColor = `rgba(${BLUE},${0.5 + 0.4 * press})`; ctx.shadowBlur = 30 + 30 * press;
    const gb = ctx.createLinearGradient(0, -48, 0, 48); gb.addColorStop(0, '#ffffff'); gb.addColorStop(1, '#cdd6f6'); ctx.fillStyle = gb; rr(-246, -48, 492, 96, 48); ctx.fill(); ctx.shadowBlur = 0;
    T(S.button, 0, 2, { font: MS(32, 700), align: 'center', fill: '#05060c' }); ctx.restore();
  }
  function screenPlan(lt) {
    const S = C.screens.plan; uiFrame(lt, S.nav, S.label);
    const n = S.steps.length, done = S.steps.map((_, k) => ease(prog(lt, 0.75 + k * 0.5, 0.35)));
    const p = done.reduce((a, b) => a + b, 0) / n, cx = 280, cy = 410, R = 118;
    const ra = E.outCubic(prog(lt, 0.2, 0.6)); ctx.save(); ctx.globalAlpha *= ra;
    ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    if (p > 0) { ctx.save(); ctx.shadowColor = `rgba(${BLUE},.9)`; ctx.shadowBlur = 30; ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); ctx.stroke(); ctx.restore(); }
    T(Math.round(p * 100) + ' %', cx, cy - 4, { font: MS(72, 800), align: 'center', ls: -2 }); T('du plan', cx, cy + 56, { font: MS(21, 600), align: 'center', fill: G2, ls: 2 });
    ctx.restore();
    S.steps.forEach((s, k) => {
      const y = 640 + k * 88, st = 0.35 + k * 0.12, pp = E.outCubic(prog(lt, st, 0.5)), d = done[k], cur = d < 0.99 && (k === 0 || done[k - 1] > 0.99);
      ctx.save(); ctx.globalAlpha *= pp; ctx.translate((1 - pp) * 30, 0);
      glass(34, y - 36, 492, 72, 24, { fill: cur ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)', stroke: cur ? 'rgba(235,240,255,.55)' : 'rgba(214,224,255,.14)', lw: cur ? 2.2 : 1.5 });
      ctx.strokeStyle = G2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(80, y, 20, 0, 6.283); ctx.stroke();
      if (d > 0) { const e = E.outBack(d); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(80, y, 20 * e, 0, 6.283); ctx.fill(); check(80, y + 1, 22 * e, '#05060c', 3.6); }
      T(String(k + 1).padStart(2, '0'), 124, y + 2, { font: MS(20, 600), ls: 3, fill: G2 }); T(s, 170, y + 2, { font: MS(fit(s, 330, 29, z => MS(z, 600)), 600), alpha: 0.6 + 0.4 * Math.max(d, cur ? 1 : 0) });
      ctx.restore();
    });
  }
  function screenFollow(lt) {
    const S = C.screens.follow; uiFrame(lt, S.nav, S.label);
    const cw = 62, gap = (492 - 7 * cw) / 6, sel = S.meetings.map((m, i) => ease(prog(lt, 0.8 + i * 0.6, 0.35)));
    S.days.forEach((d, i) => {
      const x = 34 + i * (cw + gap), k = S.meetings.findIndex(m => m.day === i), on = k >= 0 ? sel[k] : 0, p = E.outCubic(prog(lt, 0.2 + i * 0.05, 0.4));
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 16);
      rr(x, 240, cw, 104, 24); ctx.fillStyle = on > 0 ? `rgba(244,246,251,${0.12 + 0.88 * on})` : 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(214,224,255,.16)'; ctx.lineWidth = 1.5; ctx.stroke();
      T(d, x + cw / 2, 276, { font: MS(25, 700), align: 'center', fill: on > 0.5 ? '#05060c' : G1 });
      ctx.fillStyle = on > 0.5 ? '#05060c' : 'rgba(232,236,248,.3)'; ctx.beginPath(); ctx.arc(x + cw / 2, 318, 5 + 2 * on, 0, 6.283); ctx.fill(); ctx.restore();
    });
    S.meetings.forEach((m, i) => {
      const y = 372 + i * 114, p = E.outCubic(prog(lt, 0.9 + i * 0.6, 0.55)), ck = prog(lt, 1.35 + i * 0.6, 0.3);
      ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 40, 0);
      glass(34, y, 492, 98, 28, { fill: 'rgba(255,255,255,.06)', stroke: 'rgba(214,224,255,.2)', lw: 1.5 });
      ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(56, y + 22, 54, 54, 16); ctx.fill(); ctx.strokeStyle = G1; ctx.lineWidth = 2.5; rr(66, y + 33, 34, 32, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(66, y + 44); ctx.lineTo(100, y + 44); ctx.stroke();
      T(m.t, 132, y + 36, { font: MS(26, 700) }); T(m.d, 132, y + 68, { font: MS(21, 500), fill: G1 });
      if (ck > 0) { const e = E.outBack(ck); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(490, y + 49, 20 * e, 0, 6.283); ctx.fill(); check(490, y + 50, 22 * e, '#05060c', 3.6); }
      ctx.restore();
    });
    // courbe « analyse des performances » (illustrative, sans chiffres)
    const lp = E.outCubic(prog(lt, 1.3, 0.5)); ctx.save(); ctx.globalAlpha *= lp;
    T(S.chart.toUpperCase(), 44, 646, { font: MS(18, 700), ls: 5, fill: G2 });
    const x0 = 44, x1 = 516, y0 = 700, y1 = 930, pts = [0.82, 0.74, 0.78, 0.6, 0.55, 0.46, 0.4, 0.24, 0.12];
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { const y = y0 + (y1 - y0) * i / 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    const dp = ease(prog(lt, 1.5, 1.1)), seg = pts.length - 1, upto = dp * seg;
    const P = i => ({ x: x0 + (x1 - x0) * i / seg, y: y0 + (y1 - y0) * pts[i] });
    const path = () => { ctx.beginPath(); ctx.moveTo(P(0).x, P(0).y); for (let i = 1; i <= Math.floor(upto); i++) ctx.lineTo(P(i).x, P(i).y); const fi = Math.floor(upto), fr = upto - fi; if (fi < seg) { const a = P(fi), b = P(fi + 1); ctx.lineTo(lerp(a.x, b.x, fr), lerp(a.y, b.y, fr)); } };
    const gf = ctx.createLinearGradient(0, y0, 0, y1); gf.addColorStop(0, `rgba(${BLUE},.35)`); gf.addColorStop(1, `rgba(${BLUE},0)`);
    path(); ctx.lineTo(lerp(P(Math.min(seg, Math.floor(upto))).x, P(Math.min(seg, Math.floor(upto) + 1)).x, upto - Math.floor(upto)), y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fillStyle = gf; ctx.fill();
    ctx.save(); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WHITE; ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 20; path(); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function drawPhoneUI(t) {
    const prev = ctx; ctx = pctx; pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, PW, PH); pctx.globalAlpha = 1; pctx.shadowBlur = 0; pctx.filter = 'none';
    const bg = pctx.createLinearGradient(0, 0, PW, PH); bg.addColorStop(0, '#141829'); bg.addColorStop(1, '#05060c');
    pctx.fillStyle = bg; rr(2, 2, PW - 4, PH - 4, 86); pctx.fill(); pctx.strokeStyle = 'rgba(214,224,255,.5)'; pctx.lineWidth = 3; pctx.stroke();
    pctx.save(); rr(14, 14, PW - 28, PH - 28, 74); pctx.clip();
    const sc = t < T_.screenB ? 0 : t < T_.screenC ? 1 : 2, starts = [T_.phoneIn + 0.35, T_.screenB, T_.screenC], lt = t - starts[sc];
    // fondu enchaîné entre écrans
    const fns = [screenGoal, screenPlan, screenFollow];
    const tr = sc > 0 ? prog(t, starts[sc], 0.4) : 1;
    if (sc > 0 && tr < 1) { pctx.save(); pctx.globalAlpha = 1 - tr; pctx.translate(-50 * E.inOut(tr), 0); fns[sc - 1](t - starts[sc - 1]); pctx.restore(); }
    pctx.save(); pctx.globalAlpha = tr; pctx.translate(sc > 0 ? 50 * (1 - E.inOut(tr)) : 0, 0); fns[sc](Math.max(0, lt)); pctx.restore();
    pctx.restore();
    pctx.fillStyle = '#000'; rr(205, 30, 150, 40, 20); pctx.fill();
    ctx = prev;
  }
  function drawPhone(t) {
    const t0 = T_.phoneOutline, tEnd = T_.phoneOut + 0.55; if (t < t0 || t > tEnd) return;
    const outlineP = ease(prog(t, t0, 0.55)), inP = E.outCubic(prog(t, T_.phoneIn, 0.8)), outP = prog(t, T_.phoneOut, 0.55);
    const rotY = lerp(-0.95, -0.2, E.outQuart(prog(t, T_.phoneIn - 0.1, 1.2))) + 0.045 * Math.sin(t * 0.9) + outP * 0.5;
    const roll = -0.03 + 0.012 * Math.sin(t * 0.7), cy = PHONE.y + (1 - E.outCubic(prog(t, T_.phoneIn - 0.1, 1.0))) * 70 - 8 * Math.sin(t * 1.1) + outP * 40, sc = lerp(0.82, 1.0, E.outCubic(prog(t, T_.phoneIn - 0.1, 1.0))) * (1 - 0.1 * outP);
    // halo
    ctx.save(); ctx.globalAlpha *= inP * (1 - outP); const g = ctx.createRadialGradient(PHONE.x, cy, 0, PHONE.x, cy, 640); g.addColorStop(0, `rgba(${BLUE},.26)`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, cy - 700, W, 1400); ctx.restore();
    if (inP < 1) {   // contour lumineux qui se trace, avant que le téléphone se remplisse
      ctx.save(); ctx.globalAlpha *= (1 - inP); ctx.translate(PHONE.x, cy); ctx.scale(sc, sc); ctx.shadowColor = `rgba(${BLUE},1)`; ctx.shadowBlur = 26; ctx.strokeStyle = ICE; ctx.lineWidth = 4;
      const per = 2 * (PW + PH); ctx.setLineDash([per * outlineP, per]); rr(-PW / 2, -PH / 2, PW, PH, 86); ctx.stroke(); ctx.restore();
    }
    if (inP > 0) { drawPhoneUI(t); ctx.save(); ctx.globalAlpha *= inP * (1 - outP); tilted(phoneCv, PHONE.x, cy, sc, rotY, roll); ctx.restore(); }
  }

  // ====================== CARTES FORMULES ======================
  function drawCardUI(i, lt) {
    const F = C.formulas[i], prev = ctx; ctx = cctx; cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, 820, 340); cctx.globalAlpha = 1; cctx.shadowBlur = 0;
    const fp = ease(prog(lt, 0.55, 0.6)), op = ease(prog(lt, 0, 0.7));
    // contour qui se trace
    cctx.save(); cctx.shadowColor = `rgba(${BLUE},1)`; cctx.shadowBlur = 22; cctx.strokeStyle = ICE; cctx.lineWidth = 3.5; const per = 2 * (800 + 320) + 150; cctx.setLineDash([per * op, per]); rr(10, 10, 800, 320, 44); cctx.stroke(); cctx.restore();
    // remplissage verre
    cctx.save(); cctx.globalAlpha = fp; const g = cctx.createLinearGradient(0, 0, 820, 340); g.addColorStop(0, 'rgba(210,222,255,.22)'); g.addColorStop(1, 'rgba(120,140,255,.08)'); cctx.fillStyle = g; rr(10, 10, 800, 320, 44); cctx.fill(); cctx.strokeStyle = 'rgba(214,224,255,.45)'; cctx.lineWidth = 2; cctx.stroke(); cctx.restore();
    const a = ease(prog(lt, 0.9, 0.5)); cctx.save(); cctx.globalAlpha = a;
    T(F.tag, 56, 62, { font: MS(19, 700), ls: 6, fill: G2 });
    cctx.fillStyle = 'rgba(255,255,255,.16)'; rr(690, 40, 74, 54, 12); cctx.fill(); cctx.fillStyle = 'rgba(255,255,255,.38)'; rr(702, 52, 22, 30, 5); cctx.fill();
    T(F.name, 52, 142, { font: PF(96, 700, true) }); T(F.sub, 56, 206, { font: MS(20, 600), ls: 7, fill: G1 });
    F.lines.forEach((l, k) => { const y = 250 + k * 42, ck = E.outBack(prog(lt, 1.15 + k * 0.2, 0.35)); cctx.fillStyle = WHITE; cctx.beginPath(); cctx.arc(70, y, 13 * ck, 0, 6.283); cctx.fill(); check(70, y + 1, 14 * ck, '#05060c', 3); T(l, 100, y + 1, { font: MS(25, 600), alpha: ck }); });
    cctx.restore(); ctx = prev;
  }
  function drawCards(t) {
    const a = T_.cards, b = T_.cardsOut; if (t < a || t > b + 0.5) return;
    const out = prog(t, b - 0.2, 0.5);
    [0, 1].forEach(i => {
      const st = a + 0.15 + i * 0.5, lt = t - st; if (lt < 0) return;
      drawCardUI(i, lt);
      const pin = E.outCubic(prog(lt, 0, 0.7)), y = 1010 + i * 400 + (1 - pin) * 120 - 10 * Math.sin(t * 1.1 + i * 1.7);
      ctx.save(); ctx.globalAlpha *= pin * (1 - E.inCubic(out));
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(540, y, 0, 540, y, 520); g.addColorStop(0, `rgba(${BLUE},.2)`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.fillStyle = g; ctx.fillRect(0, y - 520, W, 1040); ctx.globalCompositeOperation = 'source-over';
      tilted(cardCv, 540 + 10 * (1 - pin), y, 1.0, -0.22 + 0.03 * Math.sin(t * 0.8 + i), -0.05);
      ctx.restore();
      sparks(250, y - 140, st + 0.6, t, 10, 90, 40 + i); sparks(830, y + 130, st + 0.7, t, 10, 90, 50 + i);
    });
  }

  // ====================== EN-TÊTE FIXE (icône + phrase d'accroche) ======================
  function drawHeader(t) {
    const p = prog(t, T_.header, 0.6), out = prog(t, T_.headerOut, 0.5); if (p <= 0 || out >= 1) return;
    const H_ = C.header, e = E.outBack(p);
    ctx.save(); ctx.globalAlpha *= clamp(p * 2) * (1 - E.inCubic(out)); ctx.translate(0, -out * 30);
    // icône d'application (monogramme)
    ctx.save(); ctx.translate(W / 2, 205); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40;
    const g = ctx.createLinearGradient(0, -90, 0, 90); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe4f3'); ctx.fillStyle = g; rr(-90, -90, 180, 180, 44); ctx.fill(); ctx.shadowBlur = 0;
    T(C.brand.monogram, 0, 10, { font: PF(138, 800, true), align: 'center', fill: '#05060c' });
    ctx.restore();
    // phrase d'accroche
    const full = H_.title + ' ' + H_.emoji, size = fit(full, 940, 92, z => PF(z, 800, true));
    const lp = E.outCubic(prog(t, T_.header + 0.2, 0.6)); ctx.save(); ctx.globalAlpha *= lp; ctx.translate(0, (1 - lp) * 20);
    T(full, W / 2, 400, { font: PF(size, 800, true), align: 'center', glow: `rgba(${BLUE},.5)`, glowBlur: 30 }); ctx.restore();
    ctx.restore();
  }

  // ====================== FINAL : signature, slogan, bouton ======================
  function drawEnd(t) {
    const lt = t - T_.end; if (lt < -0.1) return;
    const E_ = C.end, cx = W / 2;
    const fl = 1 - prog(t, T_.end, 0.8);
    if (fl > 0) { const g = ctx.createRadialGradient(cx, 560, 0, cx, 560, 700); g.addColorStop(0, `rgba(255,255,255,${0.35 * fl})`); g.addColorStop(1, `rgba(${BLUE},0)`); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    const wp = E.outCubic(prog(lt, 0.1, 0.9)), ls = lerp(40, 10, wp), size = fit(C.brand.name, 900, 118, z => MS(z, 800), ls);
    T(C.brand.name, cx, 470, { font: MS(size, 800), ls, align: 'center', alpha: clamp(wp * 1.6), blur: (1 - wp) * 14, glow: `rgba(${BLUE},.7)`, glowBlur: 44 });
    T(C.brand.sub, cx, 560, { font: MS(fit(C.brand.sub, 880, 24, z => MS(z, 500), 12), 500), ls: 12, align: 'center', fill: G1, alpha: E.outCubic(prog(lt, 0.5, 0.7)) });
    ctx.save(); ctx.globalAlpha *= E.outCubic(prog(lt, 0.6, 0.6)) * 0.7; ctx.fillStyle = WHITE; const hw = 240 * E.inOut(prog(lt, 0.6, 0.9)); ctx.fillRect(cx - hw / 2, 620, hw, 1.8); ctx.restore();
    E_.tagline.forEach((ln, i) => {
      const p = prog(lt, 0.8 + i * 0.4, 0.7), e = E.outCubic(p); if (p <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 790 + i * 118 - 76, W, 152); ctx.clip(); ctx.translate(0, (1 - E.outQuart(p)) * 90); ctx.globalAlpha *= clamp(p * 2.5);
      T(ln, cx, 790 + i * 118, { font: PF(104, 700, true), align: 'center', blur: (1 - e) * 8 }); ctx.restore();
    });
    // bouton
    const bp = E.outBack(prog(lt, 2.15, 0.6)), bw = 880, bh = 140, by = 1280;
    if (bp > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(bp * 1.5); ctx.translate(cx, by); ctx.scale(0.85 + 0.15 * bp, 0.85 + 0.15 * bp);
      ctx.shadowColor = `rgba(${BLUE},.8)`; ctx.shadowBlur = 50 + 16 * Math.sin(lt * 2.4); const gb = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2); gb.addColorStop(0, '#ffffff'); gb.addColorStop(1, '#cfd8f6'); ctx.fillStyle = gb; rr(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      const bs = fit(E_.button, 640, 40, z => MS(z, 800), 8), tw = T(E_.button, -34, 2, { font: MS(bs, 800), ls: 8, align: 'center', fill: '#05060c' });
      const ax = -34 + tw / 2 + 52 + 6 * Math.sin(lt * 2.6); ctx.strokeStyle = '#05060c'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(ax - 24, 2); ctx.lineTo(ax + 18, 2); ctx.moveTo(ax + 4, -14); ctx.lineTo(ax + 20, 2); ctx.lineTo(ax + 4, 18); ctx.stroke();
      ctx.restore(); sparks(cx - 300, by - 30, T_.end + 2.2, t, 10, 110, 77); sparks(cx + 300, by + 30, T_.end + 2.25, t, 10, 110, 78);
    }
    const up = E.outCubic(prog(lt, 2.8, 0.8)), us = fit(E_.link, 700, 116, z => PF(z, 700, true)), lw = measure(E_.link, PF(us, 700, true));
    ctx.save(); ctx.globalAlpha *= up; ctx.translate(0, (1 - up) * 24);
    const lx = cx - (lw + 96) / 2;
    T(E_.link, lx, 1470, { font: PF(us, 700, true) });
    // flèche vers le haut (le lien est dans la bio, en haut du profil) qui « respire »
    const axc = lx + lw + 66, ayc = 1474 - 7 * Math.sin(lt * 3.2);
    ctx.strokeStyle = WHITE; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = `rgba(${BLUE},.9)`; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(axc, ayc + 36); ctx.lineTo(axc, ayc - 36); ctx.moveTo(axc - 26, ayc - 10); ctx.lineTo(axc, ayc - 36); ctx.lineTo(axc + 26, ayc - 10); ctx.stroke();
    ctx.restore();
    const lg = E.outCubic(prog(lt, 3.3, 0.9));
    ctx.save(); ctx.font = MS(23, 400); const words = E_.legal.split(' '), lines = []; let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > 860 && line) { lines.push(line); line = w; } else line = test; } lines.push(line); ctx.restore();
    lines.forEach((l, k) => T(l, cx, 1620 + k * 34, { font: MS(23, 500), align: 'center', fill: 'rgba(232,236,248,.58)', alpha: lg }));
  }

  // ---------- rendu principal ----------
  window.renderFrame = t => {
    t = clamp(t, 0, TOTAL - 1e-3);
    ctx = mainCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.filter = 'none'; ctx.letterSpacing = '0px';
    drawBackground(t);
    ctx.save();
    const zoom = 1 + 0.025 * (t / TOTAL); ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
    drawHook(t); drawBurst(t); drawTerrain(t); drawPhone(t);
    // pastilles (devant le téléphone)
    const S = C.screens;
    pill(S.goal.pill, 540, 1530, 8.3, t, { out: 8.6 });
    pill(S.plan.pill, 540, 1560, 11.2, t, { out: 11.8 });
    pill(S.follow.pill, 540, 1600, 14.3, t, { tag: S.follow.pillTag, out: 15.0, size: 33 });
    word(C.words.goal, T_.goal, t); word(C.words.plan, T_.plan, t); word(C.words.follow, T_.follow, t); word(C.words.formulas, T_.formulas, t, 640);
    drawCards(t); drawHeader(t); drawEnd(t);
    ctx.restore();
    ctx.globalAlpha = 1; drawFinish(t);
  };

  window.ready = Promise.all([
    document.fonts.load('400 100px PF'), document.fonts.load('italic 400 100px PF'), document.fonts.load('700 100px PF'), document.fonts.load('italic 700 100px PF'), document.fonts.load('italic 800 100px PF'),
    document.fonts.load('400 30px MS'), document.fonts.load('500 30px MS'), document.fonts.load('600 30px MS'), document.fonts.load('700 30px MS'), document.fonts.load('800 30px MS'),
  ]).then(() => { window.renderFrame(0); return true; });
})();
