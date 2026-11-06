import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Populated Statistics visual regression.
 *
 * The shipped seed has no review history, so these frames use the deterministic
 * developer fixture instead. A fixed clock plus UTC pins the report window, day
 * labels and forecast until the screenshots are taken. Fake timers are advanced
 * explicitly so the real reveal/bar animations finish before each capture.
 *
 * The page scrolls inside a React Native ScrollView, which does not paint
 * off-screen children for a stitched full-page capture. The suite therefore
 * scrolls to each section and captures the viewport.
 */

const FIXED_NOW = new Date('2026-11-06T12:00:00Z');

const SIZES = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

const SECTIONS = [
  { name: 'top', anchor: null },
  { name: 'memory', anchor: 'Memory' },
  { name: 'habits', anchor: 'Study habits' },
  { name: 'forecast', anchor: 'Next 7 days' },
  { name: 'insights', anchor: 'What stands out' },
  { name: 'reports', anchor: 'Reports' },
];

test.use({
  locale: 'en-US',
  timezoneId: 'UTC',
  reducedMotion: 'reduce',
});

async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('div')].filter((element) => {
      const style = getComputedStyle(element);
      return (
        element.scrollHeight > element.clientHeight + 100 &&
        /(auto|scroll)/.test(style.overflowY)
      );
    });
    scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight);
    if (scrollers[0]) scrollers[0].scrollTop = 0;
  });
  await page.clock.runFor(150);
}

async function seedStatistics(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: FIXED_NOW });

  await page.goto('/dev');
  await page.getByText('Load test library', { exact: true }).waitFor();

  // Let the launch reveal finish before interacting with the dev controls.
  await page.clock.runFor(1_500);
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);

  await page.getByText('Load test library', { exact: true }).click();
  await page.clock.runFor(900);
  await expect(page.getByText('Test library loaded', { exact: false })).toBeVisible();

  await page.goto('/statistics');
  await expect(
    page.getByText('Last 30 days · intelligence', { exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Complete the statistics reveal animations and the chart growth.
  await page.clock.runFor(2_500);
  await scrollToTop(page);
}

test.describe('statistics populated', () => {
  for (const { width, height } of SIZES) {
    test(`dashboard at ${width}px`, async ({ page }) => {
      await seedStatistics(page, width, height);

      for (const section of SECTIONS) {
        if (section.anchor) {
          await page.getByText(section.anchor, { exact: true }).first().scrollIntoViewIfNeeded();
          await page.clock.runFor(700);
        }

        await expect(page).toHaveScreenshot(
          `statistics-${width}-${section.name}.png`,
          { fullPage: false }
        );
      }
    });
  }
});
