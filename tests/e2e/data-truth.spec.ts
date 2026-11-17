import { test, expect, type Page } from '@playwright/test';
import { buildFixture, fixtureInitScript } from '../ui/fixtures';
import { folderSubtreeCounts } from '../../data/folders';
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
 *   - The shelf's meta line at the root covers every active deck and every root
 *     folder, including decks filed inside folders; inside a folder it covers
 *     that folder's subtree. Folder headers roll up the same subtree and name
 *     their direct/nested split.
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

const dueByDeck = (store: Store) =>
  Object.fromEntries(activeQueues(store).map(({ deck, queue }) => [deck.id, queue.total]));

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The shelf header's meta line: decks in scope, folders in scope, and the due
 * figure those decks roll up. The card count left this line when the shelf
 * became a library index (`home.tsx` `shelfMeta`).
 */
const shelfMeta = (decks: number, folders: number, due: number) =>
  [
    plural(decks, 'deck', 'decks'),
    plural(folders, 'folder', 'folders'),
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
    await expect(panel).toContainText(`${dueDecks} decks · estimated`);

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

  test('home: a caught-up library never prints an estimate', async ({ page }) => {
    await boot(page, 'F2');
    const future = Date.now() + 30 * DAY;
    // Make every card wait a month and give every deck no new-card budget: the
    // library is genuinely caught up, not merely "nothing reviewed today".
    await page.evaluate(
      ({ keys, due }) => {
        const cards = JSON.parse(localStorage.getItem(keys.cards) ?? '{}') as Record<
          string,
          Array<{ fsrs?: { due: string } }>
        >;
        for (const list of Object.values(cards)) {
          for (const card of list) if (card.fsrs) card.fsrs.due = new Date(due).toISOString();
        }
        localStorage.setItem(keys.cards, JSON.stringify(cards));
        const decks = JSON.parse(localStorage.getItem(keys.decks) ?? '[]') as Array<{
          newCardsPerDay: number;
          maxCardsPerDay: number;
        }>;
        for (const deck of decks) {
          deck.newCardsPerDay = 0;
          deck.maxCardsPerDay = 0;
        }
        localStorage.setItem(keys.decks, JSON.stringify(decks));
      },
      { keys: { cards: K.allCards, decks: K.decks }, due: future }
    );
    await page.reload();
    await settle(page);

    const store = await readStore(page);
    const pending = activeQueues(store).reduce((sum, entry) => sum + entry.queue.total, 0);
    expect(pending).toBe(0);

    const panel = page.getByTestId('today-panel');
    await expect(panel).toContainText('Nothing waiting — you are all caught up');
    // No fabricated session length when there is nothing to study.
    await expect(panel).not.toContainText('estimated');
    await expect(panel).not.toContainText('minute');
  });

  test('home: the shelf totals and folder headers roll up each subtree', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    const active = activeDecks(store);
    const rootFolders = store.folders.filter((folder) => !folder.parentId);
    const rootDue = activeQueues(store).reduce((sum, entry) => sum + entry.queue.total, 0);
    const subtrees = folderSubtreeCounts(store.folders, store.decks, dueByDeck(store));

    expect(rootFolders.length).toBe(4);
    expect(store.folders.length).toBeGreaterThan(rootFolders.length);
    expect(active.length).toBe(5);
    expect(rootDue).toBe(40);
    await expect(
      page.getByText(shelfMeta(active.length, rootFolders.length, rootDue), { exact: true })
    ).toBeVisible();
    // The band below the masthead lists exactly those folders, so it carries the
    // same number: a nested folder must not appear in one count and not the other.
    await expect(
      page.getByTestId('shelf-band').filter({ hasText: 'Folders' })
    ).toContainText(`(${rootFolders.length})`);

    // Languages has no direct decks, but its German child owns two. The header
    // must name both sides of that split rather than claiming the folder is empty.
    const languages = page.getByTestId('folder-group').filter({ hasText: 'Languages' });
    await expect(languages).toContainText('0 direct · 2 nested');
    await expect(languages).toContainText('30 due');
    // The child folder is a sub-item inside its parent's well; opening it drills
    // into that level, where the header names the folder and its own totals.
    const germanItem = page.getByTestId('folder-subitem').filter({ hasText: 'German' });
    await expect(germanItem).toContainText('2 decks · 30 due');
    await expect(germanItem).not.toContainText('direct');
    await germanItem.click();
    await settle(page);

    const childFolders = store.folders.filter((folder) => folder.parentId === 'fold-lang');
    const germanChildren = store.folders.filter((folder) => folder.parentId === 'fold-de');
    const language = subtrees.get('fold-lang');
    expect(childFolders.length).toBe(1);
    expect(language).toEqual({ decks: 2, due: 30, nestedFolders: 1 });
    await expect(
      page.getByText(shelfMeta(language!.decks, germanChildren.length, language!.due), {
        exact: true,
      })
    ).toBeVisible();

    // The two nested decks are the remaining per-deck totals: German and the
    // long-named deck. Their rows must agree with their own queues.
    const germanDecks = active.filter((deck) => deck.folderId === 'fold-de');
    expect(germanDecks.length).toBe(2);
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
      } else if (cards.length === 0) {
        // A deck with no cards is empty, not finished: it must state that and
        // must not borrow the green "clear" of a caught-up deck.
        await expect(row).toContainText('no cards');
        await expect(row).not.toContainText('clear');
      } else {
        // The due tile deliberately shows a clear mark, not a misleading zero.
        await expect(row).toContainText('clear');
      }
      // v3 renders the share as a percentage, and an unstarted share as an
      // em dash rather than a v2 "Not started" label.
      const studied = cards.filter((card) => card.fsrs.last_review != null).length;
      const progress = cards.length > 0 ? Math.round((studied / cards.length) * 100) : 0;
      await expect(
        row.getByText(studied === 0 ? '—' : `${progress}%`, { exact: true })
      ).toBeVisible();
    }
  });

  test('profile: progression and Mini Statistics recompute from the normalized log', async ({ page }) => {
    await boot(page, 'F2');
    const store = await readStore(page);
    // Canonical scope: archived decks are excluded, orphan reviews stay in the
    // totals. The fixture has no duplicates or invalid ratings.
    const archivedIds = new Set(
      store.decks.filter((deck) => deck.archivedAt != null).map((deck) => deck.id)
    );
    const log = store.log.filter((entry) => !archivedIds.has(entry.deckId));

    const now = Date.now();
    const xp = log.length * XP_PER_REVIEW;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const intoLevel = xp % XP_PER_LEVEL;
    const streak = computeStreak(
      log.map((entry) => entry.reviewedAt),
      now
    );
    const activeDays = new Set(log.map((entry) => startOfLocalDay(entry.reviewedAt))).size;
    const rangeStart = startOfLocalDay(now) - 29 * DAY;
    const inRange = log.filter((entry) => entry.reviewedAt >= rangeStart);
    const rangeActiveDays = new Set(
      inRange.map((entry) => startOfLocalDay(entry.reviewedAt))
    ).size;
    // Rating 1 is Again; 2–4 are passes (Hard still counts as recall).
    const successes = inRange.filter((entry) => entry.rating !== 1).length;
    const recall =
      inRange.length >= 10 ? `${Math.round((successes / inRange.length) * 100)}%` : '—';
    const nightCards = new Set(
      log
        .filter((entry) => {
          const hour = new Date(entry.reviewedAt).getHours();
          return hour >= 23 || hour < 5;
        })
        .map((entry) => entry.cardId)
    );
    const earned =
      (log.length >= 1 ? 1 : 0) +
      (streak >= 7 ? 1 : 0) +
      (log.length >= 100 ? 1 : 0) +
      (nightCards.size >= 20 ? 1 : 0);

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
    await expect(page.getByTestId('achievement-night-owl')).toContainText('Locked');
    await expect(page.getByTestId('achievement-speed-demon')).toContainText('Not tracked yet');
    await expect(page.getByTestId('achievement-speed-demon')).toContainText(/not stored/i);
    await expect(page.getByTestId('profile-deck')).toHaveCount(0);
    await expect(page.getByText('My decks', { exact: true })).toHaveCount(0);

    // Mini Statistics is the same canonical last-30-days window as Statistics.
    await expect(page.getByTestId('profile-mini-reviews-value')).toHaveText(
      String(inRange.length)
    );
    await expect(page.getByTestId('profile-mini-active-days-value')).toHaveText(
      String(rangeActiveDays)
    );
    await expect(page.getByTestId('profile-mini-recall-value')).toHaveText(recall);
    await expect(page.getByTestId('profile-activity-strip')).toBeVisible();
    await expect(page.getByText('Last 30 days', { exact: true })).toBeVisible();

    // The CTA is labelled and opens the standalone report.
    await page.getByTestId('profile-statistics-cta').click();
    await expect(page).toHaveURL(/\/statistics$/);
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
    await expect(
      page.locator(`[aria-label="${inRange.length} reviews in last 30 days"]`)
    ).toBeVisible();
    await expect(
      page.getByText(`${activeDecks(store).length} decks`, { exact: false }).first()
    ).toBeVisible();
    await expect(page.getByText('All time', { exact: true })).toBeVisible();
    await expect(page.getByText('Last 30 days', { exact: true }).first()).toBeVisible();

    // A range change must relabel the reviews ledger and recall, not just the chart.
    await page.getByRole('button', { name: '7 days' }).click();
    await expect(page.getByText('Last 7 days', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Successful recall rate · Last 7 days', { exact: false })
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

  test('study: every rating key announces a separated name', async ({ page }) => {
    await boot(page, 'F2');
    await page.goto('/study/deck-german-a2b1');
    await settle(page);
    await page.getByRole('button', { name: 'Show answer' }).click();

    const ratings = [
      { rating: 1, label: 'Again' },
      { rating: 2, label: 'Hard' },
      { rating: 3, label: 'Good' },
      { rating: 4, label: 'Easy' },
    ];
    for (const { rating, label } of ratings) {
      const key = page.getByTestId(`rating-${rating}`);
      await expect(key).toBeVisible();
      await expect(key).toHaveAccessibleName(new RegExp(`${label} ${rating}$`));
      expect(await key.getAttribute('aria-label')).toMatch(new RegExp(`${label} ${rating}$`));
    }
  });

  test('study: a deck with no cards is not reported as completed', async ({ page }) => {
    await boot(page, 'F2');
    await page.goto('/study/deck-empty');
    await settle(page);
    await expect(page.getByText('No cards yet')).toBeVisible();
    await expect(page.getByText('All done')).toHaveCount(0);
    await expect(page.locator('[role="main"]')).not.toContainText('0 / 0');
    await expect(page.getByRole('button', { name: 'Add cards' })).toBeVisible();
  });

  test('archived decks stay out of totals and restore from their own page', async ({ page }) => {
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

    // P4: the deck page explains the archive, hides the due figure and offers a
    // direct route back into study instead of a dead Start-session control.
    await page.goto('/deck/deck-archived');
    await settle(page);
    const hero = page.getByTestId('deck-hero');
    await expect(hero).toContainText('Archived');
    await expect(hero).not.toContainText('cards due');
    await expect(hero.getByText('cards due', { exact: true })).toHaveCount(0);
    const restore = page.getByRole('button', { name: 'Archived — restore to study' });
    await expect(restore).toBeEnabled();

    await page.goto('/study/deck-archived');
    await settle(page);
    await expect(page.getByText('This deck is archived')).toBeVisible();

    await page.goto('/deck/deck-archived');
    await settle(page);
    await page.getByRole('button', { name: 'Archived — restore to study' }).click();
    await expect(page).toHaveURL(/\/study\/deck-archived$/);
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
    const restored = await readStore(page);
    expect(restored.decks.find((deck) => deck.id === 'deck-archived')?.archivedAt ?? null).toBeNull();
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
    const active = activeDecks(store);
    const caption = shelfMeta(
      active.length,
      store.folders.filter((folder) => !folder.parentId).length,
      activeQueues(store).reduce((sum, entry) => sum + entry.queue.total, 0)
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
