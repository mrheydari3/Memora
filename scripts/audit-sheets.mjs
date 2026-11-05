/**
 * Overlay audit — every bottom sheet and sheet-route, measured while open.
 *
 *   node scripts/audit-sheets.mjs
 *
 * Writes audit/sheets-1.2.0.json and screenshots/audit-1.2.0/sheet-<w>-<name>.png
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = 'screenshots/audit-1.2.0';
const WIDTHS = [
  { w: 431, h: 822 },
  { w: 320, h: 700 },
];

const SHEETS = [
  { name: 'home-folders', path: '/home', steps: ['Manage folders'] },
  { name: 'home-deck-menu', path: '/home', steps: ['/^Options for deck/'] },
  { name: 'deck-options', path: '/deck/deck-german-a2b1', steps: ['More options'] },
  { name: 'deck-rename', path: '/deck/deck-german-a2b1', steps: ['More options', 'Rename Deck'] },
  { name: 'deck-folder', path: '/deck/deck-german-a2b1', steps: ['More options', 'Move to folder'] },
  { name: 'deck-confirm', path: '/deck/deck-german-a2b1', steps: ['More options', 'Delete Deck'] },
  { name: 'algorithm-retention', path: '/settings/algorithm', steps: ['Desired retention'] },
  { name: 'algorithm-interval', path: '/settings/algorithm', steps: ['Maximum interval'] },
  { name: 'algorithm-new', path: '/settings/algorithm', steps: ['New cards per day'] },
  { name: 'algorithm-max', path: '/settings/algorithm', steps: ['Maximum cards per day'] },
  { name: 'advanced-edit', path: '/settings/algorithm-advanced', steps: ['Edit step'] },
  { name: 'tts-language', path: '/settings/tts', steps: ['Front language'] },
  { name: 'add-deck-route', path: '/add-deck', steps: [] },
  { name: 'add-deck-form', path: '/add-deck', steps: ['Add manually'] },
];

const measureSheet = () => {
  const round = (n) => Math.round(n * 10) / 10;
  const px = (v) => round(parseFloat(v) || 0);
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) };
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const panels = [...document.querySelectorAll('div')].filter((el) => {
    const s = getComputedStyle(el);
    const h = el.getBoundingClientRect().height;
    return parseFloat(s.borderTopLeftRadius) >= 20 && parseFloat(s.borderBottomLeftRadius) === 0 && h > 80;
  });
  if (!panels.length) return { found: false };
  const panel = panels[panels.length - 1];
  const s = getComputedStyle(panel);
  const pb = box(panel);

  const heading = panel.querySelector('[role="heading"]');
  const headingBox = heading ? box(heading) : null;
  const buttons = [...panel.querySelectorAll('[role="button"]')]
    .filter((el) => {
      const b = el.getBoundingClientRect();
      return b.height > 20 && b.width > 40 && label(el) !== 'Close sheet';
    })
    .map((el) => {
      const bs = getComputedStyle(el);
      return {
        label: label(el),
        box: box(el),
        bg: bs.backgroundColor,
        radius: px(bs.borderTopLeftRadius),
        pad: [bs.paddingTop, bs.paddingRight, bs.paddingBottom, bs.paddingLeft].map(px).join('/'),
        fontSize: px(bs.fontSize),
      };
    })
    .filter((b) => !headingBox || b.box.y >= headingBox.y);

  // Rows that begin inside the header row (e.g. a close control) are excluded;
  // a menu row is anything tall enough to be a tap target.
  const rows = buttons.filter((b) => b.box.h >= 32);

  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    gaps.push(rows[i].box.y - (rows[i - 1].box.y + rows[i - 1].box.h));
  }

  const scrollers = [...panel.querySelectorAll('*')]
    .filter((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    })
    .map((el) => {
      const eb = box(el);
      const clipped = rows.filter((r) => r.box.y < eb.bottom - 2 && r.box.y + r.box.h > eb.bottom + 2);
      return { box: eb, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, clippedRows: clipped.map((c) => c.label) };
    });

  const last = rows[rows.length - 1];
  const lastRowToEdge = last ? pb.bottom - (last.box.y + last.box.h) : null;

  return {
    found: true,
    panel: { ...pb, radius: px(s.borderTopLeftRadius), pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px).join('/'), bg: s.backgroundColor, minHeight: s.minHeight, maxHeight: s.maxHeight },
    heading: headingBox ? { text: heading.textContent.trim().slice(0, 40), box: headingBox } : null,
    headerGap: headingBox && rows[0] ? rows[0].box.y - headingBox.bottom : null,
    rows,
    gaps,
    lastRowToEdge,
    scrollers,
    deadSpace: last && pb.h > 200 ? pb.bottom - px(s.paddingBottom) - (last.box.y + last.box.h) : null,
  };
};

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
const results = [];

for (const vp of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));

  // A second deck makes the algorithm screen's deck switch + "apply to all"
  // reachable; it is user data in an ephemeral profile.
  await page.goto(BASE + '/add-deck', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Add manually' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByPlaceholder('Deck name').fill('Audit Deck').catch(() => {});
  await page.getByRole('button', { name: 'Create deck' }).first().click().catch(() => {});
  await page.waitForTimeout(900);

  for (const sheet of SHEETS) {
    const rec = { name: sheet.name, width: vp.w };
    try {
      await page.goto(BASE + sheet.path, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('[role="main"]');
      await page.waitForTimeout(800);
      for (const step of sheet.steps) {
        if (step.startsWith('/') && step.endsWith('/')) {
          await page.getByRole('button', { name: new RegExp(step.slice(1, -1)) }).first().click();
        } else {
          await page.getByRole('button', { name: step, exact: false }).first().click();
        }
        await page.waitForTimeout(650);
      }
      const m = await page.evaluate(measureSheet);
      Object.assign(rec, m);
      try {
        const a = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
          .analyze();
        rec.axe = a.violations.map((v) => ({ id: v.id, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(' ') }));
      } catch (e) {
        rec.axe = [{ id: 'axe-failed', nodes: 0, target: String(e).slice(0, 100) }];
      }
      await page.screenshot({ path: `${OUT}/sheet-${vp.w}-${sheet.name}.png` });
      console.log(
        `${vp.w} ${sheet.name.padEnd(20)} panel:${m.panel ? String(m.panel.h).padStart(3) : '---'} rows:${String(m.rows?.length ?? 0).padStart(2)} gaps:${(m.gaps ?? []).join(',')} last:${m.lastRowToEdge ?? '-'} axe:${(rec.axe ?? []).length}`
      );
    } catch (e) {
      rec.error = String(e).slice(0, 160);
      console.log(`${vp.w} ${sheet.name.padEnd(20)} ERROR ${rec.error}`);
    }
    results.push(rec);
  }
  rec_error_loop: {
    for (const e of errors.splice(0)) results.push({ name: 'pageerror', width: vp.w, error: e });
  }
  await ctx.close();
}

await browser.close();
writeFileSync('audit/sheets-1.2.0.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 1));
console.log('wrote audit/sheets-1.2.0.json');
