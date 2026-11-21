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
  test('keeps the wordmark at 320px and puts the streak shortcut in the hero', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await boot(page);

    const heading = page.getByRole('heading', { level: 1, name: 'Memora' });
    await expect(heading).toBeVisible();
    const width = await heading.evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);

    const panel = page.getByTestId('today-panel');
    const streak = panel.getByTestId('home-streak-control');
    await expect(streak).toBeVisible();
    await expect(streak).toHaveAccessibleName(/\d+-day streak/);
    const box = await streak.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);

    await streak.click();
    await expect(page).toHaveURL(/\/streak$/);
  });

  test('keeps the streak shortcut in the app bar above the narrow breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);

    const streak = page.getByTestId('page-header-bar').getByTestId('home-streak-control');
    await expect(streak).toBeVisible();
    await expect(streak).toHaveAccessibleName(/\d+-day streak/);
    const box = await streak.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(
      page.getByTestId('today-panel').getByTestId('home-streak-control')
    ).toHaveCount(0);
  });

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

  test('the header plus offers both deck and folder creation', async ({ page }) => {
    await boot(page);

    const create = page.getByRole('button', { name: 'Create new' });
    await expect(create).toHaveAttribute('aria-haspopup', 'menu');
    await create.click();
    await expect(page.getByRole('button', { name: /^New deck/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^New folder/ })).toBeVisible();

    await page.getByRole('button', { name: /^New folder/ }).click();
    const folders = page.getByRole('dialog', { name: 'Folders' });
    await expect(folders).toBeVisible();
    await expect(folders.getByLabel('New folder')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(create).toBeFocused();

    await create.click();
    await page.getByRole('button', { name: /^New deck/ }).click();
    await expect(page).toHaveURL(/\/add-deck$/);
  });

  test('the folder icon control is labelled and uses compact tiles at 320, 390 and 780', async ({
    page,
  }) => {
    for (const { width, height } of [
      { width: 320, height: 760 },
      { width: 390, height: 844 },
      { width: 780, height: 1024 },
    ]) {
      await page.setViewportSize({ width, height });
      await boot(page);

      await page.getByRole('button', { name: 'Create new' }).click();
      // The create menu is a sheet of buttons on phones and an anchored menu
      // of menuitems on the tablet layout; either opens the same folder sheet.
      await page
        .getByRole('button', { name: /^New folder/ })
        .or(page.getByRole('menuitem', { name: /^New folder/ }))
        .click();
      const dialog = page.getByRole('dialog', { name: 'Folders' });
      await expect(dialog).toBeVisible();

      const control = dialog.getByRole('button', { name: /Change icon/ });
      await expect(control).toBeVisible();
      await expect(control).toContainText('Change icon');
      const controlBox = await control.boundingBox();
      expect(controlBox).not.toBeNull();
      // A fractional layout position can make Chromium report an exact 44px
      // box as 43.9999…; the target is measured in whole CSS pixels.
      expect(Math.round(controlBox!.height)).toBeGreaterThanOrEqual(44);
      await control.click();

      const language = dialog.getByRole('radio', { name: 'Icon Language' });
      await expect(language).toBeVisible();
      const box = await language.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);

      // A long name must wrap inside the 44px row, not ellipsize.
      await dialog.getByRole('radio', { name: 'Icon Record Voice Over' }).click();
      await dialog.getByRole('button', { name: 'Done choosing icon' }).click();
      const chosen = dialog.getByRole('button', { name: /Change icon/ });
      await expect(chosen).toContainText('Record Voice Over');
      expect(Math.round((await chosen.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
      expect(
        await chosen.evaluate((element) => {
          const label = [...element.querySelectorAll('*')].find(
            (node) => node.textContent?.trim() === 'Record Voice Over'
          );
          return label ? label.scrollWidth > label.clientWidth + 1 : true;
        })
      ).toBe(false);

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(1);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });

  test('the create menu works on a wide canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await boot(page);

    await page.getByRole('button', { name: 'Create new' }).click();
    const menu = page.getByRole('menu', { name: 'Create new' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^New deck/ })).toBeVisible();

    await menu.getByRole('menuitem', { name: /^New deck/ }).click();
    await expect(page).toHaveURL(/\/add-deck$/);
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

  test('the hero scopes the CTA to one deck and names the other decks still due', async ({ page }) => {
    await boot(page);

    const panel = page.getByTestId('today-panel');
    await expect(panel.getByText('Start with', { exact: true })).toBeVisible();
    await expect(panel.getByText(/\d+ in queue$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue this deck' })).toBeVisible();
    await expect(panel.getByText('3 other decks are due today', { exact: true })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Continue this deck' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Study this deck' })).toBeVisible();
    expect(await storageSnapshot()).toEqual(scheduledBefore);

    // Reopening shows the explicit choice, not the last-studied default.
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(chosenRow).toHaveAttribute('aria-checked', 'true');
    await expect(defaultRow).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.getByRole('button', { name: 'Study this deck' }).click();
    await expect(page).toHaveURL(/\/study\/deck-due$/);
    expect(await storageSnapshot()).toEqual(scheduledBefore);
  });

  test('the hero drops the remaining-deck line when only one deck is due', async ({ page }) => {
    await boot(page);

    await page.evaluate(
      ({ decksKey, logKey }) => {
        const decks = JSON.parse(localStorage.getItem(decksKey) ?? '[]') as Array<{
          id: string;
          archivedAt?: number | null;
        }>;
        const archivedAt = Date.now();
        for (const deck of decks) {
          if (deck.id !== 'deck-german-a2b1') deck.archivedAt = archivedAt;
        }
        localStorage.setItem(decksKey, JSON.stringify(decks));
        localStorage.setItem(logKey, '[]');
      },
      { decksKey: K.decks, logKey: K.reviewLog }
    );
    await page.reload();
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });

    const panel = page.getByTestId('today-panel');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toContainText('1 deck · estimated');
    await expect(page.getByRole('button', { name: 'Study this deck' })).toBeVisible();
    await expect(panel).not.toContainText('other deck');
  });

  test('the hero names one other due deck in the singular', async ({ page }) => {
    await boot(page);

    await page.evaluate(
      ({ decksKey, logKey }) => {
        const keep = new Set(['deck-german-a2b1', 'deck-due']);
        const decks = JSON.parse(localStorage.getItem(decksKey) ?? '[]') as Array<{
          id: string;
          archivedAt?: number | null;
        }>;
        const archivedAt = Date.now();
        for (const deck of decks) {
          if (!keep.has(deck.id)) deck.archivedAt = archivedAt;
        }
        localStorage.setItem(decksKey, JSON.stringify(decks));
        localStorage.setItem(logKey, '[]');
      },
      { decksKey: K.decks, logKey: K.reviewLog }
    );
    await page.reload();
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });

    const panel = page.getByTestId('today-panel');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Study this deck' })).toBeVisible();
    await expect(panel.getByText('1 other deck is due today', { exact: true })).toBeVisible();
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
    // Folder drill-down is the tablet tile's job; on mobile a folder
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

    await page.getByRole('tab', { name: 'Review' }).click();
    await expect(page).toHaveURL(/\/review/);

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

    test('the wide create menu still opens its destination', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await boot(page);

      await page.getByRole('button', { name: 'Create new' }).click();
      await page.getByRole('menuitem', { name: /^New deck/ }).click();
      await expect(page).toHaveURL(/\/add-deck$/);
    });
  });
});
