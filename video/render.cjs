// Rend la vidéo image par image avec Chromium, puis encode avec ffmpeg.
//   node render.cjs                  -> out/promo.mp4 (son inclus)
//   node render.cjs --stills 1,5,9   -> PNG de contrôle dans out/stills/ (temps en secondes)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = __dirname, OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  const tl = await page.evaluate(() => window.TIMELINE);
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(tl, null, 2));
  const grab = t => page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t).then(b => Buffer.from(b, 'base64'));

  if (stillsArg) {
    fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
    for (const s of stillsArg.split(',')) {
      fs.writeFileSync(path.join(OUT, 'stills', `t${String(s).replace('.', '_')}.png`), await grab(parseFloat(s)));
      console.log('still', s);
    }
  } else {
    const py = spawnSync('python3', ['audio.py'], { cwd: ROOT, stdio: 'inherit' });
    if (py.status !== 0) throw new Error('audio.py a échoué');
    const frames = Math.round(tl.total * tl.fps);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'png', '-i', '-',
      '-i', path.join(OUT, 'audio.wav'), '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(OUT, 'promo.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise(r => ff.on('close', r));
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const buf = await grab(i / tl.fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(`frame ${i}/${frames}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    const code = await done;
    console.log('ffmpeg exit', code, `total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
