import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Search and filtering on the library shelf.
 *
 * The fixture is the same six-deck shelf the library suite uses, so the names,
 * folders and due counts are stable. These cases cover the three promises the
 * toolbar makes: it finds things across the whole library (not only the open
 * level), it names where a deck lives, and clearing it puts the shelf back.
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
  await page.addInitScript(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('memory:')) localStorage.removeItem(key);
    }
  });
  await page.addInitScript({ content: fixtureInitScript(HOME_FIXTURE) });
});

test('search finds a deck across folders and prints its folder', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);

  const search = page.getByLabel('Search your library');
  await expect(search).toBeVisible();
  await search.fill('Schritt');

  await expect(page.getByTestId('library-results-count')).toContainText('1 deck');
  const row = page.getByTestId('deck-row').filter({ hasText: 'Schritt Plus Neu' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('German');
  // The matching folder's own card is filtered out; only the deck's path names it.
  await expect(page.getByTestId('folder-card')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);
  await expect(page.getByTestId('folder-card').filter({ hasText: 'Travel' })).toBeVisible();
  await expect(page.getByTestId('deck-row').filter({ hasText: 'Schritt Plus Neu' })).toHaveCount(0);
});

test('a folder name is searchable and opens from the result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByLabel('Search your library').fill('Travel');
  const folder = page.getByTestId('folder-card').filter({ hasText: 'Travel' });
  await expect(folder).toBeVisible();
  await folder.click();
  await expect(page).toHaveURL(/\/home$/);
  // Opening a result clears the search and lands on that folder's level.
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All decks' })).toBeVisible();
  await expect(page.getByText('Decks here', { exact: true })).toBeVisible();
});

test('an empty result explains itself and clears', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByLabel('Search your library').fill('zzzz no match');
  const empty = page.getByTestId('library-no-results');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Nothing matches');
  await expect(page.getByTestId('deck-row')).toHaveCount(0);

  // The empty state itself offers the action: no dead-end instructions.
  const clear = empty.getByRole('button', { name: 'Clear search' });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page.getByTestId('library-no-results')).toHaveCount(0);
  await expect(page.getByTestId('folder-group').first()).toBeVisible();
});

test('the field clear control is hittable at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByLabel('Search your library').fill('Travel');
  // Results, not the empty state: the field's own control is the only one.
  const clear = page.getByRole('button', { name: 'Clear search' });
  await expect(clear).toHaveCount(1);
  await clear.click();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);
  // One column at 390px: folders render as grouped rows, not grid cards.
  await expect(page.getByTestId('folder-group').filter({ hasText: 'Travel' })).toBeVisible();
});

test('the toolbar wraps its controls instead of clipping the search field at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHome(page);

  const search = page.getByLabel('Search your library');
  // Measure the field itself; the input sits inside its own padding and icon.
  const fieldWidth = await search.evaluate(
    (element) => element.parentElement?.getBoundingClientRect().width ?? 0
  );
  expect(fieldWidth).toBeGreaterThanOrEqual(240);

  // The All/Due/sort group leaves the row rather than squeezing the field: on
  // a 320px canvas it wraps beneath it, still trailing its own line.
  const input = await search.boundingBox();
  const sort = await page.getByRole('button', { name: /^Sort: / }).boundingBox();
  expect(input).not.toBeNull();
  expect(sort).not.toBeNull();
  expect(sort!.y).toBeGreaterThanOrEqual(input!.y + input!.height - 1);
});

test('mouse focus drops the search ring and keyboard focus restores it', async ({ page }) => {
  for (const { width, height } of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 780, height: 1024 },
  ]) {
    await page.setViewportSize({ width, height });
    await openHome(page);

    const search = page.getByLabel('Search your library');
    await search.click();
    await expect(search).toBeFocused();
    // A pointer user already has the caret; the ring reads as a selection box.
    await expect
      .poll(() => search.evaluate((element) => getComputedStyle(element).outlineStyle))
      .toBe('none');

    const box = await search.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBe(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);

    // Leave and come back with Tab: the ring belongs to the keyboard.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(search).toBeFocused();
    await expect
      .poll(() => search.evaluate((element) => getComputedStyle(element).outlineStyle))
      .toBe('solid');
  }
});

test('a click elsewhere leaves the ring for a programmatic focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const search = page.getByLabel('Search your library');
  // A pointer-down outside the field must not mark the next focus as pointer-
  // acquired; a later focus without a click keeps the keyboard ring.
  await page.getByRole('button', { name: 'Show all' }).click();
  await search.focus();
  await expect(search).toBeFocused();
  await expect
    .poll(() => search.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe('solid');
});

test('Edit layout leaves search and shows the reorder surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByLabel('Search your library').fill('zzzz no match');
  await expect(page.getByTestId('library-no-results')).toBeVisible();

  await page.getByRole('button', { name: 'Edit layout' }).click();

  // The previously dead state: the layout editor takes over instead of leaving
  // an unchanged empty result under a "Done" button.
  await expect(page.getByTestId('reorder-group-folders')).toBeVisible();
  await expect(page.getByTestId('library-no-results')).toHaveCount(0);
  await expect(page.getByLabel('Search your library')).toHaveCount(0);

  await page.getByRole('button', { name: 'Done editing layout' }).click();
  await expect(page.getByLabel('Search your library')).toBeVisible();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);

  // The Due filter is the other route into the same dead state.
  await page.getByRole('button', { name: 'Due only' }).click();
  await expect(page.getByTestId('library-results-count')).toBeVisible();
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await expect(page.getByTestId('reorder-group-folders')).toBeVisible();
  await page.getByRole('button', { name: 'Done editing layout' }).click();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);
});

test('the Due filter keeps only decks with cards waiting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByRole('button', { name: 'Due only' }).click();
  await expect(page.getByTestId('library-results-count')).toBeVisible();
  const rows = page.getByTestId('deck-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(rows.nth(index)).toContainText('due');
  }

  // The empty deck is caught up, so it cannot be one of the rows above.
  await expect(page.getByTestId('deck-row').filter({ hasText: 'Empty deck' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);
  await expect(page.getByText('Unfiled decks', { exact: true })).toBeVisible();
});
