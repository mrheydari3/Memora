/**
 * Library index — one pass over the stored library for Home.
 *
 * Home used to answer its questions the expensive way: `buildStudyQueue` ran
 * once per deck and filtered the *whole* review log each time, then every folder
 * re-walked its descendants and re-filtered every deck queue twice. With a few
 * hundred decks and tens of thousands of reviews that is quadratic work on the
 * render path.
 *
 * This module builds the same answers in linear time:
 *
 *   - the review log is bucketed by deck once, and today's slice is bucketed
 *     again in the same walk, so a deck never scans history it does not own;
 *   - a queue summary counts cards instead of building and sorting arrays, but
 *     follows `buildStudyQueue`'s rules exactly (daily caps, learning steps,
 *     Fast Repetition) — `library.test.ts` pins the parity;
 *   - folder totals are aggregated bottom-up, one visit per folder, instead of
 *     a descendant walk per folder;
 *   - folder paths, children and direct decks are maps built once.
 *
 * Everything here is pure; the store and the screens keep their own state.
 */

import type { Deck, DeckFolder, Flashcard, ReviewLogEntry } from './types';
import type { StudyQueue } from './session';
import { buildStudyQueue, reviewStateOf } from './session';

export type DeckSummary = {
  deck: Deck;
  cardCount: number;
  /** Cards a session started now would show, daily caps included. */
  total: number;
  /** Studied share, 0–1. */
  progress: number;
  /** Cards that already carry at least one review. */
  studiedCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  /** Epoch ms of the latest review, or null when the deck has no history. */
  lastStudiedAt: number | null;
};

export type FolderAggregate = {
  /** Active decks filed directly in this folder. */
  decks: number;
  /** Cards across those decks. */
  cards: number;
  /** Cards that already carry a review. */
  studied: number;
  /** Cards those decks want today. */
  due: number;
  /** Studied share across those decks, 0–1. */
  progress: number;
  /** Latest review across the decks filed directly here, or null. */
  lastStudiedAt: number | null;
};

export type LibraryTotals = {
  decks: number;
  folders: number;
  due: number;
  dueDecks: number;
  cards: number;
  studied: number;
  progress: number;
  caughtUpDecks: number;
  caughtUpFolders: number;
  archived: number;
};

export type LibraryIndex = {
  /** Active decks in stored order. */
  entries: DeckSummary[];
  byDeckId: Map<string, DeckSummary>;
  /** Active decks filed directly in each folder, stored order. */
  byFolderId: Map<string, DeckSummary[]>;
  /** Active decks with no folder, or a folder that no longer exists. */
  unfiled: DeckSummary[];
  archived: { deck: Deck; cards: number }[];
  foldersById: Map<string, DeckFolder>;
  aggregates: Map<string, FolderAggregate>;
  totals: LibraryTotals;
};

const roundShare = (studied: number, cards: number) => (cards > 0 ? studied / cards : 0);

/** Local midnight, mirroring `buildStudyQueue`'s daily-cap boundary. */
export function startOfLocalDay(now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export type ReviewIndex = {
  byDeck: Map<string, ReviewLogEntry[]>;
  todayByDeck: Map<string, ReviewLogEntry[]>;
  /** Distinct new cards seen today, per deck. */
  newSeenToday: Map<string, Set<string>>;
  /** Review-state answers today, per deck. */
  reviewsToday: Map<string, number>;
};

/**
 * One walk over the log: every deck's history, today's slice, today's distinct
 * new cards and today's review count. The daily maps are what the queue summary
 * needs; `byDeck` is kept for callers that want the raw history.
 */
export function indexReviews(log: readonly ReviewLogEntry[], now: number = Date.now()): ReviewIndex {
  const startOfToday = startOfLocalDay(now);
  const byDeck = new Map<string, ReviewLogEntry[]>();
  const todayByDeck = new Map<string, ReviewLogEntry[]>();
  const newSeenToday = new Map<string, Set<string>>();
  const reviewsToday = new Map<string, number>();

  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const entry of log) {
    push(byDeck, entry.deckId, entry);
    if (entry.reviewedAt < startOfToday) continue;
    push(todayByDeck, entry.deckId, entry);
    if (entry.cardWasNew) {
      const seen = newSeenToday.get(entry.deckId);
      if (seen) seen.add(entry.cardId);
      else newSeenToday.set(entry.deckId, new Set([entry.cardId]));
    }
    if (reviewStateOf(entry) === 'Review') {
      reviewsToday.set(entry.deckId, (reviewsToday.get(entry.deckId) ?? 0) + 1);
    }
  }

  return { byDeck, todayByDeck, newSeenToday, reviewsToday };
}

/**
 * The queue's totals without building or sorting the arrays.
 *
 * `buildStudyQueue` returns ordered card arrays because a session needs the
 * cards themselves; Home only needs their number and split. The arithmetic is
 * the same, in the same order of rules — see `library.test.ts` for the parity
 * contract across presets, caps and learning states.
 */
export function summarizeQueue(
  deck: Deck,
  cards: readonly Flashcard[],
  today: {
    newSeenToday: ReadonlySet<string> | undefined;
    reviewsToday: number | undefined;
  },
  now: number = Date.now()
): Pick<DeckSummary, 'cardCount' | 'total' | 'studiedCount' | 'progress' | 'newCount' | 'learningCount' | 'reviewCount'> {
  const cardCount = cards.length;

  if (deck.algorithmPreset === 'fast') {
    const studiedCount = countStudied(cards);
    return {
      cardCount,
      total: cardCount,
      studiedCount,
      // One rule for every preset: the studied share is the cards that carry a
      // review over all cards. Fast repetition changes what a session offers,
      // never how much of the deck has been studied — and the folder and
      // library totals are built from the same `studiedCount`.
      progress: roundShare(studiedCount, cardCount),
      newCount: cardCount,
      learningCount: 0,
      reviewCount: 0,
    };
  }

  let newStates = 0;
  let learningDue = 0;
  let reviewDue = 0;
  let studied = 0;

  for (const card of cards) {
    if (card.fsrs.last_review != null) studied += 1;
    const state = card.fsrs.state;
    if (state === 'New') {
      newStates += 1;
      continue;
    }
    if (state === 'Learning' || state === 'Relearning') {
      if (new Date(card.fsrs.due).getTime() <= now) learningDue += 1;
      continue;
    }
    if (state === 'Review' && new Date(card.fsrs.due).getTime() <= now) reviewDue += 1;
  }

  const remainingNew = Math.max(0, deck.newCardsPerDay - (today.newSeenToday?.size ?? 0));
  const remainingReviews = Math.max(0, deck.maxCardsPerDay - (today.reviewsToday ?? 0));
  const newCount = Math.min(newStates, remainingNew);
  const reviewCount = Math.min(reviewDue, remainingReviews);

  return {
    cardCount,
    total: newCount + learningDue + reviewCount,
    studiedCount: studied,
    progress: roundShare(studied, cardCount),
    newCount,
    learningCount: learningDue,
    reviewCount,
  };
}

function countStudied(cards: readonly Flashcard[]): number {
  let studied = 0;
  for (const card of cards) if (card.fsrs.last_review != null) studied += 1;
  return studied;
}

/** One folder's own totals: the decks filed directly in it, nothing recursive. */
function aggregateFolder(entries: readonly DeckSummary[]): FolderAggregate {
  let cards = 0;
  let studied = 0;
  let due = 0;
  let lastStudiedAt: number | null = null;
  for (const entry of entries) {
    cards += entry.cardCount;
    studied += entry.studiedCount;
    due += entry.total;
    if (
      entry.lastStudiedAt !== null &&
      (lastStudiedAt === null || entry.lastStudiedAt > lastStudiedAt)
    ) {
      lastStudiedAt = entry.lastStudiedAt;
    }
  }
  return {
    decks: entries.length,
    cards,
    studied,
    due,
    progress: roundShare(studied, cards),
    lastStudiedAt,
  };
}

export type BuildLibraryOptions = {
  now?: number;
};

/**
 * The whole shelf, once per relevant data change.
 *
 * `cardsByDeck`, `decks`, `folders` and the review log are the only inputs;
 * nothing here sorts a card collection. Archived decks are indexed only as
 * archive rows, so no total can accidentally include them.
 */
export function buildLibraryIndex(
  decks: readonly Deck[],
  folders: readonly DeckFolder[],
  cardsByDeck: Readonly<Record<string, readonly Flashcard[]>>,
  reviewLog: readonly ReviewLogEntry[],
  options: BuildLibraryOptions = {}
): LibraryIndex {
  const now = options.now ?? Date.now();
  const reviews = indexReviews(reviewLog, now);
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

  const entries: DeckSummary[] = [];
  const byDeckId = new Map<string, DeckSummary>();
  const byFolderId = new Map<string, DeckSummary[]>();
  const archived: { deck: Deck; cards: number }[] = [];

  for (const deck of decks) {
    const cards = cardsByDeck[deck.id] ?? [];
    if (deck.archivedAt) {
      archived.push({ deck, cards: cards.length });
      continue;
    }
    const summary = summarizeQueue(
      deck,
      cards,
      {
        newSeenToday: reviews.newSeenToday.get(deck.id),
        reviewsToday: reviews.reviewsToday.get(deck.id),
      },
      now
    );
    const history = reviews.byDeck.get(deck.id);
    let lastStudiedAt: number | null = null;
    if (history) {
      for (const review of history) {
        if (lastStudiedAt === null || review.reviewedAt > lastStudiedAt) {
          lastStudiedAt = review.reviewedAt;
        }
      }
    }
    const entry: DeckSummary = { deck, ...summary, lastStudiedAt };
    entries.push(entry);
    byDeckId.set(deck.id, entry);
    const folderId = deck.folderId;
    if (folderId && foldersById.has(folderId)) {
      const list = byFolderId.get(folderId);
      if (list) list.push(entry);
      else byFolderId.set(folderId, [entry]);
    }
  }

  const unfiled = entries.filter((entry) => {
    const folderId = entry.deck.folderId;
    return !folderId || !foldersById.has(folderId);
  });

  // Folders are one flat level, so a folder's totals are only its own decks.
  const aggregates = new Map<string, FolderAggregate>();
  for (const folder of folders) {
    aggregates.set(folder.id, aggregateFolder(byFolderId.get(folder.id) ?? []));
  }

  let due = 0;
  let cards = 0;
  let studied = 0;
  let dueDecks = 0;
  let caughtUpDecks = 0;
  for (const entry of entries) {
    due += entry.total;
    cards += entry.cardCount;
    studied += entry.studiedCount;
    if (entry.total > 0) dueDecks += 1;
    else if (entry.cardCount > 0) caughtUpDecks += 1;
  }

  let caughtUpFolders = 0;
  for (const folder of folders) {
    const aggregate = aggregates.get(folder.id);
    if (!aggregate) continue;
    if (aggregate.decks > 0 && aggregate.due === 0) caughtUpFolders += 1;
  }

  return {
    entries,
    byDeckId,
    byFolderId,
    unfiled,
    archived,
    foldersById,
    aggregates,
    totals: {
      decks: entries.length,
      folders: folders.length,
      due,
      dueDecks,
      cards,
      studied,
      progress: roundShare(studied, cards),
      caughtUpDecks,
      caughtUpFolders,
      archived: archived.length,
    },
  };
}

/**
 * Search folding: case, Arabic/Persian letter variants and the zero-width
 * non-joiner all stop a match today. Folding them into one form means a learner
 * typing «فارسی» finds «فارسی» whichever keyboard produced it.
 */
export function foldSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064A\u0649]/g, '\u06CC') // Arabic yeh / alef maksura → Persian yeh
    .replace(/\u0643/g, '\u06A9') // Arabic kaf → Persian kaf
    .replace(/[\u200B-\u200F\uFEFF]/g, ' ') // ZWNJ / ZWJ / marks → space
    .replace(/[\u064B-\u065F\u0670]/g, '') // harakat
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when every whitespace-separated term of the folded query appears. */
export function matchesSearch(name: string, foldedQuery: string): boolean {
  if (!foldedQuery) return true;
  const folded = foldSearch(name);
  const compact = (text: string) => text.replace(/\s+/g, '');
  // A learner may type «کارت‌ها» or «کارتها», or split a two-word name either
  // way: a joined match is accepted as well as the per-term one.
  if (compact(folded).includes(compact(foldedQuery))) return true;
  return foldedQuery.split(' ').every((term) => folded.includes(term));
}

/**
 * A parity helper: the queue a summary describes, for tests and for callers
 * that need the real card arrays (a session). Not used by the index itself.
 */
export function queueFromSummary(
  deck: Deck,
  cards: readonly Flashcard[],
  reviewLog: readonly ReviewLogEntry[],
  now: number = Date.now()
): StudyQueue {
  return buildStudyQueue(deck, cards as Flashcard[], reviewLog as ReviewLogEntry[], now);
}
