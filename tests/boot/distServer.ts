import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Shared static server for the boot suite.
 *
 * `expo export` writes one `index.html` and no per-route documents, so every
 * spec here needs the same SPA fallback server on its own port.
 */

export const DIST_EXISTS = existsSync('dist/index.html');
export const BUILD_HINT =
  'dist/index.html is missing — run `CI=1 npx expo export --platform web --output-dir dist` first';

let server: ChildProcess | undefined;

export async function startDistServer(port: number): Promise<string> {
  if (!DIST_EXISTS) throw new Error(BUILD_HINT);
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['scripts/serve-dist.mjs', `--port=${port}`], { stdio: 'ignore' });

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/home`);
      if (response.ok) return base;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  stopDistServer();
  throw new Error(`dist server on ${base} did not start`);
}

export function stopDistServer(): void {
  server?.kill();
  server = undefined;
}
