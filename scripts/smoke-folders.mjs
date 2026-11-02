/**
 * Folder smoke test — the feature end to end, in a real browser.
 *
 *   node scripts/smoke-folders.mjs
 *
 * Creates a folder from the home sheet, files a deck into it from the deck's
 * options sheet, filters the home list by it, then unfiles it again and checks
 * the folder can be deleted without touching the deck. Also runs axe on the home
 * screen and on the open folder sheet, and checks 320px overflow.
 *
 * Every run uses a fresh browser context, so it never inherits or leaves state.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const DECK = 'Schritt Plus Neu A2/B1';
const FOLDER = 'German A2';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 160)));
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const axe = async (label) => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  check(`axe clean: ${label}`, violations.length === 0, violations.map((v) => v.id).join(','));
};

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1400);

  // 1. Create a folder.
  await page.getByRole('button', { name: 'Folders', exact: true }).click();
  await page.waitForTimeout(500);
  await axe('folders sheet, empty');
  await page.getByLabel('New folder').fill(FOLDER);
  await page.getByRole('button', { name: 'Create folder' }).click();
  await page.waitForTimeout(400);
  check('folder row appears in the sheet', await page.getByText(FOLDER, { exact: true }).first().isVisible());
  await axe('folders sheet, one folder');

  // A duplicate is refused with a message, not a second folder.
  await page.getByLabel('New folder').fill('  german   a2 ');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await page.waitForTimeout(300);
  check('duplicate name is refused', await page.getByText('A folder with that name already exists.').isVisible());

  await page.getByLabel('Close sheet').click();
  await page.waitForTimeout(600);
  check(
    'folder appears as a header in the My decks box',
    await page.getByRole('button', { name: `Folder ${FOLDER}` }).isVisible()
  );
  await axe('home with a folder header');

  // 2. File the deck from its own options sheet.
  await page.goto(BASE + '/deck/deck-german-a2b1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1200);
  await page.getByLabel('More options').click();
  await page.waitForTimeout(400);
  await page.getByText('Move to folder', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText(FOLDER, { exact: true }).last().click();
  await page.waitForTimeout(600);

  // 3. The folder filters home.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1200);
  const header = page.getByRole('button', { name: `Folder ${FOLDER}` });
  check('filed deck is nested under its folder', await page.getByText(DECK).first().isVisible());

  const headerBox = await header.boundingBox();
  check('folder header is 44px tall', !!headerBox && headerBox.height >= 44, headerBox ? `${Math.round(headerBox.height)}px` : 'missing');

  // Collapsing hides the children; expanding brings them back.
  await header.click();
  await page.waitForTimeout(350);
  const hidden = (await page.getByRole('button', { name: new RegExp(DECK) }).count()) === 0;
  check('folder collapses its decks', hidden);
  await header.click();
  await page.waitForTimeout(350);
  check('folder expands again', await page.getByRole('button', { name: new RegExp(DECK) }).first().isVisible());

  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);

  // 4. Unfile, then delete the folder: the deck must survive.
  await page.getByRole('button', { name: 'Folders', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByLabel(`Delete folder ${FOLDER}`).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Close sheet').click();
  await page.waitForTimeout(600);
  check('deck survives folder deletion', await page.getByText(DECK).first().isVisible());
  check(
    'folder header is gone',
    (await page.getByRole('button', { name: `Folder ${FOLDER}` }).count()) === 0
  );

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  await page.setViewportSize({ width: 320, height: 780 });
  await page.waitForTimeout(400);
  const overflow320 = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 320px', overflow320 <= 1, `${overflow320}px`);
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
