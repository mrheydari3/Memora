/**
 * Route parity — the guard that keeps "everything" true.
 *
 * It derives the route list from `app/` (dropping groups, layouts and the HTML
 * shell), then proves:
 *   - every route file has a surface entry;
 *   - every declared route has a file;
 *   - every fixture and every gate is exercised;
 *   - overlays say how they are opened.
 *
 * Run: npm run test:surfaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ALL_GATES,
  EXPECTED_SURFACE_COUNT,
  FIXTURES,
  ROUTE_PATTERNS,
  SURFACES,
} from './surfaces';

const APP_ROOT = join(process.cwd(), 'app');

function deriveRoutes(dir: string, root: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      deriveRoutes(full, root, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
    if (entry.name.startsWith('_layout') || entry.name === '+html.tsx') continue;
    if (entry.name === '+not-found.tsx') {
      out.push('*');
      continue;
    }
    const segments = relative(root, full)
      .replace(/\\/g, '/')
      .replace(/\.tsx?$/, '')
      .split('/')
      .filter((segment) => !/^\(.*\)$/.test(segment));
    if (segments[segments.length - 1] === 'index') segments.pop();
    out.push('/' + segments.join('/'));
  }
  return out;
}

const derivedRoutes = deriveRoutes(APP_ROOT, APP_ROOT, []).sort();
const declaredRoutes = [...ROUTE_PATTERNS].sort();
const coveredRoutes = new Set<string>(SURFACES.map((surface) => surface.route));

test('every route file under app/ has a surface entry', () => {
  const missing = derivedRoutes.filter((route) => !coveredRoutes.has(route));
  assert.deepEqual(missing, [], `Unmapped route(s): ${missing.join(', ')}`);
});

test('the manifest declares only routes that app/ defines', () => {
  const derived = new Set(derivedRoutes);
  const unknown = [...new Set(SURFACES.map((surface) => surface.route).filter((route) => !derived.has(route)))];
  assert.deepEqual(unknown, [], `Route(s) with no file: ${unknown.join(', ')}`);
});

test('the declared route list matches the filesystem exactly', () => {
  assert.deepEqual(declaredRoutes, derivedRoutes);
});

test(`the manifest holds exactly ${EXPECTED_SURFACE_COUNT} surfaces`, () => {
  assert.equal(SURFACES.length, EXPECTED_SURFACE_COUNT);
});

test('surface ids are unique', () => {
  const ids = SURFACES.map((surface) => surface.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate surface id');
});

test('every surface names at least one valid fixture', () => {
  for (const surface of SURFACES) {
    assert.ok(surface.fixtures.length > 0, `${surface.id} has no fixture`);
    for (const fixture of surface.fixtures) {
      assert.ok((FIXTURES as readonly string[]).includes(fixture), `${surface.id} uses unknown fixture ${fixture}`);
    }
  }
});

test('every surface names only valid gates', () => {
  for (const surface of SURFACES) {
    assert.ok(surface.gates.length > 0, `${surface.id} has no gates`);
    for (const gate of surface.gates) {
      assert.ok((ALL_GATES as readonly string[]).includes(gate), `${surface.id} uses unknown gate ${gate}`);
    }
  }
});

test('every fixture F0–F6 is exercised', () => {
  const used = new Set(SURFACES.flatMap((surface) => surface.fixtures));
  const unused = FIXTURES.filter((fixture) => !used.has(fixture));
  assert.deepEqual(unused, [], `Unused fixture(s): ${unused.join(', ')}`);
});

test('every gate G1–G12 is exercised', () => {
  const used = new Set(SURFACES.flatMap((surface) => surface.gates));
  const unused = ALL_GATES.filter((gate) => !used.has(gate));
  assert.deepEqual(unused, [], `Unused gate(s): ${unused.join(', ')}`);
});

test('every overlay says how it is opened', () => {
  for (const surface of SURFACES.filter((entry) => entry.overlay)) {
    assert.ok(surface.trigger && surface.trigger.trim().length > 0, `${surface.id} is an overlay without a trigger`);
  }
});

test('coverage summary', () => {
  const gateUses = Object.fromEntries(
    ALL_GATES.map((gate) => [gate, SURFACES.filter((surface) => surface.gates.includes(gate)).length])
  );
  console.log(`surfaces: ${SURFACES.length}`);
  console.log(`routes: ${derivedRoutes.length}/${ROUTE_PATTERNS.length} mapped`);
  console.log(
    `fixtures: ${FIXTURES.map((fixture) => `${fixture}=${SURFACES.filter((surface) => surface.fixtures.includes(fixture)).length}`).join(' ')}`
  );
  console.log(`gates: ${Object.entries(gateUses).map(([gate, count]) => `${gate}=${count}`).join(' ')}`);
  console.log(`overlays: ${SURFACES.filter((surface) => surface.overlay).length}`);
  assert.equal(derivedRoutes.length, ROUTE_PATTERNS.length);
});
