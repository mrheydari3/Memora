import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * The library's new reading order: folders first, then loose decks, with a
 * path back out of every level. The fixture is the same six-deck library the
 * wide Home baseline uses, so the folder names and progress are stable.
 */
const FIXED_NOW = new Date('2026-11-07T12:00:00Z');
const HOME_FIXTURE = buildFixture('F3', FIXED_NOW.getTime());

async function openHome(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="today-panel"]');
  await page.getByRole('progressbar', { name: 'Loading Memora' }).waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
}

test.use({ timezoneId: 'UTC' });

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(FIXED_NOW);
  // A manual session can leave the fixture in this origin's storage; every
  // case starts from a clean seed.
  await page.addInitScript(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('memory:')) localStorage.removeItem(key);
    }
  });
  await page.addInitScript({ content: fixtureInitScript(HOME_FIXTURE) });
});

test('folder-first shelf exposes deck progress and a breadcrumb back to all decks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);

  const shelf = page.getByTestId('shelf-panel');
  await expect(
    shelf.getByTestId('shelf-band').filter({ hasText: 'Folders' })
  ).toBeVisible();
  await expect(
    shelf.getByTestId('shelf-band').filter({ hasText: 'Unfiled decks' })
  ).toBeVisible();

  const folderGroups = page.getByTestId('folder-group');
  await expect(folderGroups).toHaveCount(3);
  const travel = folderGroups.filter({ hasText: 'Travel' });
  await expect(travel).toContainText('1 deck');
  const travelDeck = page.getByTestId('deck-row').filter({ hasText: 'Due today (review)' });
  await expect(travelDeck).toBeVisible();
  await expect(travelDeck).toContainText('100%');
  await expect(travelDeck).toContainText('studied');

  const foldersBox = await shelf.getByTestId('shelf-band').filter({ hasText: 'Folders' }).boundingBox();
  const decksBox = await shelf
    .getByTestId('shelf-band')
    .filter({ hasText: 'Unfiled decks' })
    .boundingBox();
  expect(foldersBox).not.toBeNull();
  expect(decksBox).not.toBeNull();
  expect(foldersBox!.y).toBeLessThan(decksBox!.y);

  // A nested folder is the door to its own level; the breadcrumb is the way up.
  const languages = page.getByTestId('folder-group').filter({ hasText: 'Languages' });
  await expect(languages).toContainText('0 direct · 2 nested');
  await page.getByTestId('folder-subitem').filter({ hasText: 'German' }).click();
  await expect(page.getByRole('button', { name: 'All decks' })).toBeVisible();
  await expect(shelf.getByTestId('shelf-band').filter({ hasText: 'Decks here' })).toBeVisible();

  await page.getByRole('button', { name: 'All decks' }).click();
  await expect(page.getByTestId('folder-group')).toHaveCount(3);
});

test('closing the Folders sheet discards an abandoned draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  // V4 keeps the shelf's library actions in the header menu, so the sheet is
  // opened the way a reader opens it.
  const openFoldersSheet = async () => {
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: 'New folder', exact: true }).click();
  };
  await openFoldersSheet();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('New folder').fill('Abandoned draft');

  // Escape must dismiss even while the name field owns focus.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await openFoldersSheet();
  const reopened = page.getByRole('dialog');
  // A cancelled draft must not come back on the next open.
  await expect(reopened.getByLabel('New folder')).toHaveValue('');
  await expect(reopened.getByRole('button', { name: 'Create folder' })).toBeDisabled();
});

test('the phone keeps folders above loose decks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const shelf = page.getByTestId('shelf-panel');
  const folders = shelf.getByTestId('shelf-band').filter({ hasText: 'Folders' });
  const looseDecks = shelf.getByTestId('shelf-band').filter({ hasText: 'Unfiled decks' });
  await expect(folders).toBeVisible();
  await expect(looseDecks).toBeVisible();

  const foldersBox = await folders.boundingBox();
  const looseDecksBox = await looseDecks.boundingBox();
  expect(foldersBox).not.toBeNull();
  expect(looseDecksBox).not.toBeNull();
  expect(foldersBox!.y).toBeLessThan(looseDecksBox!.y);
});

test('an empty folder can start its first deck in place', async ({ page }) => {
  await openHome(page);

  const empty = page.getByTestId('folder-group').filter({ hasText: 'Nothing here yet' });
  await expect(empty).toContainText('Empty folder');
  await expect(page.getByText('No decks inside yet.')).toBeVisible();

  // The action carries the folder into the composer, so the deck is filed
  // without a second trip through the folder picker.
  await page.getByRole('button', { name: 'Add a deck', exact: true }).click();
  await expect(page).toHaveURL(/\/add-deck\?folderId=fold-empty/);

  await page.getByPlaceholder('Deck name').fill('Filed by default');
  await page.getByRole('button', { name: 'Create deck' }).click();
  await page.waitForURL(/\/deck\/deck-/);

  const decks = await page.evaluate(
    () => JSON.parse(localStorage.getItem('memory:decks') || '[]') as Array<{
      name: string;
      folderId?: string | null;
    }>
  );
  const created = decks.find((deck) => deck.name === 'Filed by default');
  expect(created?.folderId).toBe('fold-empty');
});
