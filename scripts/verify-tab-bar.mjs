/**
 * Bottom tab bar + list page verification on the running web app.
 *
 *   node scripts/verify-tab-bar.mjs
 *
 * Checks, in a real browser: the capsule clears the viewport's bottom edge and
 * the content behind it, the selection lens is on the selected tab (also in a
 * right-to-left document), captions stay legible at 200% text size, rows are
 * real tap targets, and nothing overflows from 320px to 768px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8082';
const OUT = 'screenshots/audit';
const GUTTER = 12;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

/** Runs in the page: geometry, captions, contrast and scroll clearance. */
function audit() {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom), right: Math.round(b.right) };
  };
  const list = document.querySelector('[role="tablist"]');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const bar = list ? box(list) : null;

  const tabsInfo = tabs.map((tab) => {
    const label = tab.getAttribute('aria-label') ?? '';
    const cap = [...tab.querySelectorAll('div')].find(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim() === label
    );
    const style = cap ? getComputedStyle(cap) : null;
    return {
      name: label,
      selected: tab.getAttribute('aria-selected') === 'true',
      box: box(tab),
      caption: cap ? true : false,
      captionClip: cap ? cap.scrollWidth - cap.clientWidth : null,
      captionFont: style ? parseFloat(style.fontSize) : null,
      captionColor: style ? style.color : null,
    };
  });

  let lens = null;
  if (list && bar) {
    lens =
      [...list.querySelectorAll('div')]
        .map((el) => ({ el, s: getComputedStyle(el), b: el.getBoundingClientRect() }))
        .find(
          ({ s, b }) =>
            s.position === 'absolute' &&
            parseFloat(s.borderRadius) >= 20 &&
            b.width > 20 &&
            b.width < bar.w - 8
        ) ?? null;
    lens = lens ? box(lens.el) : null;
  }

  const scroller = [...document.querySelectorAll('*')]
    .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.clientHeight > 160)
    .sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))[0];

  let content = null;
  if (scroller) {
    const sr = scroller.getBoundingClientRect();
    const last = [...scroller.querySelectorAll('*')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.height > 16 && b.width > 40 && b.bottom <= sr.bottom + 1 && b.top >= sr.top - 1;
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    content = {
      scrollTop: Math.round(scroller.scrollTop),
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      scrollable: scroller.scrollHeight > scroller.clientHeight + 2,
      lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null,
    };
  }

  return {
    dir: getComputedStyle(document.documentElement).direction,
    bar,
    barGap: bar ? Math.round(window.innerHeight - bar.bottom) : null,
    lens,
    tabs: tabsInfo,
    selected: tabsInfo.find((t) => t.selected) ?? null,
    content,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
}

/** Contrast of the caption colours against the bar's rendered fill. */
function contrast() {
  const parse = (v) => {
    const m = String(v).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
  const lum = ({ r, g, b }) => {
    const f = (x) => {
      const c = x / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
  };
  const bar = document.querySelector('[role="tablist"]');
  const base = over(parse(getComputedStyle(bar).backgroundColor), { r: 7, g: 9, b: 14, a: 1 });
  const out = {};
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const label = tab.getAttribute('aria-label') ?? '';
    const cap = [...tab.querySelectorAll('div')].find(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim() === label
    );
    if (cap) out[label] = ratio(parse(getComputedStyle(cap).color), base);
  }
  return out;
}

const openPage = async (width, height, base = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark', ...base });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1800);
  return { context, page, errors };
};

// ── 1. Geometry and selection at each width ────────────────────────────────
for (const { w, h } of [
  { w: 320, h: 700 },
  { w: 390, h: 844 },
  { w: 431, h: 822 },
  { w: 768, h: 900 },
]) {
  const { context, page, errors } = await openPage(w, h);
  const state = await page.evaluate(audit);
  const colors = await page.evaluate(contrast);

  check(`${w}px: bar clears the bottom edge`, state.barGap === GUTTER, `${state.barGap}px (want ${GUTTER})`);
  check(
    `${w}px: lens sits on the selected tab`,
    !!state.lens && !!state.selected && Math.abs(state.lens.x - (state.selected.box.x + 3)) <= 2 &&
      Math.abs(state.lens.w - (state.selected.box.w - 6)) <= 2,
    state.lens && state.selected ? `lens ${state.lens.x}+${state.lens.w} · tab ${state.selected.box.x}+${state.selected.box.w}` : 'missing'
  );
  check(
    `${w}px: every tab is a full tap target`,
    state.tabs.every((t) => t.box.w >= 44 && t.box.h >= 44),
    state.tabs.map((t) => `${t.name} ${t.box.w}x${t.box.h}`).join(' · ')
  );
  check(
    `${w}px: selected tab is distinct and readable`,
    state.selected?.captionColor === 'rgb(124, 187, 255)' && (colors[state.selected?.name ?? ''] ?? 0) >= 4.5,
    `${state.selected?.name}: ${state.selected?.captionColor} · ${colors[state.selected?.name ?? '']}:1`
  );
  check(
    `${w}px: unselected captions stay readable`,
    Object.entries(colors).filter(([name]) => name !== state.selected?.name).every(([, ratio]) => ratio >= 4.5),
    Object.entries(colors).map(([n, r]) => `${n} ${r}:1`).join(' · ')
  );
  check(`${w}px: no sideways overflow`, state.overflowX <= 1, `${state.overflowX}px`);

  await page.screenshot({ path: `${OUT}/tab-${w}-top.png` });
  check(`${w}px: console clean`, errors.length === 0, errors.join(' ; '));
  await context.close();
}

// ── 2. RTL: the lens must follow the mirrored row ──────────────────────────
{
  const { context, page } = await openPage(390, 844);
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  await page.waitForTimeout(700);
  const rtl = await page.evaluate(audit);
  const mirrored = rtl.dir === 'rtl' && rtl.tabs[0].box.x > rtl.tabs[rtl.tabs.length - 1].box.x;
  check('RTL: the row mirrors', mirrored, rtl.tabs.map((t) => `${t.name}@${t.box.x}`).join(' '));
  check(
    'RTL: lens stays on the selected tab',
    !!rtl.lens && !!rtl.selected && Math.abs(rtl.lens.x - (rtl.selected.box.x + 3)) <= 2,
    rtl.lens && rtl.selected ? `lens ${rtl.lens.x} · tab ${rtl.selected.box.x}` : 'missing'
  );
  check('RTL: no sideways overflow', rtl.overflowX <= 1, `${rtl.overflowX}px`);
  await page.screenshot({ path: `${OUT}/tab-390-rtl.png` });
  await context.close();
}

// ── 3. 200% text size: captions must not be clipped ────────────────────────
{
  const { context, page } = await openPage(320, 700);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  await page.waitForTimeout(700);
  const zoom = await page.evaluate(audit);
  check(
    '200% text: no caption is clipped',
    zoom.tabs.every((t) => t.caption && t.captionClip === 0),
    zoom.tabs.map((t) => `${t.name} ${t.box.w}px clip ${t.captionClip}`).join(' · ')
  );
  check(
    '200% text: the bar still fits the viewport',
    !!zoom.bar && zoom.bar.x >= 8 && zoom.bar.right <= 320 - 8 && zoom.overflowX <= 1,
    zoom.bar ? `bar ${zoom.bar.x}…${zoom.bar.right} of 320` : 'no bar'
  );
  await page.screenshot({ path: `${OUT}/tab-320-zoom200.png` });
  await context.close();
}

// ── 4. Short viewport: the list must scroll clear of the bar ───────────────
{
  const { context, page } = await openPage(320, 560);
  const before = await page.evaluate(audit);
  check('320x560: the list actually scrolls', before.content?.scrollable === true, `${before.content?.scrollHeight} vs ${before.content?.clientHeight}`);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) el.scrollTop = el.scrollHeight;
    }
  });
  await page.waitForTimeout(700);
  const end = await page.evaluate(audit);
  check(
    '320x560: last content stops above the bar',
    end.content?.lastBottom !== null && !!end.bar && end.bar.y - end.content.lastBottom >= 16,
    end.content?.lastBottom !== null && end.bar ? `${end.bar.y - end.content.lastBottom}px of clearance` : 'unknown'
  );
  await page.screenshot({ path: `${OUT}/tab-320-scrolled.png` });
  await context.close();
}

// ── 5. 200% text: the hero deck title must stay whole ─────────────────────
for (const { w, h } of [
  { w: 320, h: 700 },
  { w: 390, h: 844 },
  { w: 431, h: 822 },
  { w: 768, h: 900 },
]) {
  const { context, page } = await openPage(w, h);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  await page.waitForTimeout(700);

  const hero = await page.evaluate(() => {
    const upNext = [...document.querySelectorAll('div')].find(
      (el) => el.children.length === 0 && /^up next$/i.test((el.textContent ?? '').trim())
    );
    const card = upNext ? upNext.closest('[class*="overflow"]') : null;
    const title = card ? card.querySelector('[role="heading"]') : null;
    if (!title || !card) return null;
    const style = getComputedStyle(title);
    return {
      text: (title.textContent ?? '').trim(),
      clipped: title.scrollHeight - title.clientHeight > 1 || title.scrollWidth - title.clientWidth > 1,
      clamp: style.webkitLineClamp,
      cardOverflowX: card.scrollWidth - card.clientWidth,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  check(
    `${w}px @200%: deck title is complete, not ellipsized`,
    !!hero && hero.clipped === false && hero.clamp === 'none' && hero.text.length > 0,
    hero ? `clamp ${hero.clamp} · clipped ${hero.clipped} · "${hero.text}"` : 'no hero title'
  );
  check(`${w}px @200%: hero card does not overflow`, !!hero && hero.cardOverflowX <= 1, hero ? `${hero.cardOverflowX}px` : 'unknown');
  check(`${w}px @200%: no sideways overflow`, !!hero && hero.pageOverflowX <= 1, hero ? `${hero.pageOverflowX}px` : 'unknown');

  await page.screenshot({ path: `${OUT}/tab-${w}-zoom200.png` });
  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:\n' + failed.map((f) => `  ✗ ${f.name} — ${f.detail}`).join('\n'));
  process.exitCode = 1;
}
