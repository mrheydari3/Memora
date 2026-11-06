import type {
  Deck,
  DeckFolder,
  Flashcard,
  FSRSCardState,
  GameRecord,
  Rating,
  ReviewLogEntry,
  Settings,
} from './types';
import { FSRS_DEFAULTS } from './fsrs-params';

/**
 * Developer fixture — a deterministic test library.
 *
 * The shipped seed is one deck of 1,817 cards, which cannot exercise the shapes
 * the app actually has to survive: nested folders, a deck with no cards, an
 * overflow-prone name, RTL cards, overdue reviews and a review history long
 * enough for a streak. This module is the single source of that library, so the
 * `/dev` screen and any future test harness write exactly the same data.
 *
 * Everything is derived from the `now` argument, so two calls with the same
 * clock produce byte-identical output and a test can pin the date.
 */

/** The shipped deck's id, reused so the fixture opens the same routes. */
export const DEV_MAIN_DECK_ID = 'deck-german-a2b1';

export type DevLibrary = {
  decks: Deck[];
  folders: DeckFolder[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: ReviewLogEntry[];
  gameRecords: Record<string, GameRecord>;
  settings: Settings;
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

type CardOptions = {
  state?: FSRSCardState['state'];
  /** Offset from `now`, so a card can be overdue (negative) or future. */
  dueInMs?: number;
  stability?: number;
  difficulty?: number;
  reps?: number;
  lapses?: number;
  scheduledDays?: number;
  elapsedDays?: number;
  /** Offset from `now`; `null` means the card was never reviewed. */
  lastReviewInMs?: number | null;
  learningStep?: number;
  front?: string;
  frontDirection?: 'ltr' | 'rtl';
  back?: string;
  backDirection?: 'ltr' | 'rtl';
  example?: string;
};

function makeCard(
  deckId: string,
  index: number,
  now: number,
  options: CardOptions = {}
): Flashcard {
  return {
    id: `${deckId}-c${index}`,
    deckId,
    front: {
      text: options.front ?? `Wort ${index}`,
      direction: options.frontDirection ?? 'ltr',
    },
    back: {
      text: options.back ?? `واژهٔ ${index}`,
      direction: options.backDirection ?? 'rtl',
    },
    example: options.example ?? `Beispielsatz ${index}.`,
    createdAt: now - index * 1000,
    fsrs: {
      due: new Date(now + (options.dueInMs ?? 0)).toISOString(),
      stability: options.stability ?? 0,
      difficulty: options.difficulty ?? 0,
      elapsed_days: options.elapsedDays ?? 0,
      scheduled_days: options.scheduledDays ?? 0,
      reps: options.reps ?? 0,
      lapses: options.lapses ?? 0,
      state: options.state ?? 'New',
      last_review:
        options.lastReviewInMs === null || options.lastReviewInMs === undefined
          ? null
          : new Date(now + options.lastReviewInMs).toISOString(),
      learning_steps: options.learningStep ?? 0,
    },
  };
}

function makeDeck(id: string, name: string, now: number, overrides: Partial<Deck> = {}): Deck {
  return {
    id,
    name,
    icon: 'language',
    color: '#FFD54F',
    rating: 4.5,
    parentId: null,
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
    masteredIntervalMultiplier: 2.5,
    ...FSRS_DEFAULTS,
    createdAt: now - 5 * DAY,
    archivedAt: null,
    folderId: null,
    pinnedAt: null,
    ...overrides,
  };
}

export function buildDevLibrary(now: number = Date.now()): DevLibrary {
  const decks: Deck[] = [
    makeDeck(DEV_MAIN_DECK_ID, 'Schritt Plus Neu A2/B1', now, {
      description: 'German vocabulary with Persian translations',
      folderId: 'fold-de',
    }),
    makeDeck('deck-empty', 'Empty deck', now, {
      description: 'A deck with no cards, to check every empty state',
      icon: 'inbox',
      color: '#64B5F6',
    }),
    makeDeck('deck-archived', 'Archived deck', now, {
      description: 'Archived, so it must stay out of the library',
      icon: 'archive',
      color: '#90A4AE',
      archivedAt: now - 2 * DAY,
    }),
    makeDeck(
      'deck-longname',
      'Ein außerordentlich langer Deckname, der die Zeile sprengen könnte und geprüft werden muss',
      now,
      { icon: 'menu-book', color: '#CE93D8', folderId: 'fold-de' }
    ),
    makeDeck('deck-persian', 'فارسی — کارت‌های راست‌به‌چپ', now, {
      description: 'Persian front, English back',
      icon: 'translate',
      color: '#81C784',
    }),
    makeDeck('deck-due', 'Due today (review)', now, {
      description: 'Every card overdue, for the due counts',
      icon: 'schedule',
      color: '#EF5350',
      folderId: 'fold-travel',
      pinnedAt: now,
    }),
  ];

  const folders: DeckFolder[] = [
    {
      id: 'fold-lang',
      name: 'Languages',
      createdAt: now - 9 * DAY,
      icon: 'translate',
      color: '#FFD54F',
      parentId: null,
    },
    {
      id: 'fold-de',
      name: 'German',
      createdAt: now - 9 * DAY,
      icon: 'language',
      color: '#FFD54F',
      parentId: 'fold-lang',
    },
    {
      id: 'fold-travel',
      name: 'Travel',
      createdAt: now - 8 * DAY,
      icon: 'flight',
      color: '#4FC3F7',
      parentId: null,
      pinnedAt: now,
    },
    {
      id: 'fold-empty',
      name: 'Nothing here yet',
      createdAt: now - 7 * DAY,
      parentId: null,
    },
  ];

  const main = [
    ...Array.from({ length: 10 }, (_, i) => makeCard(DEV_MAIN_DECK_ID, i + 1, now)),
    ...Array.from({ length: 8 }, (_, i) =>
      makeCard(DEV_MAIN_DECK_ID, i + 11, now, {
        state: 'Review',
        dueInMs: -2 * DAY,
        stability: 6 + i,
        difficulty: 5.2,
        reps: 4,
        scheduledDays: 6,
        elapsedDays: 8,
        lastReviewInMs: -8 * DAY,
      })
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      makeCard(DEV_MAIN_DECK_ID, i + 19, now, {
        state: 'Learning',
        dueInMs: -HOUR,
        stability: 1.2,
        difficulty: 4.8,
        reps: 2,
        learningStep: 1,
        lastReviewInMs: -HOUR,
      })
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      makeCard(DEV_MAIN_DECK_ID, i + 24, now, {
        state: 'Relearning',
        dueInMs: -3 * HOUR,
        stability: 2.1,
        difficulty: 7.4,
        reps: 6,
        lapses: 2,
        learningStep: 1,
        elapsedDays: 4,
        lastReviewInMs: -3 * HOUR,
      })
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      makeCard(DEV_MAIN_DECK_ID, i + 27, now, {
        state: 'Review',
        dueInMs: 5 * DAY,
        stability: 21 + i,
        difficulty: 4.1,
        reps: 7,
        scheduledDays: 21,
        elapsedDays: 1,
        lastReviewInMs: -DAY,
      })
    ),
  ];

  const cardsByDeck: Record<string, Flashcard[]> = {
    [DEV_MAIN_DECK_ID]: main,
    'deck-empty': [],
    'deck-archived': Array.from({ length: 3 }, (_, i) => makeCard('deck-archived', i + 1, now)),
    'deck-longname': Array.from({ length: 4 }, (_, i) => makeCard('deck-longname', i + 1, now)),
    'deck-persian': Array.from({ length: 4 }, (_, i) =>
      makeCard('deck-persian', i + 1, now, {
        front: 'سلام دنیا — این یک متن فارسی طولانی برای آزمون راست‌به‌چپ است',
        frontDirection: 'rtl',
        back: 'Hello world',
        backDirection: 'ltr',
      })
    ),
    'deck-due': Array.from({ length: 6 }, (_, i) =>
      makeCard('deck-due', i + 1, now, {
        state: 'Review',
        dueInMs: -DAY,
        stability: 4 + i,
        difficulty: 6,
        reps: 3,
        scheduledDays: 4,
        elapsedDays: 2,
        lastReviewInMs: -2 * DAY,
      })
    ),
  };

  // Thirteen days of reviews, dense today, so the streak and the bar chart have
  // something real to draw.
  const reviewLog: ReviewLogEntry[] = [];
  for (let day = 12; day >= 0; day--) {
    const perDay = day === 0 ? 3 : (day % 4) + 1;
    for (let k = 0; k < perDay; k++) {
      reviewLog.push({
        cardId: main[(day + k) % main.length].id,
        deckId: DEV_MAIN_DECK_ID,
        rating: (((day + k) % 4) + 1) as Rating,
        reviewedAt: now - day * DAY - k * HOUR,
        elapsedMs: 3200 + ((day * 700 + k * 400) % 8000),
        cardWasNew: day > 9 && k === 0,
        stateBefore: day > 9 ? 'New' : 'Review',
      });
    }
  }

  const gameRecords: Record<string, GameRecord> = {
    [DEV_MAIN_DECK_ID]: {
      deckId: DEV_MAIN_DECK_ID,
      bestScore: 9,
      bestCombo: 6,
      plays: 4,
      lastPlayedAt: now - DAY,
    },
  };

  const settings: Settings = {
    ttsEnabled: true,
    ttsReadWholeCard: false,
    ttsAutoPlay: false,
    ttsFrontVoiceLang: 'de-DE',
    ttsBackVoiceLang: 'fa-IR',
    offlineCacheEnabled: false,
    pwaInstalled: false,
    soundEnabled: true,
    hapticsEnabled: true,
  };

  return { decks, folders, cardsByDeck, reviewLog, gameRecords, settings };
}
