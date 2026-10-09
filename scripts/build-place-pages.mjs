// Builds /place/<slug> pages: the world page with that place's own title, description and
// share card as its link preview, so LinkedIn, X, Slack etc. show the place's card.
// Runs on every Vercel deploy (npm run build) from places/manifest.json; no browser needed.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://www.isomaker.club';
const manifestPath = join(root, 'places', 'manifest.json');
if(!existsSync(manifestPath)){ console.log('No places/manifest.json yet; skipping place pages.'); process.exit(0); }
const places = JSON.parse(readFileSync(manifestPath, 'utf8'));
const base = readFileSync(join(root, 'isomaker.html'), 'utf8');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// replace one <meta> tag's content, found by its name or property
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.:]/g, m => '\\' + m)}" content=")[^"]*(")`);
  if(!re.test(html)) throw new Error(`meta ${attr}="${key}" not found in isomaker.html`);
  return html.replace(re, `$1${esc(value)}$2`);
};

const out = join(root, 'place'); rmSync(out, { recursive:true, force:true }); mkdirSync(out, { recursive:true });
let n = 0;
for(const p of places){
  if(!/^[a-z0-9-]+$/.test(p.slug)) continue;
  if(!existsSync(join(root, 'places', p.slug, 'card-og.jpg'))) continue;   // no card yet: the world's default preview applies
  const url = `${SITE}/place/${p.slug}`, img = `${SITE}/places/${p.slug}/card-og.jpg`;
  const title = `${p.name} — Isomaker`;
  const lead = String(p.tagline || p.desc).trim().replace(/([^.!?…])$/, '$1.');
  const desc = `${lead}${p.by ? ` By ${p.by}.` : ''} A place in the ${p.districtName} of Isomaker, a living world of indie tools.`;
  let html = base.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>\n<link rel="canonical" href="${url}" />`);
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', desc);
  html = setMeta(html, 'property', 'og:image', img);
  html = setMeta(html, 'property', 'og:image:alt', `${p.name}'s place in Isomaker: its building on a small island at night.`);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', desc);
  html = setMeta(html, 'name', 'twitter:image', img);
  writeFileSync(join(out, `${p.slug}.html`), html); n++;
}
console.log(`Built ${n} place page(s) in place/.`);
