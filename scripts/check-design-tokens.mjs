/**
 * Design-token guard.
 *
 * Fails when a raw colour literal appears outside `theme/`. Every colour in the
 * app must come from `theme/palette.js` (directly, or through `theme/tokens.ts`
 * and the Tailwind classes generated from it), otherwise the design language
 * drifts back into per-screen one-offs.
 *
 * Escape hatch: a trailing `// design-ignore` comment on the line, used only by
 * the flashcard's type-specific line heights.
 *
 * Run: npm run check:design
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app', 'components'];
const EXTENSIONS = /\.(tsx?|jsx?)$/;
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;
const SKIP_DIRECTORIES = new Set(['node_modules', '.expo', 'dist', '.git']);

const files = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRECTORIES.has(name)) walk(path);
    } else if (EXTENSIONS.test(name)) {
      files.push(path);
    }
  }
}

for (const root of ROOTS) walk(root);

const hits = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (RAW_COLOUR.test(line) && !line.includes('design-ignore')) {
      hits.push(`${relative(process.cwd(), file)}:${index + 1}  ${line.trim()}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`Design tokens: ${hits.length} raw colour literal(s) outside theme/\n`);
  console.error(hits.join('\n'));
  process.exit(1);
}

console.log(`Design tokens: clean (${files.length} files checked)`);
