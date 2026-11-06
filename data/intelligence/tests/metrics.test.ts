/**
 * Performance metrics: rating semantics, rates, durations, daily averages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReviewLog } from '../core/normalize';
import { computeDuration, computePerformance, computeRecall, longestStreak } from '../analysis/metrics';
import { MIN_RECALL_SAMPLE } from '../core/constants';
import type { Rating } from '../../types';
import { at, makeDeck, makeReview, NOW, rangeFor } from './fixtures';

const decks = [makeDeck()];

function performanceFor(reviews: ReturnType<typeof makeReview>[], days = 30) {
  const normalized = normalizeReviewLog(reviews, decks, NOW);
  return computePerformance(normalized.reviews, rangeFor(days), NOW, normalized.reviews);
}

const close = (actual: number | null, expected: number, epsilon = 1e-9) => {
  assert.ok(actual !== null, 'value should not be null');
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
};

test('Hard is a successful recall with difficulty, never a failure', () => {
  const ratings: Rating[] = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4];
  const reviews = ratings.map((rating, index) =>
    makeReview({ cardId: `c${index}`, rating, reviewedAt: at(-(11 - index), 9) })
  );

  const performance = performanceFor(reviews);
  const recall = performance.recall;

  assert.equal(recall.sampleSize, 12);
  assert.deepEqual(recall.counts, { again: 3, hard: 3, good: 3, easy: 3 });
  close(recall.successRate, 0.75); // Hard + Good + Easy
  close(recall.fluentRate, 0.5); // Good + Easy
  close(recall.difficultRate, 0.25); // Hard alone
  close(recall.againRate, 0.25);
  assert.equal(recall.status, 'ok');
  assert.ok(recall.successInterval);
});

test('a deck rated only Hard reports 100% successful recall and no failures', () => {
  const reviews = Array.from({ length: MIN_RECALL_SAMPLE }, (_, index) =>
    makeReview({ cardId: `h${index}`, rating: 2, reviewedAt: at(-index, 9) })
  );
  const recall = computeRecall(normalizeReviewLog(reviews, decks, NOW).reviews);

  close(recall.successRate, 1);
  close(recall.againRate, 0);
  close(recall.difficultRate, 1);
});

test('below ten rated reviews no percentage is reported, but counts are exact', () => {
  const reviews = Array.from({ length: 4 }, (_, index) =>
    makeReview({ cardId: `g${index}`, rating: 3, reviewedAt: at(-index, 9) })
  );
  const recall = computeRecall(normalizeReviewLog(reviews, decks, NOW).reviews);

  assert.equal(recall.status, 'insufficient_data');
  assert.equal(recall.successRate, null);
  assert.equal(recall.fluentRate, null);
  assert.equal(recall.counts.good, 4);
  assert.equal(recall.confidence.level, 'insufficient');
});

test('an empty history is empty, not NaN', () => {
  const performance = computePerformance([], rangeFor(30), NOW);

  assert.equal(performance.status, 'empty');
  assert.equal(performance.volume.perCalendarDay, 0);
  assert.equal(performance.volume.perActiveDay, 0);
  assert.equal(performance.duration.status, 'empty');
  assert.equal(performance.duration.meanMs, null);
  assert.equal(performance.streak.current, 0);
  assert.equal(performance.activity.points.length, 30);
  assert.equal(performance.efficiency.successfulReviewsPerMinute, null);
});

test('average per calendar day includes zero-review days; per active day does not', () => {
  const reviews = Array.from({ length: 10 }, (_, index) =>
    makeReview({ cardId: `c${index}`, reviewedAt: at(0, 9, index) })
  );
  const performance = performanceFor(reviews, 30);

  close(performance.volume.perCalendarDay, 10 / 30);
  close(performance.volume.perActiveDay, 10);
  assert.equal(performance.volume.activeDays, 1);
  assert.equal(performance.volume.today, 10);
});

test('duration statistics use the median and p90 and ignore excluded records', () => {
  const reviews = Array.from({ length: 9 }, (_, index) =>
    makeReview({
      cardId: `d${index}`,
      reviewedAt: at(-index, 9),
      elapsedMs: (index + 1) * 1000,
    })
  );
  const durations = computeDuration(normalizeReviewLog(reviews, decks, NOW).reviews);

  assert.equal(durations.sampleSize, 9);
  close(durations.meanMs, 5000);
  close(durations.medianMs, 5000);
  close(durations.p90Ms, 8200); // linear interpolation at position 0.9 × 8
  close(durations.totalMs, 45_000);
});

test('a record with an invalid duration is counted as excluded, not dropped', () => {
  const reviews = [
    ...Array.from({ length: 5 }, (_, index) =>
      makeReview({ cardId: `x${index}`, reviewedAt: at(-index, 9), elapsedMs: 2000 })
    ),
    makeReview({ cardId: 'bad', reviewedAt: at(-6, 9), elapsedMs: -1 }),
  ];
  const normalized = normalizeReviewLog(reviews, decks, NOW);

  assert.equal(normalized.usableCount, 6);
  const durations = computeDuration(normalized.reviews);
  assert.equal(durations.sampleSize, 5);
  assert.equal(durations.excluded, 1);
});

test('the streak counts today and yesterday, and the longest run is independent', () => {
  const reviews = [
    makeReview({ cardId: 'today', reviewedAt: at(0, 9) }),
    makeReview({ cardId: 'yesterday', reviewedAt: at(-1, 9) }),
    makeReview({ cardId: 'older', reviewedAt: at(-3, 9) }),
  ];
  const performance = performanceFor(reviews, 30);

  assert.equal(performance.streak.current, 2);
  assert.equal(performance.streak.longest, 2);
  assert.equal(longestStreak([]), 0);
});

test('a single review is handled without inventing a rate', () => {
  const performance = performanceFor([makeReview({ cardId: 'one', reviewedAt: at(0, 9) })]);

  assert.equal(performance.totals.reviews, 1);
  assert.equal(performance.recall.sampleSize, 1);
  assert.equal(performance.recall.successRate, null);
  assert.equal(performance.recall.status, 'insufficient_data');
  close(performance.volume.perActiveDay, 1);
});

test('weekday and hour distributions account for every review', () => {
  const hours = [0, 5, 9, 13, 17, 21, 23];
  const reviews = hours.map((hour, index) =>
    makeReview({ cardId: `w${index}`, reviewedAt: at(-index, hour, 5) })
  );
  const performance = performanceFor(reviews, 14);

  assert.equal(performance.weekday.length, 7);
  assert.equal(
    performance.weekday.reduce((total, point) => total + point.reviews, 0),
    reviews.length
  );
  assert.equal(performance.hours.length, 6);
  assert.equal(
    performance.hours.reduce((total, point) => total + point.reviews, 0),
    reviews.length
  );
  // 23:00 belongs to the last bucket, 00:00 to the first.
  assert.equal(performance.hours[0].reviews, 1);
  assert.equal(performance.hours[5].reviews, 2);
});
