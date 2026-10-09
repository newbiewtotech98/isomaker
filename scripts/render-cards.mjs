// Renders every place's share cards with the site's own card renderer, in headless Chrome.
// Writes, for each place:  places/<slug>/card.jpg      (1080×1080, for posts)
//                          places/<slug>/card-og.jpg   (1200×630, the link preview)
// and places/manifest.json, which scripts/build-place-pages.mjs turns into /place/<slug> pages.
//
// Usage: node scripts/dev.mjs   (in another terminal)
//        node scripts/render-cards.mjs [slug ...]     (no slugs = every place)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const only = process.argv.slice(2);
const DEV = 'http://localhost:8765', PORT = 9334;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

try{ await fetch(DEV + '/places.json'); }catch{ console.error('Start the dev server first: node scripts/dev.mjs'); process.exit(1); }
const profile = join(tmpdir(), 'isomaker-cards-' + process.pid);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--enable-webgl', '--ignore-gpu-blocklist', 'about:blank'], { stdio:'ignore' });
const cleanup = () => { try{ chrome.kill(); }catch{} try{ rmSync(profile, { recursive:true, force:true }); }catch{} };
process.on('exit', cleanup);
for(let i=0; i<40; i++){ try{ await fetch(`http://127.0.0.1:${PORT}/json/version`); break; }catch{ await new Promise(r=>setTimeout(r,250)); } }

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(DEV + '/?debug')}`, { method:'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if(m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const send = (method, params={}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id:i, method, params })); });
const run = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
  if(r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width:1280, height:800, deviceScaleFactor:1, mobile:false });
// wait for the world to finish building
for(let i=0; i<240; i++){ if(await run(`!!(window.__iso && document.getElementById('loader').classList.contains('done'))`).catch(()=>false)) break; await new Promise(r=>setTimeout(r,500)); }

const list = await run(`__iso.places.map(p=>({ slug:__iso.slugOf(p), name:p.name, tagline:p.tagline||'', desc:p.desc||'', district:p.district, districtName:__iso.DISTRICTS[p.district].name, by:p.by||'' }))`);
const todo = only.length ? list.filter(p => only.includes(p.slug)) : list;
if(only.length && todo.length !== only.length) console.warn('Unknown slugs skipped:', only.filter(s => !list.some(p => p.slug === s)).join(', '));
for(const [i, p] of todo.entries()){
  const dir = join(root, 'places', p.slug); mkdirSync(dir, { recursive:true });
  // cards are saved as high-quality JPEGs: a fraction of the PNG size, which matters for the repo and for social platforms
  const card = (f, q) => run(`(async()=>{ const p=__iso.places.find(x=>__iso.slugOf(x)===${JSON.stringify(p.slug)}); const src=await __iso.renderPlaceCard(p,${JSON.stringify(f)});
    const im=new Image(); im.src=src; await im.decode(); const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; c.getContext('2d').drawImage(im,0,0); return c.toDataURL('image/jpeg',${q}); })()`);
  writeFileSync(join(dir, 'card.jpg'), Buffer.from((await card('square', .92)).split(',')[1], 'base64'));
  writeFileSync(join(dir, 'card-og.jpg'), Buffer.from((await card('og', .9)).split(',')[1], 'base64'));
  console.log(`${String(i+1).padStart(2)}/${todo.length}  ${p.slug}`);
}
// the manifest always lists every place, so a partial run doesn't drop pages
writeFileSync(join(root, 'places', 'manifest.json'), JSON.stringify(list, null, 2) + '\n');
console.log(`Wrote cards for ${todo.length} place(s) and places/manifest.json (${list.length} places).`);
ws.close(); cleanup(); process.exit(0);
