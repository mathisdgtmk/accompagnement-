const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright-core');
const ROOT=__dirname;const MIME={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,s)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/,'/index.html'));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(s);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:1080,height:1920}});await pg.goto(`http://127.0.0.1:${srv.address().port}/?s=0.25`);await pg.waitForFunction(()=>window.ready===true,null,{timeout:120000});
const cands=JSON.parse(process.argv[2]);for(const c of cands)console.log(JSON.stringify(c),'=>',JSON.stringify(await pg.evaluate(c=>window.probeCam(c[0],c[1],c[2]),c)));
await b.close();srv.close();})();
