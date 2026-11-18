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

  test('rapidly reopening a folder during its close restores the body', async ({ page }) => {
    await boot(page);

    const folder = page.getByTestId('folder-group').filter({ hasText: 'Travel' });
    const deck = page.getByTestId('deck-row').filter({ hasText: 'Due today (review)' });
    await expect(deck).toBeVisible();

    await folder.click();
    await expect(folder).toHaveAttribute('aria-expanded', 'false');
    // Reopen while the rows are still fading and the close timer is pending.
    await page.waitForTimeout(120);
    await folder.click();
    await expect(folder).toHaveAttribute('aria-expanded', 'true');

    await page.waitForTimeout(450);
    await expect(deck).toBeVisible();
    await expect(deck).toHaveCount(1);
  });

  test('the hero names the next deck queue separately from the global due total', async ({ page }) => {
    await boot(page);

    const panel = page.getByTestId('today-panel');
    await expect(panel.getByText('Next deck', { exact: true })).toBeVisible();
    await expect(panel.getByText(/\d+ in queue$/)).toBeVisible();
  });

  test('the plan sheet defaults to the last-studied due deck and routes the CTA to the chosen deck', async ({
    page,
  }) => {
    await boot(page);

    const storageSnapshot = () =>
      page.evaluate(
        (keys) => ({
          cards: localStorage.getItem(keys.cards),
          log: localStorage.getItem(keys.log),
        }),
        { cards: K.allCards, log: K.reviewLog }
      );
    const lastStudiedDeckId = await page.evaluate((key) => {
      const log = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
        deckId: string;
        reviewedAt: number;
      }>;
      return log.sort((a, b) => b.reviewedAt - a.reviewedAt)[0]?.deckId ?? null;
    }, K.reviewLog);
    expect(lastStudiedDeckId).toBe('deck-german-a2b1');

    const trigger = page.getByTestId('today-plan-trigger');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: "Today's plan" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radiogroup', { name: 'Due decks' })).toBeVisible();
    const radios = dialog.getByRole('radio');
    await expect(radios).toHaveCount(4);

    const defaultRow = dialog.getByRole('radio', { name: /Schritt Plus Neu A2\/B1/ });
    await expect(defaultRow).toHaveAttribute('aria-checked', 'true');
    for (const row of await radios.all()) {
      await expect(row).toContainText(/\d+ new/);
      await expect(row).toContainText(/\d+ learning/);
      await expect(row).toContainText(/\d+ review/);
    }

    const chosenRow = dialog.getByRole('radio', { name: /Due today \(review\)/ });
    await expect(chosenRow).toHaveAttribute('aria-checked', 'false');
    const scheduledBefore = await storageSnapshot();
    await chosenRow.click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('today-panel')).toContainText('Due today (review)');
    await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
    expect(await storageSnapshot()).toEqual(scheduledBefore);

    // Reopening shows the explicit choice, not the last-studied default.
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(chosenRow).toHaveAttribute('aria-checked', 'true');
    await expect(defaultRow).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page).toHaveURL(/\/study\/deck-due$/);
    expect(await storageSnapshot()).toEqual(scheduledBefore);
  });

  test.describe('320px phone', () => {
    test.use({ viewport: { width: 320, height: 700 } });

    test('keeps the streak and header actions visible without overflow', async ({ page }) => {
      await boot(page);

      await expect(page.getByLabel(/\d+-day streak/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Discover' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add deck' })).toBeVisible();
      const brand = page.getByRole('heading', { name: 'Memora' });
      expect(await brand.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(1);
    });

    test('the plan sheet fits and lists every due deck', async ({ page }) => {
      await boot(page);

      await page.getByTestId('today-plan-trigger').click();
      const dialog = page.getByRole('dialog', { name: "Today's plan" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('radio')).toHaveCount(4);

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320.5);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(1);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('today-plan-trigger')).toBeFocused();
    });
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
