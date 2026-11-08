import { test, expect } from '@playwright/test';

/**
 * Group A regressions.
 *
 * Each case maps to a defect the audit reproduced in the browser:
 *  - a direct-loaded route with no history left Back dead;
 *  - a sheet had no accessible name, no initial focus, and no focus return;
 *  - the card composer discarded typed content without asking;
 *  - a long prompt stayed clipped inside a fixed-height multiline input.
 */

const settle = async (page: import('@playwright/test').Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);
};

test.describe('Group A navigation', () => {
  test('a direct-loaded Statistics screen falls back to Profile', async ({ page }) => {
    await page.goto('/statistics');
    await settle(page);

    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('a direct-loaded add-deck sheet closes to the Library', async ({ page }) => {
    await page.goto('/add-deck');
    await page.getByRole('button', { name: 'Close sheet' }).waitFor();

    await page.getByRole('button', { name: 'Close sheet' }).click();
    await expect(page).toHaveURL(/\/library$/);
  });
});

test.describe('Group A sheets and composer', () => {
  test('a sheet is named, traps focus, and returns focus to its trigger', async ({ page }) => {
    await page.goto('/deck/deck-german-a2b1');
    await settle(page);

    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCount(1);
    await expect(dialog).toHaveAttribute('aria-label', 'Schritt Plus Neu A2/B1');

    const close = page.getByRole('button', { name: 'Close sheet' });
    await expect(close).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Delete Deck' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'More options', exact: true })).toBeFocused();
  });

  test('long front text grows instead of clipping', async ({ page }) => {
    await page.goto('/deck/deck-german-a2b1/add-card');
    const front = page.getByLabel('Front — the prompt');
    await expect(front).toBeVisible();

    const initialHeight = await front.evaluate((el) => el.clientHeight);
    const longText =
      'A very long prompt that should wrap across several lines instead of being clipped by a fixed textarea. '.repeat(
        6
      );

    await front.fill(longText);
    await expect
      .poll(async () => {
        const sizes = await front.evaluate((el) => ({
          client: el.clientHeight,
          scroll: el.scrollHeight,
        }));
        return sizes.client > initialHeight && sizes.client >= sizes.scroll - 1;
      })
      .toBe(true);
  });

  test('an unsaved draft can be kept or discarded', async ({ page }) => {
    await page.goto('/deck/deck-german-a2b1/add-card');
    const front = page.getByLabel('Front — the prompt');
    await expect(front).toBeVisible();

    const draft = 'A draft that must survive Keep editing.';
    await front.fill(draft);
    await page.getByRole('button', { name: 'Go back' }).click();

    const discard = page.getByRole('dialog', { name: 'Discard changes?' });
    await expect(discard).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close sheet' })).toBeFocused();

    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(discard).toBeHidden();
    await expect(front).toHaveValue(draft);
    await expect(page).toHaveURL(/\/add-card$/);

    await page.getByRole('button', { name: 'Go back' }).click();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/deck\/deck-german-a2b1$/);
  });
});
