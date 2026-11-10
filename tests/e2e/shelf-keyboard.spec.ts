import { test, expect, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Task 5 of the Your-decks debug plan, pinned in a real browser.
 *
 * The shelf's folder header and the deck options trigger are both React Native
 * Web pressables, so keyboard activation goes through PressResponder: keydown
 * starts the press, the document-level keyup fires `onPress`. Nothing in the
 * component tests can prove that pairing, and the sandbox probes could only
 * dispatch untrusted key events, which PressResponder ignores. These two cases
 * are the definitive check.
 */
const FIXED_NOW = new Date('2026-11-07T12:00:00Z');
const HOME_FIXTURE = buildFixture('F3', FIXED_NOW.getTime());

test.use({
  timezoneId: 'UTC',
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});

async function openHome(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="today-panel"]');
  await page
    .getByRole('progressbar', { name: 'Loading Memora' })
    .waitFor({ state: 'detached' });
  await page.waitForTimeout(700);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(FIXED_NOW);
  await page.addInitScript(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('memory:')) localStorage.removeItem(key);
    }
  });
  await page.addInitScript({ content: fixtureInitScript(HOME_FIXTURE) });
});

test('the folder header opens and closes from Enter and Space', async ({ page }) => {
  await openHome(page);

  const header = page.getByTestId('folder-group').first();
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute('aria-expanded', 'true');

  await header.focus();
  await expect(header).toBeFocused();

  // A key that is not Enter or Space must not move the accordion.
  await page.keyboard.press('a');
  await expect(header).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Space');
  await expect(header).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Space');
  await expect(header).toHaveAttribute('aria-expanded', 'true');
});

test('Escape closes a deck options sheet and returns focus to its trigger', async ({ page }) => {
  await openHome(page);

  const trigger = page.getByRole('button', { name: /^Options for deck / }).first();
  await expect(trigger).toBeVisible();

  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Pinned decks stay above the others');

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});
