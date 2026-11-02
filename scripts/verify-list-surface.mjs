/**
 * List-surface verification on the running app.
 *
 *   node scripts/verify-list-surface.mjs
 *
 * Finds the bottom-bar tab whose body is the app's main list (by clicking every
 * tab and counting deck rows), then measures on that tab: the canvas is flat
 * (no colour fields, no blurred decorative layer, no running animation), text
 * stays readable, the list scrolls from every pointer height with a wheel and
 * with a touch drag, and the console is clean.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:8082';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

/** Runs in the page: painted-screen probe. */
function inspect() {
  const rgb = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((v) => parseFloat(v.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const painted = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    let up = el;
    while (up) {
      const s = getComputedStyle(up);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      up = up.parentElement;
    }
    return true;
  };

  const canvas = rgb(getComputedStyle(document.body).backgroundColor) ?? { r: 7, g: 9, b: 14, a: 1 };

  // Anything that looks like a decorative field or a blurred layer.
  const ambientFields = [...document.querySelectorAll('*')].filter((el) => {
    const bg = getComputedStyle(el).backgroundColor.replace(/\s/g, '');
    return /^rgba?\((0,132,255|255,200,90|90,220,170)/.test(bg);
  }).length;
  const blurredLayers = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return /blur\(/.test(s.filter) || /blur\(/.test(s.backdropFilter);
  }).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 200 && r.height > 200 && painted(el);
  }).length;

  const textSamples = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode()) && textSamples.length < 60) {
    const text = (node.textContent || '').trim();
    if (text.length < 4) continue;
    const el = node.parentElement;
    if (!el || !painted(el)) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 6) continue;
    if (rect.top < 0 || rect.top > window.innerHeight) continue;
    const fg = rgb(style.color);
    if (!fg) continue;
    const panes = [];
    let up = el;
    while (up && up !== document.body) {
      const bg = rgb(getComputedStyle(up).backgroundColor);
      if (bg && bg.a > 0) panes.push(bg);
      up = up.parentElement;
    }
    let base = canvas;
    for (const pane of panes.reverse()) base = over(pane, base);
    textSamples.push({ text: text.slice(0, 28), ratio: Number(contrast(fg, base).toFixed(2)) });
  }

  const scrollerList = [...document.querySelectorAll('*')]
    .filter((el) => {
      const s = getComputedStyle(el);
      return (
        painted(el) &&
        /(auto|scroll)/.test(s.overflowY) &&
        el.scrollHeight > el.clientHeight + 20 &&
        el.clientHeight > 200
      );
    })
    .sort((a, b) => b.clientHeight - a.clientHeight);

  const rows = [...document.querySelectorAll('[role="button"]')].filter((el) => {
    if (!painted(el)) return false;
    const r = el.getBoundingClientRect();
    return r.height >= 44 && r.width > 240;
  });
  const row = rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  let hit = null;
  if (row) {
    const box = row.getBoundingClientRect();
    const at = document.elementFromPoint(Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2));
    hit = { sameRow: !!at && (at === row || row.contains(at)), tag: at ? at.tagName : null, rowTop: Math.round(box.top) };
  }

  return {
    path: location.pathname,
    canvasColor: getComputedStyle(document.body).backgroundColor,
    ambientFields,
    blurredLayers,
    animations: document.getAnimations().length,
    rowCount: rows.length,
    rowHit: hit,
    textMinRatio: textSamples.length ? Math.min(...textSamples.map((s) => s.ratio)) : null,
    textWorst: textSamples.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 2),
    hasScroller: scrollerList.length > 0,
    scrollTops: scrollerList.map((el) => Math.round(el.scrollTop)),
    scrollHeight: scrollerList[0] ? scrollerList[0].scrollHeight : null,
    clientHeight: scrollerList[0] ? scrollerList[0].clientHeight : null,
    viewportHeight: window.innerHeight,
  };
}

const resetScroll = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 20) {
        el.style.scrollBehavior = 'auto';
        el.scrollTop = 0;
      }
    }
  });

const sweepWheel = async (page, heights) => {
  const out = [];
  for (const y of heights) {
    await resetScroll(page);
    await page.waitForTimeout(200);
    const before = await page.evaluate(inspect);
    await page.mouse.move(215, y);
    await page.waitForTimeout(150);
    await page.mouse.wheel(0, 280);
    await page.waitForTimeout(450);
    const after = await page.evaluate(inspect);
    out.push({ y, before: Math.max(0, ...before.scrollTops), after: Math.max(0, ...after.scrollTops) });
  }
  return out;
};

const context = await browser.newContext({ viewport: { width: 431, height: 822 }, colorScheme: 'dark', hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 160)));
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));

await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[role="main"]');
await page.waitForTimeout(1600);

const tabLabels = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((el) => el.getAttribute('aria-label')));
console.log('TABS', JSON.stringify(tabLabels));

const survey = [];
for (const label of tabLabels) {
  await page.getByRole('tab', { name: label, exact: true }).click();
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const deckRows = [...document.querySelectorAll('[role="button"]')].filter((el) => /\d+\s*cards?\b/.test(el.textContent || '')).length;
    return { path: location.pathname, deckRows };
  });
  survey.push({ label, ...info });
  console.log(`SURVEY ${label}`, JSON.stringify(info));
}

const listTab = survey.slice().sort((a, b) => b.deckRows - a.deckRows)[0];
check('list tab identified in the bottom bar', !!listTab && listTab.deckRows > 0, `"${listTab?.label}" → ${listTab?.path} (deck rows: ${survey.map((s) => `${s.label}:${s.deckRows}`).join(', ')})`);

await page.getByRole('tab', { name: listTab.label, exact: true }).click();
await page.waitForTimeout(1400);
check('list tab is open after a real tab click', page.url().endsWith(listTab.path), page.url());

const state = await page.evaluate(inspect);
check('canvas is one flat colour', state.canvasColor === 'rgb(7, 9, 14)', state.canvasColor);
check('no colour fields anywhere', state.ambientFields === 0, `${state.ambientFields} field(s)`);
check('no blurred decorative layer', state.blurredLayers === 0, `${state.blurredLayers} blurred layer(s)`);
check('no running animation', state.animations === 0, `${state.animations} animation(s)`);
check('list rows paint on the canvas', state.rowHit?.sameRow === true, JSON.stringify(state.rowHit));
check('text stays readable', state.textMinRatio !== null && state.textMinRatio >= 4.5, `min ${state.textMinRatio}:1 · worst ${JSON.stringify(state.textWorst[0])}`);

await page.setViewportSize({ width: 431, height: 560 });
await page.waitForTimeout(700);
const tall = await page.evaluate(inspect);
check('list overflows at 560px so scrolling is real', tall.hasScroller === true, `scrollHeight ${tall.scrollHeight} vs ${tall.clientHeight}`);

const heights = [160, 220, 280, 340, 400, 420, 460];
const wheel = await sweepWheel(page, heights);
const dead = wheel.filter((r) => r.after <= r.before);
check('wheel scrolls the list from every height', dead.length === 0, wheel.map((r) => `${r.y}px:${r.before}→${r.after}`).join(' '));

await resetScroll(page);
await page.waitForTimeout(250);
const cdp = await context.newCDPSession(page);
const touch = async (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 215, y }] });
await touch('touchStart', 460);
for (const y of [420, 380, 340, 300, 260]) {
  await touch('touchMove', y);
  await page.waitForTimeout(60);
}
await touch('touchEnd', 260);
await page.waitForTimeout(600);
const dragged = await page.evaluate(inspect);
check('touch drag scrolls the list', (dragged.scrollTops[0] ?? 0) > 0, `scrollTop 0 → ${dragged.scrollTops[0]}`);
check('canvas still has no fields after scrolling', dragged.ambientFields === 0 && dragged.blurredLayers === 0, `fields ${dragged.ambientFields} · blurred ${dragged.blurredLayers}`);
check('console clean on the list tab', consoleErrors.length === 0, consoleErrors.join(' ; '));

// Second list surface.
await page.setViewportSize({ width: 431, height: 822 });
await page.getByRole('tab', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(1300);
await page.setViewportSize({ width: 431, height: 560 });
await page.waitForTimeout(700);
const settingsWheel = await sweepWheel(page, heights);
const settingsDead = settingsWheel.filter((r) => r.after <= r.before);
check('settings rows also scroll from every height', settingsDead.length === 0, settingsWheel.map((r) => `${r.y}px:${r.before}→${r.after}`).join(' '));

// Reduce motion: nothing to stop, and the canvas stays flat.
const reduceContext = await browser.newContext({ viewport: { width: 431, height: 822 }, colorScheme: 'dark', reducedMotion: 'reduce' });
const reducePage = await reduceContext.newPage();
const reduceErrors = [];
reducePage.on('console', (m) => m.type() === 'error' && reduceErrors.push(m.text().slice(0, 160)));
reducePage.on('pageerror', (e) => reduceErrors.push(String(e).slice(0, 160)));
await reducePage.goto(BASE + listTab.path, { waitUntil: 'domcontentloaded' });
await reducePage.waitForSelector('[role="main"]');
await reducePage.waitForTimeout(1600);
const reduced = await reducePage.evaluate(inspect);
check('reduce: canvas stays flat with no animation', reduced.ambientFields === 0 && reduced.blurredLayers === 0 && reduced.animations === 0, JSON.stringify({ fields: reduced.ambientFields, blurred: reduced.blurredLayers, animations: reduced.animations }));
check('reduce: text still readable', reduced.textMinRatio >= 4.5, `min ${reduced.textMinRatio}:1`);
check('reduce: console clean', reduceErrors.length === 0, reduceErrors.join(' ; '));

await reduceContext.close();
await context.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:\n' + failed.map((f) => `  ✗ ${f.name} — ${f.detail}`).join('\n'));
  process.exitCode = 1;
}
