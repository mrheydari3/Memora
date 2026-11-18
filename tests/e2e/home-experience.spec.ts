import { expect, test, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';
import { STORAGE_KEYS as K } from '../../data/storageKeys';

/**
 * Focused Home regressions for the launch and daily-library work.
 *
 * The broad data-truth suite already owns the arithmetic. These cases pin the
 * interaction seams that are easy to regress: archived-only and folder-only
 * libraries, the two scroll positions of a folder drill-down, tab re-entry and
 * reduced-motion boot.
 */

const NOW = Date.now();

async function boot(page: Page): Promise<void> {
  const spec = buildFixture('F2', NOW);
  await page.addInitScript({
    content: `if (sessionStorage.getItem('home-experience-seeded') !== '1') {
  sessionStorage.setItem('home-experience-seeded', '1');
  ${fixtureInitScript(spec)}
}`,
  });
  await page.goto('/home');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await expect(page.getByTestId('today-panel')).toBeVisible({ timeout: 20_000 });
}

test.describe('Home experience', () => {
  test('archived-only library keeps the archive and restore route reachable', async ({ page }) => {
    await boot(page);

    await page.evaluate((key) => {
      const decks = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
        archivedAt?: number | null;
      }>;
      const archivedAt = Date.now();
      for (const deck of decks) deck.archivedAt ??= archivedAt;
      localStorage.setItem(key, JSON.stringify(decks));
    }, K.decks);
    await page.reload();
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });

    await expect(
      page.getByText('No active decks. Your archived decks are below.', { exact: true })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('No decks yet', { exact: true })).toHaveCount(0);

    const archive = page.getByRole('button', { name: /Archived decks, \d+/ });
    await expect(archive).toBeVisible();
    await archive.click();
    const archivedDeck = page.getByRole('button', { name: /^Archived deck \d+ cards?$/ });
    await expect(archivedDeck).toBeVisible();
    await archivedDeck.click();

    await expect(page).toHaveURL(/\/deck\/deck-archived$/);
    await expect(
      page.getByRole('button', { name: 'Archived — restore to study' })
    ).toBeVisible();
  });

  test('a library with folders but no decks still exposes those folders', async ({ page }) => {
    await boot(page);

    await page.evaluate((key) => localStorage.setItem(key, '[]'), K.decks);
    await page.reload();
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });

    await expect(page.getByText('No decks yet', { exact: true })).toHaveCount(0);
    await expect(
      page.getByTestId('folder-group').filter({ hasText: 'Travel' })
    ).toBeVisible({ timeout: 20_000 });
  });

  test('collapsing a folder fades its body and then removes it', async ({ page }) => {
    await boot(page);

    const folder = page.getByTestId('folder-group').filter({ hasText: 'Travel' });
    const deck = page.getByTestId('deck-row').filter({ hasText: 'Due today (review)' });
    await expect(deck).toBeVisible();

    await folder.click();
    await expect(folder).toHaveAttribute('aria-expanded', 'false');
    await expect(deck).toHaveCount(0, { timeout: 3_000 });

    await folder.click();
    await expect(folder).toHaveAttribute('aria-expanded', 'true');
    await expect(deck).toBeVisible({ timeout: 3_000 });
  });

  test('closing the archive fades its body before unmounting it', async ({ page }) => {
    await boot(page);

    const archive = page.getByRole('button', { name: /Archived decks, \d+/ });
    await archive.click();
    await expect(
      page.getByRole('button', { name: /^Archived deck \d+ cards?$/ })
    ).toBeVisible();

    await archive.click();
    await expect(archive).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('archive-body')).toHaveCount(0, { timeout: 3_000 });
  });

  test.describe('folder navigation', () => {
    // Folder drill-down is the desktop tile's job; on the phone a folder
    // expands in place so its decks stay in the virtualized list.
    test.use({ viewport: { width: 1280, height: 320 } });

    test('opening a folder starts at the top and returning restores the root offset', async ({ page }) => {
      await boot(page);
      const shelf = page.getByTestId('shelf-panel');

      await shelf.evaluate((element) => {
        element.scrollTop = 700;
        element.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      await expect
        .poll(() => shelf.evaluate((element) => element.scrollTop), { timeout: 2_000 })
        .toBeGreaterThan(100);

      const folder = page.getByTestId('folder-card').filter({ hasText: 'Travel' });
      // Click from the element itself: Playwright's actionability scroll would
      // move the root list after we recorded its offset, which is the state this
      // test is trying to preserve. The handler is still the real Pressable.
      await folder.evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole('button', { name: 'All decks' })).toBeVisible();
      await expect
        .poll(() => shelf.evaluate((element) => element.scrollTop), { timeout: 2_000 })
        .toBe(0);

      await page.getByRole('button', { name: 'All decks' }).click();
      await expect
        .poll(() => shelf.evaluate((element) => element.scrollTop), { timeout: 2_000 })
        .toBeGreaterThan(100);
    });
  });

  test('returning to Home after another tab keeps the ready hero mounted', async ({ page }) => {
    await boot(page);

    await page.getByRole('tab', { name: 'Game' }).click();
    await expect(page).toHaveURL(/\/library/);

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByTestId('today-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Loading Memora')).toHaveCount(0);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('ready Home still renders and the skeleton hands off', async ({ page }) => {
      await boot(page);
      expect(
        await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      ).toBe(true);
      await expect(page.getByTestId('today-panel')).toBeVisible();
      await expect(page.getByText('Your decks', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Loading Memora')).toHaveCount(0);
    });
  });
});
