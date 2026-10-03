// Moteur d'animation v3 — style éditorial noir & blanc, mouvements lents et soignés.
// renderFrame(t) dessine l'image à l'instant t (secondes), de façon déterministe.
(() => {
  'use strict';
  const C = window.CONTENT;
  const W = 1080, H = 1920, FPS = C.fps;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ---------- palette & utilitaires ----------
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
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Texte avec crénage. Retourne la largeur.
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
  function wrapText(str, maxW, font) {
    ctx.save(); ctx.font = font; const words = str.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); ctx.restore(); return lines;
  }
  // Ligne qui « monte » depuis sa ligne de base derrière un masque. p : 0→1
  function rise(fn, y, lh, p) {
    if (p <= 0) return; const e = E.outQuart(p);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - lh * 0.58, W, lh * 1.16); ctx.clip();
    ctx.translate(0, (1 - e) * lh * 0.85); ctx.globalAlpha *= clamp(p * 2.5); fn(); ctx.restore();
  }
  const hair = (x, y, w, p, a = 1, lw = 1.5) => { if (p <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = WHITE; ctx.fillRect(x, y, w * p, lw); ctx.restore(); };
  const parseIt = str => str.split('*').map((s, i) => ({ s, it: i % 2 === 1 })).filter(x => x.s);
  // texte à segments romain / italique, retourne la largeur
  function mixed(str, x, y, size, o = {}) {
    let cx = x; parseIt(str).forEach(sg => { cx += T(sg.s, cx, y, { ...o, font: PF(size, o.w || 400, sg.it), align: 'left' }); });
    return cx - x;
  }

  // ---------- chronologie ----------
  const scenes = [], events = []; let cur = 0;
  const addScene = (name, dur, draw, opt = {}) => {
    scenes.push({ name, t0: cur, t1: cur + dur, draw, label: opt.label || '', idx: scenes.length });
    (opt.events || []).forEach(([lt, type, n]) => events.push({ t: cur + lt, type, n: n || 0 })); cur += dur;
  };
  addScene('opening', 5, drawOpening, { events: [[1.3, 'chime', 0], [2.5, 'tap'], [3.4, 'tap']] });
  addScene('statements', 5, drawStatements, { events: [[0.1, 'chime', 1], [2.6, 'chime', 2]] });
  C.methods.forEach((m, i) => addScene('method' + (i + 1), 5, lt => drawMethod(i, lt), { label: 'LA MÉTHODE', events: [[0.2, 'chime', 3 + i], ...[0, 1, 2, 3].map(k => [0.9 + k * 0.55, 'tap'])] }));
  C.formulas.forEach((f, i) => addScene('formula' + (i + 1), 9, (lt, d) => drawFormula(i, lt, d), {
    label: 'LES FORMULES',
    events: [[0.3, 'chime', 0], ...[0, 1, 2].map(k => [1.1 + k * 0.55, 'chime', 2 + k]), [3.8, 'chime', 4], ...f.bullets.map((_, k) => [5.3 + k * 0.36, 'tap'])],
  }));
  addScene('closing', 6, drawClosing, { label: 'RÉSERVER', events: [[0.3, 'chime', 1], [1.2, 'chime', 3], [2.4, 'tap'], [2.7, 'tap'], [3.0, 'tap']] });
  const TOTAL = cur;
  window.TIMELINE = { total: TOTAL, fps: FPS, scenes: scenes.map(s => ({ name: s.name, t0: s.t0, t1: s.t1 })), events };
  const sceneAt = t => { for (const s of scenes) if (t < s.t1) return s; return scenes[scenes.length - 1]; };

  // ---------- décor : lumière diffuse, poussière, grain, cadre ----------
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
    const a = E.outCubic(prog(t, 1.2, 1.6)); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    // cadre fin qui se trace
    const x0 = 46, y0 = 46, w = W - 92, h = H - 92, L = 2 * (w + h), p = E.inOut(prog(t, 1.0, 2.6));
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
    const fi = 1 - prog(t, 0, 0.6); if (fi > 0) { ctx.fillStyle = `rgba(5,5,5,${fi})`; ctx.fillRect(0, 0, W, H); }
  }

  // ====================== SCÈNES ======================

  // ---- OUVERTURE : monogramme, anneau fin, nom ----
  function drawOpening(lt) {
    const cx = W / 2, cy = 760, B = C.brand;
    // anneau qui se trace + fin croisillon
    const rp = E.inOut(prog(lt, 0.3, 2.2));
    ctx.save(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 290, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rp); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.5 * E.outCubic(prog(lt, 0.6, 1.4)); ctx.strokeStyle = LINE2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 340, cy); ctx.lineTo(cx + 340, cy); ctx.moveTo(cx, cy - 340); ctx.lineTo(cx, cy + 340); ctx.stroke(); ctx.restore();
    // petit point qui parcourt l'anneau
    if (rp > 0.02) { const a = -Math.PI / 2 + Math.PI * 2 * rp; ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 290, cy + Math.sin(a) * 290, 4.5, 0, 6.283); ctx.fill(); ctx.restore(); }
    // monogramme
    const mp = E.outCubic(prog(lt, 1.1, 1.6)), sc = 1.1 - 0.1 * mp;
    ctx.save(); ctx.translate(cx, cy + 10); ctx.scale(sc, sc); T(B.monogram, 0, 0, { font: PF(360, 400, true), align: 'center', alpha: mp, glow: 'rgba(255,255,255,.35)', glowBlur: 40 }); ctx.restore();
    // nom : l'espacement des lettres se resserre
    const np = E.outCubic(prog(lt, 2.0, 1.5)), ns = fit(B.name, 900, 50, z => MS(z, 500), 22);
    T(B.name, cx, 1135, { font: MS(ns, 500), ls: 22 + 26 * (1 - np), align: 'center', alpha: np });
    hair(cx - 120, 1195, 240, E.inOut(prog(lt, 2.7, 1.0)), 0.8);
    const sp = E.outCubic(prog(lt, 3.0, 1.2)); T(B.sub, cx, 1250, { font: MS(fit(B.sub, 920, 25, z => MS(z, 400), 12), 400), ls: 12, align: 'center', alpha: sp, fill: G1 });
    const tp = E.outCubic(prog(lt, 3.6, 1.1)); T(B.tagline, cx, 1330, { font: PF(38, 400, true), align: 'center', alpha: tp, fill: G1 });
  }

  // ---- MANIFESTE : deux phrases qui se révèlent ligne par ligne ----
  function drawStatements(lt) {
    const dur = 2.5, k = Math.min(C.statements.length - 1, Math.floor(lt / dur)), l = lt - k * dur, S = C.statements[k];
    const plain = S.lines.map(s => s.replace(/\*/g, ''));
    const size = Math.min(...plain.map(s => fit(s, 860, 124, z => PF(z, 400, false)))), lh = size * 1.22, n = S.lines.length, y0 = H * 0.47 - (n * lh) / 2 + lh / 2;
    const oa = 1 - E.inCubic(prog(l, 2.1, 0.4));
    ctx.save(); ctx.globalAlpha *= oa;
    T(S.index, 110, y0 - lh * 0.95, { font: MS(24, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(l, 0, 0.5)) });
    hair(210, y0 - lh * 0.95 - 1, 760, E.inOut(prog(l, 0.05, 0.9)), 0.7);
    S.lines.forEach((ln, i) => rise(() => mixed(ln, 110, y0 + i * lh, size), y0 + i * lh, lh, prog(l, 0.15 + i * 0.16, 0.8)));
    ctx.restore();
  }

  // ---- MÉTHODES : liste éditoriale ----
  function drawMethod(idx, lt) {
    const m = C.methods[idx], x0 = 110;
    T(String(idx + 1).padStart(2, '0') + ' / ' + String(C.methods.length).padStart(2, '0'), x0, 235, { font: MS(24, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, 0, 0.5)) });
    const ts = fit(m.title, 860, 190, z => PF(z, 400, true));
    rise(() => T(m.title, x0 - 4, 400, { font: PF(ts, 400, true) }), 400, ts * 1.15, prog(lt, 0.15, 1.0));
    hair(x0, 520, 860, E.inOut(prog(lt, 0.5, 1.0)), 0.8);
    const y0 = 660, step = 232;
    m.steps.forEach((s, i) => {
      const st = 0.9 + i * 0.55, y = y0 + i * step, p = prog(lt, st, 0.9);
      T(String(i + 1).padStart(2, '0'), x0, y - 18, { font: MS(26, 300), ls: 6, fill: G2, alpha: E.outCubic(prog(lt, st, 0.6)) });
      const sz = fit(s.t, 700, 80, z => PF(z, 400, false));
      rise(() => T(s.t, x0 + 112, y - 20, { font: PF(sz, 400, false) }), y - 20, sz * 1.2, p);
      wrapText(s.d, 740, MS(31, 300)).slice(0, 2).forEach((ln, k) => T(ln, x0 + 112, y + 38 + k * 42, { font: MS(31, 300), fill: G1, alpha: E.outCubic(prog(lt, st + 0.25, 0.8)) }));
      hair(x0, y + 120, 860, E.inOut(prog(lt, st + 0.1, 0.9)), 0.35, 1);
    });
  }

  // ---- FORMULES : acte 1 (nom + prix) puis acte 2 (commission + avantages) ----
  function drawFormula(idx, lt, dur) {
    const f = C.formulas[idx], x0 = 110, SPLIT = 3.7, n = C.formulas.length;
    T(f.tag, x0, 235, { font: MS(24, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, 0, 0.5)) });
    T(String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'), W - 110, 235, { font: MS(24, 500), ls: 14, fill: G2, align: 'right', alpha: E.outCubic(prog(lt, 0, 0.5)) });
    if (lt < SPLIT) {
      const out = prog(lt, SPLIT - 0.45, 0.45), ctxA = 1 - E.inCubic(out), dy = -out * 90;
      ctx.save(); ctx.globalAlpha *= ctxA; ctx.translate(0, dy);
      if (f.badge) {
        const bp = E.outCubic(prog(lt, 0.3, 0.8)); ctx.save(); ctx.globalAlpha *= bp;
        ctx.font = MS(20, 500); ctx.letterSpacing = '10px'; const bw = ctx.measureText(f.badge).width + 64; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x0, 290, bw, 62, 31); ctx.stroke();
        T(f.badge, x0 + 32, 322, { font: MS(20, 500), ls: 10, fill: WHITE }); ctx.restore();
      }
      const ns = fit(f.name, 860, 250, z => PF(z, 400, true)), ny = f.badge ? 500 : 460;
      rise(() => T(f.name, x0 - 6, ny, { font: PF(ns, 400, true) }), ny, ns * 1.15, prog(lt, 0.2, 1.1));
      T(f.sub, x0, ny + ns * 0.62, { font: MS(24, 400), ls: 12, fill: G1, alpha: E.outCubic(prog(lt, 0.8, 0.8)) });
      const ry = ny + ns * 0.62 + 50; hair(x0, ry, 860, E.inOut(prog(lt, 0.9, 1.0)), 0.8);
      f.prices.forEach((p, i) => {
        const st = 1.0 + i * 0.55, y = ry + 70 + i * 240, pp = prog(lt, st, 0.9);
        T(p.label, x0, y + 10, { font: MS(21, 500), ls: 12, fill: G1, alpha: E.outCubic(prog(lt, st, 0.6)) });
        const val = Math.round(p.value * E.outCubic(prog(lt, st + 0.1, 1.0))), fin = fmt(p.value), size = 150;
        ctx.save(); ctx.font = MS(size, 300); const fw = ctx.measureText(fin).width, ew = ctx.measureText(' €').width; ctx.restore();
        rise(() => { T(fmt(val), x0 - 4, y + 112, { font: MS(size, 300) }); T(' €', x0 - 4 + fw, y + 112, { font: MS(size, 300), fill: G1 }); T(p.per, x0 + fw + ew + 22, y + 144, { font: MS(24, 500), ls: 8, fill: G1 }); }, y + 112, size * 1.15, pp);
        hair(x0, y + 198, 860, E.inOut(prog(lt, st + 0.15, 0.9)), 0.3, 1);
      });
      ctx.restore();
    } else {
      const l = lt - SPLIT;
      // nom réduit
      const ns = fit(f.name, 700, 118, z => PF(z, 400, true));
      rise(() => T(f.name, x0 - 3, 350, { font: PF(ns, 400, true) }), 350, ns * 1.2, prog(l, 0.1, 0.9));
      hair(x0, 430, 860, E.inOut(prog(l, 0.2, 0.9)), 0.8);
      // commission
      T('COMMISSION', x0, 520, { font: MS(22, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(l, 0.4, 0.6)) });
      rise(() => T(f.commission.value, x0 - 8, 660, { font: MS(210, 300) }), 660, 240, prog(l, 0.5, 1.0));
      const noteLines = wrapText(f.commission.note, 860, PF(40, 400, true));
      noteLines.forEach((ln, k) => T(ln, x0, 800 + k * 52, { font: PF(40, 400, true), fill: G1, alpha: E.outCubic(prog(l, 1.0, 0.8)) }));
      const ay = 800 + noteLines.length * 52 + 30;
      hair(x0, ay, 860, E.inOut(prog(l, 1.1, 0.9)), 0.8);
      T('INCLUS', x0, ay + 70, { font: MS(22, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(l, 1.3, 0.6)) });
      f.bullets.forEach((b, i) => {
        const st = 1.6 + i * 0.36, y = ay + 160 + i * 108, p = prog(l, st, 0.7), e = E.outQuart(p);
        if (p <= 0) return;
        ctx.save(); ctx.globalAlpha *= clamp(p * 2.5); ctx.translate((1 - e) * 40, 0);
        ctx.strokeStyle = G1; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0 + 20, y, 20, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 11, y + 1); ctx.lineTo(x0 + 18, y + 8); ctx.lineTo(x0 + 30, y - 7); ctx.stroke();
        T(b, x0 + 72, y + 1, { font: MS(fit(b, 740, 40, z => MS(z, 400)), 400) });
        ctx.restore();
        hair(x0, y + 54, 860, E.inOut(prog(l, st + 0.1, 0.8)), 0.22, 1);
      });
    }
  }

  // ---- CONCLUSION ----
  function drawClosing(lt) {
    const L = C.cta, x0 = 110;
    L.lines.forEach((s, i) => {
      const size = 168, y = 450 + i * 190;
      rise(() => mixed(s, x0 - 4, y, size), y, size * 1.15, prog(lt, 0.2 + i * 0.25, 1.1));
    });
    hair(x0, 770, 860, E.inOut(prog(lt, 0.9, 1.0)), 0.8);
    // bouton : pastille blanche, texte noir
    const bp = E.outCubic(prog(lt, 1.2, 0.9)), bw = 860, bh = 132, by = 930;
    if (bp > 0) {
      ctx.save(); ctx.globalAlpha *= bp; ctx.translate(0, (1 - bp) * 24);
      ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = 40 + 14 * Math.sin(lt * 2.2); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.roundRect(x0, by - bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
      const tw = T(L.button, x0 + bw / 2 - 30, by + 1, { font: MS(34, 600), ls: 12, fill: '#050505', align: 'center' });
      const ax = x0 + bw / 2 - 30 + tw / 2 + 52 + 5 * Math.sin(lt * 2.2);
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(ax - 24, by + 1); ctx.lineTo(ax + 18, by + 1); ctx.moveTo(ax + 4, by - 14); ctx.lineTo(ax + 20, by + 1); ctx.lineTo(ax + 4, by + 16); ctx.stroke();
      ctx.restore();
    }
    // adresse du site
    const url = C.brand.url, size = fit(url, 860, 112, z => PF(z, 400, true)), up = prog(lt, 2.2, 1.4);
    rise(() => T(url, x0 - 4, 1190, { font: PF(size, 400, true) }), 1190, size * 1.2, up);
    hair(x0, 1262, 860 * 0.5, E.inOut(prog(lt, 2.9, 1.0)), 0.8);
    T(C.brand.name, x0, 1330, { font: MS(21, 500), ls: 14, fill: G1, alpha: E.outCubic(prog(lt, 3.3, 0.8)) });
    wrapText(L.legal, 860, MS(23, 300)).forEach((ln, k) => T(ln, x0, 1500 + k * 34, { font: MS(23, 300), fill: G2, alpha: E.outCubic(prog(lt, 3.6, 0.9)) }));
  }

  // ---------- rendu principal ----------
  window.renderFrame = t => {
    t = clamp(t, 0, TOTAL - 1e-3);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
    const s = sceneAt(t), lt = t - s.t0, dur = s.t1 - s.t0;
    drawBackground(t);
    ctx.save();
    // poussée de caméra très lente + fondu enchaîné entre les scènes
    const zoom = 1 + 0.028 * (lt / dur), fin = s.idx === 0 ? 1 : E.outCubic(prog(lt, 0, 0.8)), fout = s.idx === scenes.length - 1 ? 1 : 1 - E.inOut(prog(lt, dur - 0.5, 0.5));
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
