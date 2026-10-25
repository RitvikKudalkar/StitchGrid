// /llms.txt: a plain summary of the site for AI search and assistants (llmstxt.org).
import { guides } from '../data/guides';
import { SITE_NAME, SITE_URL } from '../data/site';
import { liveTools } from '../data/tools';

export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    '> Free tools that turn a photo into a printable craft pattern. Everything runs in the browser: photos are never uploaded.',
    '',
    '## Tools',
    '',
    ...liveTools.map((t) => `- [${t.name}](${SITE_URL}/${t.slug}): ${t.pitch}`),
    '',
    '## Guides',
    '',
    ...guides.map((g) => `- [${g.title}](${SITE_URL}/guides/${g.slug}): ${g.description}`),
    '',
    '## About',
    '',
    `- [About ${SITE_NAME}](${SITE_URL}/about): who makes it and how the patterns are made`,
    `- [Privacy policy](${SITE_URL}/privacy-policy): photos are processed on the visitor's device and never uploaded`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
