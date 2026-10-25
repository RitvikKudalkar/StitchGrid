// Sends every non-canonical URL to its canonical form with a single permanent 301:
// https, no www., no trailing slash and no .html extension. Everything else is handed
// to the static assets.
const CANONICAL_HOST = 'patternsquare.com';

// Moved pages go here as permanent redirects, so old links keep their rankings.
const REDIRECTS = {};

/** "/page/", "/page.html" and "/index.html" become "/page" and "/". */
function canonicalPath(pathname) {
	let path = pathname.replace(/\/+$/, '').replace(/\.html$/, '');
	if (path === '/index' || path === '') path = '/';
	else path = path.replace(/\/index$/, '');
	return REDIRECTS[path] ?? path;
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const target = new URL(url);

		// Leave local/preview hosts (localhost, *.workers.dev) on their own host.
		if (url.hostname.endsWith(CANONICAL_HOST)) {
			target.hostname = CANONICAL_HOST;
			target.protocol = 'https:';
			target.port = '';
		}
		target.pathname = canonicalPath(url.pathname);

		// Without this, the assets layer answers /page/ and /page.html with a temporary 307.
		if (target.href !== url.href) {
			return Response.redirect(target.toString(), 301);
		}

		const response = await env.ASSETS.fetch(request);
		// The workers.dev address is a preview copy of the site: keep it out of search results.
		if (url.hostname.endsWith('.workers.dev')) {
			const preview = new Response(response.body, response);
			preview.headers.set('X-Robots-Tag', 'noindex');
			return preview;
		}
		return response;
	},
};
