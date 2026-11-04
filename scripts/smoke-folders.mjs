/**
 * Folder smoke test — the feature end to end, in a real browser.
 *
 *   node scripts/smoke-folders.mjs
 *
 * Creates a folder from the home sheet, then checks it sits inside "Your decks"
 * as a row above its decks. Files a deck into it from the deck's options sheet,
 * opens the folder as its own view, returns with "All decks", then deletes the
 * folder and checks the deck survives. Also runs axe on the root shelf, inside
 * the folder and after deletion, and checks 320px overflow.
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

const folderRow = () => page.getByTestId('folder-row').filter({ hasText: FOLDER });

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1400);

  // 1. Create a folder.
  await page.getByRole('button', { name: 'Manage folders', exact: true }).click();
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

  // 2. The folder shares the shelf with the decks, above them.
  check('folder sits inside Your decks', (await folderRow().count()) === 1);
  const rowBox = await folderRow().boundingBox();
  check(
    'folder row is 44px tall',
    !!rowBox && rowBox.height >= 44,
    rowBox ? `${Math.round(rowBox.height)}px` : 'missing'
  );
  check(
    'folder row is above the first deck',
    !!rowBox &&
      !!(await page.getByTestId('deck-row').first().boundingBox()) &&
      rowBox.y < (await page.getByTestId('deck-row').first().boundingBox()).y
  );
  await axe('home with a folder row');

  // 3. File the deck from its own options sheet.
  await page.goto(BASE + '/deck/deck-german-a2b1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1200);
  // v2 gives every card row its own "More options for …" control, so the deck
  // header's action has to be matched by its exact name.
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('Move to folder', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText(FOLDER, { exact: true }).last().click();
  await page.waitForTimeout(600);

  // 4. Entering the folder is a view of its own.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1200);
  check('filed deck names its folder on the row', await page.getByText(DECK).first().isVisible());

  await folderRow().click();
  await page.waitForTimeout(500);
  check('folder opens as its own view', await page.getByRole('heading', { name: FOLDER }).isVisible());
  check('folder shows only its own decks', (await page.getByTestId('deck-row').count()) === 1);
  check('folder view offers a way back', await page.getByRole('button', { name: 'All decks', exact: true }).isVisible());
  check('folder rows are gone while inside a folder', (await page.getByTestId('folder-row').count()) === 0);
  await axe('inside a folder');

  await page.getByRole('button', { name: 'All decks', exact: true }).click();
  await page.waitForTimeout(450);
  check('back returns to Your decks', await page.getByRole('heading', { name: 'Your decks' }).isVisible());
  check('folder row is back on the shelf', (await folderRow().count()) === 1);
  check('all decks are listed again', (await page.getByTestId('deck-row').count()) >= 1);

  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);

  // 5. Delete the folder: the deck must survive.
  await page.getByRole('button', { name: 'Manage folders', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByLabel(`Delete folder ${FOLDER}`).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Close sheet').click();
  await page.waitForTimeout(600);
  check('deck survives folder deletion', await page.getByText(DECK).first().isVisible());
  check('folder row is gone', (await folderRow().count()) === 0);
  await axe('home after deleting the folder');

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
