/**
 * Test-only resolver hook.
 *
 * The app's modules use extensionless relative imports (`'../fsrs-params'`),
 * which Metro resolves but Node's ESM loader does not. Node can strip the
 * TypeScript types itself; this hook only fills in the missing extension so
 * `npm test` can import the real modules instead of a test-only copy.
 *
 * Used by the `test` script: node --import ./scripts/ts-resolve.mjs --test ...
 */
import { registerHooks } from 'node:module';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];

function hasExtension(specifier) {
  return /\.[cm]?[jt]sx?$/.test(specifier) || /\.[a-z]+$/i.test(specifier);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !hasExtension(specifier)) {
      for (const extension of EXTENSIONS) {
        try {
          return nextResolve(specifier + extension, context);
        } catch {
          // try the next extension
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
