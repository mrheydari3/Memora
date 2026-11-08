import { test, expect } from '@playwright/test';

/**
 * Keyboard regression: Memora is a web app first, so a session must be usable
 * without a pointer. Space reveals the answer and 1–4 rate the card.
 */
test('add-deck sheet traps focus and Escape returns to its opener', async ({ page }) => {
  await page.goto('/home');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Add deck' }).click();
  await expect(page.getByRole('heading', { name: 'New deck' })).toBeVisible();

  const close = page.getByRole('button', { name: 'Close sheet' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: 'Add deck' })).toBeFocused();
});

test('four-tab bar follows the ARIA tab keyboard pattern', async ({ page }) => {
  await page.goto('/home');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  for (const [index, name] of ['Home', 'Game', 'Profile', 'Settings'].entries()) {
    await expect(tabs.nth(index)).toHaveAccessibleName(name);
  }

  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('tab', { name: 'Game' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Game' })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  await page.keyboard.press('End');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();

  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('tab', { name: 'Home' })).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
});

test('Profile Statistics CTA and Back work from the keyboard', async ({ page }) => {
  await page.goto('/profile');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);

  const cta = page.getByTestId('profile-statistics-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAccessibleName('View detailed statistics');
  await cta.focus();
  await expect(cta).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/statistics$/);
  await expect(page.getByRole('button', { name: 'Share statistics' })).toBeVisible();

  const back = page.getByRole('button', { name: 'Go back' });
  await expect(back).toBeVisible();
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/profile$/);
});

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
