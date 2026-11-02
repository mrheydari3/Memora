/**
 * Cross-browser audit — the same assertions in Chromium, Firefox and WebKit.
 *
 *   node scripts/cross-browser.mjs                 # all engines
 *   node scripts/cross-browser.mjs --engine=webkit # one engine
 *
 * Per engine and route it measures:
 *   - axe-core WCAG 2.2 A/AA violations
 *   - horizontal document overflow at 320px and 1440px
 *   - interactive controls smaller than 44x44 CSS px
 *   - keyboard focus visibility (first two Tab stops)
 *   - 200% text zoom actually growing the type
 *   - console errors, page errors and failed requests
 *
 * Exit code is 1 if any engine reports a violation, so it can gate a release.
 */
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const ENGINES = { chromium, firefox, webkit };
const only = process.argv.find((a) => a.startsWith('--engine='))?.split('=')[1];
const engines = only ? [only] : Object.keys(ENGINES);

const ROUTES = [
  { label: 'home', path: '/' },
  { label: 'library', path: '/library' },
  { label: 'deck', path: '/deck/deck-german-a2b1' },
  { label: 'study', path: '/study/deck-german-a2b1' },
  { label: 'quiz', path: '/quiz/deck-german-a2b1' },
  { label: 'statistics', path: '/statistics' },
  { label: 'profile', path: '/profile' },
  { label: 'settings', path: '/settings' },
  { label: 'not-found', path: '/this-route-does-not-exist' },
];

const WIDTHS = [320, 1440];
const results = {};
mkdirSync('audit', { recursive: true });
mkdirSync('screenshots/cross-browser', { recursive: true });

for (const engineName of engines) {
  const browserType = ENGINES[engineName];
  const engineResult = { engine: engineName, version: null, routes: [], failures: [] };
  let browser;
  try {
    browser = await browserType.launch();
    engineResult.version = browser.version();
  } catch (error) {
    engineResult.launchError = String(error).slice(0, 300);
    results[engineName] = engineResult;
    continue;
  }

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      /*
       * Measure the settled state, not a frame of the entrance.
       *
       * WCAG evaluates the resting UI, but the deck screen staggers its cards in
       * and React Native's Animated values live in JS (so `document.getAnimations()`
       * cannot finish them). A run that sampled mid-reveal reported a contrast
       * failure on half-opaque text and two 41px targets on a scaled card — a
       * measurement artefact that reproduced as 0/0 once the transition ended.
       * `reduce` makes the app apply every entrance instantly, which is both
       * deterministic and a real user state; motion itself is verified separately
       * by scripts/reduced-motion.mjs (which measures reduce AND no-preference).
       */
      reducedMotion: 'reduce',
    });

    for (const route of ROUTES) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
      });
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
      page.on('requestfailed', (r) => failedRequests.push(`${r.url().slice(0, 80)} ${r.failure()?.errorText}`));

      const label = `${engineName}-${width}-${route.label}`;
      try {
        await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await page.waitForSelector('[role="main"]', { timeout: 45_000 });
        // Let the splash dissolve finish: it is the only long incidental animation.
        await page.waitForTimeout(1400);

        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        const metrics = await page.evaluate(() => {
          const vw = window.innerWidth;
          const doc = document.scrollingElement ?? document.documentElement;
          const small = [];
          for (const el of document.querySelectorAll(
            'a[href], button, [role="button"], [role="switch"], [role="tab"]'
          )) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.width < 44 || r.height < 44) {
              small.push({
                name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }
          return {
            overflow: Math.max(doc.scrollWidth, document.body.scrollWidth) - vw,
            smallTargets: small,
            colorScheme: getComputedStyle(document.documentElement).colorScheme,
            schemeSupported: CSS.supports('color-scheme', 'dark'),
            focusVisibleSupported: CSS.supports('selector(:focus-visible)'),
          };
        });

        const focus = [];
        for (let i = 0; i < 2; i++) {
          await page.keyboard.press('Tab');
          focus.push(
            await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const s = getComputedStyle(el);
              return {
                label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30),
                ring: s.outlineStyle !== 'none' && (parseFloat(s.outlineWidth) || 0) > 0,
              };
            })
          );
        }

        await page.screenshot({ path: `screenshots/cross-browser/${label}.png` });

        const entry = {
          label,
          width,
          route: route.path,
          axe: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
            samples: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
          })),
          ...metrics,
          smallTargetCount: metrics.smallTargets.length,
          focus,
          consoleErrors,
          pageErrors,
          failedRequests,
        };
        engineResult.routes.push(entry);

        if (entry.axe.length) engineResult.failures.push(`${label}: axe ${entry.axe.map((v) => v.id).join(',')}`);
        if (entry.smallTargetCount) engineResult.failures.push(`${label}: ${entry.smallTargetCount} tiny targets`);
        if (entry.overflow > 1) engineResult.failures.push(`${label}: overflow ${entry.overflow}px`);
        if (entry.focus.some((f) => f && !f.ring)) engineResult.failures.push(`${label}: focus without ring`);
        const errors = consoleErrors.length + pageErrors.length;
        if (errors) engineResult.failures.push(`${label}: ${errors} console/page errors`);
      } catch (error) {
        engineResult.failures.push(`${label}: ${String(error).slice(0, 200)}`);
      }
      await page.close();
    }
    await context.close();
  }

  // 200% text zoom, per engine: the assertion is measured, not assumed.
  const zoomContext = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const zoomPage = await zoomContext.newPage();
  try {
    await zoomPage.goto(BASE + '/library', { waitUntil: 'domcontentloaded' });
    await zoomPage.waitForSelector('[role="main"]');
    await zoomPage.waitForTimeout(1200);
    engineResult.textZoom = await zoomPage.evaluate(() => {
      const sizes = () =>
        [...document.querySelectorAll('div')]
          .filter((el) => (el.textContent ?? '').trim().length > 3 && el.children.length === 0)
          .map((el) => parseFloat(getComputedStyle(el).fontSize));
      const before = Math.max(...sizes());
      document.documentElement.style.fontSize = '200%';
      const after = Math.max(...sizes());
      return { before, after, grew: after >= before * 1.9 };
    });
    if (!engineResult.textZoom.grew) {
      engineResult.failures.push(`text zoom did not grow type (${engineResult.textZoom.before} → ${engineResult.textZoom.after})`);
    }
    await zoomPage.screenshot({ path: `screenshots/cross-browser/${engineName}-375-zoom200.png` });
  } catch (error) {
    engineResult.failures.push(`text zoom: ${String(error).slice(0, 160)}`);
  }
  await zoomContext.close();

  await browser.close();
  results[engineName] = engineResult;
}

writeFileSync('audit/cross-browser.json', JSON.stringify(results, null, 2));

let failed = 0;
for (const [name, r] of Object.entries(results)) {
  const routes = r.routes.length;
  const axeNodes = r.routes.reduce((n, x) => n + x.axe.reduce((m, v) => m + v.nodes, 0), 0);
  const tiny = r.routes.reduce((n, x) => n + x.smallTargetCount, 0);
  const overflow = r.routes.filter((x) => x.overflow > 1).map((x) => `${x.label}+${x.overflow}`);
  const focusMiss = r.routes.filter((x) => x.focus.some((f) => f && !f.ring)).length;
  const errors = r.routes.reduce((n, x) => n + x.consoleErrors.length + x.pageErrors.length, 0);
  console.log(
    `${name} ${r.version ?? '(no launch)'}: routes=${routes} axeNodes=${axeNodes} tinyTargets=${tiny} overflow=${overflow.length ? overflow.join(',') : 'none'} focusMiss=${focusMiss} errors=${errors} zoom=${r.textZoom?.grew ?? 'n/a'} failures=${r.failures.length}`
  );
  if (r.failures.length) {
    failed++;
    for (const f of r.failures.slice(0, 8)) console.log('   ✗', f);
  }
}
process.exit(failed ? 1 : 0);
