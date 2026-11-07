/**
 * Static server for the exported web build.
 *
 *   node scripts/serve-dist.mjs --port=3107 --root=dist
 *
 * `expo export --platform web` emits no per-route HTML files, so a request for
 * an extensionless route has to be answered with `index.html` (SPA fallback).
 * Everything is served `no-store`: a boot measurement must never read a cached
 * document or a stale chunk.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.find((entry) => entry.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

const ROOT = resolve(arg('root', 'dist'));
const PORT = Number(arg('port', process.env.PORT ?? '3107'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(
    `no index.html in ${ROOT}; build it first: CI=1 npx expo export --platform web --output-dir ${ROOT}`
  );
  process.exit(2);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requested = decodeURIComponent(url.pathname);
  // Resolve inside ROOT only; a traversal attempt falls back to the shell.
  let file = resolve(join(ROOT, requested));
  if (!file.startsWith(ROOT)) file = join(ROOT, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, requested, 'index.html');
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, 'index.html');
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`dist on http://127.0.0.1:${PORT}`);
});
