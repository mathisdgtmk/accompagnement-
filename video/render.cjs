// Rend la vidéo image par image avec Chromium (plusieurs processus en parallèle), puis encode avec ffmpeg.
//   node render.cjs                  -> out/promo.mp4 (son inclus)
//   node render.cjs --stills 1,5,9   -> PNG de contrôle dans out/stills/ (temps en secondes)
//   node render.cjs --workers 4      -> nombre de processus (défaut 4)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = __dirname, OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const stillsArg = opt('--stills'), WORKERS = parseInt(opt('--workers') || '4', 10);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

async function openPage(url) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  const grab = t => page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t).then(b => Buffer.from(b, 'base64'));
  return { browser, page, grab };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const main = await openPage(url);
  const tl = await main.page.evaluate(() => window.TIMELINE);
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(tl, null, 2));

  if (stillsArg) {
    fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
    for (const s of stillsArg.split(',')) {
      fs.writeFileSync(path.join(OUT, 'stills', `t${String(s).replace('.', '_')}.png`), await main.grab(parseFloat(s)));
      console.log('still', s);
    }
    await main.browser.close(); server.close(); return;
  }

  const py = spawnSync('python3', ['audio.py'], { cwd: ROOT, stdio: 'inherit' });
  if (py.status !== 0) throw new Error('audio.py a échoué');
  const frames = Math.round(tl.total * tl.fps), per = Math.ceil(frames / WORKERS), t0 = Date.now();
  let done = 0;
  const segs = [];
  const worker = async w => {
    const a = w * per, b = Math.min(frames, a + per); if (a >= b) return;
    const seg = path.join(OUT, `seg_${w}.mp4`); segs[w] = seg;
    const { browser, grab } = w === 0 ? main : await openPage(url);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '30', '-an', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let i = a; i < b; i++) {
      const buf = await grab(i / tl.fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 60 === 0) console.log(`frame ${done}/${frames}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await closed; await browser.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
  const list = path.join(OUT, 'segments.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(OUT, 'audio.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'promo.mp4')], { stdio: 'inherit' });
  segs.filter(Boolean).forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);
  console.log('ffmpeg exit', mux.status, `total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
