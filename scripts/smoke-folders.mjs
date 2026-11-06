/**
 * Folder-tree smoke test — the feature end to end, in a real browser.
 *
 *   node scripts/smoke-folders.mjs
 *
 * Creates two top-level folders, paints one with an icon and colour, renames
 * the other, pins it to the top, nests two folders inside the first one and
 * reorders them, files the seeded deck into the folder and pins it, then deletes
 * the parent folder and checks that its children and deck moved up one level
 * instead of disappearing. Runs axe at every surface and checks 320px overflow.
 *
 * Every run uses a fresh browser context, so it never inherits or leaves state.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const DECK = 'Schritt Plus Neu A2/B1';
const FOLDER = 'Prüfung';
const SECOND = 'Grammatik B1';
const NESTED_A = 'Wortschatz';
const NESTED_B = 'Lesen';

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

const dialog = () => page.getByRole('dialog');
const folderRow = (name) => page.getByTestId('folder-row').filter({ hasText: name });
const stored = () =>
  page.evaluate(() => ({
    folders: JSON.parse(localStorage.getItem('memory:folders') || '[]'),
    decks: JSON.parse(localStorage.getItem('memory:decks') || '[]'),
  }));

const wait = (ms) => page.waitForTimeout(ms);

async function openFolders() {
  await page.getByRole('button', { name: 'Manage folders', exact: true }).click();
  await wait(450);
}

async function closeSheet() {
  await dialog().getByLabel('Close sheet').click();
  await wait(500);
}

async function createFolder(name, { icon, color } = {}) {
  await openFolders();
  await dialog().getByLabel('New folder').fill(name);
  if (icon) await dialog().getByRole('radio', { name: `Icon ${icon}` }).click();
  if (color) await dialog().getByRole('radio', { name: `Colour ${color}` }).click();
  await dialog().getByRole('button', { name: 'Create folder' }).click();
  await wait(450);
}

async function openFolderOptions(name) {
  await openFolders().catch(() => {});
  await dialog().getByLabel(`Options for folder ${name}`).click();
  await wait(450);
}

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await wait(1500);
  await axe('home, empty library');

  // 1. A top-level folder with its own icon and colour.
  await createFolder(FOLDER, { icon: 'translate', color: '#5FD39A' });
  check('folder appears in the sheet', await dialog().getByText(FOLDER, { exact: true }).first().isVisible());
  await axe('folders sheet with one folder');
  const created = await stored();
  const folderRecord = created.folders.find((f) => f.name === FOLDER);
  check('folder stores its icon', folderRecord?.icon === 'translate', String(folderRecord?.icon));
  check('folder stores its colour', folderRecord?.color === '#5FD39A', String(folderRecord?.color));
  check('new top-level folder has no parent', !folderRecord?.parentId);
  await closeSheet();

  // The shelf's own options button must raise the editor; opening it from the
  // folders sheet's list can hide a missing setFolderSheet(true).
  await page.getByLabel(`Options for folder ${FOLDER}`).click();
  await wait(450);
  check(
    'shelf options open the folder editor',
    await dialog().getByRole('button', { name: 'Save folder' }).isVisible()
  );
  await dialog().getByRole('button', { name: 'Back to folders', exact: true }).click();
  await wait(350);
  await closeSheet();

  check('folder row sits inside Your decks', (await folderRow(FOLDER).count()) === 1);
  const folderBox = await folderRow(FOLDER).boundingBox();
  const deckBox = await page.getByTestId('deck-row').first().boundingBox();
  check('folder row is 44px tall', !!folderBox && folderBox.height >= 44, folderBox ? `${Math.round(folderBox.height)}px` : 'missing');
  check('folder row is above the deck', !!folderBox && !!deckBox && folderBox.y < deckBox.y);
  await axe('home with a folder');

  // 2. A second folder, then rename it from its own editor.
  await createFolder(SECOND);
  await closeSheet();
  check('two folders share the shelf', (await page.getByTestId('folder-row').count()) === 2);

  await openFolderOptions(SECOND);
  await axe('folder editor');
  await dialog().getByLabel('Name').fill('Grammatik');
  await dialog().getByRole('button', { name: 'Save folder', exact: true }).click();
  await wait(500);
  check('saving returns to the folder list', await dialog().getByLabel('New folder').isVisible());
  await closeSheet();
  const renamed = await stored();
  check('folder rename is persisted', !!renamed.folders.find((f) => f.name === 'Grammatik'), renamed.folders.map((f) => f.name).join(','));
  check('renamed folder row is on the shelf', (await folderRow('Grammatik').count()) === 1);

  // 3. Pin it: the pinned folder moves above the unpinned one.
  await openFolderOptions('Grammatik');
  await dialog().getByRole('button', { name: /^Pin folder/ }).click();
  await wait(400);
  const pinned = await stored();
  check('folder pin is persisted', !!pinned.folders.find((f) => f.name === 'Grammatik')?.pinnedAt);
  await dialog().getByRole('button', { name: 'Back to folders', exact: true }).click();
  await wait(350);
  await closeSheet();
  const pinnedBox = await folderRow('Grammatik').boundingBox();
  const otherBox = await folderRow(FOLDER).boundingBox();
  check('pinned folder sits above the other folder', !!pinnedBox && !!otherBox && pinnedBox.y < otherBox.y);
  await axe('home with a pinned folder');

  // 4. Enter a folder and create two nested folders inside it.
  await folderRow(FOLDER).click();
  await wait(500);
  check('folder opens as its own view', await page.getByRole('heading', { name: FOLDER }).isVisible());
  check('folder view offers a way back', await page.getByRole('button', { name: 'Back to All decks', exact: true }).isVisible());

  await createFolder(NESTED_A);
  await closeSheet();
  await createFolder(NESTED_B);
  await closeSheet();
  const nested = await stored();
  const parent = nested.folders.find((f) => f.name === FOLDER);
  const childA = nested.folders.find((f) => f.name === NESTED_A);
  const childB = nested.folders.find((f) => f.name === NESTED_B);
  check('nested folder stores its parent', childA?.parentId === parent?.id && childB?.parentId === parent?.id);
  check('parent folder keeps its own level', (await page.getByTestId('folder-row').count()) === 2);
  check('nested folders are not listed at the top level', (await page.getByRole('heading', { name: 'Your decks' }).count()) === 0);

  const beforeMoveA = await folderRow(NESTED_A).boundingBox();
  const beforeMoveB = await folderRow(NESTED_B).boundingBox();
  check('nested folders keep creation order', !!beforeMoveA && !!beforeMoveB && beforeMoveA.y < beforeMoveB.y);

  // 5. Move the second nested folder up.
  await openFolderOptions(NESTED_B);
  await dialog().getByRole('button', { name: 'Move up', exact: true }).click();
  await wait(450);
  await dialog().getByRole('button', { name: 'Back to folders', exact: true }).click();
  await wait(350);
  await closeSheet();
  const movedA = await folderRow(NESTED_A).boundingBox();
  const movedB = await folderRow(NESTED_B).boundingBox();
  check('move up reorders the siblings', !!movedA && !!movedB && movedB.y < movedA.y);
  const afterMove = await stored();
  check(
    'move up is persisted',
    afterMove.folders.findIndex((f) => f.name === NESTED_B) <
      afterMove.folders.findIndex((f) => f.name === NESTED_A)
  );
  await axe('folder with nested folders');

  // 6. File the seeded deck into the parent folder, then pin it there.
  await page.goto(BASE + '/deck/deck-german-a2b1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await wait(1200);
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await wait(400);
  await page.getByText('Move to folder', { exact: true }).click();
  await wait(400);
  await page.getByText(FOLDER, { exact: true }).last().click();
  await wait(600);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await wait(1300);
  check('a filed deck is not repeated at the top level', (await page.getByTestId('deck-row').count()) === 0);
  await folderRow(FOLDER).click();
  await wait(500);
  check('the deck appears inside its folder', (await page.getByTestId('deck-row').count()) === 1);
  check('the deck row names the folder', await page.getByText('Schritt Plus Neu A2/B1').first().isVisible());

  // 6b. Moving a deck is visible: the shelf keeps the stored order. Only one
  // deck ships in the seed, so clone it into the same folder for a sibling.
  await page.evaluate(() => {
    const decks = JSON.parse(localStorage.getItem('memory:decks') || '[]');
    const source = decks.find((deck) => deck.id === 'deck-german-a2b1');
    if (source && !decks.some((deck) => deck.id === 'deck-smoke-second')) {
      decks.push({ ...source, id: 'deck-smoke-second', name: 'Zweites Deck', createdAt: Date.now() });
      localStorage.setItem('memory:decks', JSON.stringify(decks));
    }
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await wait(1300);
  await folderRow(FOLDER).click();
  await wait(500);

  await page.getByLabel('Options for deck Zweites Deck').click();
  await wait(400);
  await dialog().getByRole('button', { name: 'Move up', exact: true }).click();
  await wait(400);
  await closeSheet();
  const deckOrder = await page
    .getByTestId('deck-row')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
  check(
    'deck move up changes the shelf order',
    !!deckOrder[0]?.includes('Zweites Deck') && !!deckOrder[1]?.includes(DECK),
    deckOrder.map((text) => text.slice(0, 18)).join(' | ')
  );
  const movedDecks = await stored();
  const secondIndex = movedDecks.decks.findIndex((deck) => deck.id === 'deck-smoke-second');
  const firstIndex = movedDecks.decks.findIndex((deck) => deck.id === 'deck-german-a2b1');
  check('deck move up is persisted', secondIndex >= 0 && secondIndex < firstIndex);

  await page.getByLabel(`Options for deck ${DECK}`).click();
  await wait(400);
  await dialog().getByRole('button', { name: /^Pin deck/ }).click();
  await wait(400);
  const deckPinned = await stored();
  check('deck pin is persisted', !!deckPinned.decks.find((d) => d.id === 'deck-german-a2b1')?.pinnedAt);
  await closeSheet();
  const pinnedOrder = await page
    .getByTestId('deck-row')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
  check(
    'pinned deck carries its pin marker',
    pinnedOrder.length === 2 && !!pinnedOrder[0]?.includes(DECK) && !!pinnedOrder[1]?.includes('Zweites Deck')
  );

  // 7. Delete the parent folder: children and deck move up one level.
  await page.getByRole('button', { name: 'Back to All decks', exact: true }).click();
  await wait(500);
  await openFolderOptions(FOLDER);
  await dialog().getByRole('button', { name: /Delete folder/ }).click();
  await wait(700);

  check('deleted folder is gone', (await folderRow(FOLDER).count()) === 0);
  check('its subfolders moved to the top level', (await folderRow(NESTED_A).count()) === 1 && (await folderRow(NESTED_B).count()) === 1);
  check('its decks survive at the top level', (await page.getByTestId('deck-row').count()) === 2);
  const afterDelete = await stored();
  check('moved deck lost its old folder id', !afterDelete.decks.find((d) => d.id === 'deck-german-a2b1')?.folderId);
  await axe('home after deleting a parent folder');

  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  await page.setViewportSize({ width: 320, height: 780 });
  await wait(400);
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
