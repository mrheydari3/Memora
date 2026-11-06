/**
 * Engine: scoping, totals, cache invalidation and calendar correctness.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntelligence,
  clearIntelligenceCache,
  reportRangeLabel,
} from '../core/engine';
import { normalizeReviewLog } from '../core/normalize';
import { computePerformance } from '../analysis/metrics';
import { addDays, calendarDaysBetween, eachDay, startOfDay } from '../core/dates';
import { RANGE_OPTIONS } from '../core/constants';
import {
  at,
  localDay,
  makeCard,
  makeDeck,
  makeReview,
  NOW,
} from './fixtures';
import type { Deck, Flashcard, Rating, ReviewLogEntry } from '../../types';

const deckA = makeDeck({ id: 'deck-a', name: 'Arabic' });
const deckB = makeDeck({ id: 'deck-b', name: 'Biology', algorithmPreset: 'general' });
const deckOld = makeDeck({ id: 'deck-old', name: 'Old', archivedAt: NOW - 86_400_000 });

const cardsA: Flashcard[] = [
  makeCard({
    id: 'a1',
    deckId: 'deck-a',
    state: 'Review',
    stability: 10,
    lastReviewDaysAgo: 2,
    dueInDays: 3,
  }),
  makeCard({
    id: 'a2',
    deckId: 'deck-a',
    state: 'Review',
    stability: 4,
    lastReviewDaysAgo: 1,
    dueInDays: -1,
    lapses: 2,
  }),
  makeCard({ id: 'a3', deckId: 'deck-a', state: 'New' }),
  makeCard({ id: 'a4', deckId: 'deck-a', state: 'New' }),
];
const cardsB: Flashcard[] = [
  makeCard({
    id: 'b1',
    deckId: 'deck-b',
    state: 'Review',
    stability: 3,
    lastReviewDaysAgo: 1,
    dueInDays: 2,
  }),
  makeCard({ id: 'b2', deckId: 'deck-b', state: 'New' }),
];
const cardsOld: Flashcard[] = [makeCard({ id: 'o1', deckId: 'deck-old' })];

const validReviews: ReviewLogEntry[] = [
  ...Array.from({ length: 12 }, (_, index) =>
    makeReview({
      cardId: `a-${index % 4}`,
      deckId: 'deck-a',
      rating: (index % 4 === 0 ? 1 : 3) as Rating,
      reviewedAt: at(-index - 1, 9, index),
    })
  ),
  ...Array.from({ length: 3 }, (_, index) =>
    makeReview({
      cardId: `b-${index % 2}`,
      deckId: 'deck-b',
      reviewedAt: at(-index - 1, 14, index),
    })
  ),
  ...Array.from({ length: 2 }, (_, index) =>
    makeReview({
      cardId: `o-${index}`,
      deckId: 'deck-old',
      reviewedAt: at(-index - 1, 16, index),
    })
  ),
];

const dataQualityExtras: ReviewLogEntry[] = [
  { ...validReviews[0] }, // duplicate
  makeReview({
    cardId: 'bad-rating',
    rating: 9 as unknown as Rating,
    reviewedAt: at(-1, 8),
  }),
  makeReview({ cardId: 'future', reviewedAt: NOW + 60 * 60 * 1000 }),
];

const input = {
  decks: [deckA, deckB, deckOld],
  cardsByDeck: {
    'deck-a': cardsA,
    'deck-b': cardsB,
    'deck-old': cardsOld,
  },
  reviewLog: [...validReviews, ...dataQualityExtras],
  now: NOW,
  rangeDays: 30,
};

test('the report excludes archived decks by default and counts the exclusion', () => {
  clearIntelligenceCache();
  const report = buildIntelligence(input);

  assert.equal(report.range.days, 30);
  assert.equal(report.overview.totalReviews, 15); // 12 + 3, archived removed
  assert.equal(report.coverage.activeDecks, 2);
  assert.equal(report.coverage.archivedDecks, 1);
  assert.equal(report.coverage.archivedReviewsExcluded, 2);
  assert.equal(report.decks.decks.length, 2);
  assert.equal(report.decks.excluded.archived, 1);
  assert.equal(report.memory.coverage.fsrsDecks, 1);
  assert.equal(report.memory.coverage.nonFsrsDecks, 1);
  assert.equal(report.memory.coverage.excludedCards, 2);
  assert.equal(report.coverage.orphanReviews, 0);
});

test('data quality reports every raw record exactly once', () => {
  clearIntelligenceCache();
  const report = buildIntelligence(input);

  assert.equal(report.dataQuality.rawCount, 20);
  assert.equal(report.dataQuality.usableCount, 17);
  assert.equal(report.dataQuality.excludedCount, 3);
  const kinds = report.dataQuality.issues.map((issue) => issue.kind).sort();
  assert.deepEqual(kinds, ['duplicate', 'future_timestamp', 'invalid_rating']);
});

test('overview totals agree with the underlying reviews', () => {
  clearIntelligenceCache();
  const report = buildIntelligence(input);

  assert.equal(report.overview.cards, 6); // 4 + 2 active
  assert.equal(report.overview.reviewedCards, 6); // a-0…3 and b-0…1
  assert.equal(report.overview.deckCount, 2);
  assert.equal(report.overview.todayReviews, 0);
  assert.equal(report.overview.weeklyReviews, 9); // last 7 days of active reviews
  assert.equal(report.overview.monthlyReviews, 15);
  assert.equal(report.overview.studyTimeMs, 15 * 5000);
});

test('reports answer fixed windows independently of the selected range', () => {
  clearIntelligenceCache();
  const report = buildIntelligence({ ...input, rangeDays: 7 });

  assert.equal(report.reports.daily.days, 1);
  assert.equal(report.reports.daily.reviews, 0);
  assert.equal(report.reports.weekly.reviews, 9);
  assert.equal(report.reports.monthly.reviews, 15);
  assert.equal(report.reports.monthly.activeDays, 12);
  assert.equal(report.reports.monthly.topDeck?.deckId, 'deck-a');
});

test('archived decks can be included explicitly', () => {
  clearIntelligenceCache();
  const report = buildIntelligence({ ...input, includeArchivedDecks: true });

  assert.equal(report.overview.totalReviews, 17);
  assert.equal(report.coverage.activeDecks, 3);
  assert.equal(report.coverage.archivedDecks, 0);
  assert.equal(report.coverage.archivedReviewsExcluded, 0);
  assert.equal(report.decks.decks.length, 3);
});

test('the cache returns the same report until something changes', () => {
  clearIntelligenceCache();
  const first = buildIntelligence(input);
  const second = buildIntelligence(input);
  assert.equal(second, first, 'an unchanged input must reuse the report');

  const extra = makeReview({ cardId: 'a3', reviewedAt: at(0, 11) });
  const changed = buildIntelligence({ ...input, reviewLog: [...input.reviewLog, extra] });
  assert.notEqual(changed, first);
  assert.equal(changed.overview.totalReviews, 16);

  clearIntelligenceCache();
  const cleared = buildIntelligence(input);
  assert.notEqual(cleared, first);
  assert.equal(cleared.overview.totalReviews, 15);
});

test('range length is clamped and the option list is honoured', () => {
  clearIntelligenceCache();
  assert.equal(buildIntelligence({ ...input, rangeDays: 0 }).range.days, 1);
  clearIntelligenceCache();
  assert.equal(buildIntelligence({ ...input, rangeDays: 999 }).range.days, 365);
  assert.deepEqual([...RANGE_OPTIONS], [7, 30, 90]);
  assert.match(reportRangeLabel(buildIntelligence(input).range), / – /);
});

test('a review just before midnight is yesterday, not today', () => {
  const midnight = localDay(0);
  const reviews = [
    makeReview({ cardId: 'late', reviewedAt: midnight - 60_000 }), // 23:59 yesterday
    makeReview({ cardId: 'early', reviewedAt: midnight + 60_000 }), // 00:01 today
  ];
  const normalized = normalizeReviewLog(reviews, [deckA], NOW);
  const performance = computePerformance(
    normalized.reviews,
    { days: 2, start: addDays(midnight, -1), end: midnight, label: 'Last 2 days' },
    NOW
  );

  assert.equal(performance.volume.today, 1);
  assert.equal(performance.volume.yesterday, 1);
  assert.equal(performance.totals.reviews, 2);
  assert.equal(performance.activity.points.length, 2);
});

test('calendar arithmetic survives a DST transition', () => {
  const spring = startOfDay(new Date(2026, 2, 7, 12).getTime());
  const autumn = startOfDay(new Date(2026, 10, 1, 12).getTime());

  for (const origin of [spring, autumn]) {
    assert.equal(calendarDaysBetween(origin, addDays(origin, 2)), 2);
    assert.equal(eachDay(origin, addDays(origin, 2)).length, 3);
    assert.equal(calendarDaysBetween(origin, addDays(origin, 400)), 400);
  }

  const transitionDay = addDays(spring, 1);
  const late = new Date(transitionDay);
  late.setHours(23, 59, 0, 0);
  const normalized = normalizeReviewLog(
    [makeReview({ reviewedAt: late.getTime() })],
    [deckA],
    late.getTime() + 60_000
  );
  assert.equal(normalized.reviews[0].dayStart, transitionDay);
});

test('an empty library produces a complete, non-throwing report', () => {
  clearIntelligenceCache();
  const empty: {
    decks: Deck[];
    cardsByDeck: Record<string, Flashcard[]>;
    reviewLog: ReviewLogEntry[];
  } = { decks: [], cardsByDeck: {}, reviewLog: [] };
  const report = buildIntelligence({ ...empty, now: NOW });

  assert.equal(report.overview.totalReviews, 0);
  assert.equal(report.overview.successRate, null);
  assert.equal(report.overview.cards, 0);
  assert.equal(report.performance.status, 'empty');
  assert.equal(report.memory.status, 'empty');
  assert.equal(report.trends.status, 'empty');
  assert.equal(report.forecast.workload.status, 'empty');
  assert.equal(report.forecast.retention.status, 'empty');
  assert.equal(report.insights.status, 'empty');
  assert.equal(report.dataQuality.excludedCount, 0);
});
