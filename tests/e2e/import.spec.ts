import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);
};

test('import: Settings opens the importer, CSV preview lands in a new deck and survives reload', async ({
  page,
}) => {
  await page.goto('/settings');
  await settle(page);

  await page.getByRole('button', { name: /^Import data/ }).click();
  await expect(page).toHaveURL(/\/mass-import$/);
  await expect(page.getByRole('heading', { name: 'Import data' })).toBeVisible();

  await page.getByLabel('Data to import').fill(
    'front,back,example\nHallo,hello,Ein Gruß\nTschüss,goodbye,\n'
  );
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('2 cards', { exact: true })).toBeVisible();
  await page.getByLabel('Deck name').fill('Injected deck');
  await page.getByRole('button', { name: 'Import 2 cards' }).click();

  await expect(page.getByRole('button', { name: 'Open deck' })).toBeVisible();
  await page.getByRole('button', { name: 'Open deck' }).click();
  await expect(page.getByRole('heading', { name: 'Injected deck' })).toBeVisible();

  const stored = await page.evaluate(() => {
    const decks = JSON.parse(localStorage.getItem('memory:decks') ?? '[]') as Array<{
      id: string;
      name: string;
    }>;
    const cardsByDeck = JSON.parse(localStorage.getItem('memory:cards:all') ?? '{}') as Record<
      string,
      Array<{ front: { text: string }; back: { text: string } }>
    >;
    const deck = decks.find((entry) => entry.name === 'Injected deck');
    return {
      deck,
      cards: deck ? cardsByDeck[deck.id] ?? [] : [],
    };
  });
  expect(stored.deck).toBeTruthy();
  expect(stored.cards).toHaveLength(2);
  expect(stored.cards[0]?.front.text).toBe('Hallo');
  expect(stored.cards[0]?.back.text).toBe('hello');

  await page.reload();
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Injected deck' })).toBeVisible();
});
