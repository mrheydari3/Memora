/**
 * Deterministic fixtures for the intelligence tests.
 *
 * `NOW` is local noon, so a test can place a review at 23:59 or 00:01 without
 * landing on a DST edge by accident. Every date is built with local calendar
 * arithmetic, matching how the app records reviews.
 */

import type {
  Deck,
  Flashcard,
  FSRSCardState,
  FSRSLogSnapshot,
  FSRSState,
  Rating,
  ReviewLogEntry,
} from '../../types';
import { FSRS_DEFAULTS } from '../../fsrs-params';
import { addDays, startOfDay } from '../core/dates';
import type { AnalyticsRange } from '../core/types';

export const NOW: number = new Date(2026, 2, 15, 12, 0, 0, 0).getTime();

export function localDay(dayOffset: number, now: number = NOW): number {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function at(dayOffset: number, hour = 10, minute = 0, now: number = NOW): number {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function rangeFor(days = 30, now: number = NOW): AnalyticsRange {
  const end = startOfDay(now);
  const start = addDays(end, -(days - 1));
  return { days, start, end, label: `Last ${days} days` };
}

export function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-a',
    name: 'Deck A',
    icon: 'language',
    color: '#ffffff', // design-ignore — test fixture, never rendered
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: false,
    learningSteps: ['12 hours'],
    masteredIntervalMultiplier: 2.5,
    ...FSRS_DEFAULTS,
    requestRetention: 0.9,
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  };
}

type CardOptions = {
  id?: string;
  deckId?: string;
  state?: FSRSState;
  front?: string;
  dueInDays?: number;
  stability?: number;
  difficulty?: number;
  lapses?: number;
  reps?: number;
  lastReviewDaysAgo?: number | null;
  scheduledDays?: number;
};

export function makeCard(options: CardOptions = {}): Flashcard {
  const {
    id = 'card-1',
    deckId = 'deck-a',
    state = 'New',
    front = 'Wort',
    dueInDays = 0,
    lapses = 0,
    reps = state === 'New' ? 0 : 1,
    lastReviewDaysAgo = state === 'New' ? null : 1,
    scheduledDays = 5,
  } = options;
  const stability = options.stability ?? (state === 'New' ? 0 : 5);
  const difficulty = options.difficulty ?? (state === 'New' ? 0 : 5);

  const fsrs: FSRSCardState = {
    due: new Date(at(dueInDays, 12)).toISOString(),
    stability,
    difficulty,
    elapsed_days: 0,
    scheduled_days: scheduledDays,
    reps,
    lapses,
    state,
    last_review:
      lastReviewDaysAgo === null ? null : new Date(at(-lastReviewDaysAgo, 12)).toISOString(),
    learning_steps: 0,
  };

  return {
    id,
    deckId,
    front: { text: front, direction: 'ltr' },
    back: { text: `${front} back`, direction: 'ltr' },
    createdAt: 0,
    fsrs,
  };
}

type ReviewOptions = {
  cardId?: string;
  deckId?: string;
  rating?: Rating;
  reviewedAt?: number;
  elapsedMs?: number;
  cardWasNew?: boolean;
  stateBefore?: FSRSState;
  withMemory?: boolean;
};

export function makeReview(options: ReviewOptions = {}): ReviewLogEntry {
  const {
    cardId = 'card-1',
    deckId = 'deck-a',
    rating = 3,
    reviewedAt = at(0, 10),
    elapsedMs = 5000,
    cardWasNew = false,
    stateBefore,
    withMemory = false,
  } = options;

  const snapshot: FSRSLogSnapshot | undefined =
    withMemory || stateBefore
      ? {
          rating,
          state: stateBefore ?? 'Review',
          due: new Date(reviewedAt - 86_400_000).toISOString(),
          stability: 5,
          difficulty: 5,
          elapsedDays: 1,
          lastElapsedDays: 1,
          scheduledDays: 5,
          learningStep: 0,
          review: reviewedAt,
        }
      : undefined;

  return {
    cardId,
    deckId,
    rating,
    reviewedAt,
    elapsedMs,
    cardWasNew,
    ...(stateBefore ? { stateBefore } : {}),
    ...(snapshot ? { fsrs: snapshot } : {}),
  };
}

/** `count` reviews spread over `days`, each with a unique instant and card id. */
export function spreadReviews(options: {
  count: number;
  days?: number;
  rating?: Rating | ((index: number) => Rating);
  deckId?: string;
  dayOffsetStart?: number;
  stateBefore?: FSRSState;
  elapsedMs?: number;
}): ReviewLogEntry[] {
  const {
    count,
    days = count,
    rating = 3,
    deckId = 'deck-a',
    dayOffsetStart = -(count - 1),
    stateBefore,
    elapsedMs,
  } = options;

  return Array.from({ length: count }, (_, index) => {
    const dayOffset = dayOffsetStart + Math.floor((index * days) / count);
    const minute = index % 60;
    return makeReview({
      cardId: `card-${index}`,
      deckId,
      rating: typeof rating === 'function' ? rating(index) : rating,
      reviewedAt: at(dayOffset, 9, minute),
      stateBefore,
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    });
  });
}
