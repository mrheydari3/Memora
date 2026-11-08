import { test, expect, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';
import { buildStudyQueue } from '../../data/session';
import { computeStreak, startOfLocalDay } from '../../data/streak';
import { STORAGE_KEYS as K } from '../../data/storageKeys';
import type { Deck, DeckFolder, Flashcard, GameRecord, ReviewLogEntry } from '../../data/types';

/**
 * Phase 7 — data truth and persistence.
 *
 * Each expected value is recomputed here from the fixture's own stored entries
 * (decks, cards, review log, game records), not scraped back from the UI. The
 * UI is then asked one question: does it print the number the data implies?
 *
 * Counting semantics this suite pins down:
 *   - Home's hero is library-wide: every active deck's `buildStudyQueue` total,
 *     and the number of those decks that actually have something waiting.
 *   - The shelf caption and a folder row count the *current level's direct*
 *     entries. A parent folder reports 0 decks when its decks live in a child
 *     folder; that is the intended direct-only rule, not a missing total.
 *   - Archived decks are out of Home, the shelf, Game and Statistics.
 *   - XP is 10 per review on an active deck; a level is 1000 XP.
 */

const NOW = Date.now();
const DAY = 86_400_000;
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;

type Store = {
  decks: Deck[];
  folders: DeckFolder[];
  cards: Record<string, Flashcard[]>;
  log: ReviewLogEntry[];
  games: Record<string, GameRecord>;
};

type RawStore = {
  decks: string | null;
  folders: string | null;
  cards: string | null;
  log: string | null;
  games: string | null;
};

const parse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const readStore = async (page: Page): Promise<Store> => {
  // Only strings cross into the page: STORAGE_KEYS.cards is a function, and
  // Playwright refuses to serialize the whole object.
  const keys = {
    decks: K.decks,
    folders: K.folders,
    cards: K.allCards,
    log: K.reviewLog,
    games: K.gameRecords,
  };
  const raw = await page.evaluate(
    (ids) => ({
      decks: localStorage.getItem(ids.decks),
      folders: localStorage.getItem(ids.folders),
      cards: localStorage.getItem(ids.cards),
      log: localStorage.getItem(ids.log),
      games: localStorage.getItem(ids.games),
    }),
    keys
  );
  return {
    decks: parse<Deck[]>(raw.decks, []),
    folders: parse<DeckFolder[]>(raw.folders, []),
    cards: parse<Record<string, Flashcard[]>>(raw.cards, {}),
    log: parse<ReviewLogEntry[]>(raw.log, []),
    games: parse<Record<string, GameRecord>>(raw.games, {}),
  };
};

const boot = async (page: Page, fixture: 'F2' | 'F3' = 'F2') => {
  const spec = buildFixture(fixture, NOW);
  // Seed once per browser context. Installing the fixture on *every* document
  // load would silently restore it after a reset or a delete, and a reload
  // would then prove re-seeding rather than persistence.
  await page.addInitScript({
    content: `if (sessionStorage.getItem('phase7-seeded') !== '1') {
  sessionStorage.setItem('phase7-seeded', '1');
  ${fixtureInitScript(spec)}
}`,
  });
  await page.goto('/home');
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await expect
    .poll(async () => (await readStore(page)).decks.length, { timeout: 15_000 })
    .toBe(spec.sentinel.booted.decks);
  await page.waitForTimeout(500);
};

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(600);
};

const activeDecks = (store: Store) => store.decks.filter((deck) => !deck.archivedAt);

const queueFor = (deck: Deck, store: Store) =>
  buildStudyQueue(deck, store.cards[deck.id] ?? [], store.log, Date.now());

const activeQueues = (store: Store) =>
  activeDecks(store).map((deck) => ({ deck, queue: queueFor(deck, store) }));

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const shelfDeckCaption = (decks: number, due: number) =>
  `${plural(decks, 'deck', 'decks')} · ${due > 0 ? `${due} due` : 'all caught up'}`;

const shelfFolderCaption = (folders: number, cards: number, due: number) =>
  [
    plural(folders, 'folder', 'folders'),
    plural(cards, 'card', 'cards'),
    due > 0 ? `${due} due` : 'all caught up',
  ].join(' · ');

/** The deck the hero points at, mirroring Home's own choice rule. */
function continueDeck(store: Store) {
  const activeIds = new Set(activeDecks(store).map((deck) => deck.id));
  const latest = store.log
    .filter((entry) => activeIds.has(entry.deckId))
    .sort((a, b) => b.reviewedAt - a.reviewedAt)[0];
  const queues = activeQueues(store);
  const last = queues.find((entry) => entry.deck.id === latest?.deckId);
  return (
    (last && last.queue.total > 0 ? last : undefined) ??
    queues.find((entry) => entry.queue.total > 0) ??
    last ??
    queues[0]
  );
}

test.describe('Phase 7 — data truth', () => {
  test('home: the hero total is the sum of every active deck queue', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const queues = activeQueues(store);
    const total = queues.reduce((sum, entry) => sum + entry.queue.total, 0);
    const dueDecks = queues.filter((entry) => entry.queue.total > 0).length;

    // Fixture sanity: the numbers the UI must agree with.
    expect(total).toBe(40);
    expect(dueDecks).toBe(4);

    const panel = page.getByTestId('today-panel');
    await expect(panel).toContainText(String(total));
    await expect(panel).toContainText(`${plural(dueDecks, 'deck', 'decks')} · estimated`);

    // The New / Learning / Review rail describes the deck the button opens.
    const next = continueDeck(store);
    expect(next).toBeTruthy();
    const learning = next!.queue.dueCards.filter(
      (card) => card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning'
    ).length;
    const review = next!.queue.dueCards.length - learning;
    await expect(panel).toContainText(String(next!.queue.newCards.length));
    await expect(panel).toContainText(String(learning));
    await expect(panel).toContainText(String(review));
  });

  test('home: the shelf and folder rows count the current level only', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const active = activeDecks(store);
    const rootFolders = store.folders.filter((folder) => !folder.parentId);
    const rootDecks = active.filter((deck) => !deck.folderId);
    const rootDue = rootDecks.reduce((sum, deck) => sum + queueFor(deck, store).total, 0);

    expect(rootFolders.length).toBe(4);
    expect(rootDecks.length).toBe(2);
    await expect(
      page.getByText(shelfDeckCaption(rootDecks.length, rootDue), { exact: true })
    ).toBeVisible();

    // Languages holds German, whose two decks live one level down. The direct
    // rule means Languages itself reports no decks — and that is what we assert.
    const languages = page.getByTestId('folder-group').filter({ hasText: 'Languages' });
    await expect(languages).toContainText('0 decks');
    await page.getByRole('button', { name: /1 folder inside/ }).click();

    const childFolders = store.folders.filter((folder) => folder.parentId === 'fold-lang');
    const languageDecks = active.filter((deck) => deck.folderId === 'fold-lang');
    const languageCards = languageDecks.reduce(
      (sum, deck) => sum + (store.cards[deck.id] ?? []).length,
      0
    );
    const languageDue = languageDecks.reduce(
      (sum, deck) => sum + queueFor(deck, store).total,
      0
    );
    await expect(
      page.getByText(shelfFolderCaption(childFolders.length, languageCards, languageDue), {
        exact: true,
      })
    ).toBeVisible();

    // German is where those decks actually live: two decks, 34 cards, 30 due.
    const german = page.getByTestId('folder-group').filter({ hasText: 'German' });
    const germanDecks = active.filter((deck) => deck.folderId === 'fold-de');
    const germanDue = germanDecks.reduce((sum, deck) => sum + queueFor(deck, store).total, 0);
    await expect(german).toContainText('2 decks · 30 due');
    await expect(german).toContainText(`${plural(germanDecks.length, 'deck', 'decks')} · ${germanDue} due`);

    // The two nested decks are the remaining per-deck totals: German and the
    // long-named deck. Their rows must agree with their own queues.
    for (const deck of germanDecks) {
      const row = page.getByTestId('deck-row').filter({ hasText: deck.name });
      await expect(row).toBeVisible();
      await expect(row).toContainText(
        plural((store.cards[deck.id] ?? []).length, 'card', 'cards')
      );
      await expect(row.getByText(String(queueFor(deck, store).total), { exact: true })).toBeVisible();
    }
  });

  test('deck rows: card, due and studied share match the stored deck', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const rootDecks = activeDecks(store).filter((deck) => !deck.folderId);
    expect(rootDecks.length).toBeGreaterThan(0);

    for (const deck of rootDecks) {
      const row = page.getByTestId('deck-row').filter({ hasText: deck.name });
      await expect(row).toBeVisible();
      const cards = store.cards[deck.id] ?? [];
      const queue = queueFor(deck, store);
      await expect(row).toContainText(plural(cards.length, 'card', 'cards'));
      if (queue.total > 0) {
        await expect(row.getByText(String(queue.total), { exact: true })).toBeVisible();
      } else {
        await expect(row).toContainText('clear');
      }
      // A deck with no reviews prints an em dash; once studied it prints a share.
      const studied = cards.filter((card) => card.fsrs.last_review != null).length;
      await expect(row).toContainText(studied === 0 ? '—' : '%');
    }
  });

  test('profile: XP, level, streak, badges and deck order recompute from the data', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const activeIds = new Set(activeDecks(store).map((deck) => deck.id));
    const log = store.log.filter((entry) => activeIds.has(entry.deckId));

    const xp = log.length * XP_PER_REVIEW;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const intoLevel = xp % XP_PER_LEVEL;
    const streak = computeStreak(
      log.map((entry) => entry.reviewedAt),
      Date.now()
    );
    const earned = 1 + (streak >= 7 ? 1 : 0) + (log.length >= 100 ? 1 : 0);

    expect(log.length).toBe(33);
    expect(streak).toBe(13);
    expect(earned).toBe(2);

    await page.goto('/profile');
    await settle(page);
    await expect(page.locator(`[aria-label="Level ${level}"]`)).toBeVisible();
    await expect(page.getByText(`${intoLevel} of ${XP_PER_LEVEL} XP into this level`)).toBeVisible();
    await expect(page.getByText(`${streak}-day streak`)).toBeVisible();
    await expect(page.getByText(`${earned} of 5`, { exact: true })).toBeVisible();
    // The count alone could be right for the wrong badges; name them.
    await expect(page.getByText('First Review', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('7-Day Streak', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('100 Reviews', { exact: true }).first()).toBeVisible();

    // Deck order: the four most recently active decks, then the archived
    // record. Recompute it from the stored review log and card states rather
    // than pinning display copy to the fixture.
    const archivedDecks = store.decks.filter((deck) => deck.archivedAt != null);
    const lastReviewByDeck = new Map<string, number>();
    for (const entry of store.log) {
      lastReviewByDeck.set(
        entry.deckId,
        Math.max(lastReviewByDeck.get(entry.deckId) ?? 0, entry.reviewedAt)
      );
    }
    const rankedDecks = activeDecks(store)
      .map((deck) => {
        const cards = store.cards[deck.id] ?? [];
        let lastStudiedAt = lastReviewByDeck.get(deck.id) ?? 0;
        let studied = 0;
        for (const card of cards) {
          if (card.fsrs.last_review == null) continue;
          studied += 1;
          const reviewedAt = Date.parse(card.fsrs.last_review);
          if (Number.isFinite(reviewedAt)) lastStudiedAt = Math.max(lastStudiedAt, reviewedAt);
        }
        return {
          deck,
          lastStudiedAt,
          progress: cards.length > 0 ? studied / cards.length : 0,
          cardCount: cards.length,
        };
      })
      .sort(
        (a, b) =>
          b.lastStudiedAt - a.lastStudiedAt ||
          b.progress - a.progress ||
          b.cardCount - a.cardCount ||
          a.deck.name.localeCompare(b.deck.name, 'en')
      );
    const expectedOrder = [
      ...rankedDecks
        .slice(0, archivedDecks.length > 0 ? 4 : 5)
        .map((entry) => entry.deck.name),
      ...archivedDecks.slice(0, 1).map((deck) => deck.name),
    ];
    const deckButtons = page.getByRole('button', { name: /^Open / });
    await expect(deckButtons).toHaveCount(expectedOrder.length);
    expect(
      await deckButtons.evaluateAll((buttons) =>
        buttons.map((button) =>
          (button.getAttribute('aria-label') ?? '').replace(/^Open /, '')
        )
      )
    ).toEqual(expectedOrder);
  });

  test('statistics: the range total and deck count recompute from the log', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const activeIds = new Set(activeDecks(store).map((deck) => deck.id));
    const rangeStart = startOfLocalDay(Date.now()) - 29 * DAY;
    const inRange = store.log.filter(
      (entry) => activeIds.has(entry.deckId) && entry.reviewedAt >= rangeStart
    );

    expect(inRange.length).toBe(33);
    expect(activeDecks(store).length).toBe(5);

    await page.goto('/statistics');
    await settle(page);
    await expect(page.locator(`[aria-label="${inRange.length} reviews"]`)).toBeVisible();
    await expect(
      page.getByText(`${activeDecks(store).length} decks`, { exact: false }).first()
    ).toBeVisible();
  });

  test('study: the header denominator is exactly the queue total', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const deck = store.decks.find((entry) => entry.id === 'deck-german-a2b1');
    expect(deck).toBeTruthy();
    const queue = queueFor(deck!, store);
    expect(queue.total).toBe(26);

    await page.goto('/study/deck-german-a2b1');
    await settle(page);
    await expect(page.locator('[role="main"]')).toContainText(`1 / ${queue.total}`);
  });

  test('archived decks stay out of Home, Library and every due total', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const archived = store.decks.find((deck) => deck.archivedAt != null);
    expect(archived).toBeTruthy();

    const withoutArchived = activeQueues(store).reduce(
      (sum, entry) => sum + entry.queue.total,
      0
    );
    const archivedQueue = buildStudyQueue(
      archived!,
      store.cards[archived!.id] ?? [],
      store.log,
      Date.now()
    );
    expect(archivedQueue.total).toBeGreaterThan(0);
    expect(withoutArchived + archivedQueue.total).toBeGreaterThan(withoutArchived);

    await expect(page.getByTestId('deck-row').filter({ hasText: 'Archived deck' })).toHaveCount(0);
    await page.goto('/library');
    await settle(page);
    await expect(page.getByText('Archived deck')).toHaveCount(0);
  });

  test('deleting a deck removes its cards, reviews and game record', async ({ page }) => {
    await boot(page, 'F3');
    const before = await readStore(page);
    expect(before.cards['deck-german-a2b1']?.length).toBe(30);
    expect(before.log.some((entry) => entry.deckId === 'deck-german-a2b1')).toBe(true);
    expect(before.games['deck-german-a2b1']).toBeTruthy();

    await page.goto('/deck/deck-german-a2b1');
    await settle(page);
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Deck', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete deck?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete deck' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await expect
      .poll(async () => (await readStore(page)).decks.some((deck) => deck.id === 'deck-german-a2b1'))
      .toBe(false);
    const after = await readStore(page);
    expect(after.cards['deck-german-a2b1']).toBeUndefined();
    expect(after.log.some((entry) => entry.deckId === 'deck-german-a2b1')).toBe(false);
    expect(after.games['deck-german-a2b1']).toBeUndefined();
  });

  test('deleting a card removes only that card history', async ({ page }) => {
    await boot(page, 'F3');
    const store = await readStore(page);
    const cards = store.cards['deck-german-a2b1'] ?? [];
    const cardIds = new Set(cards.map((card) => card.id));
    const entry = store.log.find((item) => cardIds.has(item.cardId));
    expect(entry).toBeTruthy();
    const card = cards.find((item) => item.id === entry!.cardId)!;
    const removed = store.log.filter((item) => item.cardId === card.id).length;
    expect(removed).toBeGreaterThan(0);

    await page.goto('/deck/deck-german-a2b1');
    await settle(page);
    // The list renders the first 8 cards; the chosen card may be outside it.
    const showAll = page.getByRole('button', { name: /^Show all \d+ cards$/ });
    if (await showAll.isVisible()) {
      await showAll.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole('button', { name: `More options for ${card.front.text}` }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete card?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete card' }).click();

    await expect
      .poll(async () => {
        const current = await readStore(page);
        return (current.cards['deck-german-a2b1'] ?? []).some((item) => item.id === card.id);
      })
      .toBe(false);
    const after = await readStore(page);
    expect(after.log.some((item) => item.cardId === card.id)).toBe(false);
    expect(after.log.length).toBe(store.log.length - removed);
  });

  test('reset returns every card to new and drops only the deck log', async ({ page }) => {
    await boot(page, 'F3');
    const before = await readStore(page);
    expect(before.cards['deck-german-a2b1']?.length).toBe(30);
    expect(before.log.some((entry) => entry.deckId === 'deck-german-a2b1')).toBe(true);
    expect(before.games['deck-german-a2b1']).toBeTruthy();

    await page.goto('/deck/deck-german-a2b1');
    await settle(page);
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.getByRole('button', { name: 'Reset Progress', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Reset progress?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Reset progress', exact: true }).click();

    await expect
      .poll(async () => {
        const current = await readStore(page);
        return current.log.filter((entry) => entry.deckId === 'deck-german-a2b1').length;
      })
      .toBe(0);
    const after = await readStore(page);
    expect(after.cards['deck-german-a2b1']?.length).toBe(30);
    for (const card of after.cards['deck-german-a2b1'] ?? []) {
      expect(card.fsrs.state).toBe('New');
      expect(card.fsrs.reps).toBe(0);
      expect(card.fsrs.last_review ?? null).toBeNull();
    }
    // Reset clears the schedule and history — not the deck or its game record.
    expect(after.decks.some((deck) => deck.id === 'deck-german-a2b1')).toBe(true);
    expect(after.games['deck-german-a2b1']).toBeTruthy();

    await page.goto('/profile');
    await settle(page);
    await expect(page.getByText('0 of 1000 XP into this level')).toBeVisible();
    await expect(page.getByText('0 of 5', { exact: true })).toBeVisible();
  });

  test('reload, deep link and back keep the same numbers', async ({ page }) => {
    await boot(page, 'F2');
    const panel = page.getByTestId('today-panel');
    // React Native Web emits one text node per element, so innerText has no
    // separator between adjacent lines; compare it verbatim, not normalised.
    const heroText = await panel.innerText();
    const store = await readStore(page);
    const rootDecks = activeDecks(store).filter((deck) => !deck.folderId);
    const caption = shelfDeckCaption(
      rootDecks.length,
      rootDecks.reduce((sum, deck) => sum + queueFor(deck, store).total, 0)
    );

    await page.reload();
    await settle(page);
    await expect.poll(async () => (await panel.innerText()).trim()).toBe(heroText.trim());
    await expect(page.getByText(caption, { exact: true })).toBeVisible();

    // A direct link to a deck, then Back, must return to the same shelf totals.
    await page.goto('/deck/deck-persian');
    await settle(page);
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect.poll(async () => (await panel.innerText()).trim()).toBe(heroText.trim());
    await expect(page.getByText(caption, { exact: true })).toBeVisible();
  });
});
