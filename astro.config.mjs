// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_URL } from './src/data/site.ts';

// Guides carry their own dates; the sitemap passes them on so crawlers can see what changed.
// Read from the source so the config doesn't import the guides' pictures.
const guideSource = fs.readFileSync(new URL('./src/data/guides.ts', import.meta.url), 'utf8');
const guideDates = new Map(
  [...guideSource.matchAll(/slug: '([^']+)'[\s\S]*?published: '([^']+)'(?:,\s*modified: '([^']+)')?/g)]
    .map(([, slug, published, modified]) => [`${SITE_URL}/guides/${slug}`, modified ?? published]),
);

// https://astro.build/config
export default defineConfig({
  site: `${SITE_URL}/`,
  trailingSlash: 'never',
  build: {
    format: 'file'
  },
  integrations: [sitemap({
    // The 404 page is noindex; /sitemap.xml is the index itself.
    filter: (page) => !/\/404$/.test(page.replace(/\/$/, '')),
    serialize(item) {
      const date = guideDates.get(item.url.replace(/\/$/, ''));
      if (date) item.lastmod = date;
      return item;
    }
  })],
  vite: {
    plugins: [tailwindcss()]
  }
});
