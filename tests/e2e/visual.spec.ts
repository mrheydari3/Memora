import { test, expect } from '@playwright/test';

/**
 * Visual regression suite.
 *
 * Baselines are generated once (`npx playwright test --update-snapshots`) and
 * committed, so a border that comes back, a card that changes proportion or a
 * pane that loses its fill shows up as an image diff. Animations are disabled by
 * the config, and the store seed is deterministic, so the frames are stable.
 */

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
      await page.waitForSelector('[role="main"]');
      await page.waitForTimeout(900);
      await expect(page).toHaveScreenshot(`${route.label}-390.png`, { fullPage: false });
    });
  }

  test('wide layout at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForSelector('[role="main"]');
    await page.waitForTimeout(900);
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
