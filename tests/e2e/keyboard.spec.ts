import { test, expect } from '@playwright/test';

/**
 * Keyboard regression: Memora is a web app first, so a session must be usable
 * without a pointer. Space reveals the answer and 1–4 rate the card.
 */
test('study shortcuts reveal with Space and rate with 1–4', async ({ page }) => {
  await page.goto('/study/deck-german-a2b1');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);

  const showAnswer = page.getByRole('button', { name: 'Show answer' });
  await expect(showAnswer).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /Again/ })).toBeVisible();
  await expect(page.getByText('Press 1–4 to rate')).toBeVisible();

  await page.keyboard.press('3');
  await expect(showAnswer).toBeVisible();
});
