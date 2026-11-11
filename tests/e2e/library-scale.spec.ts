import { test, expect } from '@playwright/test';
import { buildScaleLibrary } from '../../data/libraryFixture';
import { STORAGE_KEYS as K } from '../../data/storageKeys';

/**
 * A 300-deck library in the browser.
 *
 * The Node suites prove the index arithmetic on the stress fixture; this case
 * proves the screen only mounts a window of it. The browser fixture keeps the
 * deck/folder shape (300 decks, 60 folders, deep nesting, RTL and long names)
 * but stores fewer cards and reviews, because localStorage is a 5 MB budget and
 * the point here is row virtualization, not arithmetic.
 */
const NOW = new Date('2026-11-10T12:00:00Z').getTime();
const SCALE = {
  decks: 300,
  folders: 60,
  cardsPerDeck: 5,
  reviewsPerDeck: 20,
  seed: 0x5eed0003,
};
const library = buildScaleLibrary(SCALE, NOW);

const seedScript = `(() => {
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key && key.indexOf('memory:') === 0) localStorage.removeItem(key);
  }
  const entries = {
    decks: ${JSON.stringify(JSON.stringify(library.decks))},
    folders: ${JSON.stringify(JSON.stringify(library.folders))},
    cards: ${JSON.stringify(JSON.stringify(library.cardsByDeck))},
    log: ${JSON.stringify(JSON.stringify(library.reviewLog))},
  };
  localStorage.setItem(${JSON.stringify(K.decks)}, entries.decks);
  localStorage.setItem(${JSON.stringify(K.folders)}, entries.folders);
  localStorage.setItem(${JSON.stringify(K.allCards)}, entries.cards);
  localStorage.setItem(${JSON.stringify(K.reviewLog)}, entries.log);
  localStorage.setItem(${JSON.stringify(K.initialized)}, '1');
})();`;

test.use({ timezoneId: 'UTC' });

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(NOW);
  await page.addInitScript({ content: seedScript });
});

test('a 300-deck library mounts a window, searches, and does not overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  await page.waitForSelector('[role="main"]');
  await page.getByRole('progressbar', { name: 'Loading Memora' }).waitFor({ state: 'detached' });
  await page.waitForTimeout(900);

  // Root has 60 folders and no unfiled decks. The list must not mount them all.
  const foldersMounted = await page.getByTestId('folder-group').count();
  expect(foldersMounted).toBeGreaterThan(0);
  expect(foldersMounted).toBeLessThan(SCALE.folders);

  // A deck deep in the library is still reachable through search.
  await page.getByLabel('Search your library').fill('Deck 250');
  const hit = page.getByTestId('deck-row').filter({ hasText: 'Deck 250' });
  await expect(hit).toBeVisible();
  await expect(page.getByTestId('library-results-count')).toContainText('1 deck');

  // Persian names are searchable in their folded form.
  await page.getByLabel('Search your library').fill('کارتها');
  await expect(page.getByTestId('deck-row').first()).toBeVisible();

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByTestId('library-results-count')).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  expect(errors).toEqual([]);
});
