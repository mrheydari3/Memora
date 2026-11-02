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
