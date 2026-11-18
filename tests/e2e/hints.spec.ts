import { test, expect, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Hint regression suite.
 *
 * Each test reads the hint a screen reader receives, activates the control, and
 * asserts the promised result: a destination, a folder view, or an expanded
 * card. This keeps the hint text tied to behaviour instead of allowing a copy
 * change to drift away from the control.
 *
 * CardStack and DeckLibrary also carry hints, but neither component is mounted
 * by a route, so there is no activation path to exercise in the app.
 */

const DECK = 'Schritt Plus Neu A2/B1';
const FOLDER = 'Travel';
const HOME_FIXTURE = buildFixture('F3', new Date('2026-11-07T12:00:00Z').getTime());

test.use({ reducedMotion: 'reduce' });

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);
};

test('a deck row hint opens that deck', async ({ page }) => {
  await page.goto('/');
  await settle(page);

  const row = page.getByTestId('deck-row').filter({ hasText: DECK }).first();
  await expect(row).toHaveAccessibleDescription('Open deck');
  await row.click();

  await expect(page).toHaveURL(/\/deck\/deck-german-a2b1$/);
  await expect(page.getByRole('heading', { name: DECK })).toBeVisible();
});

test('a folder group hint expands and collapses that folder', async ({ page }) => {
  // A folder with decks is the only expandable group, so use the fixture's
  // Travel folder (one deck) rather than creating an empty one.
  await page.addInitScript({ content: fixtureInitScript(HOME_FIXTURE) });
  await page.goto('/');
  await settle(page);

  // v3 shows a folder's decks inline: the header is an accordion control, so
  // its hint and state describe expansion rather than navigating to a page.
  // Travel starts expanded, so the first press collapses it.
  const row = page.getByTestId('folder-group').filter({ hasText: FOLDER });
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleDescription('Collapse folder');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await row.click();

  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(row).toHaveAccessibleDescription('Expand folder');
  await expect(
    page.getByTestId('deck-row').filter({ hasText: 'Due today (review)' })
  ).toHaveCount(0);

  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByTestId('deck-row').filter({ hasText: 'Due today (review)' })
  ).toBeVisible();
});

test('a card row hint expands and collapses the full card', async ({ page }) => {
  await page.goto('/deck/deck-german-a2b1');
  await settle(page);

  const row = page.getByTestId('deck-card-row').first();
  await expect(row).toHaveAccessibleDescription('Show the full card');
  await expect(row).toHaveAttribute('aria-expanded', 'false');

  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(row).toHaveAccessibleDescription('Hide the full card');

  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(row).toHaveAccessibleDescription('Show the full card');
});
