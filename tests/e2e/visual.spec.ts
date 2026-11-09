import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Visual regression suite.
 *
 * Baselines are generated once (`npx playwright test --update-snapshots`) and
 * committed, so a border that comes back, a card that changes proportion or a
 * pane that loses its fill shows up as an image diff. Animations are disabled by
 * the config, and the store seed is deterministic, so the frames are stable.
 */

/**
 * The Home hero prints the wall-clock date, so a live clock made the Home
 * baselines drift by one day and fail for no UI reason. Start every page at
 * noon UTC, Sat 7 Nov 2026, so the calendar day is identical on every runner,
 * but let the clock keep ticking: the splash measures its paint grace with
 * `Date.now()` deltas, and a frozen clock would hold its skeleton over the
 * page forever.
 */
const FIXED_NOW = new Date('2026-11-07T12:00:00Z');

/**
 * The desktop Home baseline uses the six-deck fixture, so it shows the board's
 * real shapes: folders, an empty deck, an archived deck, RTL and overdue cards.
 * The phone baseline keeps the shipped deck; mobile layout is unchanged.
 */
const HOME_FIXTURE = buildFixture('F3', FIXED_NOW.getTime());

async function seedHome(page: Page) {
  await page.addInitScript({ content: fixtureInitScript(HOME_FIXTURE) });
}

test.use({ timezoneId: 'UTC' });

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(FIXED_NOW);
  // A manual /dev session can leave the six-deck fixture in this origin's
  // storage. Every case starts from the shipped seed unless it opts in; the
  // desktop Home fixture is installed after this reset by `seedHome`.
  await page.addInitScript(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('memory:')) localStorage.removeItem(key);
    }
  });
});

/**
 * `role="main"` exists while the launch skeleton is still on screen, so it is
 * not proof the route has painted. On a cold dev-server compile the 900ms
 * settle could run out before the stores hydrate and the baseline captured the
 * skeleton. Home waits for the today pane; the 900ms settle still lets its
 * reveal finish.
 */
async function waitForRoute(page: Page, label: string) {
  await page.waitForSelector('[role="main"]');
  if (label === 'home') {
    await page.waitForSelector('[data-testid="today-panel"]');
  }
  // The splash covers the route while it hands off, including its own skeleton.
  // Waiting for it to unmount keeps that layer out of every baseline.
  await page
    .getByRole('progressbar', { name: 'Loading Memora' })
    .waitFor({ state: 'detached' });
  await page.waitForTimeout(900);
}

const ROUTES = [
  { label: 'home', path: '/' },
  { label: 'library', path: '/library' },
  { label: 'deck', path: '/deck/deck-german-a2b1' },
  { label: 'settings', path: '/settings' },
];

test.describe('visual', () => {
  for (const route of ROUTES) {
    test(`${route.label} at 390px`, async ({ page }) => {
      await page.goto(route.path);
      await waitForRoute(page, route.label);
      await expect(page).toHaveScreenshot(`${route.label}-390.png`, { fullPage: false });
    });
  }

  test('wide layout at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedHome(page);
    await page.goto('/');
    await waitForRoute(page, 'home');
    // Prove the six-deck board, not the shipped single deck, is on screen.
    await expect(page.getByText('Empty deck', { exact: true }).first()).toBeVisible();
    await expect(page).toHaveScreenshot('home-1280.png', { fullPage: false });
  });
});

/**
 * The surfaces the design pass changed. These are rendered through the real
 * navigation (the sheet is opened from Home, not by loading its route) so the
 * scrim is proven against live content rather than an empty canvas.
 */
const SURFACES = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
];

test.describe('changed surfaces', () => {
  for (const { width, height } of SURFACES) {
    test(`new deck sheet at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForSelector('[role="main"]');
      await page.waitForTimeout(700);

      await page.getByRole('button', { name: 'Add deck' }).click();
      await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible();
      await page.waitForTimeout(1200);

      // Capture the sheet itself. Playwright's first frame of a transparent
      // route misses the previous screen's composited layer, so a full-page
      // snapshot would show the scrim over black; the scrim's live behaviour
      // (Home behind it, focus trapped, click closes) is asserted below.
      const sheet = page.getByRole('dialog', { name: 'New deck' });
      const box = await sheet.boundingBox();
      expect(box).not.toBeNull();
      await expect(page).toHaveScreenshot(`add-deck-${width}.png`, {
        animations: 'allow',
        clip: { x: box!.x, y: box!.y, width: box!.width, height: box!.height },
      });
    });

    test(`answered study card at ${width}px`, async ({ page }) => {
      // The seeded deck shuffles by default; pin the RNG so the captured card
      // is the same on every run.
      await page.addInitScript(() => {
        Math.random = () => 0.42;
      });
      await page.setViewportSize({ width, height });
      await page.goto('/study/deck-german-a2b1');
      await page.waitForSelector('[role="main"]', { timeout: 30_000 });

      await page.getByRole('button', { name: 'Show answer' }).click();
      await expect(page.getByRole('button', { name: /Again/ })).toBeVisible();
      await page.waitForTimeout(700);

      await expect(page).toHaveScreenshot(`study-answer-${width}.png`);
    });

    test(`statistics empty state at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/statistics');
      await page.waitForSelector('[role="main"]');
      await page.waitForTimeout(700);

      await expect(page.getByText(/No reviews in the last 30 days\./)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible();
      await expect(page).toHaveScreenshot(`statistics-${width}.png`);
    });
  }
});

test('the sheet scrim dims the canvas and keeps focus inside', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Add deck' }).click();
  await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible();

  // The page behind stays mounted under the scrim …
  await expect(page.getByText('Memora', { exact: true }).first()).toBeVisible();

  // … but it is not in the keyboard path: focus enters the sheet and wraps.
  const close = page.getByRole('button', { name: 'Close sheet' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  // A click above the sheet must hit the scrim and close, not activate the
  // Home control underneath it. Focus then returns to the trigger.
  await page.mouse.click(12, 12);
  await expect(page).not.toHaveURL(/add-deck/);
  await expect(page.getByRole('button', { name: 'Add deck' })).toBeFocused();
});
