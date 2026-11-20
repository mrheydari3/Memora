import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';
import { STORAGE_KEYS } from '../../data/storageKeys';

/**
 * Folder-level review.
 *
 * The F3 folder German holds two due decks: Schritt Plus Neu (26 in its own
 * session) and the long-name deck (4). A folder session must show 30, split
 * every rating back to the card's own deck, and leave the deck route's 26
 * untouched. Travel proves the single-deck folder still offers the same entry.
 */
const FIXED_NOW = new Date('2026-11-07T12:00:00Z');
const HOME_FIXTURE = buildFixture('F3', FIXED_NOW.getTime());

async function openHome(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="today-panel"]');
  await page.getByRole('progressbar', { name: 'Loading Memora' }).waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
}

async function openSession(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('[role="main"]');
  await page.getByRole('progressbar', { name: 'Loading Memora' }).waitFor({ state: 'detached' });
  await expect(page.getByText('1 /', { exact: false })).toBeVisible();
}

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

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

test('the phone folder entry builds one queue across both due decks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Baseline: the deck route keeps its own 26-card queue.
  await openSession(page, '/study/deck-german-a2b1');
  await expect(page.getByText('1 / 26')).toBeVisible();

  await openHome(page);
  const german = page.getByTestId('folder-group').filter({ hasText: 'German' });
  await expect(german).toContainText('30 due');
  const entry = page.getByRole('button', { name: /^Review folder German,/ });
  await expect(entry).toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(/\/study\/folder\/fold-de$/);
  await expect(page.getByRole('heading', { name: 'German' })).toBeVisible();
  // 26 cards from Schritt Plus Neu + 4 from the long-name deck.
  await expect(page.getByText('1 / 30')).toBeVisible();

  // A review is written to the card's own deck, not to a synthetic folder id.
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByTestId('rating-3').click();
  await expect(page.getByText('2 / 30')).toBeVisible();

  const latest = await page.evaluate((key) => {
    const entries = JSON.parse(localStorage.getItem(key) ?? '[]') as { deckId?: string }[];
    return entries.at(-1) ?? null;
  }, STORAGE_KEYS.reviewLog);
  expect(['deck-german-a2b1', 'deck-longname']).toContain(latest?.deckId);
});

test('completing a folder session closes on the folder and returns home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.getByRole('button', { name: /^Review folder Travel,/ }).click();
  await expect(page).toHaveURL(/\/study\/folder\/fold-travel$/);
  await expect(page.getByText('1 / 6')).toBeVisible();

  // Travel has one six-card deck. Good keeps each Review card settled, so the
  // session ends after exactly six ratings.
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByTestId('rating-3').click();
    if (i < 5) await expect(page.getByText(`${i + 2} / 6`)).toBeVisible();
  }

  const summary = page.getByTestId('session-summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Travel', { exact: true })).toBeVisible();
  await expect(summary.getByRole('button', { name: 'Back to folder' })).toBeVisible();
  // A folder has no single deck of its own to add cards to.
  await expect(summary.getByRole('button', { name: 'Add cards' })).toHaveCount(0);

  await summary.getByRole('button', { name: 'Back to folder' }).click();
  await expect(page.getByTestId('today-panel')).toBeVisible();
});

test('the tablet folder view carries the review entry and tile cue', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);

  const german = page.getByTestId('folder-card').filter({ hasText: 'German' });
  await expect(german).toContainText('30 due');
  await expect(german).toContainText('Review folder');

  await german.click();
  await expect(page.getByRole('button', { name: 'All decks' })).toBeVisible();
  const review = page.getByTestId('review-folder');
  await expect(review).toBeVisible();
  await review.click();

  await expect(page).toHaveURL(/\/study\/folder\/fold-de$/);
  await expect(page.getByText('1 / 30')).toBeVisible();
});
