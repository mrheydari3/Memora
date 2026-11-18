/**
 * Flat-folder smoke test — the current folder feature end to end.
 *
 *   node scripts/smoke-folders.mjs
 *
 * Creates folders, paints one with an icon and colour, reorders the single
 * order-wide list, renames and pins a folder, files the seeded deck into a
 * folder, then proves the legacy nested-data migration: a stored `parentId` is
 * dropped on load while every deck keeps its `folderId`. Finally it deletes a
 * folder and checks that its decks become unfiled instead of disappearing.
 *
 * There is no folder-inside-folder, Location picker or parent breadcrumb to
 * test because the app no longer has one. Runs axe at each surface and checks
 * 390px and 320px overflow. A fresh browser context means no state is inherited
 * or left behind.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const DECK = 'Schritt Plus Neu A2/B1';
const FOLDER = 'Prüfung';
const SECOND = 'Grammatik B1';
const RENAMED = 'Grammatik';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160));
});
page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 160)));

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const wait = (ms) => page.waitForTimeout(ms);

const axe = async (label) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  check(`axe clean: ${label}`, violations.length === 0, violations.map((v) => v.id).join(','));
};

const sheet = () => page.getByRole('dialog').filter({ hasText: 'New folder' });
const editor = () => page.getByRole('dialog').filter({ hasText: 'Save folder' });
const folderCard = (name) => page.getByTestId('folder-group').filter({ hasText: name });

const stored = () =>
  page.evaluate(() => ({
    folders: JSON.parse(localStorage.getItem('memory:folders') || '[]'),
    decks: JSON.parse(localStorage.getItem('memory:decks') || '[]'),
  }));

const settle = async () => {
  await page.waitForSelector('[role="main"]');
  await wait(1200);
};

async function openFolders() {
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await wait(400);
}

async function closeSheet() {
  await page.getByLabel('Close sheet').click();
  await wait(450);
}

async function createFolder(name, { icon, color } = {}) {
  await openFolders();
  await sheet().getByLabel('New folder').fill(name);
  if (icon) await sheet().getByRole('radio', { name: `Icon ${icon}` }).click();
  if (color) await sheet().getByRole('radio', { name: `Colour ${color}` }).click();
  await sheet().getByRole('button', { name: 'Create folder' }).click();
  await wait(450);
}

async function openOptions(name) {
  await openFolders();
  await sheet().getByRole('button', { name: `Options for folder ${name}` }).click();
  await wait(400);
}

async function backToFolderList() {
  await editor().getByRole('button', { name: 'Back to folders' }).click();
  await wait(350);
}

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await settle();
  await axe('seeded home');

  // 1. One flat folder with its own icon and colour.
  await createFolder(FOLDER, { icon: 'translate', color: 'Green' });
  check('folder appears in the flat sheet', await sheet().getByText(FOLDER, { exact: true }).first().isVisible());
  const created = await stored();
  const folderRecord = created.folders.find((folder) => folder.name === FOLDER);
  check('folder stores its icon', folderRecord?.icon === 'translate', String(folderRecord?.icon));
  check('folder stores its colour', folderRecord?.color === '#5FD39A', String(folderRecord?.color));
  check('new folder has no parent link', !!folderRecord && !('parentId' in folderRecord));
  await closeSheet();

  check('folder card is on Your decks', (await folderCard(FOLDER).count()) === 1);
  const folderBox = await folderCard(FOLDER).boundingBox();
  check('folder card is at least 44px tall', !!folderBox && folderBox.height >= 44, folderBox ? `${Math.round(folderBox.height)}px` : 'missing');
  await axe('home with a flat folder');

  // 2. A second folder, then its editor: no Location or nesting destination.
  await createFolder(SECOND);
  await closeSheet();
  check('two folders share the one flat list', (await page.getByTestId('folder-group').count()) === 2);

  await openOptions(SECOND);
  check(
    'folder editor has no Location row',
    (await editor().getByRole('button', { name: /location/i }).count()) === 0
  );
  check(
    'folder editor has no nesting copy',
    (await editor().getByText(/nest|subfolder|top level/i).count()) === 0
  );
  await backToFolderList();
  await closeSheet();

  // 3. Move a folder in the order-wide list; there is no sibling group.
  await openOptions(SECOND);
  await editor().getByRole('button', { name: 'Move up', exact: true }).click();
  await wait(450);
  await closeSheet();
  const moved = await stored();
  check(
    'move up rewrites the flat order',
    moved.folders.map((folder) => folder.name).join('|') === `${SECOND}|${FOLDER}`,
    moved.folders.map((folder) => folder.name).join(',')
  );
  const secondBox = await folderCard(SECOND).boundingBox();
  const firstBox = await folderCard(FOLDER).boundingBox();
  check('moved folder is drawn above the other folder', !!secondBox && !!firstBox && secondBox.y < firstBox.y);

  // 4. Rename and pin from the same editor.
  await openOptions(SECOND);
  await editor().getByLabel('Name').fill(RENAMED);
  await editor().getByRole('button', { name: 'Save folder', exact: true }).click();
  await wait(450);
  await closeSheet();
  const renamed = await stored();
  check('folder rename is persisted', !!renamed.folders.find((folder) => folder.name === RENAMED));
  check('renamed folder card is on the shelf', (await folderCard(RENAMED).count()) === 1);

  await openOptions(RENAMED);
  await editor().getByRole('button', { name: /^Pin folder/ }).click();
  await wait(400);
  await closeSheet();
  const pinned = await stored();
  check('folder pin is persisted', !!pinned.folders.find((folder) => folder.name === RENAMED)?.pinnedAt);
  const pinnedBox = await folderCard(RENAMED).boundingBox();
  const otherBox = await folderCard(FOLDER).boundingBox();
  check('pinned folder sits above the other folder', !!pinnedBox && !!otherBox && pinnedBox.y < otherBox.y);
  await axe('home with a pinned flat folder');

  // 5. File the seeded deck into the first folder.
  await page.goto(BASE + '/deck/deck-german-a2b1', { waitUntil: 'domcontentloaded' });
  await settle();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await wait(400);
  await page.getByText('Move to folder', { exact: true }).click();
  await wait(400);
  await page.getByText(FOLDER, { exact: true }).last().click();
  await wait(700);

  const filedState = await stored();
  const folderId = filedState.folders.find((folder) => folder.name === FOLDER)?.id;
  const filedDeck = filedState.decks.find((deck) => deck.id === 'deck-german-a2b1');
  check('deck is filed in the chosen folder', !!folderId && filedDeck?.folderId === folderId);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await settle();

  // 6. Migration: write the old tree shape, reload, and prove load flattens it
  // without moving the deck out of its folder.
  const parent = filedState.folders.find((folder) => folder.name === RENAMED);
  const child = filedState.folders.find((folder) => folder.name === FOLDER);
  await page.evaluate(
    ({ childId, parentId }) => {
      const folders = JSON.parse(localStorage.getItem('memory:folders') || '[]');
      const next = folders.map((folder) =>
        folder.id === childId ? { ...folder, parentId } : folder
      );
      localStorage.setItem('memory:folders', JSON.stringify(next));
    },
    { childId: child.id, parentId: parent.id }
  );
  await page.reload();
  await settle();
  await page.waitForFunction(() => {
    const folders = JSON.parse(localStorage.getItem('memory:folders') || '[]');
    return folders.length > 0 && folders.every((folder) => !('parentId' in folder));
  });

  const migrated = await stored();
  check(
    'legacy parent links are removed from storage',
    migrated.folders.every((folder) => !('parentId' in folder))
  );
  check(
    'migration keeps every folder',
    [FOLDER, RENAMED].every((name) => migrated.folders.some((folder) => folder.name === name))
  );
  check(
    'migration keeps the deck in its folder',
    migrated.decks.find((deck) => deck.id === 'deck-german-a2b1')?.folderId === folderId
  );
  check('no folder is drawn as a child row', (await page.getByTestId('folder-subitem').count()) === 0);
  check(
    'the former parent no longer rolls up its child deck',
    (await folderCard(RENAMED).innerText()).includes('Empty folder')
  );
  check('the child folder keeps its one deck', (await folderCard(FOLDER).innerText()).includes('1 deck'));
  await axe('home after legacy-nested migration');

  // 7. Delete the folder: the deck becomes unfiled, nothing is deleted.
  await openOptions(FOLDER);
  await editor().getByRole('button', { name: /^Delete folder/ }).click();
  await wait(800);
  const afterDelete = await stored();
  check('deleted folder is gone', !afterDelete.folders.some((folder) => folder.name === FOLDER));
  check(
    'deleted folder returns its deck to unfiled',
    !afterDelete.decks.find((deck) => deck.id === 'deck-german-a2b1')?.folderId
  );
  check(
    'the deck is still on the shelf',
    (await page.getByTestId('deck-row').filter({ hasText: DECK }).count()) === 1
  );
  await axe('home after deleting a flat folder');

  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);

  await page.setViewportSize({ width: 320, height: 780 });
  await wait(400);
  const overflow320 = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  check('no horizontal overflow at 320px', overflow320 <= 1, `${overflow320}px`);

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
