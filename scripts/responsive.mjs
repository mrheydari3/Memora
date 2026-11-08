/**
 * Phase 6 responsive and visual harness.
 *
 *   npm run responsive -- --mode=measure --widths=320,375
 *   npm run responsive -- --mode=shots
 *   npm run responsive -- --mode=zoom
 *   npm run responsive -- --mode=summary
 *
 * Every mode reuses the Phase 4 census plan: the same 85 targets, fixtures and
 * trigger actions, so a surface measured here is the surface the census walked.
 *
 * Measurements per target and width:
 *   - document horizontal overflow (must stay <= 1 px)
 *   - elements past the viewport, excluding intentional horizontal rails
 *   - text clipped without an ellipsis (ellipsis is the designed truncation)
 *   - a horizontally scrolling main region (a phone layout must not pan)
 *   - content permanently covered by the floating tab capsule
 *   - an open sheet's controls clipped by the viewport
 *
 * Results append to `audit/responsive/*.jsonl`, so a run can be split across
 * commands and resumed with `--skip-existing`. Evidence is gitignored.
 *
 * Browser environment in this workspace:
 *   PLAYWRIGHT_BROWSERS_PATH=0
 *   PLAYWRIGHT_LIBS_DIR=$PWD/.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu
 */

import { chromium } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SURFACES } from '../tests/ui/surfaces.ts';
import {
  assertFixtureSentinel,
  buildFixture,
  countsFromEntries,
  fixtureInitScript,
} from '../tests/ui/fixtures.ts';
import { allCensusTargets, censusUrl } from '../tests/ui/census-plan.ts';
import { STORAGE_KEYS as K } from '../data/storageKeys.ts';

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.find((entry) => entry.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const flag = (name) => args.includes(`--${name}`);

const MODE = arg('mode', 'measure');
const BASE = (arg('base', process.env.BASE_URL ?? 'http://127.0.0.1:3005')).replace(/\/$/, '');
const ONLY = arg('surfaces')
  ? new Set(arg('surfaces').split(',').map((id) => id.trim()))
  : null;
const LIMIT = Number(arg('limit', '0')) || 0;
const OFFSET = Number(arg('offset', '0')) || 0;
const SKIP = flag('skip-existing');
const OUT = 'audit/responsive';
const HEIGHTS = {
  320: 700,
  375: 812,
  390: 844,
  431: 932,
  768: 1024,
  1024: 768,
  1280: 800,
  1440: 900,
};
const NOW = Date.now();
const READ_KEYS = [
  K.decks,
  K.folders,
  K.allCards,
  K.reviewLog,
  K.settings,
  K.gameRecords,
  K.initialized,
];
const ROUTE_SHOTS = [768, 1280, 1440];
const STATE_SHOTS = [320, 390];
const MEASURE_WIDTHS = [320, 375, 390, 431, 768, 1024, 1280, 1440];

if (process.env.PLAYWRIGHT_LIBS_DIR) {
  process.env.LD_LIBRARY_PATH = `${process.env.PLAYWRIGHT_LIBS_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`;
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
mkdirSync(OUT, { recursive: true });

const widthsArg = arg('widths');
const widthsFor = (fallback) =>
  widthsArg ? widthsArg.split(',').map((value) => Number(value.trim())) : fallback;

function targets() {
  let rows = allCensusTargets(SURFACES);
  if (ONLY) rows = rows.filter((row) => ONLY.has(row.surfaceId));
  if (OFFSET > 0) rows = rows.slice(OFFSET);
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  return rows;
}

function routeTargets() {
  const seen = new Set();
  const rows = [];
  for (const surface of SURFACES) {
    if (seen.has(surface.route)) continue;
    seen.add(surface.route);
    rows.push(allCensusTargets([surface])[0]);
  }
  return rows;
}

const slug = (value) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function appendJsonl(file, row) {
  appendFileSync(file, `${JSON.stringify(row)}\n`);
}

/** Runs in the page. Self-contained: page.evaluate cannot close over Node data. */
function measureLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (element) =>
    clean(
      element.getAttribute('aria-label') ||
        element.textContent ||
        element.getAttribute('placeholder') ||
        ''
    ).slice(0, 70);
  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    return element.getClientRects().length > 0;
  };
  const inHiddenTree = (element) => Boolean(element.closest('[aria-hidden="true"]'));
  const inHorizontalScroller = (element) => {
    for (let parent = element.parentElement; parent && parent !== doc.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) {
        return true;
      }
    }
    return false;
  };

  const pastViewport = [];
  const clipped = [];
  let ellipsized = 0;
  let textNodes = 0;

  for (const element of document.querySelectorAll('body *')) {
    if (!visible(element) || inHiddenTree(element)) continue;
    const tag = element.tagName.toLowerCase();
    if (['script', 'style', 'link', 'meta'].includes(tag)) continue;

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    if (rect.right > vw + 1 || rect.left < -1) {
      if (!inHorizontalScroller(element)) {
        pastViewport.push({
          tag,
          name: nameOf(element),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }

    const directText = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
    if (!directText) continue;
    textNodes += 1;
    if (['input', 'textarea', 'select'].includes(tag)) continue;

    const clippedX = style.overflowX === 'hidden' && element.scrollWidth > element.clientWidth + 1;
    const clippedY = style.overflowY === 'hidden' && element.scrollHeight > element.clientHeight + 1;
    if (!clippedX && !clippedY) continue;
    if (clippedX && style.textOverflow === 'ellipsis') {
      ellipsized += 1;
      continue;
    }
    if (inHorizontalScroller(element)) continue;
    clipped.push({
      tag,
      name: nameOf(element),
      axis: clippedX ? 'x' : 'y',
      scroll: clippedX ? element.scrollWidth : element.scrollHeight,
      client: clippedX ? element.clientWidth : element.clientHeight,
      ellipsis: style.textOverflow,
    });
  }

  // A main region that pans horizontally is a phone-layout defect even when the
  // document itself does not overflow (the ScrollView clips it).
  // A vertical body that pans sideways is a layout defect. A deliberate
  // horizontal rail (the badge belt) is a design choice and is counted apart.
  const mainHorizontalScroll = [];
  const horizontalRails = [];
  const main = document.querySelector('[role="main"]') ?? document.body;
  for (const element of [main, ...main.querySelectorAll('*')]) {
    if (!visible(element) || inHiddenTree(element)) continue;
    const style = getComputedStyle(element);
    if (!/(auto|scroll)/.test(style.overflowX)) continue;
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const entry = {
      tag: element.tagName.toLowerCase(),
      name: nameOf(element),
      scroll: element.scrollWidth,
      client: element.clientWidth,
    };
    const verticalBody =
      /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    if (verticalBody) mainHorizontalScroll.push(entry);
    else horizontalRails.push(entry);
  }

  // The tab capsule floats over the page. With the main scroll region at its
  // end, the last text must sit above the capsule; a page that does not scroll
  // must have no text under it at all. Only leaf text is measured, so the
  // full-height containers that merely intersect the band are not counted.
  const tabOverlap = [];
  let tabTop = null;
  const tablist =
    document.querySelector('[role="tablist"][aria-label="Primary tabs"]') ??
    [
      ...document.querySelectorAll('[role="tablist"]'),
    ].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0] ??
    null;
  const dialogOpen = document.querySelectorAll('[role="dialog"]').length > 0;
  if (tablist && visible(tablist) && !dialogOpen) {
    const tabRect = tablist.getBoundingClientRect();
    tabTop = Math.round(tabRect.top);
    const scrollers = [main, ...main.querySelectorAll('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1
        );
      })
      .sort(
        (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
      );
    const scroller = scrollers[0] ?? null;
    const previous = scroller ? scroller.scrollTop : 0;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    for (const element of main.querySelectorAll('*')) {
      if (!visible(element) || inHiddenTree(element) || tablist.contains(element)) continue;
      const direct = [...element.childNodes].some(
        (node) => node.nodeType === 3 && (node.textContent ?? '').trim()
      );
      if (!direct) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const overlapX = Math.min(rect.right, tabRect.right) - Math.max(rect.left, tabRect.left);
      const overlapY = Math.min(rect.bottom, tabRect.bottom) - Math.max(rect.top, tabRect.top);
      if (overlapX > 2 && overlapY > 2) {
        tabOverlap.push({
          tag: element.tagName.toLowerCase(),
          name: nameOf(element),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        });
      }
    }
    if (scroller) scroller.scrollTop = previous;
  }

  // An open sheet must fit: no control below the viewport and no panel offscreen.
  const sheetClipped = [];
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const dialog = dialogs.at(-1) ?? null;
  if (dialog) {
    const panel = dialog.getBoundingClientRect();
    if (panel.top < -1 || panel.bottom > vh + 1) {
      sheetClipped.push({
        tag: 'dialog',
        name: nameOf(dialog),
        top: Math.round(panel.top),
        bottom: Math.round(panel.bottom),
      });
    }
    // A control below the fold is reachable when a body inside the sheet scrolls;
    // only a control outside the viewport with no scroll path is clipped.
    const scrollableAncestor = (element) => {
      for (let parent = element.parentElement; parent && parent !== dialog; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) {
          return true;
        }
      }
      return false;
    };
    for (const element of dialog.querySelectorAll('button, input, textarea, [role="button"]')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      const offscreen =
        rect.right > vw + 1 || rect.left < -1 || (rect.bottom > vh + 1 && !scrollableAncestor(element));
      if (offscreen) {
        sheetClipped.push({
          tag: element.tagName.toLowerCase(),
          name: nameOf(element),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        });
      }
    }
  }

  return {
    vw,
    vh,
    docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
    bodyOverflow: Math.max(0, document.body.scrollWidth - vw),
    pastViewport: pastViewport.slice(0, 12),
    pastViewportCount: pastViewport.length,
    clipped: clipped.slice(0, 12),
    clippedCount: clipped.length,
    ellipsized,
    textNodes,
    mainHorizontalScroll: mainHorizontalScroll.slice(0, 6),
    horizontalRails: horizontalRails.slice(0, 6),
    tabTop,
    tabOverlap: tabOverlap.slice(0, 8),
    tabOverlapCount: tabOverlap.length,
    dialog: Boolean(dialog),
    sheetClipped,
  };
}

/**
 * Boots one census target exactly like the Phase 4 walk: fixture before app
 * code, a verified sentinel, then the declared trigger actions. A surface that
 * never reached its state is an error, never an empty-screen pass.
 */
async function boot(page, target) {
  const spec = buildFixture(target.fixture, NOW);
  await page.addInitScript({ content: fixtureInitScript(spec) });
  await page.goto(BASE + target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(400);

  if (spec.failure?.readThrows?.length) {
    await page.getByText(spec.sentinel.text, { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 });
  } else {
    const deadline = Date.now() + 20_000;
    let error = null;
    while (Date.now() < deadline) {
      try {
        const raw = await page.evaluate((keys) => {
          const out = {};
          for (const key of keys) out[key] = localStorage.getItem(key);
          return out;
        }, READ_KEYS);
        const entries = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== null));
        assertFixtureSentinel(countsFromEntries(entries), spec, 'booted');
        error = null;
        break;
      } catch (caught) {
        error = caught;
        await page.waitForTimeout(200);
      }
    }
    if (error) throw error;
  }

  for (const action of target.actions) {
    const dialog = page.getByRole('dialog').last();
    const scope = (await dialog.count()) > 0 ? dialog : page;
    if (action.kind === 'click') {
      const control = scope.getByRole('button', { name: action.name, exact: action.exact ?? true }).first();
      if ((await control.count()) === 0) throw new Error(`button not found: ${action.name}`);
      await control.click({ timeout: 5_000 });
    } else if (action.kind === 'fill') {
      await scope.getByLabel(action.label, { exact: true }).first().fill(action.value);
    } else if (action.kind === 'press') {
      await page.keyboard.press(action.key);
    } else if (action.kind === 'scroll') {
      await page.getByText(action.text, { exact: true }).first().scrollIntoViewIfNeeded();
    } else if (action.kind === 'expect') {
      await page.getByText(action.text, { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 });
    }
    await page.waitForTimeout(200);
  }

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

const findings = (metrics) =>
  metrics.docOverflow > 1 ||
  metrics.pastViewportCount > 0 ||
  metrics.clippedCount > 0 ||
  metrics.mainHorizontalScroll.length > 0 ||
  metrics.tabOverlapCount > 0 ||
  metrics.sheetClipped.length > 0;

const contextFor = (browser, width) =>
  browser.newContext({
    viewport: { width, height: HEIGHTS[width] ?? 844 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  });

async function runMeasure() {
  const rows = targets();
  const widths = widthsFor(MEASURE_WIDTHS);
  const file = join(OUT, 'measure.jsonl');
  const done = new Set(
    SKIP ? readJsonl(file).map((row) => `${row.surfaceId}|${row.fixture}|${row.width}`) : []
  );
  const browser = await chromium.launch({ headless: true });
  let measured = 0;
  let failed = 0;
  let flagged = 0;

  for (const target of rows) {
    const pending = widths.filter(
      (width) => !done.has(`${target.surfaceId}|${target.fixture}|${width}`)
    );
    if (pending.length === 0) continue;
    const context = await contextFor(browser, pending[0]);
    const page = await context.newPage();
    try {
      await boot(page, target);
      for (const width of pending) {
        await page.setViewportSize({ width, height: HEIGHTS[width] ?? 844 });
        await page.waitForTimeout(300);
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(measureLayout);
        const row = {
          at: new Date().toISOString(),
          mode: 'measure',
          surfaceId: target.surfaceId,
          label: target.label,
          fixture: target.fixture,
          url: target.url,
          state: target.state,
          width,
          ok: true,
          findings: findings(metrics),
          metrics,
        };
        appendJsonl(file, row);
        measured += 1;
        if (row.findings) flagged += 1;
        const brief = [
          metrics.docOverflow > 1 ? `doc=${metrics.docOverflow}` : '',
          metrics.pastViewportCount ? `past=${metrics.pastViewportCount}` : '',
          metrics.clippedCount ? `clipped=${metrics.clippedCount}` : '',
          metrics.mainHorizontalScroll.length ? `hscroll=${metrics.mainHorizontalScroll.length}` : '',
          metrics.tabOverlapCount ? `tab=${metrics.tabOverlapCount}` : '',
          metrics.sheetClipped.length ? `sheet=${metrics.sheetClipped.length}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        console.log(
          `${row.findings ? 'FLAG' : 'OK  '} ${target.surfaceId} ${target.fixture} ${width}px ${brief}`
        );
      }
    } catch (error) {
      failed += 1;
      appendJsonl(file, {
        at: new Date().toISOString(),
        mode: 'measure',
        surfaceId: target.surfaceId,
        fixture: target.fixture,
        width: pending[0],
        ok: false,
        error: String(error).slice(0, 400),
      });
      console.log(`FAIL ${target.surfaceId} ${target.fixture} ${String(error).slice(0, 120)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  await browser.close();
  console.log(`RESPONSIVE_MEASURED=${measured}`);
  console.log(`RESPONSIVE_FLAGGED=${flagged}`);
  console.log(`RESPONSIVE_FAILED=${failed}`);
}

async function runShots() {
  const rows = targets();
  const stateWidths = widthsFor(STATE_SHOTS);
  const routes = routeTargets();
  const file = join(OUT, 'shots.jsonl');
  const browser = await chromium.launch({ headless: true });
  let shot = 0;
  let failed = 0;

  for (const target of rows) {
    const pathFor = (width) =>
      join(OUT, 'shots', String(width), `${target.surfaceId}-${target.fixture}.png`);
    const pending = stateWidths.filter(
      (width) => !(SKIP && existsSync(pathFor(width)))
    );
    if (pending.length === 0) continue;
    const context = await contextFor(browser, pending[0]);
    const page = await context.newPage();
    try {
      await boot(page, target);
      for (const width of pending) {
        await page.setViewportSize({ width, height: HEIGHTS[width] ?? 844 });
        await page.waitForTimeout(300);
        await page.evaluate(() => document.fonts.ready);
        const path = pathFor(width);
        mkdirSync(join(OUT, 'shots', String(width)), { recursive: true });
        await page.screenshot({ path });
        appendJsonl(file, {
          at: new Date().toISOString(),
          kind: 'state',
          surfaceId: target.surfaceId,
          fixture: target.fixture,
          label: target.label,
          url: target.url,
          width,
          path,
        });
        shot += 1;
        console.log(`SHOT ${target.surfaceId} ${target.fixture} ${width}px`);
      }
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${target.surfaceId} ${String(error).slice(0, 100)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  const routeWidths = widthsFor(ROUTE_SHOTS);
  for (const target of routes) {
    const routeSlug = slug(target.url === '/' ? 'root' : target.url.replace(/^\//, ''));
    const pathFor = (width) => join(OUT, 'shots', String(width), `route-${routeSlug}.png`);
    const pending = routeWidths.filter((width) => !(SKIP && existsSync(pathFor(width))));
    if (pending.length === 0) continue;
    const context = await contextFor(browser, pending[0]);
    const page = await context.newPage();
    try {
      await boot(page, target);
      for (const width of pending) {
        await page.setViewportSize({ width, height: HEIGHTS[width] ?? 844 });
        await page.waitForTimeout(300);
        await page.evaluate(() => document.fonts.ready);
        const path = pathFor(width);
        mkdirSync(join(OUT, 'shots', String(width)), { recursive: true });
        await page.screenshot({ path });
        appendJsonl(file, {
          at: new Date().toISOString(),
          kind: 'route',
          surfaceId: target.surfaceId,
          fixture: target.fixture,
          label: target.label,
          url: target.url,
          width,
          path,
        });
        shot += 1;
        console.log(`SHOT route ${target.url} ${width}px`);
      }
    } catch (error) {
      failed += 1;
      console.log(`FAIL route ${target.url} ${String(error).slice(0, 100)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  await browser.close();
  console.log(`RESPONSIVE_SHOTS=${shot}`);
  console.log(`RESPONSIVE_SHOT_FAILED=${failed}`);
  writeFileSync(
    join(OUT, 'shots-manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        stateWidths,
        routeWidths: widthsFor(ROUTE_SHOTS),
        shots: readJsonl(file),
      },
      null,
      2
    )
  );
}

/**
 * 200% zoom. A 640 px viewport with `zoom: 2` lays the page out at 320 CSS px
 * and paints it at 1280 device px, which is what browser zoom does. The heading
 * box must roughly double, proving the page did not simply reflow at one size.
 */
async function runZoom() {
  const rows = routeTargets();
  const file = join(OUT, 'zoom.jsonl');
  const browser = await chromium.launch({ headless: true });
  let measured = 0;
  let flagged = 0;
  let failed = 0;

  for (const target of rows) {
    const path = join(OUT, 'shots', 'zoom', `route-${slug(target.url.replace(/^\//, '') || 'root')}.png`);
    if (SKIP && existsSync(join(OUT, 'zoom.jsonl'))) {
      const seen = readJsonl(file).some((row) => row.surfaceId === target.surfaceId);
      if (seen) continue;
    }
    mkdirSync(join(OUT, 'shots', 'zoom'), { recursive: true });
    const context = await contextFor(browser, 640);
    const page = await context.newPage();
    try {
      await boot(page, target);
      const base = await page.evaluate(() => {
        const heading = document.querySelector('h1, h2, [role="heading"]');
        return heading
          ? {
              height: Math.round(heading.getBoundingClientRect().height),
              fontSize: getComputedStyle(heading).fontSize,
            }
          : null;
      });
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => document.fonts.ready);
      const zoomed = await page.evaluate(() => {
        const heading = document.querySelector('h1, h2, [role="heading"]');
        return heading
          ? {
              height: Math.round(heading.getBoundingClientRect().height),
              fontSize: getComputedStyle(heading).fontSize,
            }
          : null;
      });
      const metrics = await page.evaluate(measureLayout);
      await page.screenshot({ path });
      const headingScale =
        base && zoomed && base.height > 0 ? Number((zoomed.height / base.height).toFixed(2)) : null;
      const row = {
        at: new Date().toISOString(),
        mode: 'zoom',
        surfaceId: target.surfaceId,
        label: target.label,
        fixture: target.fixture,
        url: target.url,
        width: 640,
        heading: { base, zoomed, scale: headingScale },
        ok: true,
        findings: findings(metrics),
        metrics,
        path,
      };
      appendJsonl(file, row);
      measured += 1;
      if (row.findings) flagged += 1;
      console.log(
        `${row.findings ? 'FLAG' : 'OK  '} zoom ${target.surfaceId} ${target.url} scale=${headingScale ?? 'n/a'} doc=${metrics.docOverflow} past=${metrics.pastViewportCount} clipped=${metrics.clippedCount}`
      );
    } catch (error) {
      failed += 1;
      console.log(`FAIL zoom ${target.surfaceId} ${String(error).slice(0, 120)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  await browser.close();
  console.log(`RESPONSIVE_ZOOM=${measured}`);
  console.log(`RESPONSIVE_ZOOM_FLAGGED=${flagged}`);
  console.log(`RESPONSIVE_ZOOM_FAILED=${failed}`);
}

function runSummary() {
  const measure = readJsonl(join(OUT, 'measure.jsonl')).filter((row) => row.ok);
  const zoom = readJsonl(join(OUT, 'zoom.jsonl')).filter((row) => row.ok);
  const shots = readJsonl(join(OUT, 'shots.jsonl'));
  const byWidth = {};
  for (const row of measure) {
    byWidth[row.width] ??= { runs: 0, flagged: 0 };
    byWidth[row.width].runs += 1;
    if (row.findings) byWidth[row.width].flagged += 1;
  }
  const offenders = measure
    .filter((row) => row.findings)
    .map((row) => ({
      surfaceId: row.surfaceId,
      fixture: row.fixture,
      width: row.width,
      docOverflow: row.metrics.docOverflow,
      past: row.metrics.pastViewportCount,
      clipped: row.metrics.clippedCount,
      hscroll: row.metrics.mainHorizontalScroll.length,
      tab: row.metrics.tabOverlapCount,
      sheet: row.metrics.sheetClipped.length,
    }));
  const summary = {
    generatedAt: new Date().toISOString(),
    widths: MEASURE_WIDTHS,
    measured: measure.length,
    flagged: offenders.length,
    byWidth,
    zoomRuns: zoom.length,
    zoomFlagged: zoom.filter((row) => row.findings).length,
    zoomScale: zoom.map((row) => ({ surfaceId: row.surfaceId, scale: row.heading?.scale ?? null })),
    shots: shots.length,
    offenders,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`SUMMARY_MEASURED=${summary.measured}`);
  console.log(`SUMMARY_FLAGGED=${summary.flagged}`);
  console.log(`SUMMARY_ZOOM=${summary.zoomRuns} flagged=${summary.zoomFlagged}`);
  console.log(`SUMMARY_SHOTS=${summary.shots}`);
  for (const row of Object.entries(byWidth)) {
    console.log(`SUMMARY_WIDTH ${row[0]} runs=${row[1].runs} flagged=${row[1].flagged}`);
  }
  for (const row of offenders.slice(0, 20)) {
    console.log(
      `SUMMARY_OFFENDER ${row.surfaceId} ${row.fixture} ${row.width} doc=${row.docOverflow} past=${row.past} clipped=${row.clipped} hscroll=${row.hscroll} tab=${row.tab} sheet=${row.sheet}`
    );
  }
}

const mode = MODE;
if (mode === 'measure') await runMeasure();
else if (mode === 'shots') await runShots();
else if (mode === 'zoom') await runZoom();
else if (mode === 'summary') runSummary();
else {
  console.error(`unknown mode: ${mode}`);
  process.exitCode = 1;
}
