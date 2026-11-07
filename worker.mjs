/**
 * Memora is a fully client-side Expo web build: dist/ contains one SPA entry
 * and every route (/home, /deck/:id, /study/:id) is resolved by Expo Router in
 * the browser.
 *
 * A navigation to an extensionless path is answered with the exported document
 * on that same path, so a deep link or refresh keeps its route. The asset
 * router's own SPA handling redirects such paths to `/`, which would throw the
 * deck id away; its `/index.html` path is not addressable, so the document is
 * read from `/`.
 *
 * Asset requests are served from the exported files and still 404 when missing:
 * only GET requests that explicitly accept HTML take the document shortcut.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const accept = request.headers.get('accept') ?? '';
    const isNavigation =
      request.method === 'GET' && accept.includes('text/html') && !/\.[a-z0-9]+$/i.test(url.pathname);

    if (isNavigation) {
      const document = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      if (document.ok) return document;
    }

    return env.ASSETS.fetch(request);
  },
};
