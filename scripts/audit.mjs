/**
 * Audit harness — real browser measurements, no guesses.
 *
 *   node scripts/audit.mjs            # full matrix, writes audit/report.json
 *   node scripts/audit.mjs --quick    # one viewport, one theme
 *
 * Collects, per route and per environment:
 *   - axe-core: WCAG 2.2 A/AA rule violations
 *   - horizontal overflow (document + individual elements past the viewport)
 *   - touch targets smaller than 44x44 CSS px (WCAG 2.5.8 wants 24, we hold 44)
 *   - keyboard focus visibility (outline/box-shadow on the focused element)
 *   - LCP / CLS / long tasks / total blocking time via PerformanceObserver
 *   - console errors and page errors
 *
 * Screenshots land in screenshots/audit/<label>.png.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const QUICK = process.argv.includes('--quick');

const ROUTES = [
  { label: 'home', path: '/' },
  { label: 'library', path: '/library' },
  { label: 'deck', path: '/deck/deck-german-a2b1' },
  { label: 'study', path: '/study/deck-german-a2b1' },
  { label: 'quiz', path: '/quiz/deck-german-a2b1' },
  { label: 'statistics', path: '/statistics' },
  { label: 'profile', path: '/profile' },
  { label: 'settings', path: '/settings' },
  { label: 'discover', path: '/discover' },
];

const WIDTHS = QUICK ? [375] : [320, 375, 768, 1024, 1440];
const THEMES = QUICK ? ['dark'] : ['dark', 'light'];

/** Runs inside the page before any app code. */
function perfProbe() {
  window.__audit = { lcp: 0, cls: 0, longTasks: [], tbt: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__audit.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__audit.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__audit.longTasks.push(Math.round(entry.duration));
        window.__audit.tbt += Math.max(0, entry.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
}

/** Measurements taken after the page settles. */
async function measure(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.scrollingElement ?? document.documentElement;

    const overflowing = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        // Only report the outermost offender, not every child of it.
        if (overflowing.some((o) => o.el.contains(el))) continue;
        overflowing.push({
          el,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }

    const interactive = document.querySelectorAll(
      'a[href], button, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])'
    );
    const smallTargets = [];
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }

    const html = document.documentElement;
    const body = document.body;
    return {
      documentOverflow: Math.max(doc.scrollWidth, body.scrollWidth) - vw,
      overflowCount: overflowing.length,
      overflowing: overflowing.map(({ tag, text, left, right, width }) => ({ tag, text, left, right, width })),
      interactiveCount: interactive.length,
      smallTargets: smallTargets.slice(0, 25),
      smallTargetCount: smallTargets.length,
      colorScheme: getComputedStyle(html).colorScheme,
      bodyBackground: getComputedStyle(body).backgroundColor,
      htmlLang: html.lang || null,
      documentTitle: document.title,
      headingCount: document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length,
      liveRegions: document.querySelectorAll('[aria-live],[role="status"],[role="alert"]').length,
      viewport: { w: vw, h: window.innerHeight },
      perf: window.__audit,
    };
  });
}

/** Tabs through the page and reports whether the focused node is visible. */
async function focusAudit(page, stops = 6) {
  const seen = [];
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const outlinePx = parseFloat(s.outlineWidth) || 0;
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        outline: `${s.outlineStyle} ${outlinePx}px ${s.outlineColor}`,
        outlineVisible: s.outlineStyle !== 'none' && outlinePx > 0,
        boxShadow: s.boxShadow === 'none' ? null : s.boxShadow.slice(0, 60),
        inViewport: r.width > 0 && r.height > 0,
      };
    });
    if (info) seen.push(info);
  }
  return seen;
}

const results = [];
mkdirSync('screenshots/audit', { recursive: true });

const browser = await chromium.launch();

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
      colorScheme: theme,
      deviceScaleFactor: 1,
    });
    await context.addInitScript(perfProbe);

    for (const route of ROUTES) {
      // Wide viewports only need the representative screens.
      if (width > 500 && !['home', 'library', 'deck'].includes(route.label)) continue;
      if (width >= 1440 && !['home', 'library'].includes(route.label)) continue;

      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
      });
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

      const label = `${width}-${theme}-${route.label}`;
      try {
        await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(1200);

        const metrics = await measure(page);
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();

        const focus = await focusAudit(page, 5);
        await page.screenshot({ path: `screenshots/audit/${label}.png`, fullPage: false });

        results.push({
          label,
          width,
          theme,
          route: route.path,
          ...metrics,
          axe: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            samples: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
          })),
          focus,
          focusVisible: focus.filter((f) => f.outlineVisible).length,
          consoleErrors,
          pageErrors,
        });
      } catch (error) {
        results.push({ label, width, theme, route: route.path, error: String(error).slice(0, 300) });
      }
      await page.close();
    }
    await context.close();
  }
}

// 200% text zoom: bump the root font-size and see whether the type scales.
const zoomContext = await browser.newContext({ viewport: { width: 375, height: 844 } });
const zoomPage = await zoomContext.newPage();
await zoomPage.goto(BASE + '/library', { waitUntil: 'domcontentloaded' });
await zoomPage.waitForTimeout(1500);
const textZoom = await zoomPage.evaluate(() => {
  const sample = () =>
    [...document.querySelectorAll('div')]
      .filter((el) => (el.textContent ?? '').trim().length > 3 && el.children.length === 0)
      .slice(0, 200)
      .map((el) => parseFloat(getComputedStyle(el).fontSize));
  const before = sample();
  document.documentElement.style.fontSize = '200%';
  const after = sample();
  return {
    beforeMax: Math.max(...before),
    afterMax: Math.max(...after),
    grew: Math.max(...after) > Math.max(...before) + 1,
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
  };
});
await zoomPage.screenshot({ path: 'screenshots/audit/375-dark-library-zoom200.png' });
await zoomContext.close();

await browser.close();

writeFileSync('audit/report.json', JSON.stringify({ generatedAt: new Date().toISOString(), results, textZoom }, null, 2));

const flat = results.filter((r) => !r.error);
const axeTotals = {};
for (const r of flat) for (const v of r.axe) axeTotals[v.id] = (axeTotals[v.id] ?? 0) + v.nodes;
const worstOverflow = flat.filter((r) => r.documentOverflow > 1).map((r) => `${r.label} +${r.documentOverflow}px`);
const consoleErrorCount = flat.reduce((n, r) => n + r.consoleErrors.length + r.pageErrors.length, 0);
const focusInvisible = flat.filter((r) => r.focus.length > 0 && r.focusVisible === 0).map((r) => r.label);
const smallTargetTotals = flat.reduce((n, r) => n + r.smallTargetCount, 0);

console.log(`routes measured: ${flat.length} (errors: ${results.length - flat.length})`);
console.log('axe violations:', Object.keys(axeTotals).length === 0 ? 'none' : axeTotals);
console.log('horizontal overflow:', worstOverflow.length ? worstOverflow : 'none');
console.log('small touch targets (<44px):', smallTargetTotals);
console.log('focus invisible on:', focusInvisible.length ? focusInvisible : 'no screen');
console.log('console/page errors:', consoleErrorCount);
console.log('text zoom 200% grows type:', textZoom.grew, textZoom);
