// /sitemap.xml: the address people and tools look for first. It is a sitemap index pointing at
// the URL list @astrojs/sitemap writes (sitemap-0.xml), so there is one list of pages to keep.
import { SITE_URL } from '../data/site';

export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap-0.xml</loc></sitemap>
</sitemapindex>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
