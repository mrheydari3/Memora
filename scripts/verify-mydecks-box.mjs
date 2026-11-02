/**
 * My decks box verification on the running app.
 *
 *   node scripts/verify-mydecks-box.mjs
 *
 * Seeds two empty folders around the real library (the deck stays unfiled, so
 * the Known group exists), measures the box, then restores the exact stored
 * value. Checks: the group is called Known and is collapsible, folders still
 * collapse, the trunk's leaf branch meets its icon at 431px and at 320px (where
 * the name wraps), rows are real tap targets, and nothing overflows.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:8082';
const FOLDERS_KEY = 'memory:folders';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 431, height: 822 }, colorScheme: 'dark' });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[role="main"]');
await page.waitForTimeout(1500);

const backup = await page.evaluate((key) => localStorage.getItem(key), FOLDERS_KEY);

// Folders live in their own key; the real deck stays unfiled so Known exists.
await page.evaluate((key) => {
  const now = Date.now();
  localStorage.setItem(
    key,
    JSON.stringify([
      { id: 'verify-fold-a', name: 'German A2', createdAt: now },
      { id: 'verify-fold-b', name: 'Travel', createdAt: now },
    ])
  );
}, FOLDERS_KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[role="main"]');
await page.waitForTimeout(1800);

/** Reads the box: pane bounds, header rows, deck leaves and the leaf branch. */
function readBox() {
  const buttons = [...document.querySelectorAll('[role="button"]')];
  const anchor = buttons.find((el) => /^(known|folder )/i.test(el.getAttribute('aria-label') ?? ''));
  const deckRow = buttons.find((el) => /·\s*<?\d+%/i.test(el.textContent ?? ''));
  const from = anchor ?? deckRow;
  if (!from) return { error: 'no box' };
  let card = from;
  while (card && !/overflow-hidden/.test(card.className?.toString?.() ?? '')) card = card.parentElement;
  if (!card) return { error: 'no pane' };

  const cr = card.getBoundingClientRect();
  const rows = [...card.querySelectorAll('[role="button"]')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      label: el.getAttribute('aria-label'),
      expanded: el.getAttribute('aria-expanded'),
      top: Math.round(r.top),
      center: Math.round(r.top + r.height / 2),
      h: Math.round(r.height),
    };
  });

  // The leaf branch: a 1px line, painted (not transparent), inside the deck row.
  let branch = null;
  let rowCenter = null;
  if (deckRow) {
    const rr = deckRow.getBoundingClientRect();
    rowCenter = rr.top + rr.height / 2;
    const line = [...deckRow.querySelectorAll('div')]
      .map((el) => ({ r: el.getBoundingClientRect(), bg: getComputedStyle(el).backgroundColor }))
      .find(({ r, bg }) => Math.round(r.height) === 1 && r.width > 8 && r.width < 30 && /rgba?\(/.test(bg));
    if (line) branch = { center: line.r.top + line.r.height / 2, w: Math.round(line.r.width), bg: line.bg };
  }

  return {
    pane: { top: Math.round(cr.top), bottom: Math.round(cr.bottom), w: Math.round(cr.width) },
    rows,
    deckRow: !!deckRow,
    branch,
    rowCenter,
    text: (card.textContent ?? '').replace(/\s+/g, ' ').trim(),
    overflowX: card.scrollWidth - card.clientWidth,
    bodyHasUnfiled: /unfiled/i.test(document.body.innerText ?? ''),
  };
}

const box = await page.evaluate(readBox);
check('box renders with folders', !box.error, box.error ?? `${box.rows.length} rows`);
const known = box.rows.find((r) => /^known/i.test(r.label ?? ''));
const folderRows = box.rows.filter((r) => /^folder /i.test(r.label ?? ''));
check('no "Unfiled" left on the screen', box.bodyHasUnfiled === false);
check('group is named Known', !!known && /known/i.test(box.text), known?.label ?? 'not found');
check('Known is a real control, not a dead heading', !!known && known.expanded !== null, known ? `aria-expanded=${known.expanded}` : '');
check(
  'folders keep their collapse control',
  folderRows.length === 2 && folderRows.every((f) => f.expanded !== null),
  folderRows.map((f) => `${f.label}:${f.expanded}`).join(' · ')
);
check('every box row clears 44px', box.rows.every((r) => r.h >= 44), box.rows.map((r) => `${r.h}px`).join(' '));
check(
  'leaf branch meets the row centre at 431px',
  !!box.branch && box.rowCenter !== null && Math.abs(box.branch.center - box.rowCenter) <= 1.5,
  box.branch ? `branch ${Math.round(box.branch.center)} vs row ${Math.round(box.rowCenter)}` : 'no branch'
);

// Collapsing Known hides its deck but keeps the header.
await page.getByRole('button', { name: /^Known/ }).click();
await page.waitForTimeout(500);
const collapsedBox = await page.evaluate(readBox);
const collapsedKnown = collapsedBox.rows.find((r) => /^known/i.test(r.label ?? ''));
check(
  'Known collapses to its header',
  collapsedKnown?.expanded === 'false' && collapsedBox.deckRow === false,
  `rows now: ${collapsedBox.rows.map((r) => r.label).join(' | ')}`
);
await page.getByRole('button', { name: /^Known/ }).click();
await page.waitForTimeout(500);
const reopened = await page.evaluate(readBox);
check(
  'Known expands again',
  reopened.deckRow === true && reopened.rows.find((r) => /^known/i.test(r.label ?? ''))?.expanded === 'true'
);

// Folders still collapse, and an empty one keeps its guidance.
await page.getByRole('button', { name: /^Folder German A2/ }).click();
await page.waitForTimeout(450);
const afterFolder = await page.evaluate(readBox);
check(
  'folder header still collapses',
  afterFolder.rows.find((r) => /^folder german a2/i.test(r.label ?? ''))?.expanded === 'false',
  afterFolder.rows.find((r) => /^folder german a2/i.test(r.label ?? ''))?.expanded ?? 'missing'
);
check('empty folder keeps its guidance', /no decks here yet/i.test(afterFolder.text));

// 320px: the name wraps, the branch must still meet the row centre, and
// nothing may spill out of the pane or the page.
await page.setViewportSize({ width: 320, height: 700 });
await page.waitForTimeout(800);
const narrow = await page.evaluate(readBox);
const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const narrowDeck = narrow.rows.find((r) => /·\s*<?\d+%/i.test(r.text));
check('box does not overflow its pane at 320px', narrow.overflowX <= 1, `pane overflow ${narrow.overflowX}px`);
check('page does not scroll sideways at 320px', pageOverflow <= 1, `${pageOverflow}px`);
check('rows stay ≥44px at 320px', narrow.rows.every((r) => r.h >= 44), narrow.rows.map((r) => `${r.h}px`).join(' '));
check(
  'wrapped deck row keeps its branch on the icon',
  !!narrow.branch && narrow.rowCenter !== null && Math.abs(narrow.branch.center - narrow.rowCenter) <= 1.5,
  narrow.branch ? `branch ${Math.round(narrow.branch.center)} vs row ${Math.round(narrow.rowCenter)} (row ${narrowDeck?.h}px)` : 'no branch'
);

check('console clean', errors.length === 0, errors.join(' ; '));

await page.evaluate(
  ({ key, value }) => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  },
  { key: FOLDERS_KEY, value: backup }
);
const restored = await page.evaluate((key) => localStorage.getItem(key), FOLDERS_KEY);
check('stored folders restored to their original value', restored === backup);

await context.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:\n' + failed.map((f) => `  ✗ ${f.name} — ${f.detail}`).join('\n'));
  process.exitCode = 1;
}
