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
  await expect(folderCards).toHaveCount(3);
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
  await expect(page.getByTestId('folder-card')).toHaveCount(3);
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
