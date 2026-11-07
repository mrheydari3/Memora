/**
 * Phase 8 performance harness — LCP / TBT / CLS, baseline and constrained.
 *
 *   npm run perf -- --scenarios=local --runs=3
 *   npm run perf -- --scenarios=throttled --routes=home --runs=1
 *   npm run perf -- --routes=home,deck --runs=2
 *
 * Each run gets a fresh browser context (cold cache) and the F2 fixture, so the
 * app boots into the same 47-card library the other audits use. The probe is
 * installed before any app code and records:
 *   - Largest Contentful Paint and the element that painted it
 *   - cumulative layout shift (entries without recent input)
 *   - every long task (>50 ms), from which total blocking time is summed
 *   - navigation/paint timings, resource count and font readiness
 *
 * Scenarios:
 *   local      — no emulation; this is the one the Phase 8 budgets gate.
 *   throttled  — 4× CPU throttling plus Chrome's Slow 3G profile via CDP. This
 *                is a degradation reading, not a second budget gate: the Expo
 *                dev server ships unbundled modules, so a production-build
 *                budget would not be meaningful here (Phase 9 covers dist/).
 *
 * Evidence is written to `audit/perf.json` (gitignored).
 *
 * Browser environment in this workspace:
 *   PLAYWRIGHT_BROWSERS_PATH=0
 *   PLAYWRIGHT_LIBS_DIR=$PWD/.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildFixture, fixtureInitScript } from '../tests/ui/fixtures.ts';

if (process.env.PLAYWRIGHT_LIBS_DIR) {
  process.env.LD_LIBRARY_PATH = `${process.env.PLAYWRIGHT_LIBS_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`;
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.find((entry) => entry.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

const BASE = (arg('base', process.env.BASE_URL ?? 'http://127.0.0.1:3005')).replace(/\/$/, '');
const RUNS = Math.max(1, Number(arg('runs', '2')) || 2);
const SETTLE = Math.max(200, Number(arg('settle', '1500')) || 1500);
const LCP_TIMEOUT = Math.max(1000, Number(arg('lcp-timeout', '10000')) || 10_000);
const SPLASH_TIMEOUT = Math.max(1000, Number(arg('splash-timeout', '45000')) || 45_000);
const OUT = arg('out', 'audit/perf.json');
const NOW = Date.now();
const BUDGET = { lcp: 2500, tbt: 200, cls: 0.1 };
const SLOW_3G = {
  offline: false,
  latency: 400,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
  connectionType: 'cellular3g',
};

const ALL_ROUTES = [
  { label: 'home', path: '/home' },
  { label: 'deck', path: '/deck/deck-german-a2b1' },
  { label: 'study', path: '/study/deck-german-a2b1' },
  { label: 'quiz', path: '/quiz/deck-german-a2b1' },
  { label: 'statistics', path: '/statistics' },
];
const requested = arg('routes');
const ROUTES = requested
  ? ALL_ROUTES.filter((route) => requested.split(',').map((s) => s.trim()).includes(route.label))
  : ALL_ROUTES;

const ALL_SCENARIOS = [
  { id: 'local', label: 'local (no throttle)', throttle: false },
  { id: 'throttled', label: '4x CPU + Slow 3G', throttle: true },
];
const requestedScenarios = arg('scenarios', 'local');
const SCENARIOS = ALL_SCENARIOS.filter((scenario) =>
  requestedScenarios.split(',').map((s) => s.trim()).includes(scenario.id)
);
if (SCENARIOS.length === 0) {
  console.error(`unknown --scenarios=${requestedScenarios}; use local or throttled`);
  process.exit(2);
}

mkdirSync('audit', { recursive: true });

/** Runs before any app code. Every field is self-contained for page.evaluate. */
function perfProbe() {
  window.__perf = {
    lcp: 0,
    lcpElement: '',
    cls: 0,
    shifts: [],
    longTasks: [],
    tbt: 0,
    timeline: [],
  };

  // One sample a second until the page is closed. The end-state metrics alone
  // cannot say whether the splash or the real page delayed LCP.
  window.setInterval(() => {
    window.__perf.timeline.push({
      t: Math.round(performance.now()),
      splash: Boolean(document.querySelector('[aria-label="Loading Memora"]')),
      text: (document.body.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      textLength: (document.body.innerText ?? '').trim().length,
      fonts: document.fonts?.status ?? 'unknown',
      lcp: Math.round(window.__perf.lcp),
    });
  }, 1000);

  const describe = (element) => {
    if (!element) return '';
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70);
    const testId = element.getAttribute('data-testid');
    const label = element.getAttribute('aria-label');
    const id = testId ? `[data-testid=${testId}]` : label ? `[aria-label=${label}]` : '';
    return `${element.tagName.toLowerCase()}${id}: ${text}`;
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.lcp = entry.startTime;
        window.__perf.lcpElement = describe(entry.element);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__perf.cls += entry.value;
        window.__perf.shifts.push({
          value: Number(entry.value.toFixed(4)),
          startTime: Math.round(entry.startTime),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Math.round(entry.duration);
        window.__perf.longTasks.push({
          duration,
          startTime: Math.round(entry.startTime),
          attribution: (entry.attribution ?? []).slice(0, 2).map((item) => ({
            name: item.name,
            containerType: item.containerType,
            containerSrc: item.containerSrc,
          })),
        });
        window.__perf.tbt += Math.max(0, entry.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3))
    : Number(sorted[middle].toFixed(3));
};

async function warmUp(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page
      .goto(BASE + route.path, { waitUntil: 'load', timeout: 90_000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
  }
  await context.close();
}

async function measure(browser, scenario, route) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });
  const spec = buildFixture('F2', NOW);
  await context.addInitScript({ content: fixtureInitScript(spec) });
  await context.addInitScript(perfProbe);

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));

  let cdp = null;
  if (scenario.throttle) {
    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  const startedAt = Date.now();
  try {
    await page.goto(BASE + route.path, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForSelector('[role="main"]', { timeout: 60_000 });
    // The splash is a real first paint, but wait for the hand-off so CLS and
    // LCP include the transition into the page, not just the skeleton.
    await page
      .waitForFunction(() => !document.querySelector('[aria-label="Loading Memora"]'), null, {
        timeout: SPLASH_TIMEOUT,
      })
      .catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE);
    // Force real frames after the settle, then give the LCP observer a bounded
    // window to deliver. Under Slow 3G the first contentful paint can land just
    // before collection; without this, a valid run would report LCP 0.
    await page
      .evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      )
      .catch(() => {});
    await page
      .waitForFunction(() => (window.__perf?.lcp ?? 0) > 0, null, { timeout: LCP_TIMEOUT })
      .catch(() => {});

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType('paint').map((entry) => [entry.name, Math.round(entry.startTime)])
      );
      // Some throttled runs never fire the observer callback before collection;
      // the buffered entry list is the same data and closes that gap.
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lastLcp = lcpEntries[lcpEntries.length - 1];
      const observedLcp = Math.max(window.__perf.lcp, lastLcp?.startTime ?? 0);
      return {
        lcp: observedLcp > 0 ? Math.round(observedLcp) : null,
        lcpAvailable: observedLcp > 0,
        lcpEntries: lcpEntries.length,
        timeline: window.__perf.timeline,
        lcpElement: window.__perf.lcpElement,
        tbt: Math.round(window.__perf.tbt),
        cls: Number(window.__perf.cls.toFixed(4)),
        shifts: window.__perf.shifts,
        longTasks: window.__perf.longTasks,
        paints,
        ttfb: navigation ? Math.round(navigation.responseStart) : null,
        domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
        load: navigation ? Math.round(navigation.loadEventEnd) : null,
        resources: performance.getEntriesByType('resource').length,
        fontsStatus: document.fonts.status,
        fonts: {
          inter: document.fonts.check('16px Inter'),
          vazirmatn: document.fonts.check('16px Vazirmatn'),
          materialIcons: document.fonts.check('16px "Material Icons"'),
        },
        mainVisible: Boolean(document.querySelector('[role="main"]')),
        splashPresent: Boolean(document.querySelector('[aria-label="Loading Memora"]')),
        bodyTextLength: (document.body.innerText ?? '').length,
        visibilityState: document.visibilityState,
        url: location.pathname,
      };
    });

    return {
      scenario: scenario.id,
      route: route.label,
      path: route.path,
      ...metrics,
      wallMs: Date.now() - startedAt,
      consoleErrors,
      pageErrors,
    };
  } catch (error) {
    return {
      scenario: scenario.id,
      route: route.label,
      path: route.path,
      error: String(error).slice(0, 300),
      wallMs: Date.now() - startedAt,
      consoleErrors,
      pageErrors,
    };
  } finally {
    await page.close();
    await context.close();
  }
}

const browser = await chromium.launch();
await warmUp(browser);

const runs = [];
let browserClosed = false;
for (const scenario of SCENARIOS) {
  for (const route of ROUTES) {
    for (let run = 1; run <= RUNS; run += 1) {
      let result;
      try {
        result = await measure(browser, scenario, route);
      } catch (error) {
        result = {
          scenario: scenario.id,
          route: route.label,
          path: route.path,
          error: String(error).slice(0, 300),
          wallMs: 0,
          consoleErrors: [],
          pageErrors: [],
        };
      }
      runs.push({ ...result, run });
      const status = result.error
        ? `ERROR ${result.error}`
        : `lcp=${result.lcp}ms tbt=${result.tbt}ms cls=${result.cls} tasks=${result.longTasks.length}`;
      console.log(
        `${scenario.id.padEnd(10)} ${route.label.padEnd(10)} run ${run}/${RUNS} ${status}` +
          (result.pageErrors?.length ? ` pageErrors=${result.pageErrors.length}` : '')
      );
      if (result.error && /closed|crash/i.test(result.error)) {
        browserClosed = true;
        break;
      }
    }
    if (browserClosed) break;
  }
  if (browserClosed) break;
}
await browser.close().catch(() => {});

const byScenarioRoute = [];
for (const scenario of SCENARIOS) {
  for (const route of ROUTES) {
    const rows = runs.filter(
      (row) => row.scenario === scenario.id && row.route === route.label && !row.error
    );
    const lcp = rows.map((row) => row.lcp).filter((value) => Number.isFinite(value));
    const tbt = rows.map((row) => row.tbt);
    const cls = rows.map((row) => row.cls);
    const summary = {
      scenario: scenario.id,
      route: route.label,
      runs: rows.length,
      lcpMedian: median(lcp),
      lcpWorst: lcp.length ? Math.max(...lcp) : null,
      tbtMedian: median(tbt),
      tbtWorst: tbt.length ? Math.max(...tbt) : null,
      clsMedian: median(cls),
      clsWorst: cls.length ? Math.max(...cls) : null,
      longTaskCount: rows.reduce((sum, row) => sum + row.longTasks.length, 0),
      longestTask: rows.reduce(
        (max, row) => Math.max(max, ...row.longTasks.map((task) => task.duration), 0),
        0
      ),
      longTaskDurations: rows
        .flatMap((row) => row.longTasks.map((task) => task.duration))
        .sort((a, b) => b - a)
        .slice(0, 8),
    };

    if (scenario.id === 'local') {
      summary.budget = {
        lcp: summary.lcpMedian !== null && summary.lcpMedian <= BUDGET.lcp,
        tbt: summary.tbtMedian !== null && summary.tbtMedian <= BUDGET.tbt,
        cls: summary.clsMedian !== null && summary.clsMedian <= BUDGET.cls,
      };
      summary.pass =
        summary.budget.lcp &&
        summary.budget.tbt &&
        summary.budget.cls &&
        summary.runs === RUNS &&
        lcp.length === RUNS;
    }
    byScenarioRoute.push(summary);
  }
}

const localFailures = byScenarioRoute.filter(
  (summary) => summary.scenario === 'local' && !summary.pass
);
const errored = runs.filter((row) => row.error);
const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  runs: RUNS,
  settleMs: SETTLE,
  budget: BUDGET,
  throttle: { cpuRate: 4, network: SLOW_3G },
  note:
    'local is the Phase 8 budget gate. throttled is a degradation reading under 4x CPU and Slow 3G; the Expo dev server ships unbundled modules, so those numbers are diagnostic, not a production budget.',
  abortedEarly: browserClosed,
  routes: ROUTES,
  scenarios: SCENARIOS,
  summary: byScenarioRoute,
  results: runs,
};
writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log('\nSummary (median of runs)');
for (const summary of byScenarioRoute) {
  const verdict =
    summary.scenario === 'local'
      ? summary.pass
        ? 'PASS'
        : 'FAIL'
      : 'diagnostic';
  console.log(
    `${summary.scenario.padEnd(10)} ${summary.route.padEnd(10)} ` +
      `LCP ${summary.lcpMedian ?? 'n/a'} / ${summary.lcpWorst ?? 'n/a'} ms · ` +
      `TBT ${summary.tbtMedian} / ${summary.tbtWorst} ms · ` +
      `CLS ${summary.clsMedian} / ${summary.clsWorst} · ` +
      `long tasks ${summary.longTaskCount} (max ${summary.longestTask} ms) ${verdict}`
  );
}
console.log(`\nEvidence: ${OUT}`);

if (errored.length > 0 || localFailures.length > 0) {
  if (errored.length > 0) console.log(`failed runs: ${errored.length}`);
  if (localFailures.length > 0) {
    console.log(
      `local budget misses: ${localFailures
        .map((summary) => `${summary.route} (LCP ${summary.lcpMedian}, TBT ${summary.tbtMedian}, CLS ${summary.clsMedian})`)
        .join(', ')}`
    );
  }
  process.exit(1);
}
console.log('local budgets met: LCP <= 2500 ms, TBT <= 200 ms, CLS <= 0.1');
