import { test, expect, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';
import { STORAGE_KEYS as K } from '../../data/storageKeys';
import type { ReviewLogEntry, StreakSkip } from '../../data/types';

/**
 * The streak screen is time-sensitive, so every run pins the browser clock and
 * writes its own review log. 2026-11-19 is a Thursday in ISO week 47.
 */
const NOW = new Date(2026, 10, 19, 12, 0, 0, 0).getTime();
const MONDAY = new Date(2026, 10, 23, 12, 0, 0, 0).getTime();
const DECK_ID = 'deck-german-a2b1';

const reviewAt = (dayOffset: number, hour = 9): number =>
  new Date(2026, 10, 19 + dayOffset, hour, 0, 0, 0).getTime();

function entry(dayOffset: number, cardId: string): ReviewLogEntry {
  return {
    cardId,
    deckId: DECK_ID,
    rating: 3,
    reviewedAt: reviewAt(dayOffset),
    elapsedMs: 5_000,
    cardWasNew: false,
  };
}

async function boot(
  page: Page,
  reviewLog: ReviewLogEntry[],
  skips: StreakSkip[] = [],
  now = NOW
) {
  const spec = buildFixture('F3', now);
  spec.entries[K.reviewLog] = JSON.stringify(reviewLog);
  spec.entries[K.streakSkips] = JSON.stringify(skips);
  // A fixed Date also freezes React Native's animation clock. Install a clock
  // at the fixture instant and let it run, so the date is stable while the
  // sheet entrance still finishes.
  await page.clock.install({ time: now });
  await page.clock.resume();
  await page.addInitScript({
    content: `if (sessionStorage.getItem('streak-seeded') !== '1') {
  sessionStorage.setItem('streak-seeded', '1');
  ${fixtureInitScript(spec)}
}`,
  });
  await page.goto('/home');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await expect(page.getByTestId('home-streak-control')).toBeVisible({ timeout: 20_000 });
}

async function readSkips(page: Page): Promise<StreakSkip[]> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), K.streakSkips);
  return raw ? (JSON.parse(raw) as StreakSkip[]) : [];
}

test.describe('streak calendar and weekly rest day', () => {
  test('home opens the calendar and a confirmed rest day survives a reload', async ({ page }) => {
    await boot(page, [
      entry(-3, 'mon'),
      entry(-2, 'tue'),
      entry(-1, 'wed'),
    ]);

    const control = page.getByTestId('home-streak-control');
    await expect(control).toHaveAccessibleName(/3-day streak/);
    await control.click();
    await expect(page).toHaveURL(/\/streak$/);
    await expect(page.getByRole('heading', { name: 'Your Streak' })).toBeVisible();
    await expect(page.getByTestId('streak-summary')).toContainText('3');
    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('1 of 1 available');

    // Cancelling is not consuming: the allowance must still be there.
    await page.getByRole('button', { name: 'Use Rest Day' }).click();
    const dialog = page.getByRole('dialog', { name: 'Use a rest day?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep it available' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await readSkips(page)).toEqual([]);

    await page.getByRole('button', { name: 'Use Rest Day' }).click();
    await page
      .getByRole('dialog', { name: 'Use a rest day?' })
      .getByRole('button', { name: 'Use rest day' })
      .click();

    await expect(page.getByTestId('weekly-rest-day')).toContainText('Rest day used this week');
    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('0 of 1 available');
    await expect(page.getByTestId('streak-notice')).toContainText('Rest day saved');

    const skips = await readSkips(page);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ date: '2026-11-19', weekKey: '2026-W47' });
    expect(skips[0].createdAt).toBeGreaterThanOrEqual(NOW);

    await page.reload();
    await expect(page.getByTestId('weekly-rest-day')).toContainText('Rest day used this week');
    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('0 of 1 available');
    await expect(page.getByTestId('streak-day-2026-11-19')).toHaveAccessibleName(
      /Protected rest day/
    );

    await page.goto('/home');
    await expect(page.getByTestId('home-streak-control')).toHaveAccessibleName(/3-day streak/);
    await page.goto('/profile');
    await expect(page.getByText('3-day streak')).toBeVisible();
  });

  test('protecting yesterday bridges the missed day without inflating the count', async ({
    page,
  }) => {
    await boot(page, [entry(-3, 'mon'), entry(-2, 'tue')]);
    await page.goto('/streak');

    // Wednesday (yesterday) is the missed date. Select it explicitly so this
    // test also covers choosing a candidate other than the default.
    await page.getByTestId('streak-day-2026-11-18').click();
    await page.getByRole('button', { name: 'Use Rest Day' }).click();
    await page
      .getByRole('dialog', { name: 'Use a rest day?' })
      .getByRole('button', { name: 'Use rest day' })
      .click();

    await expect(page.getByTestId('streak-summary')).toContainText('2');
    await expect(page.getByTestId('streak-day-2026-11-18')).toHaveAccessibleName(
      /Protected rest day/
    );
    const skips = await readSkips(page);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ date: '2026-11-18', weekKey: '2026-W47' });
    expect(skips[0].createdAt).toBeGreaterThanOrEqual(NOW);

    // The previous missed day is protected, but the summary remains the two
    // real study days; the skip itself never increments it.
    await expect(page.getByTestId('streak-summary')).not.toContainText('3');
  });

  test('browsing a protected history day keeps this week available and arms no action', async ({
    page,
  }) => {
    await boot(
      page,
      [entry(-3, 'mon'), entry(-2, 'tue'), entry(-1, 'wed')],
      [
        {
          date: '2026-11-12',
          weekKey: '2026-W46',
          createdAt: NOW - 7 * 86_400_000,
        },
      ]
    );
    await page.goto('/streak');

    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('1 of 1 available');
    await page.getByTestId('streak-day-2026-11-12').click();

    // The selected day is last week's protected day. The panel still describes
    // the current week, and the old day must not arm an action for today.
    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('1 of 1 available');
    await expect(page.getByTestId('weekly-rest-day')).not.toContainText('Rest day used');
    await expect(page.getByTestId('weekly-rest-day')).toContainText('This date is not eligible');
    await expect(page.getByRole('button', { name: 'Use Rest Day' })).toHaveCount(0);
  });

  test('a Monday yesterday action uses its own allowance and leaves this week untouched', async ({
    page,
  }) => {
    await boot(page, [], [], MONDAY);
    await page.goto('/streak');

    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('1 of 1 available');
    await page.getByTestId('streak-day-2026-11-22').click();
    await expect(page.getByTestId('weekly-rest-day')).toContainText(
      'Available for yesterday, Sunday, November 22'
    );
    await expect(page.getByTestId('weekly-rest-day')).toContainText(
      'This uses last week’s allowance. This week’s allowance is still available.'
    );

    await page.getByRole('button', { name: 'Use Rest Day' }).click();
    const dialog = page.getByRole('dialog', { name: 'Use a rest day?' });
    await expect(dialog).toContainText('allowance for that week');
    await dialog.getByRole('button', { name: 'Use rest day' }).click();

    // Sunday belongs to ISO week 47; Monday opened week 48. Only the selected
    // week's allowance is spent, so the current week must remain available.
    await expect(page.getByTestId('weekly-rest-day-count')).toHaveText('1 of 1 available');
    await expect(page.getByTestId('streak-notice')).toContainText(
      'Rest day saved for Sunday, November 22'
    );
    const skips = await readSkips(page);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ date: '2026-11-22', weekKey: '2026-W47' });
    expect(skips[0].createdAt).toBeGreaterThanOrEqual(MONDAY);
  });

  test('the calendar fits a 320px viewport with 44px date targets', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await boot(page, [entry(-1, 'wed')]);

    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(homeOverflow).toBeLessThanOrEqual(0);

    await page.goto('/streak');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const target = page.getByTestId('streak-day-2026-11-18');
    const box = await target.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('weekly-rest-day')).toBeVisible();

    // 200% browser text: the screen must grow vertically, not sideways.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.waitForTimeout(100);
    const zoomedOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(zoomedOverflow).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('weekly-rest-day')).toBeVisible();

    // A direct load has no history stack; Back must still land on Home.
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
