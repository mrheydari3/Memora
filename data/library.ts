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
import { folderParentId } from './folders';

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
};

export type FolderAggregate = {
  /** Active decks anywhere in this folder's subtree. */
  decks: number;
  /** Active decks filed directly here. */
  directDecks: number;
  /** Folder children, for the header split. */
  nestedFolders: number;
  /** Cards across the subtree. */
  cards: number;
  /** Subtree cards that already carry a review. */
  studied: number;
  /** Cards the subtree's decks want today. */
  due: number;
  /** Studied share across the subtree, 0–1. */
  progress: number;
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
  /** Children by parent id; the top level is the empty-string key. */
  childrenByParent: Map<string, DeckFolder[]>;
  /** Every folder from the top level down to it, inclusive. */
  pathById: Map<string, DeckFolder[]>;
  aggregates: Map<string, FolderAggregate>;
  totals: LibraryTotals;
};

const EMPTY_AGGREGATE: FolderAggregate = {
  decks: 0,
  directDecks: 0,
  nestedFolders: 0,
  cards: 0,
  studied: 0,
  due: 0,
  progress: 0,
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

/**
 * Every folder's path, resolved once.
 *
 * A corrupt parent cycle must not hang: each chain stops when it meets an id it
 * has already visited, so the path is still returned (truncated) rather than
 * looping forever.
 */
export function buildFolderPaths(folders: readonly DeckFolder[]): Map<string, DeckFolder[]> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const paths = new Map<string, DeckFolder[]>();

  for (const folder of folders) {
    const chain: DeckFolder[] = [];
    const seen = new Set<string>();
    let current: DeckFolder | undefined = byId.get(folder.id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current);
      const parentId = folderParentId(current);
      current = parentId ? byId.get(parentId) : undefined;
    }
    paths.set(folder.id, chain.reverse());
  }

  return paths;
}

/**
 * Bottom-up subtree totals.
 *
 * Children are visited once, and each folder folds its children's totals into
 * its own. A cycle is broken by refusing to re-enter a folder that is already
 * on the current stack, which keeps the walk linear and finite.
 */
export function buildFolderAggregates(
  folders: readonly DeckFolder[],
  directByFolder: ReadonlyMap<string, readonly DeckSummary[]>,
  childrenByParent: ReadonlyMap<string, DeckFolder[]>
): Map<string, FolderAggregate> {
  const aggregates = new Map<string, FolderAggregate>();
  const state = new Map<string, 1 | 2>();

  const resolve = (id: string): FolderAggregate => {
    const known = aggregates.get(id);
    if (known) return known;
    if (state.get(id) === 1) return EMPTY_AGGREGATE;
    state.set(id, 1);

    const direct = directByFolder.get(id) ?? [];
    let decks = direct.length;
    let cards = 0;
    let studied = 0;
    let due = 0;
    for (const entry of direct) {
      cards += entry.cardCount;
      studied += entry.studiedCount;
      due += entry.total;
    }

    const children = childrenByParent.get(id) ?? [];
    for (const child of children) {
      const nested = resolve(child.id);
      decks += nested.decks;
      cards += nested.cards;
      studied += nested.studied;
      due += nested.due;
    }

    const aggregate: FolderAggregate = {
      decks,
      directDecks: direct.length,
      nestedFolders: children.length,
      cards,
      studied,
      due,
      progress: roundShare(studied, cards),
    };
    aggregates.set(id, aggregate);
    state.set(id, 2);
    return aggregate;
  };

  for (const folder of folders) resolve(folder.id);
  return aggregates;
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
  const pathById = buildFolderPaths(folders);

  const childrenByParent = new Map<string, DeckFolder[]>();
  for (const folder of folders) {
    const key = folderParentId(folder) ?? '';
    const siblings = childrenByParent.get(key);
    if (siblings) siblings.push(folder);
    else childrenByParent.set(key, [folder]);
  }

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
    const entry: DeckSummary = { deck, ...summary };
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

  const aggregates = buildFolderAggregates(folders, byFolderId, childrenByParent);

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
    childrenByParent,
    pathById,
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

/** Children of a folder, or the top level when `parentId` is null. */
export function childFoldersOf(
  index: Pick<LibraryIndex, 'childrenByParent'>,
  parentId: string | null
): DeckFolder[] {
  return index.childrenByParent.get(parentId ?? '') ?? [];
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
