import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Quiz result dialog regression.
 *
 * The result is a modal, not a card: focus starts on the dialog itself, Tab
 * cycles only through the result actions, and the quiz shell behind it is
 * inert. Closing the result must release that inert state and return focus to
 * the quiz control that was focused when the round ended. The fake clock
 * fast-forwards the 60-second round instead of waiting for it.
 */
const FIXED_NOW = new Date('2026-11-06T12:00:00Z');

test.use({ reducedMotion: 'reduce' });

async function openResult(page: Page) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto('/quiz/deck-german-a2b1');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.clock.runFor(1_500);

  await expect(page.getByText('Press 1–4 to answer')).toBeVisible();

  // A quiz control owns focus when the result opens. The result has to
  // remember it despite the shell turning inert, then restore it on close.
  const opener = page.getByRole('button', { name: 'Close quiz' });
  await opener.focus();
  await expect(opener).toBeFocused();

  await page.clock.runFor(61_000);

  const dialog = page.getByRole('dialog', { name: /^Round result:/ });
  await expect(dialog).toBeVisible();
  return { dialog, opener };
}

test('quiz result traps focus, restores its opener, and cleans up its inert shell', async ({ page }) => {
  const { dialog, opener } = await openResult(page);

  // Focus starts on the dialog, so its label is announced before the actions.
  await expect(dialog).toBeFocused();

  // The screen behind the dialog is inert and hidden from the accessibility
  // tree, but the dialog itself must remain outside that shell.
  const shell = page.locator('[inert]');
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveAttribute('aria-hidden', 'true');
  await expect(shell.locator('[aria-label="Close quiz"]')).toHaveCount(1);

  const dialogInsideShell = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    const background = document.querySelector('[inert]');
    return Boolean(modal && background && background.contains(modal));
  });
  expect(dialogInsideShell).toBe(false);

  const playAgain = page.getByRole('button', { name: 'Play again' });
  const backToGame = page.getByRole('button', { name: 'Back to Game' });

  await page.keyboard.press('Tab');
  await expect(playAgain).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(backToGame).toBeFocused();

  // Forward Tab wraps from the last action back to the first.
  await page.keyboard.press('Tab');
  await expect(playAgain).toBeFocused();

  // Shift+Tab wraps from the first action back to the last.
  await page.keyboard.press('Shift+Tab');
  await expect(backToGame).toBeFocused();

  // Return to Play again and close the dialog with the keyboard.
  await page.keyboard.press('Tab');
  await expect(playAgain).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  await expect(page.getByText('Press 1–4 to answer')).toBeVisible();
  await expect(opener).toBeFocused();
});
