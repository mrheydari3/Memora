/**
 * Phase 4 node census.
 *
 *   npm run census:dry        # no browser: prove all 84 rows resolve
 *   npm run census            # walk every surface in Chromium
 *   npm run census -- --surface=HM-08
 *   npm run census -- --strict
 *
 * A surface counts as visited only when its fixture sentinel is verified on the
 * resolved route and every declared trigger action succeeds. Node findings and
 * axe nodes are reported per surface; `--strict` turns them into a non-zero exit
 * as well. An unvisited row is always a failure.
 *
 * Browser environment in this workspace:
 *   PLAYWRIGHT_BROWSERS_PATH=0
 *   PLAYWRIGHT_LIBS_DIR=$PWD/.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu
 */

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SURFACES } from '../tests/ui/surfaces.ts';
import {
  assertFixtureSentinel,
  buildFixture,
  countsFromEntries,
  fixtureInitScript,
} from '../tests/ui/fixtures.ts';
import { allCensusTargets, censusTargets } from '../tests/ui/census-plan.ts';
import { STORAGE_KEYS as K } from '../data/storageKeys.ts';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const STRICT = args.includes('--strict');
const NO_AXE = args.includes('--no-axe');
const surfaceArg = args.find((arg) => arg.startsWith('--surface='))?.split('=')[1];
const baseArg = args.find((arg) => arg.startsWith('--base='))?.split('=')[1];
const BASE = (baseArg ?? process.env.BASE_URL ?? 'http://127.0.0.1:3005').replace(/\/$/, '');
const NOW = Date.now();
const OUT = 'audit/census';
const READ_KEYS = [
  K.decks,
  K.folders,
  K.allCards,
  K.reviewLog,
  K.settings,
  K.gameRecords,
  K.initialized,
];

if (process.env.PLAYWRIGHT_LIBS_DIR) {
  process.env.LD_LIBRARY_PATH = `${process.env.PLAYWRIGHT_LIBS_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`;
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

/** Runs in the page. Keep it self-contained: page.evaluate cannot close over Node values. */
async function scanNodes() {
  const SELECTOR =
    'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]';
  const VALID_ROLES = new Set([
    'button',
    'link',
    'tab',
    'switch',
    'checkbox',
    'radio',
    'combobox',
    'textbox',
    'searchbox',
    'menuitem',
    'option',
    'slider',
    'spinbutton',
    'progressbar',
    'dialog',
    'listbox',
    'menu',
  ]);
  const clean = (value) =>
    String(value ?? '')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const isIcon = (element) => {
    const family = getComputedStyle(element).fontFamily || '';
    return /material icons|material symbols|ionicons|fontawesome/i.test(family);
  };
  const visibleText = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = '';
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (
        parent &&
        !parent.closest('[aria-hidden="true"]') &&
        !isIcon(parent) &&
        !parent.closest('[aria-hidden="true"]')
      ) {
        text += node.textContent ?? '';
      }
      node = walker.nextNode();
    }
    return clean(text);
  };
  const nameOf = (element) => {
    const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    const labels = element.labels ? [...element.labels].map((label) => label.textContent).join(' ') : '';
    return clean(
      element.getAttribute('aria-label') ||
        labelledBy ||
        labels ||
        element.getAttribute('alt') ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        visibleText(element)
    );
  };

  const nodes = [];
  const seen = new Set();
  const focusableHidden = [];
  const duplicateIds = [];
  const ids = new Map();
  // An open sheet is the surface under measurement. Content behind its scrim
  // is intentionally covered and must not be reported as obscured controls.
  const activeDialog = [...document.querySelectorAll('[role="dialog"]')].at(-1) ?? null;

  for (const element of document.querySelectorAll('[id]')) {
    const id = element.id;
    if (ids.has(id)) duplicateIds.push(id);
    else ids.set(id, true);
  }

  for (const hidden of document.querySelectorAll('[aria-hidden="true"]')) {
    if (activeDialog && !activeDialog.contains(hidden)) continue;
    if (hidden.tabIndex >= 0 || hidden.querySelector(SELECTOR)) {
      focusableHidden.push({
        tag: hidden.tagName.toLowerCase(),
        name: clean(hidden.textContent).slice(0, 80),
      });
    }
  }

  for (const element of document.querySelectorAll(SELECTOR)) {
    if (seen.has(element)) continue;
    seen.add(element);
    if (activeDialog && !activeDialog.contains(element)) continue;

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (element.getClientRects().length === 0) continue;

    if (element.closest('[aria-hidden="true"]')) {
      if (element.tabIndex >= 0) {
        focusableHidden.push({
          tag: element.tagName.toLowerCase(),
          name: clean(element.textContent).slice(0, 80),
        });
      }
      continue;
    }

    const disabled =
      element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
    const centerHit = () => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        Math.min(window.innerWidth - 1, Math.max(0, box.left + box.width / 2)),
        Math.min(window.innerHeight - 1, Math.max(0, box.top + box.height / 2))
      );
      return Boolean(top && (element === top || element.contains(top)));
    };
    if (!disabled) {
      const before = element.getBoundingClientRect();
      const outsideViewport =
        before.top < 0 ||
        before.left < 0 ||
        before.bottom > window.innerHeight ||
        before.right > window.innerWidth;
      // A row can be inside the viewport yet still under the floating tab bar,
      // or inside a sheet body clipped by its scroll viewport. Scroll it to the
      // centre before measuring so scrolling is not mistaken for an overlay.
      if (outsideViewport || !centerHit()) {
        element.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      }
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const name = nameOf(element);
    const text = visibleText(element);
    const role = element.getAttribute('role') || element.tagName.toLowerCase();
    const violations = [];

    if (!name) violations.push('G4-name-empty');
    if (text && name && !name.toLowerCase().includes(text.toLowerCase())) {
      violations.push('G4-name-contains-text');
    }
    if (element.getAttribute('role') && !VALID_ROLES.has(element.getAttribute('role'))) {
      violations.push('G4-valid-role');
    }
    if (element.parentElement?.closest(SELECTOR)) violations.push('G4-nested-interactive');

    const roleAttr = element.getAttribute('role');
    if (['switch', 'checkbox', 'radio'].includes(roleAttr) && !element.hasAttribute('aria-checked')) {
      violations.push('G4-state-checked');
    }
    if (roleAttr === 'tab' && !element.hasAttribute('aria-selected')) {
      violations.push('G4-state-selected');
    }
    if (roleAttr === 'combobox' && !element.hasAttribute('aria-expanded')) {
      violations.push('G4-state-expanded');
    }

    if (!disabled && (rect.width < 44 || rect.height < 44)) violations.push('G5-target-44');
    if (
      rect.top < -1 ||
      rect.left < -1 ||
      rect.bottom > window.innerHeight + 1 ||
      rect.right > window.innerWidth + 1
    ) {
      violations.push('G7-inside-viewport');
    }

    if (!disabled) {
      const top = document.elementFromPoint(
        Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
        Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
      );
      if (!top || !(element === top || element.contains(top))) violations.push('G5-obscured');
    }

    if (!disabled && element.tabIndex < 0) violations.push('G6-tab-order');

    if (!disabled) {
      element.focus({ preventScroll: true });
      const focusVisible = element.matches(':focus-visible');
      const focusStyle = getComputedStyle(element);
      const ring =
        (focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0) ||
        focusStyle.boxShadow !== 'none';
      if (document.activeElement === element && focusVisible && !ring) {
        violations.push('G6-focus-ring');
      }
    }

    nodes.push({
      tag: element.tagName.toLowerCase(),
      role,
      name,
      text: text.slice(0, 80),
      tabIndex: element.tabIndex,
      disabled,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      violations,
    });
  }

  const iconGlyphs = [];
  for (const element of document.querySelectorAll('*')) {
    if (activeDialog && !activeDialog.contains(element)) continue;
    if (!isIcon(element)) continue;
    if (element.closest('[aria-hidden="true"]')) continue;
    iconGlyphs.push({
      tag: element.tagName.toLowerCase(),
      text: clean(element.textContent).slice(0, 40),
    });
  }

  return { nodes, focusableHidden, duplicateIds: [...new Set(duplicateIds)], iconGlyphs };
}

function plan() {
  const surfaces = surfaceArg
    ? SURFACES.filter((surface) => surface.id === surfaceArg)
    : SURFACES;
  if (surfaceArg && surfaces.length === 0) throw new Error(`unknown surface: ${surfaceArg}`);
  const targets = allCensusTargets(surfaces);
  const counts = new Map();
  for (const target of targets) counts.set(target.surfaceId, (counts.get(target.surfaceId) ?? 0) + 1);
  return { surfaces, targets, counts };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { surfaces, targets, counts } = plan();

  if (DRY) {
    const missing = surfaces.filter((surface) => !counts.has(surface.id));
    const noTargets = targets.filter((target) => !target.url);
    const duplicateTargets = targets.filter(
      (target, index) =>
        targets.findIndex(
          (other) => other.surfaceId === target.surfaceId && other.fixture === target.fixture
        ) !== index
    );
    const planRows = targets.map((target) => ({
      ...target,
      fixtureLabel: buildFixture(target.fixture, NOW).label,
    }));
    writeFileSync(join(OUT, 'plan.json'), JSON.stringify({ generatedAt: new Date().toISOString(), targets: planRows }, null, 2));
    console.log(`CENSUS_SURFACES=${surfaces.length}`);
    console.log(`CENSUS_TARGETS=${targets.length}`);
    console.log(`CENSUS_MISSING=${missing.length}`);
    console.log(`CENSUS_NO_URL=${noTargets.length}`);
    console.log(`CENSUS_DUPLICATE_TARGETS=${duplicateTargets.length}`);
    console.log(
      `CENSUS_STATES=${JSON.stringify(
        targets.reduce((acc, target) => {
          acc[target.state] = (acc[target.state] ?? 0) + 1;
          return acc;
        }, {})
      )}`
    );
    if (missing.length || noTargets.length || duplicateTargets.length) {
      console.error('CENSUS_DRY=FAIL');
      process.exitCode = 1;
    } else {
      console.log('CENSUS_DRY=PASS');
    }
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const runs = [];

  for (const target of targets) {
    const spec = buildFixture(target.fixture, NOW);
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 240));
    });
    page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));

    const run = {
      surfaceId: target.surfaceId,
      label: target.label,
      fixture: target.fixture,
      url: target.url,
      state: target.state,
      actions: target.actions,
      ok: false,
      error: null,
      nodeCount: 0,
      violationCount: 0,
      violations: [],
      axeViolations: 0,
      axeNodes: 0,
      axe: [],
      focusableHidden: [],
      duplicateIds: [],
      iconGlyphs: [],
      consoleErrors,
      pageErrors,
      pointerFallbacks: [],
      ariaSnapshot: `${target.surfaceId}-${target.fixture}.aria.yml`,
    };

    try {
      await page.addInitScript({ content: fixtureInitScript(spec) });
      await page.goto(BASE + target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(500);

      if (spec.failure?.readThrows?.length) {
        await page
          .getByText(spec.sentinel.text, { exact: false })
          .first()
          .waitFor({ state: 'visible', timeout: 20_000 });
      } else {
        const deadline = Date.now() + 20_000;
        let sentinelError = null;
        while (Date.now() < deadline) {
          try {
            const raw = await page.evaluate((keys) => {
              const out = {};
              for (const key of keys) out[key] = localStorage.getItem(key);
              return out;
            }, READ_KEYS);
            const entries = Object.fromEntries(
              Object.entries(raw).filter(([, value]) => value !== null)
            );
            const actual = countsFromEntries(entries);
            assertFixtureSentinel(actual, spec, 'booted');
            sentinelError = null;
            break;
          } catch (error) {
            sentinelError = error;
            await page.waitForTimeout(200);
          }
        }
        if (sentinelError) throw sentinelError;
      }

      for (const action of target.actions) {
        // An open sheet owns the interaction: the covered route is still in the
        // DOM, so an unscoped role query can select its identically named row
        // behind the modal and record a false pointer interception.
        const dialog = page.getByRole('dialog').last();
        const scope = (await dialog.count()) > 0 ? dialog : page;
        if (action.kind === 'click') {
          const control = scope
            .getByRole('button', { name: action.name, exact: action.exact ?? true })
            .first();
          if ((await control.count()) === 0) {
            throw new Error(`button not found: ${action.name}`);
          }
          try {
            await control.click({ timeout: 3_000 });
          } catch {
            // The control is in the accessibility tree but a pointer click is
            // intercepted (the scrim/sheet layer). Fire the DOM click so the
            // surface can still be censused; the obstruction is recorded and
            // must be resolved by G5, not hidden.
            await control.evaluate((element) => element.click());
            run.pointerFallbacks.push(action.name);
          }
        } else if (action.kind === 'fill') {
          await scope.getByLabel(action.label, { exact: true }).first().fill(action.value);
        } else if (action.kind === 'press') {
          await page.keyboard.press(action.key);
        } else if (action.kind === 'scroll') {
          await page.getByText(action.text, { exact: true }).first().scrollIntoViewIfNeeded();
        } else if (action.kind === 'expect') {
          await page
            .getByText(action.text, { exact: false })
            .first()
            .waitFor({ state: 'visible', timeout: 10_000 });
        }
        await page.waitForTimeout(250);
      }

      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const scan = await page.evaluate(scanNodes);
      const ariaSnapshot = await page.locator('body').ariaSnapshot();
      writeFileSync(join(OUT, run.ariaSnapshot), ariaSnapshot);

      let axe = { violations: [] };
      if (!NO_AXE) {
        axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          // Expo's development LogBox mounts a shadow-root error toast outside
          // the app when the F6 fixture makes a read throw. It is not shipped
          // UI; the app's own recovery screen is measured separately.
          .exclude('#error-toast')
          .analyze();
      }

      run.nodeCount = scan.nodes.length;
      run.violations = scan.nodes
        .filter((node) => node.violations.length > 0)
        .map((node) => ({
          tag: node.tag,
          role: node.role,
          name: node.name,
          width: node.width,
          height: node.height,
          violations: node.violations,
        }));
      run.violationCount =
        run.violations.length +
        scan.focusableHidden.length +
        scan.duplicateIds.length +
        scan.iconGlyphs.length;
      run.focusableHidden = scan.focusableHidden;
      run.duplicateIds = scan.duplicateIds;
      run.iconGlyphs = scan.iconGlyphs;
      run.axe = axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        samples: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
      }));
      run.axeViolations = run.axe.length;
      run.axeNodes = run.axe.reduce((total, violation) => total + violation.nodes, 0);
      run.ok = true;
    } catch (error) {
      run.error = String(error).slice(0, 500);
    } finally {
      await page.close();
      runs.push(run);
    }
    console.log(
      `${run.ok ? 'VISITED' : 'FAILED '} ${target.surfaceId} ${target.fixture} ${target.url} nodes=${run.nodeCount} violations=${run.violationCount} axe=${run.axeNodes}`
    );
  }

  await context.close();
  await browser.close();

  const visited = new Set(
    surfaces
      .filter((surface) => {
        const surfaceTargets = censusTargets(surface);
        return surfaceTargets.every((target) =>
          runs.some(
            (run) =>
              run.ok &&
              run.surfaceId === target.surfaceId &&
              run.fixture === target.fixture
          )
        );
      })
      .map((surface) => surface.id)
  );
  const unvisited = surfaces.filter((surface) => !visited.has(surface.id));
  const totals = runs.reduce(
    (acc, run) => {
      acc.nodes += run.nodeCount;
      acc.violations += run.violationCount;
      acc.axeNodes += run.axeNodes;
      acc.consoleErrors += run.consoleErrors.length + run.pageErrors.length;
      return acc;
    },
    { nodes: 0, violations: 0, axeNodes: 0, consoleErrors: 0 }
  );

  writeFileSync(
    join(OUT, 'report.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: BASE,
        surfaces: surfaces.length,
        targets: targets.length,
        visited: visited.size,
        unvisited: unvisited.map((surface) => surface.id),
        totals,
        runs,
      },
      null,
      2
    )
  );

  console.log(`CENSUS_SURFACES=${surfaces.length}`);
  console.log(`CENSUS_TARGETS=${targets.length}`);
  console.log(`CENSUS_VISITED=${visited.size}`);
  console.log(`CENSUS_UNVISITED=${unvisited.length}${unvisited.length ? `:${unvisited.map((s) => s.id).join(',')}` : ''}`);
  console.log(`CENSUS_NODES=${totals.nodes}`);
  console.log(`CENSUS_VIOLATIONS=${totals.violations}`);
  console.log(`CENSUS_AXE_NODES=${totals.axeNodes}`);
  console.log(`CENSUS_CONSOLE_ERRORS=${totals.consoleErrors}`);
  console.log(
    `CENSUS_STATES=${JSON.stringify(
      runs.reduce((acc, run) => {
        acc[run.state] = (acc[run.state] ?? 0) + 1;
        return acc;
      }, {})
    )}`
  );

  if (unvisited.length > 0) {
    console.error('CENSUS=FAIL_UNVISITED');
    process.exitCode = 1;
  } else if (STRICT && (totals.violations > 0 || totals.axeNodes > 0)) {
    console.error('CENSUS=FAIL_STRICT');
    process.exitCode = 1;
  } else {
    console.log('CENSUS=PASS');
  }
}

main().catch((error) => {
  console.error('CENSUS_ERROR', error);
  process.exitCode = 1;
});
