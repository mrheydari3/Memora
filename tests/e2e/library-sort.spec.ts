import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * The Home shelf's order control.
 *
 * F3 has four folders (Travel pinned), two decks in German and one studied deck,
 * so every mode has a distinct, checkable order. Storage is seeded once per
 * context: the reload case must read the saved setting, not a fresh fixture.
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
  // Same once-per-context guard data-truth uses: installing the fixture on
  // every document would silently undo the sort choice on reload.
  await page.addInitScript({
    content: `if (sessionStorage.getItem('sort-seeded') !== '1') {
  sessionStorage.setItem('sort-seeded', '1');
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith('memory:')) localStorage.removeItem(key);
  }
  ${fixtureInitScript(HOME_FIXTURE)}
}`,
  });
});

const chooseSort = async (page: Page, current: string, option: string) => {
  await page.getByRole('button', { name: `Sort: ${current}` }).click();
  const menu = page.getByRole('dialog', { name: 'Sort shelf' });
  await menu.getByRole('button', { name: new RegExp(`^${option}`) }).click();
};

test('the sort control orders both levels, keeps pins first and persists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const folders = page.getByTestId('folder-group');
  const decks = page.getByTestId('deck-row');

  // Manual: the stored folder order, with the pinned Travel folder lifted.
  await expect(page.getByRole('button', { name: 'Sort: Manual' })).toBeVisible();
  await expect(folders.nth(0)).toContainText('Travel');
  await expect(folders.nth(1)).toContainText('Languages');
  await expect(folders.nth(2)).toContainText('German');

  // Name: the pin still leads; the rest turn alphabetical.
  await chooseSort(page, 'Manual', 'Name');
  await expect(page.getByRole('button', { name: 'Sort: Name' })).toBeVisible();
  await expect(folders.nth(0)).toContainText('Travel');
  await expect(folders.nth(1)).toContainText('German');
  await expect(folders.nth(2)).toContainText('Languages');

  // Folder bodies are open by default: Travel's pinned deck leads, then the
  // German pair turns alphabetical (the long deck before Schritt).
  await expect(decks.nth(0)).toContainText('Due today (review)');
  await expect(decks.nth(1)).toContainText('Ein außerordentlich');
  await expect(decks.nth(2)).toContainText('Schritt Plus Neu');

  // The choice is a setting, and the shelf reads it back after a reload.
  const settings = await page.evaluate(
    () => JSON.parse(localStorage.getItem('memory:settings') ?? '{}') as { librarySort?: string }
  );
  expect(settings.librarySort).toBe('name');
  await page.reload();
  await openHome(page);
  await expect(page.getByRole('button', { name: 'Sort: Name' })).toBeVisible();
  await expect(folders.nth(1)).toContainText('German');

  // Due: the pinned folder stays first; Schritt outranks the four-card deck,
  // and the studied Persian deck moves above the empty one.
  await chooseSort(page, 'Name', 'Due');
  await expect(page.getByRole('button', { name: 'Sort: Due' })).toBeVisible();
  await expect(folders.nth(0)).toContainText('Travel');
  await expect(folders.nth(1)).toContainText('German');
  await expect(decks.nth(1)).toContainText('Schritt Plus Neu');
  await expect(decks.nth(2)).toContainText('Ein außerordentlich');
  await expect(decks.nth(3)).toContainText('فارسی');
  await expect(decks.nth(4)).toContainText('Empty deck');

  // Recently studied: the studied decks lead their groups, and a tie between
  // two never-studied decks keeps the stored order.
  await chooseSort(page, 'Due', 'Recently studied');
  await expect(page.getByRole('button', { name: 'Sort: Recent' })).toBeVisible();
  await expect(decks.nth(1)).toContainText('Schritt Plus Neu');
  await expect(decks.nth(3)).toContainText('Empty deck');
  await expect(decks.nth(4)).toContainText('فارسی');

  // The layout editor works on the stored order; leaving it resumes the
  // chosen sort instead of silently overwriting the preference with manual.
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await expect(page.getByTestId('reorder-group-folders')).toBeVisible();
  await page.getByRole('button', { name: 'Done editing layout' }).click();
  await expect(page.getByRole('button', { name: 'Sort: Recent' })).toBeVisible();
  const afterEdit = await page.evaluate(
    () => JSON.parse(localStorage.getItem('memory:settings') ?? '{}') as { librarySort?: string }
  );
  expect(afterEdit.librarySort).toBe('recent');
});
