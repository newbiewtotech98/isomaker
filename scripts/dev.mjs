// Local dev server that mirrors the Vercel routing in vercel.json:
//   /            → isomaker.html
//   /place/:slug → place/<slug>.html when built (npm run build), else isomaker.html
//   /story       → story.html      (cleanUrls)
// Usage: node scripts/dev.mjs [port]   (default 8765)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || 8765);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp', '.mp4':'video/mp4', '.css':'text/css', '.ico':'image/x-icon' };

function route(pathname){
  if(pathname === '/') return '/isomaker.html';
  const place = pathname.match(/^\/place\/([a-z0-9-]+)\/?$/i);   // a built place page if there is one, else the world
  if(place) return existsSync(join(root, 'place', place[1] + '.html')) ? `/place/${place[1]}.html` : '/isomaker.html';
  if(!extname(pathname)) return pathname.replace(/\/$/, '') + '.html';
  return pathname;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = normalize(join(root, decodeURIComponent(route(pathname))));
  if(!file.startsWith(root)){ res.writeHead(403).end(); return; }
  try{
    if(!(await stat(file)).isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  }catch{ res.writeHead(404, { 'content-type':'text/plain' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Isomaker dev server: http://localhost:${port}/`));
