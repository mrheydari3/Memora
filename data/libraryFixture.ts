/**
 * Deterministic scale fixtures for the library.
 *
 * The shipped dev fixture is six decks: enough to exercise states, not enough
 * to tell whether Home scales. These builders create the two libraries the
 * brief asks for — a medium one and a stress one — with the shapes that break
 * naive renderers: deep nesting, very long names, Persian/RTL text, empty
 * decks, archived decks, pinned decks and a long review history.
 *
 * Everything is derived from a seeded PRNG, so two calls with the same clock
 * are byte-identical. Nothing here is shipped to users; the module is imported
 * by tests and by the scale harness only.
 */

import type {
  Deck,
  DeckFolder,
  Flashcard,
  FSRSState,
  Rating,
  ReviewLogEntry,
} from './types';
import { FSRS_DEFAULTS } from './fsrs-params';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export type ScaleSpec = {
  decks: number;
  folders: number;
  cardsPerDeck: number;
  reviewsPerDeck: number;
  seed: number;
};

export type ScaleLibrary = {
  decks: Deck[];
  folders: DeckFolder[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: ReviewLogEntry[];
};

/** 100 decks · 20 folders · 5,000 cards · 20,000 reviews. */
export const MEDIUM_SCALE: ScaleSpec = {
  decks: 100,
  folders: 20,
  cardsPerDeck: 50,
  reviewsPerDeck: 200,
  seed: 0x5eed0001,
};

/** 300 decks · 60 folders · 15,000 cards · 75,000 reviews. */
export const STRESS_SCALE: ScaleSpec = {
  decks: 300,
  folders: 60,
  cardsPerDeck: 50,
  reviewsPerDeck: 250,
  seed: 0x5eed0002,
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (at: number) => new Date(at).toISOString();

const LONG_NAME =
  'Ein außerordentlich langer Deckname, der die Zeile sprengen könnte und auf jeder Breite geprüft werden muss';

const PERSIAN_NAME = 'فارسی — کارت‌های راست‌به‌چپ برای آزمون چیدمان';

export function buildScaleLibrary(
  spec: ScaleSpec,
  now: number = Date.now()
): ScaleLibrary {
  const random = mulberry32(spec.seed);
  const folders: DeckFolder[] = [];
  const roots = Math.max(1, Math.ceil(spec.folders / 6));

  for (let i = 0; i < spec.folders; i += 1) {
    // Earlier folders only, so the tree is acyclic by construction. Every ninth
    // folder hangs off the one before it, which produces deep chains quickly.
    const parentIndex = i < roots ? null : i % 9 === 0 ? i - 1 : Math.floor(random() * i);
    folders.push({
      id: `fold-${i}`,
      name:
        i % 5 === 0
          ? `${PERSIAN_NAME} ${i}`
          : i % 7 === 0
            ? `${LONG_NAME} ${i}`
            : `Folder ${i + 1}`,
      createdAt: now - (spec.folders - i) * DAY,
      icon: i % 3 === 0 ? 'folder' : 'translate',
      color: '#FFD54F',
      parentId: parentIndex === null ? null : `fold-${parentIndex}`,
      pinnedAt: i % 17 === 0 ? now : null,
    });
  }

  const decks: Deck[] = [];
  const cardsByDeck: Record<string, Flashcard[]> = {};

  // Empty decks are part of the shape, but the fixture's card total must stay
  // exactly `decks × cardsPerDeck`. The cards an empty deck would have carried
  // are spread over the non-empty decks instead of being dropped.
  const emptyCount = Math.floor((spec.decks - 1) / 13) + 1;
  const nonEmptyCount = Math.max(0, spec.decks - emptyCount);
  const deficit = emptyCount * spec.cardsPerDeck;
  const extraEach = nonEmptyCount > 0 ? Math.floor(deficit / nonEmptyCount) : 0;
  let extraRemainder = nonEmptyCount > 0 ? deficit - extraEach * nonEmptyCount : 0;

  for (let i = 0; i < spec.decks; i += 1) {
    const archived = i % 11 === 0;
    const empty = i % 13 === 0;
    const pinned = i % 17 === 0;
    const folderIndex = spec.folders > 0 ? i % spec.folders : null;
    const deck: Deck = {
      id: `deck-${i}`,
      name:
        i % 7 === 0
          ? `${LONG_NAME} ${i}`
          : i % 5 === 0
            ? `${PERSIAN_NAME} ${i}`
            : `Deck ${i + 1}`,
      icon: i % 4 === 0 ? 'menu-book' : 'language',
      color: i % 2 === 0 ? '#FFD54F' : '#64B5F6',
      algorithmPreset: i % 10 === 0 ? 'fast' : 'fsrs',
      newCardsPerDay: i % 9 === 0 ? 5 : 20,
      maxCardsPerDay: i % 6 === 0 ? 40 : 80,
      shuffleCards: true,
      adaptiveOrdering: true,
      learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
      masteredIntervalMultiplier: 2.5,
      ...FSRS_DEFAULTS,
      createdAt: now - (spec.decks - i) * HOUR,
      archivedAt: archived ? now - DAY : null,
      folderId: folderIndex === null ? null : `fold-${folderIndex}`,
      pinnedAt: pinned ? now : null,
    };
    decks.push(deck);
    cardsByDeck[deck.id] = [];

    if (empty) continue;

    const cardCount = spec.cardsPerDeck + extraEach + (extraRemainder-- > 0 ? 1 : 0);
    for (let c = 0; c < cardCount; c += 1) {
      const roll = random();
      const state: FSRSState =
        roll < 0.4 ? 'New' : roll < 0.5 ? 'Learning' : roll < 0.6 ? 'Relearning' : 'Review';
      const duePast = state === 'New' ? true : random() < 0.55;
      const reviewed = state !== 'New' && random() < 0.9;
      cardsByDeck[deck.id].push({
        id: `deck-${i}-c${c}`,
        deckId: deck.id,
        front: {
          text: i % 5 === 0 ? 'سلام دنیا — متن فارسی برای آزمون راست‌به‌چپ' : `Wort ${i}/${c}`,
          direction: i % 5 === 0 ? 'rtl' : 'ltr',
        },
        back: {
          text: i % 5 === 0 ? `Meaning ${i}/${c}` : `واژهٔ ${i}/${c}`,
          direction: i % 5 === 0 ? 'ltr' : 'rtl',
        },
        createdAt: now - c * 1000,
        fsrs: {
          due: iso(now + (duePast ? -1 : 1) * Math.floor(random() * 5) * DAY),
          stability: state === 'New' ? 0 : 1 + random() * 40,
          difficulty: state === 'New' ? 0 : 3 + random() * 6,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: state === 'New' ? 0 : 1 + Math.floor(random() * 8),
          lapses: 0,
          state,
          last_review: reviewed ? iso(now - Math.floor(random() * 30) * DAY) : null,
          learning_steps: state === 'Learning' || state === 'Relearning' ? 1 : 0,
        },
      });
    }
  }

  const reviewLog: ReviewLogEntry[] = [];
  for (let i = 0; i < spec.decks; i += 1) {
    const deck = decks[i];
    const cards = cardsByDeck[deck.id];
    for (let r = 0; r < spec.reviewsPerDeck; r += 1) {
      const today = r % 25 === 0;
      const reviewedAt = today
        ? now - (r % 12) * HOUR
        : now - Math.floor(random() * 120) * DAY - Math.floor(random() * 22) * HOUR;
      const card = cards.length > 0 ? cards[r % cards.length] : null;
      reviewLog.push({
        cardId: card?.id ?? `${deck.id}-c0`,
        deckId: deck.id,
        rating: (((r + i) % 4) + 1) as Rating,
        reviewedAt,
        elapsedMs: 2000 + ((i * 37 + r * 13) % 9000),
        cardWasNew: r % 25 === 0 && random() < 0.5,
        stateBefore: today ? 'New' : 'Review',
      });
    }
  }

  return { decks, folders, cardsByDeck, reviewLog };
}
