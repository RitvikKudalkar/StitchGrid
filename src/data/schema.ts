import { AUTHOR, SITE_NAME, SITE_URL } from './site';

export interface Faq {
  question: string;
  answer: string;
}

/** schema.org FAQPage data. Render the same list visibly on the page. */
export function faqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
    }))
  };
}

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** The site as an entity. Emitted once on the homepage; other pages point at it by @id. */
export function siteSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORG_ID,
      "name": SITE_NAME,
      "url": `${SITE_URL}/`,
      "logo": `${SITE_URL}/apple-touch-icon.png`,
      "description": "Free, private, in-browser tools that turn a photo into a printable craft pattern.",
      "founder": { "@type": "Person", "name": AUTHOR.name, "url": AUTHOR.url }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      "name": SITE_NAME,
      "url": `${SITE_URL}/`,
      "publisher": { "@id": ORG_ID }
    }
  ];
}

/** A tool page as a free browser app, plus its breadcrumb. */
export function toolSchemas(opts: { path: string; name: string; description: string }) {
  const url = `${SITE_URL}${opts.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": opts.name,
      "url": url,
      "description": opts.description,
      "applicationCategory": "DesignApplication",
      "operatingSystem": "Any",
      "browserRequirements": "Requires a modern web browser with JavaScript",
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "publisher": { "@id": ORG_ID },
      "isPartOf": { "@id": WEBSITE_ID }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/` },
        { "@type": "ListItem", "position": 2, "name": opts.name, "item": url }
      ]
    }
  ];
}
