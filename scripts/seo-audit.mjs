// Checks the built site (dist/) for the SEO basics on every page: title and description length
// and uniqueness, one H1, heading order, canonical and Open Graph tags, valid JSON-LD, image alt
// text and sizes, internal links that resolve, and the sitemap matching the pages.
// Run after `npm run build`: `npm run seo`. Exits non-zero on any error.

import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '../dist');
const site = fs.readFileSync(path.resolve(import.meta.dirname, '../src/data/site.ts'), 'utf8').match(/SITE_URL = '([^']+)'/)[1];

const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== '_astro') walk(p);
    else if (f.name.endsWith('.html')) pages.push(p);
  }
})(dist);

const urlFor = (file) => {
  const rel = path.relative(dist, file).replace(/\\/g, '/').replace(/\.html$/, '').replace(/(^|\/)index$/, '');
  return rel ? `/${rel}` : '/';
};
const exists = (url) => {
  const clean = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (clean === '/') return true;
  return [`${clean}.html`, `${clean}/index.html`, clean].some((c) => fs.existsSync(path.join(dist, c)));
};

const errors = [];
const warnings = [];
const titles = new Map();
const descriptions = new Map();
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

for (const file of pages) {
  const url = urlFor(file);
  const html = fs.readFileSync(file, 'utf8');
  const err = (m) => errors.push(`${url}: ${m}`);
  const warn = (m) => warnings.push(`${url}: ${m}`);
  const noindex = /<meta name="robots" content="noindex"/.test(html);

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = attr(html.match(/<meta name="description"[^>]*>/)?.[0] ?? '', 'content');
  if (!title) err('no <title>');
  else {
    if (title.length > 60) warn(`title is ${title.length} characters (keep to 60): "${title}"`);
    titles.set(title, [...(titles.get(title) ?? []), url]);
  }
  if (!desc) err('no meta description');
  else {
    if (desc.length > 155) warn(`description is ${desc.length} characters (keep to 155)`);
    if (desc.length < 70 && !noindex) warn(`description is short (${desc.length} characters)`);
    descriptions.set(desc, [...(descriptions.get(desc) ?? []), url]);
  }
  if (!/<html lang="/.test(html)) err('no lang on <html>');

  const canonical = attr(html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '', 'href');
  if (noindex) {
    if (canonical) err('noindex page should not declare a canonical');
  } else {
    const expected = site + (url === '/' ? '/' : url);
    if (canonical !== expected) err(`canonical is ${canonical}, expected ${expected}`);
  }
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) {
    const v = attr(html.match(new RegExp(`<meta property="${prop}"[^>]*>`))?.[0] ?? '', 'content');
    if (!v) err(`no ${prop}`);
    else if ((prop === 'og:url' || prop === 'og:image') && !v.startsWith(site)) err(`${prop} is not absolute on ${site}: ${v}`);
  }
  if (!/<meta name="twitter:card"/.test(html)) err('no twitter:card');

  // Headings: one H1, no skipped levels.
  const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  const h1s = visible.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) err(`${h1s} <h1> elements`);
  let last = 1;
  for (const m of visible.matchAll(/<h([1-6])[\s>]/g)) {
    const level = Number(m[1]);
    if (level > last + 1) warn(`heading jumps from h${last} to h${level}`);
    last = level;
  }

  // Structured data parses and has a type.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      if (!data['@type']) err('JSON-LD without @type');
      if (data['@type'] === 'FAQPage') {
        for (const q of data.mainEntity) if (!visible.includes(q.name.replace(/'/g, '&#39;')) && !visible.includes(q.name)) warn(`FAQ question not visible on the page: "${q.name}"`);
      }
    } catch (e) {
      err(`invalid JSON-LD: ${e.message}`);
    }
  }

  // Images: alt present, size set.
  for (const m of visible.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    // A bare `alt` is an empty alt: correct for decorative images.
    if (!/\salt(="|[\s>])/.test(tag)) err(`image without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="/.test(tag) || !/\sheight="/.test(tag)) warn(`image without width/height: ${tag.slice(0, 80)}`);
  }

  // Internal links resolve and use the canonical form.
  for (const m of visible.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href) && !href.startsWith(site)) continue;
    const local = href.startsWith(site) ? href.slice(site.length) || '/' : href;
    if (!local.startsWith('/')) continue;
    if (/\.html(#|$)/.test(local) || (local.length > 1 && /\/(#|$)/.test(local.split('?')[0]))) warn(`link not in canonical form: ${href}`);
    if (!exists(local)) err(`broken internal link: ${href}`);
  }
}

for (const [t, urls] of titles) if (urls.length > 1) errors.push(`duplicate title "${t}" on ${urls.join(', ')}`);
for (const [d, urls] of descriptions) if (urls.length > 1) errors.push(`duplicate description on ${urls.join(', ')}`);

// Sitemap: every indexable page listed, nothing else.
const sitemapUrls = new Set();
for (const f of fs.readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f))) {
  for (const m of fs.readFileSync(path.join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) if (!/sitemap[^/]*\.xml$/.test(m[1])) sitemapUrls.add(m[1]);
}
for (const file of pages) {
  const url = urlFor(file);
  const html = fs.readFileSync(file, 'utf8');
  const indexable = !/<meta name="robots" content="noindex"/.test(html);
  const loc = site + (url === '/' ? '/' : url);
  if (indexable && !sitemapUrls.has(loc)) errors.push(`${url}: missing from the sitemap`);
  if (!indexable && sitemapUrls.has(loc)) errors.push(`${url}: noindex page is in the sitemap`);
}
if (!fs.existsSync(path.join(dist, 'sitemap.xml'))) errors.push('no /sitemap.xml');
const robots = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8');
for (const m of robots.matchAll(/^Sitemap: (.+)$/gm)) if (!fs.existsSync(path.join(dist, m[1].replace(site, '')))) errors.push(`robots.txt points at a missing sitemap: ${m[1]}`);

console.log(`${pages.length} pages, ${sitemapUrls.size} URLs in the sitemap\n`);
if (warnings.length) console.log(`WARN\n${warnings.map((w) => `  ${w}`).join('\n')}\n`);
if (errors.length) console.log(`ERROR\n${errors.map((e) => `  ${e}`).join('\n')}\n`);
console.log(`${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
