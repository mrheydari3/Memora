/**
 * Build the upload bundle for the static Sites deployment.
 *
 * Metro copies package assets into `dist/assets/node_modules`: every weight of
 * @expo-google-fonts/inter, every icon family, and a few expo-router error
 * images. The app serves its six real faces from `public/fonts` through
 * `services/webFonts.ts`, so those package copies are dead weight in the upload.
 * The hosting validator also rejects any `node_modules` path inside the asset
 * bundle. Removing the directory keeps the upload small and clean without
 * touching the files the browser requests.
 */
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'dist');
const TARGET = join(ROOT, 'dist-deploy');
const LIMIT_BYTES = 10 * 1024 * 1024;
const LIMIT_FILES = 1000;

if (!existsSync(join(SOURCE, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build:web` first.');
  process.exit(2);
}

rmSync(TARGET, { recursive: true, force: true });
cpSync(SOURCE, TARGET, { recursive: true });

// These are Metro's copies, not the served faces. The served files live in
// `dist/fonts` and are referenced by absolute `/fonts/*` URLs. The whole
// directory is removed because the upload validator rejects dependency paths.
rmSync(join(TARGET, 'assets/node_modules'), { recursive: true, force: true });

const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push({ path, bytes: statSync(path).size });
  }
};
walk(TARGET);

const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
const size = `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const forbidden = files.filter(({ path }) => {
  const relative = path.slice(TARGET.length + 1);
  return (
    relative.includes('node_modules/') ||
    relative.split('/').some((part) => part.startsWith('.')) ||
    /\.(map|pem|key)$/i.test(relative)
  );
});

if (forbidden.length > 0) {
  console.error(`dist-deploy contains non-public paths: ${forbidden.map((file) => file.path).join(', ')}`);
  process.exit(1);
}

if (bytes > LIMIT_BYTES || files.length > LIMIT_FILES) {
  console.error(
    `dist-deploy is too large for Sites: ${size}, ${files.length} files (limit ${LIMIT_BYTES / 1024 / 1024} MiB, ${LIMIT_FILES} files).`
  );
  process.exit(1);
}

console.log(`dist-deploy: ${size}, ${files.length} files.`);
