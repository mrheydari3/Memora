import { test, expect, type Locator, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '../../data/storageKeys';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';

/**
 * Edit layout is a real drag surface, not only a visual state. The dev fixture
 * gives us two unpinned root decks and three root folders (one pinned), which
 * covers both sibling groups and the pinned boundary the store enforces.
 */
const FIXED_NOW = new Date('2026-11-07T12:00:00Z');
const FIXTURE = buildFixture('F3', FIXED_NOW.getTime());
const LONG_FIXTURE = buildFixture('F4', FIXED_NOW.getTime());

test.use({ timezoneId: 'UTC', viewport: { width: 1280, height: 900 } });

async function settle(page: Page) {
  await page.waitForSelector('[data-testid="today-panel"]');
  await page
    .getByRole('progressbar', { name: 'Loading Memora' })
    .waitFor({ state: 'detached' });
  await page.waitForTimeout(900);
}

async function dragDown(page: Page, row: Locator) {
  const handle = row.getByTestId('reorder-handle');
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();

  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 72, { steps: 12 });
  await page.mouse.up();
}

async function rowName(row: Locator) {
  return (await row.getByTestId('reorder-name').innerText()).trim();
}

async function holdAtBottom(page: Page, row: Locator) {
  const handle = row.getByTestId('reorder-handle');
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();

  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  // Home's virtualized board owns the scroll now; the old Screen wrapper no
  // longer scrolls, so auto-scroll has to advance this list.
  const scroller = page.getByTestId('shelf-panel');
  const before = await scroller.evaluate((node) => node.scrollTop);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, 840, { steps: 12 });
  await page.waitForTimeout(1400);
  const after = await scroller.evaluate((node) => node.scrollTop);
  await page.mouse.up();
  return { before, after };
}

test('edit layout drags decks and folders and persists the order', async ({ page }) => {
  // Seed once. A plain fixture init script would reinstall the fixture on the
  // reload and hide whether the drag actually persisted.
  await page.addInitScript({
    content: `(() => {
      try {
        if (localStorage.getItem('__memora_layout_fixture') === '1') return;
        localStorage.setItem('__memora_layout_fixture', '1');
      } catch {
        return;
      }
      ${fixtureInitScript(FIXTURE)}
    })();`,
  });
  await page.goto('/');
  await settle(page);

  await page.getByRole('button', { name: 'Edit layout' }).click();
  const decks = page.getByTestId('reorder-group-decks').getByTestId('reorder-row');
  const folders = page.getByTestId('reorder-group-folders').getByTestId('reorder-row');
  await expect(decks).toHaveCount(2);
  await expect(folders).toHaveCount(3);

  const firstDeckBefore = await rowName(decks.first());
  await dragDown(page, decks.first());
  await expect(decks.first().getByTestId('reorder-name')).not.toHaveText(firstDeckBefore);
  const firstDeckAfter = await rowName(decks.first());

  // The pinned Travel folder stays first; drag the first unpinned folder down.
  const firstFolderBefore = await rowName(folders.first());
  const secondFolderBefore = await rowName(folders.nth(1));
  expect(firstFolderBefore).toBe('Travel');
  await dragDown(page, folders.nth(1));
  await expect(folders.first().getByTestId('reorder-name')).toHaveText(firstFolderBefore);
  await expect(folders.nth(1).getByTestId('reorder-name')).not.toHaveText(secondFolderBefore);
  const secondFolderAfter = await rowName(folders.nth(1));

  await page.getByRole('button', { name: 'Done editing layout' }).click();
  await page.reload();
  await settle(page);
  await page.getByRole('button', { name: 'Edit layout' }).click();

  await expect(
    page.getByTestId('reorder-group-decks').getByTestId('reorder-row').first().getByTestId('reorder-name')
  ).toHaveText(firstDeckAfter);
  await expect(
    page.getByTestId('reorder-group-folders').getByTestId('reorder-row').first().getByTestId('reorder-name')
  ).toHaveText(firstFolderBefore);
  await expect(
    page.getByTestId('reorder-group-folders').getByTestId('reorder-row').nth(1).getByTestId('reorder-name')
  ).toHaveText(secondFolderAfter);
});

test('edit layout auto-scrolls while the drag stays at the edge', async ({ page }) => {
  await page.addInitScript({ content: fixtureInitScript(LONG_FIXTURE) });
  await page.goto('/');
  await settle(page);

  await page.getByRole('button', { name: 'Edit layout' }).click();
  const decks = page.getByTestId('reorder-group-decks').getByTestId('reorder-row');
  await expect(decks).toHaveCount(100);

  const firstName = await rowName(decks.first());
  const scroll = await holdAtBottom(page, decks.first());
  await page.waitForTimeout(300);

  const stored = (await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, STORAGE_KEYS.decks)) as { name: string }[];
  const movedTo = stored.findIndex((deck) => deck.name === firstName);

  // The held pointer must advance the page meaningfully, not only translate
  // the row; the row then has to cross more than a plain 240px finger drag.
  expect(scroll.after).toBeGreaterThan(scroll.before + 100);
  expect(movedTo).toBeGreaterThan(6);
});
