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

test('folder-first shelf exposes progress and a breadcrumb back to all decks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);

  const shelf = page.getByTestId('shelf-panel');
  await expect(
    shelf.getByTestId('shelf-band').filter({ hasText: 'Folders' })
  ).toBeVisible();
  await expect(
    shelf.getByTestId('shelf-band').filter({ hasText: 'Unfiled decks' })
  ).toBeVisible();

  const folderCards = page.getByTestId('folder-card');
  await expect(folderCards).toHaveCount(4);
  const travel = folderCards.filter({ hasText: 'Travel' });
  await expect(travel).toContainText('% studied');

  const lastFolderBox = await folderCards.last().boundingBox();
  const firstDeckBox = await page.getByTestId('deck-row').first().boundingBox();
  expect(lastFolderBox).not.toBeNull();
  expect(firstDeckBox).not.toBeNull();
  expect(lastFolderBox!.y).toBeLessThan(firstDeckBox!.y);

  await travel.click();
  await expect(page.getByRole('button', { name: 'All decks' })).toBeVisible();
  await expect(shelf.getByTestId('shelf-band').filter({ hasText: 'Decks here' })).toBeVisible();

  await page.getByRole('button', { name: 'All decks' }).click();
  await expect(page.getByTestId('folder-card')).toHaveCount(4);
});

test('closing the Folders sheet discards an abandoned draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const opener = page.getByRole('button', { name: 'Create new' });
  await opener.click();
  await page.getByRole('button', { name: /^New folder/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('New folder')).toBeFocused();
  await sheet.getByLabel('New folder').fill('Abandoned draft');

  // Escape must dismiss even while the name field owns focus.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await opener.click();
  await page.getByRole('button', { name: /^New folder/ }).click();
  const reopened = page.getByRole('dialog');
  // A cancelled draft must not come back on the next open.
  await expect(reopened.getByLabel('New folder')).toBeFocused();
  await expect(reopened.getByLabel('New folder')).toHaveValue('');
  await expect(reopened.getByRole('button', { name: 'Create folder' })).toBeDisabled();
});

test('the Library opens folder management separately from folder creation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByRole('button', { name: 'Manage folders' }).click();
  const sheet = page.getByRole('dialog', { name: 'Folders' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Close sheet' })).toBeFocused();
  await expect(sheet.getByRole('button', { name: 'Options for folder Travel' })).toBeVisible();
  await expect(sheet.getByLabel('New folder')).not.toBeFocused();
});

test('the phone drops the Folders band and keeps folders above loose decks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  // The masthead names the shelf and carries its counts, so the redundant band
  // is gone on a phone; the folders themselves lead the list.
  await expect(page.getByText('5 decks · 4 folders', { exact: true })).toBeVisible();
  const shelf = page.getByTestId('shelf-panel');
  await expect(shelf.getByTestId('shelf-band').filter({ hasText: 'Folders' })).toHaveCount(0);
  const looseDecks = shelf.getByTestId('shelf-band').filter({ hasText: 'Unfiled decks' });
  await expect(looseDecks).toBeVisible();

  const firstFolder = page.getByTestId('folder-group').first();
  await expect(firstFolder).toBeVisible();
  const folderBox = await firstFolder.boundingBox();
  const looseDecksBox = await looseDecks.boundingBox();
  expect(folderBox).not.toBeNull();
  expect(looseDecksBox).not.toBeNull();
  expect(folderBox!.y).toBeLessThan(looseDecksBox!.y);
});

test('the whole first folder header clears the tab dock at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHome(page);

  // F3's first folder (Travel) is the last content that has to fit above the
  // fold. Its 76px header must clear the floating dock entirely; the deck body
  // beneath it is allowed to continue under the dock.
  const folder = page.getByTestId('folder-group').first();
  const dock = page.locator('[role="tablist"]');
  await expect(folder).toBeVisible();
  await expect(dock).toBeVisible();

  const folderBox = await folder.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(folderBox).not.toBeNull();
  expect(dockBox).not.toBeNull();

  const clearance = Math.round(dockBox!.y - (folderBox!.y + folderBox!.height));
  // A few px of air, not merely "not overlapping": a 1px touch would pass an
  // overlap check while still reading as clipped.
  expect(clearance).toBeGreaterThanOrEqual(4);
});
