import { test, expect, type Page } from '@playwright/test';

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

test.use({ reducedMotion: 'reduce' });

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);
};

async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'New folder' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();

  await sheet.getByLabel('New folder').fill(name);
  await sheet.getByRole('button', { name: 'Create folder' }).click();
  await expect(sheet.getByText(name, { exact: true })).toBeVisible();

  await sheet.getByRole('button', { name: 'Close sheet' }).click();
  await expect(sheet).toBeHidden();
}

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
  await page.goto('/');
  await settle(page);
  await createFolder(page, FOLDER);

  // v3 shows a folder's decks inline: the header is an accordion control, so
  // its hint and state describe expansion rather than navigating to a page.
  // A new folder starts expanded, so the first press collapses it.
  const row = page.getByTestId('folder-group').filter({ hasText: FOLDER });
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleDescription('Collapse folder');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await row.click();

  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(row).toHaveAccessibleDescription('Expand folder');

  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('No decks directly inside yet.')).toBeVisible();
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
