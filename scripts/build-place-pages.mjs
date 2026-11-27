// Builds the crawlable site around the world (runs on every Vercel deploy: npm run build).
// From isomaker.html (the app), places/manifest.json (every place) and scripts/seo-copy.json (the copy):
//   home.html              served at /: the world + an "All tools" directory, H1, JSON-LD
//   creative.html, …       one page per use case (district), its top 10 first
//   place/<slug>.html      one page per tool: its own article, card as link preview
//   robots.txt, sitemap.xml, llms.txt
// Each page is the world itself, so visitors land in the app; the directory is real HTML that crawlers
// (and anyone without JavaScript) read, and that the app opens as its "All tools" panel.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const copy = JSON.parse(readFileSync(join(root, 'scripts', 'seo-copy.json'), 'utf8'));
const SITE = copy.site;
const manifestPath = join(root, 'places', 'manifest.json');
if(!existsSync(manifestPath)){ console.log('No places/manifest.json yet; skipping pages.'); process.exit(0); }
const places = JSON.parse(readFileSync(manifestPath, 'utf8')).filter(p => /^[a-z0-9-]+$/.test(p.slug));
const base = readFileSync(join(root, 'isomaker.html'), 'utf8');
const TODAY = new Date().toISOString().slice(0, 10);

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const host = u => { try{ return new URL(u).host.replace(/^www\./,''); }catch{ return ''; } };
const clip = (s, n) => { s = String(s).trim(); if(s.length <= n) return s; const c = s.slice(0, n - 1); return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:\s—-]+$/,'') + '…'; };
const sentence = s => String(s || '').trim().replace(/([^.!?…])$/, '$1.');
const D = copy.districts, ORDER = copy.order;
const placeUrl = p => `${SITE}/place/${p.slug}`;
const hasPage = p => existsSync(join(root, 'places', p.slug, 'card-og.jpg'));
// a district's list: its top 10 in order, then everything else by name
const inDistrict = k => { const all = places.filter(p => p.district === k);
  const top = all.filter(p => p.top).sort((a,b) => a.top - b.top); const rest = all.filter(p => !p.top).sort((a,b) => a.name.localeCompare(b.name));
  return { top, rest, all:[...top, ...rest] }; };

// ---------- head ----------
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.:]/g, m => '\\' + m)}" content=")[^"]*(")`);
  if(!re.test(html)) throw new Error(`meta ${attr}="${key}" not found in isomaker.html`);
  return html.replace(re, `$1${esc(value)}$2`);
};
function head(html, { title, description, url, image, imageAlt, jsonld }){
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`).replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', description);
  if(image){ html = setMeta(html, 'property', 'og:image', image); html = setMeta(html, 'name', 'twitter:image', image); }
  if(imageAlt) html = setMeta(html, 'property', 'og:image:alt', imageAlt);
  if(jsonld) html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g,'\\u003c')}</script>\n</head>`);
  return html;
}
const body = (html, dir) => html.replace(/(<body[^>]*>)/, `$1\n${dir}`);

// ---------- the directory (crawlable HTML; the app's "All tools" panel) ----------
const item = p => `<li><a href="/place/${p.slug}">${esc(p.name)}</a>${p.tagline ? ` — ${esc(p.tagline)}` : ''}${p.top ? ` <small>#${p.top} this week</small>` : ''}</li>`;
const nav = `<nav class="dir-nav" aria-label="Use cases"><a href="/">All tools</a>${ORDER.map(k => `<a href="${D[k].path}">${esc(D[k].h1)}</a>`).join('')}<a href="/story">The story</a></nav>`;
const districtSection = (k, h = 'h2') => { const { top, rest } = inDistrict(k);
  return `<section id="d-${k}"><${h}><a href="${D[k].path}">${esc(D[k].h1)}</a></${h}><p>${esc(D[k].intro)}</p>`
    + (top.length ? `<h3>Top 10 this week in ${esc(copy.landmarks[k])}</h3><ol>${top.map(item).join('')}</ol>${top.length < 10 ? `<p>${10 - top.length} open spot${10 - top.length > 1 ? 's' : ''}. Found a great tool? Submit it on Isomaker.</p>` : ''}` : '')
    + (rest.length ? `<h3>More ${esc(D[k].useCase)}</h3><ul>${rest.map(item).join('')}</ul>` : '') + `</section>`; };
const shell = (inner, crumbs) => `<main id="dir" class="dir" aria-label="Isomaker directory">
<div class="dir-in">
<header class="dir-top"><a class="dir-brand" href="/">Isomaker</a><button type="button" class="dir-x" data-dir-close aria-label="Close the directory">×</button></header>
${crumbs ? `<nav class="dir-crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a> › ` : esc(c[0])).join('')}</nav>` : ''}
${inner}
${nav}
<p class="dir-foot">${esc(copy.valueProp)}. <a href="/">Explore the world</a> · Made by <a href="https://ruthvikvaidya.in/" rel="author">Ruthvik</a></p>
</div>
</main>`;

// ---------- structured data ----------
const org = { '@type':'Organization', '@id':`${SITE}/#org`, name:copy.name, url:`${SITE}/`, logo:`${SITE}/og.png`, founder:{ '@type':'Person', name:'Ruthvik Vaidyanathan', url:'https://ruthvikvaidya.in/' } };
const website = { '@type':'WebSite', '@id':`${SITE}/#site`, name:copy.name, url:`${SITE}/`, description:copy.home.description, publisher:{ '@id':`${SITE}/#org` } };
const crumbsLd = list => ({ '@type':'BreadcrumbList', itemListElement:list.map(([name, path], i) => ({ '@type':'ListItem', position:i + 1, name, item:SITE + path })) });
const itemList = (name, list) => ({ '@type':'ItemList', name, numberOfItems:list.length,
  itemListElement:list.map((p, i) => ({ '@type':'ListItem', position:i + 1, name:p.name, url:placeUrl(p) })) });

const pages = []; // [path, lastmod, priority] for the sitemap
const write = (file, html) => { mkdirSync(join(root, ...file.split('/').slice(0, -1)), { recursive:true }); writeFileSync(join(root, file), html); };

// ---------- home ----------
{
  const inner = `<h1>${esc(copy.home.h1)}</h1><p class="dir-lead">${esc(copy.home.intro)}</p>${ORDER.map(k => districtSection(k)).join('')}`;
  let html = head(base, { title:copy.home.title, description:copy.home.description, url:`${SITE}/`,
    jsonld:{ '@context':'https://schema.org', '@graph':[website, org, { '@type':'CollectionPage', '@id':`${SITE}/#page`, url:`${SITE}/`, name:copy.home.title, description:copy.home.description, isPartOf:{ '@id':`${SITE}/#site` },
      mainEntity:itemList('Tools on Isomaker', places) }] } });
  write('home.html', body(html, shell(inner)));
  pages.push(['/', TODAY, '1.0']);
}
// the app template itself points search engines at the home page
// ---------- use-case pages ----------
for(const k of ORDER){
  const d = D[k], { all } = inDistrict(k), url = SITE + d.path;
  const inner = districtSection(k, 'h1');
  const html = head(base, { title:d.title, description:d.description, url,
    jsonld:{ '@context':'https://schema.org', '@graph':[{ '@type':'CollectionPage', url, name:d.title, description:d.description, isPartOf:{ '@id':`${SITE}/#site` },
      mainEntity:itemList(d.h1, all) }, crumbsLd([['Isomaker','/'], [d.h1, d.path]])] } });
  write(`${k}.html`, body(html, shell(inner, [['Isomaker','/'], [d.h1, d.path]])));
  pages.push([d.path, TODAY, '0.9']);
}
// ---------- place pages ----------
rmSync(join(root, 'place'), { recursive:true, force:true });
let n = 0;
for(const p of places){
  if(!hasPage(p)) continue;   // no card yet: the world's default preview applies
  const d = D[p.district], url = placeUrl(p), img = `${SITE}/places/${p.slug}/card-og.jpg`;
  let title = `${p.name} — ${p.tagline} | Isomaker`; if(!p.tagline || title.length > 60) title = `${p.name}: ${d.useCase} | Isomaker`;
  if(title.length > 60) title = `${p.name} | Isomaker`;
  const description = clip(`${sentence(p.desc || p.tagline)} Find ${p.name} and more ${d.useCase} on Isomaker.`, 158);
  const web = p.site !== false && p.url ? p.url : '', apps = [p.appStore && ['App Store', p.appStore], p.playStore && ['Google Play', p.playStore]].filter(Boolean);
  const { all } = inDistrict(p.district), more = all.filter(x => x !== p).slice(0, 8);
  const inner = `<article class="dir-place">
<h1>${esc(p.name)}</h1>
${p.tagline ? `<p class="dir-lead">${esc(p.tagline)}</p>` : ''}
${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
${p.highlights?.length ? `<ul>${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
<dl>
<dt>Use case</dt><dd><a href="${d.path}">${esc(d.h1)}</a></dd>
${p.top ? `<dt>Top 10</dt><dd>#${p.top} this week in ${esc(copy.landmarks[p.district])}</dd>` : ''}
${p.by ? `<dt>Made by</dt><dd>${p.creatorUrl ? `<a href="${esc(p.creatorUrl)}" rel="nofollow">${esc(p.by)}</a>` : esc(p.by)}</dd>` : ''}
${web ? `<dt>Website</dt><dd><a href="${esc(web)}" rel="nofollow">${esc(host(web))}</a></dd>` : ''}
${apps.map(([l, u]) => `<dt>${l}</dt><dd><a href="${esc(u)}" rel="nofollow">Get ${esc(p.name)}</a></dd>`).join('')}
${p.tags?.length ? `<dt>Tags</dt><dd>${p.tags.map(esc).join(', ')}</dd>` : ''}
</dl>
</article>
${more.length ? `<section><h2>More ${esc(d.useCase)}</h2><ul>${more.map(item).join('')}</ul></section>` : ''}`;
  const app = { '@type':'SoftwareApplication', name:p.name, url:web || apps[0]?.[1] || url, description:p.desc || p.tagline,
    applicationCategory: p.district === 'maker' ? 'DeveloperApplication' : p.district === 'creative' ? 'DesignApplication' : p.district === 'personal' ? 'LifestyleApplication' : 'WebApplication',
    operatingSystem: apps.length && !web ? 'iOS' : 'Web', ...(p.by ? { author:{ '@type': p.creatorUrl ? 'Person' : 'Organization', name:p.by, ...(p.creatorUrl ? { url:p.creatorUrl } : {}) } } : {}),
    ...(p.tags?.length ? { keywords:p.tags.join(', ') } : {}), ...(p.screenshot ? { screenshot:SITE + p.screenshot } : {}), image:img };
  const html = head(base, { title, description, url, image:img, imageAlt:`${p.name}'s place in Isomaker: its building on a small island at night.`,
    jsonld:{ '@context':'https://schema.org', '@graph':[{ '@type':'WebPage', url, name:title, description, isPartOf:{ '@id':`${SITE}/#site` }, mainEntity:app },
      crumbsLd([['Isomaker','/'], [d.h1, d.path], [p.name, `/place/${p.slug}`]])] } });
  write(`place/${p.slug}.html`, body(html, shell(inner, [['Isomaker','/'], [d.h1, d.path], [p.name, `/place/${p.slug}`]])));
  pages.push([`/place/${p.slug}`, p.added || TODAY, p.top ? '0.8' : '0.6']); n++;
}
pages.push(['/story', TODAY, '0.5']);

// ---------- robots.txt, sitemap.xml, llms.txt ----------
writeFileSync(join(root, 'robots.txt'), `# Isomaker welcomes search engines and AI assistants.
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([path, lastmod, pr]) => `  <url><loc>${SITE}${path === '/' ? '/' : path}</loc><lastmod>${lastmod}</lastmod><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
const llmsLine = p => `- [${p.name}](${placeUrl(p)}): ${sentence(p.tagline || p.desc)}${p.by ? ` By ${p.by}.` : ''}${p.top ? ` #${p.top} in this week's top 10.` : ''}`;
writeFileSync(join(root, 'llms.txt'), `# ${copy.name}

> ${copy.valueProp}. ${copy.home.intro}

Isomaker is free to browse at ${SITE}/ on desktop and phone. Tools are grouped by use case; each district's landmark holds a weekly top 10 of hand-picked tools, and anyone can submit a tool for the open spots.

${ORDER.map(k => { const { top, rest } = inDistrict(k);
  return `## ${D[k].h1}\n\n${D[k].intro} Page: ${SITE}${D[k].path}\n\n${top.length ? `### Top 10 this week in ${copy.landmarks[k]}\n\n${top.map(llmsLine).join('\n')}\n\n` : ''}${rest.length ? `### More ${D[k].useCase}\n\n${rest.map(llmsLine).join('\n')}\n` : ''}`; }).join('\n')}
## About

- [The story](${SITE}/story): ${copy.story.description}
- Made by Ruthvik Vaidyanathan: https://ruthvikvaidya.in/
`);
console.log(`Built home, ${ORDER.length} use-case pages, ${n} place page(s), robots.txt, sitemap.xml (${pages.length} URLs) and llms.txt.`);
