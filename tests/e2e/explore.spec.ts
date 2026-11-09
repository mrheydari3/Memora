import { test, expect, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '../../data/storageKeys';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Explore reads the dev library. It must stay a lens over the shelf: the row
 * appears only when there is a deck worth surfacing, the sheet groups picks by
 * the work they ask for, and opening a pick leaves every due date untouched.
 */

const FIXED_NOW = new Date('2026-11-07T12:00:00Z');
const FIXTURE = buildFixture('F3', FIXED_NOW.getTime());

/** F3 with only the deck the Today pane already offers: Explore has no pick. */
function singleHeroFixture() {
  const entries = { ...FIXTURE.entries };
  const decks = JSON.parse(entries[STORAGE_KEYS.decks] ?? '[]') as { id: string }[];
  const cards = JSON.parse(entries[STORAGE_KEYS.allCards] ?? '{}') as Record<string, unknown>;
  entries[STORAGE_KEYS.decks] = JSON.stringify(decks.filter((deck) => deck.id === 'deck-due'));
  entries[STORAGE_KEYS.allCards] = JSON.stringify({ 'deck-due': cards['deck-due'] });
  return { ...FIXTURE, entries };
}

const SINGLE_HERO = singleHeroFixture();

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

async function settle(page: Page) {
  await page.waitForSelector('[data-testid="today-panel"]', { timeout: 45_000 });
  await page
    .getByRole('progressbar', { name: 'Loading Memora' })
    .waitFor({ state: 'detached' });
  await page.waitForTimeout(700);
}

async function seed(page: Page, spec = FIXTURE) {
  await page.clock.setSystemTime(FIXED_NOW);
  await page.addInitScript({ content: fixtureInitScript(spec) });
  await page.goto('/');
  await settle(page);
}

async function openSheet(page: Page) {
  const entry = page.getByTestId('explore-entry');
  await entry.click();
  const sheet = page.getByRole('dialog').filter({ hasText: 'Picked from your library.' });
  await expect(sheet).toBeVisible();
  return { entry, sheet };
}

test('the row summarizes the picks and the sheet groups them by action', async ({ page }) => {
  await seed(page);

  const entry = page.getByTestId('explore-entry');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('Explore your decks');
  await expect(entry).toContainText('2 picks · Backlog · 6 overdue · 6 due today');

  const { sheet } = await openSheet(page);
  await expect(sheet.getByText('Picked from your library. Nothing is rescheduled.')).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Now' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Keep going' })).toHaveCount(0);
  await expect(sheet.getByRole('heading', { name: 'Fresh start' })).toBeVisible();

  const rows = sheet.getByTestId('explore-pick');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Backlog');
  await expect(rows.first()).toContainText('Due today (review)');
  await expect(rows.first()).toContainText('6 overdue · 6 due today');
  await expect(rows.first()).toContainText('6 due');
  await expect(rows.first()).toHaveAccessibleName(
    'Backlog: Due today (review). 6 overdue · 6 due today. 6 due.'
  );
  await expect(rows.nth(1)).toContainText('Fresh start');
  await expect(rows.nth(1)).toContainText('4 new cards · not started');
  await expect(
    sheet.getByText('Ranked from your own reviews. Due dates are unchanged.')
  ).toBeVisible();

  await rows.first().click();
  await expect(page).toHaveURL(/\/deck\/deck-due$/);
  await expect(page.getByRole('heading', { name: 'Due today (review)' })).toBeVisible();
});

test('Escape closes the sheet and returns focus to the row', async ({ page }) => {
  await seed(page);
  const { entry, sheet } = await openSheet(page);

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(entry).toBeFocused();
});

test('inside a folder the sheet names the scope and drops every other deck', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);

  const travel = page.getByTestId('folder-card').filter({ hasText: 'Travel' });
  await expect(travel).toBeVisible();
  await travel.click();

  const entry = page.getByTestId('explore-entry');
  await expect(entry).toContainText('1 pick · Backlog · 6 overdue · 6 due today');
  const { sheet } = await openSheet(page);

  await expect(sheet.getByText('Inside Travel')).toBeVisible();
  await expect(sheet.getByTestId('explore-pick')).toHaveCount(1);
  await expect(sheet.getByTestId('explore-pick')).toContainText('Due today (review)');
  await expect(sheet.getByRole('heading', { name: 'Fresh start' })).toHaveCount(0);
});

test('the row is hidden while editing the layout and returns when done', async ({ page }) => {
  await seed(page);
  await expect(page.getByTestId('explore-entry')).toBeVisible();

  await page.getByRole('button', { name: 'Edit layout' }).click();
  await expect(page.getByTestId('explore-entry')).toHaveCount(0);

  await page.getByRole('button', { name: 'Done editing layout' }).click();
  await expect(page.getByTestId('explore-entry')).toBeVisible();
});

test('320px keeps the entry and sheet inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(page);

  await expect(page.getByTestId('explore-entry')).toBeVisible();
  const { sheet } = await openSheet(page);
  await expect(sheet.getByTestId('explore-pick')).toHaveCount(2);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});

test('a library whose only deck is the hero has nothing to explore', async ({ page }) => {
  await seed(page, SINGLE_HERO);

  await expect(page.getByTestId('today-panel')).toContainText('Due today (review)');
  await expect(page.getByTestId('explore-entry')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('explore screenshots at 320, 390 and 1280', async ({ page }) => {
  for (const { width, height } of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width, height });
    await seed(page);

    const entry = page.getByTestId('explore-entry');
    if (width < 1024) await entry.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `docs/refinements/explore-row-${width}.png`,
      animations: 'disabled',
    });

    const { sheet } = await openSheet(page);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `docs/refinements/explore-sheet-${width}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  }
});
