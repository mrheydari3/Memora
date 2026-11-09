import { test, expect, type Page } from '@playwright/test';

/**
 * Smart Haptic Engine — repair-mode verification.
 *
 * The engine is deliberately locked while the tactile layer is under repair.
 * Playwright cannot feel a motor, so the Web Vibration API is recorded before
 * the app boots. In repair mode the recorder must stay empty: not one tab,
 * rating, quiz answer or menu may reach the platform.
 */

type Calls = Array<number | number[]>;

declare global {
  interface Window {
    __hapticsCalls?: Calls;
  }
}

async function installSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: Calls = [];
    window.__hapticsCalls = calls;
    try {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: (pattern: number | number[]) => {
          calls.push(pattern);
          return true;
        },
      });
    } catch {
      (navigator as unknown as { vibrate: (pattern: number | number[]) => boolean }).vibrate = (
        pattern
      ) => {
        calls.push(pattern);
        return true;
      };
    }
  });
}

const hapticCount = (page: Page) =>
  page.evaluate(() => window.__hapticsCalls?.length ?? 0);

async function settle(page: Page): Promise<void> {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);
}

test.use({ reducedMotion: 'reduce' });

test('Settings reports repair mode and locks the preference off', async ({ page }) => {
  await installSpy(page);
  await page.goto('/settings');
  await settle(page);

  await expect(page.getByText(/In repair/)).toBeVisible();

  const toggle = page.getByRole('switch', { name: 'Haptic feedback' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // The saved preference is preserved for when the engine is repaired; the
  // lock is service state, not a user choice.
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('memory:settings');
    return raw ? (JSON.parse(raw) as { hapticsEnabled?: boolean }).hapticsEnabled : undefined;
  });
  expect(saved).not.toBe(false);

  const lockedAt = await hapticCount(page);
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.waitForTimeout(350);
  expect(await hapticCount(page)).toBe(lockedAt);
});

test('study, quiz and menu interactions stay silent in repair mode', async ({ page }) => {
  await installSpy(page);

  await page.goto('/study/deck-german-a2b1');
  await settle(page);
  const reveal = page.getByRole('button', { name: 'Show answer' });
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="rating-3"]').click();
    await page.waitForTimeout(700);
  }

  await page.goto('/quiz/deck-german-a2b1');
  await settle(page);
  await page.waitForTimeout(800);
  await page.keyboard.press('1');
  await page.waitForTimeout(350);

  await page.goto('/deck/deck-german-a2b1');
  await settle(page);
  await page.getByRole('button', { name: 'More options', exact: true }).first().click();
  await page.waitForTimeout(300);

  expect(await hapticCount(page)).toBe(0);
});
