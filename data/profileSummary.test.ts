/**
 * Profile summary tests — fixed local clock, normalized review scope, and the
 * exact 30-day preview that Profile will show.
 *
 * These tests deliberately use the intelligence fixtures so the summary and the
 * full report are compared against the same review history.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAchievementFacts,
  buildLearningSummary,
  buildProfileBundle,
} from './profileSummary';
import { buildIntelligence, clearIntelligenceCache } from './intelligence/core/engine';
import { addDays, startOfDay } from './intelligence/core/dates';
import {
  at,
  makeDeck,
  makeReview,
  NOW,
  spreadReviews,
} from './intelligence/tests/fixtures';
import type { Rating } from './types';

const deck = makeDeck();

function summaryFor(
  reviewLog: ReturnType<typeof makeReview>[],
  decks = [deck],
  rangeDays = 30
) {
  return buildLearningSummary({ decks, reviewLog, now: NOW, rangeDays });
}

test('an empty history is level 1 with a complete zeroed 30-day series', () => {
  const summary = summaryFor([]);

  assert.deepEqual(summary.allTime, {
    reviews: 0,
    activeDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpProgress: 0,
  });
  assert.equal(summary.range.range.days, 30);
  assert.equal(summary.range.range.end, startOfDay(NOW));
  assert.equal(summary.range.range.start, addDays(startOfDay(NOW), -29));
  assert.equal(summary.range.range.label, 'Last 30 days');
  assert.equal(summary.range.reviews, 0);
  assert.equal(summary.range.activeDays, 0);
  assert.equal(summary.range.recall.status, 'empty');
  assert.equal(summary.range.recall.successRate, null);
  assert.equal(summary.range.activity.points.length, 30);
  assert.equal(summary.range.activity.total, 0);
  assert.deepEqual(summary.dataQuality, {
    rawCount: 0,
    usableCount: 0,
    excludedCount: 0,
    orphanReviews: 0,
    archivedReviewsExcluded: 0,
  });
});

test('the 30-day window is inclusive, while all-time values include older reviews', () => {
  const reviews = [
    makeReview({ cardId: 'today', reviewedAt: at(0, 9, 0) }),
    makeReview({ cardId: 'yesterday', reviewedAt: at(-1, 9, 0) }),
    makeReview({ cardId: 'day-29', reviewedAt: at(-29, 9, 0) }),
    makeReview({ cardId: 'day-30', reviewedAt: at(-30, 9, 0) }),
  ];
  const summary = summaryFor(reviews);

  assert.equal(summary.allTime.reviews, 4);
  assert.equal(summary.allTime.activeDays, 4);
  assert.equal(summary.range.reviews, 3);
  assert.equal(summary.range.activeDays, 3);
  assert.equal(summary.range.activity.points.length, 30);
  assert.equal(summary.range.activity.points[0].dayStart, summary.range.range.start);
  assert.equal(summary.range.activity.points.at(-1)?.dayStart, summary.range.range.end);
  assert.equal(summary.range.activity.points.at(-1)?.today, true);
  assert.equal(summary.allTime.currentStreak, 2);
  assert.equal(summary.allTime.longestStreak, 2);
});

test('recall stays hidden below ten rated reviews and appears at ten', () => {
  const nine = spreadReviews({ count: 9, days: 9 });
  const nineSummary = summaryFor(nine);

  assert.equal(nineSummary.range.recall.sampleSize, 9);
  assert.equal(nineSummary.range.recall.status, 'insufficient_data');
  assert.equal(nineSummary.range.recall.successRate, null);
  assert.equal(nineSummary.range.recall.fluentRate, null);

  const ten = spreadReviews({ count: 10, days: 10 });
  const tenSummary = summaryFor(ten);

  assert.equal(tenSummary.range.recall.sampleSize, 10);
  assert.equal(tenSummary.range.recall.status, 'ok');
  assert.equal(tenSummary.range.recall.successRate, 1);
});

test('archived decks are excluded and reported; orphan reviews remain in totals', () => {
  const archived = makeDeck({ id: 'archived', archivedAt: NOW - 1000 });
  const summary = summaryFor(
    [
      makeReview({ cardId: 'active', deckId: deck.id, reviewedAt: at(-1, 9, 0) }),
      makeReview({ cardId: 'archived', deckId: archived.id, reviewedAt: at(-1, 9, 1) }),
      makeReview({ cardId: 'orphan', deckId: 'deleted-deck', reviewedAt: at(-1, 9, 2) }),
    ],
    [deck, archived]
  );

  assert.equal(summary.allTime.reviews, 2);
  assert.equal(summary.range.reviews, 2);
  assert.equal(summary.dataQuality.rawCount, 3);
  assert.equal(summary.dataQuality.usableCount, 3);
  assert.equal(summary.dataQuality.archivedReviewsExcluded, 1);
  assert.equal(summary.dataQuality.orphanReviews, 1);
});

test('duplicates and invalid ratings are excluded without hiding the usable review', () => {
  const duplicate = makeReview({ cardId: 'duplicate', reviewedAt: at(-1, 9, 0) });
  const summary = summaryFor([
    duplicate,
    { ...duplicate },
    makeReview({
      cardId: 'invalid',
      rating: 5 as unknown as Rating,
      reviewedAt: at(-1, 9, 1),
    }),
  ]);

  assert.equal(summary.allTime.reviews, 1);
  assert.equal(summary.range.reviews, 1);
  assert.equal(summary.dataQuality.rawCount, 3);
  assert.equal(summary.dataQuality.usableCount, 1);
  assert.equal(summary.dataQuality.excludedCount, 2);
});

test('current streak counts yesterday when today has no review, and longest is independent', () => {
  const reviews = [
    makeReview({ cardId: 'yesterday', reviewedAt: at(-1, 9, 0) }),
    makeReview({ cardId: 'two-days-ago', reviewedAt: at(-2, 9, 0) }),
    makeReview({ cardId: 'older-1', reviewedAt: at(-10, 9, 0) }),
    makeReview({ cardId: 'older-2', reviewedAt: at(-11, 9, 0) }),
    makeReview({ cardId: 'older-3', reviewedAt: at(-12, 9, 0) }),
  ];
  const summary = summaryFor(reviews);

  assert.equal(summary.allTime.currentStreak, 2);
  assert.equal(summary.allTime.longestStreak, 3);
});

test('XP crosses the level boundary and uses the same 10/1,000 curve', () => {
  const summary = summaryFor(spreadReviews({ count: 100, days: 100 }));

  assert.equal(summary.allTime.reviews, 100);
  assert.equal(summary.allTime.xp, 1000);
  assert.equal(summary.allTime.level, 2);
  assert.equal(summary.allTime.xpIntoLevel, 0);
  assert.equal(summary.allTime.xpProgress, 0);
  assert.equal(summary.range.reviews, 30);
});

test('achievement facts are evidence-backed and do not invent quiz accuracy', () => {
  const reviews = spreadReviews({ count: 100, days: 100 });
  const facts = buildAchievementFacts({ decks: [deck], reviewLog: reviews, now: NOW });
  const byId = new Map(facts.map((fact) => [fact.id, fact]));

  assert.equal(byId.get('first-review')?.earned, true);
  assert.equal(byId.get('hundred-reviews')?.earned, true);
  assert.equal(byId.get('seven-day-streak')?.earned, true);
  assert.deepEqual(byId.get('seven-day-streak')?.progress, { current: 7, target: 7 });
  assert.equal(byId.get('night-owl')?.earned, false);
  assert.equal(byId.get('night-owl')?.available, true);
  assert.equal(byId.get('speed-demon')?.earned, false);
  assert.equal(byId.get('speed-demon')?.available, false);
  assert.equal(byId.get('speed-demon')?.progress, null);
  assert.match(byId.get('speed-demon')?.evidence ?? '', /not stored/i);
});

test('seven consecutive active days earn the streak badge', () => {
  const reviews = Array.from({ length: 7 }, (_, index) =>
    makeReview({
      cardId: `streak-${index}`,
      reviewedAt: at(-index, 9, index),
    })
  );
  const facts = buildAchievementFacts({ decks: [deck], reviewLog: reviews, now: NOW });
  const streak = facts.find((fact) => fact.id === 'seven-day-streak');

  assert.equal(streak?.earned, true);
  assert.deepEqual(streak?.progress, { current: 7, target: 7 });
});

test('Night Owl counts distinct cards in the 23:00–04:59 window', () => {
  const reviews = Array.from({ length: 20 }, (_, index) =>
    makeReview({
      cardId: `night-${index}`,
      reviewedAt: at(-index - 1, index % 2 === 0 ? 23 : 4, 59),
    })
  );
  const facts = buildAchievementFacts({ decks: [deck], reviewLog: reviews, now: NOW });
  const nightOwl = facts.find((fact) => fact.id === 'night-owl');

  assert.equal(nightOwl?.earned, true);
  assert.deepEqual(nightOwl?.progress, { current: 20, target: 20 });
  assert.match(nightOwl?.evidence ?? '', /20 cards/);
});

test('Profile bundle normalizes once and exposes the same summary and achievements', () => {
  const reviews = spreadReviews({ count: 100, days: 100 });
  const bundle = buildProfileBundle({ decks: [deck], reviewLog: reviews, now: NOW });
  const separate = buildLearningSummary({ decks: [deck], reviewLog: reviews, now: NOW });

  assert.deepEqual(bundle.summary, separate);
  assert.equal(bundle.achievements.find((fact) => fact.id === 'hundred-reviews')?.earned, true);
});

test('the summary agrees with the full intelligence report for the default range', () => {
  const reviews = spreadReviews({ count: 35, days: 40 });
  clearIntelligenceCache();
  const report = buildIntelligence({
    decks: [deck],
    cardsByDeck: {},
    reviewLog: reviews,
    now: NOW,
    rangeDays: 30,
  });
  const summary = summaryFor(reviews);

  assert.equal(summary.range.range.days, 30);
  assert.equal(summary.range.reviews, report.overview.totalReviews);
  assert.equal(summary.range.activeDays, report.performance.volume.activeDays);
  assert.equal(summary.range.recall.sampleSize, report.performance.recall.sampleSize);
  assert.equal(summary.range.recall.successRate, report.performance.recall.successRate);
  assert.equal(summary.allTime.currentStreak, report.overview.streak);
  assert.equal(summary.allTime.longestStreak, report.overview.longestStreak);
  assert.equal(summary.dataQuality.rawCount, report.dataQuality.rawCount);
  assert.equal(summary.dataQuality.usableCount, report.dataQuality.usableCount);
  assert.equal(summary.dataQuality.orphanReviews, report.coverage.orphanReviews);
});
