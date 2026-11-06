/**
 * Trend intelligence: half-window comparisons, gaps, zero days, anomalies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTrends } from '../analysis/trends';
import { normalizeReviewLog } from '../core/normalize';
import { at, makeDeck, makeReview, NOW, rangeFor, spreadReviews } from './fixtures';
import type { Rating, ReviewLogEntry } from '../../types';

const decks = [makeDeck()];

function trendsFor(reviews: ReviewLogEntry[], days = 30) {
  const normalized = normalizeReviewLog(reviews, decks, NOW);
  return analyzeTrends(normalized.reviews, rangeFor(days));
}

test('recall improving is reported only when both windows clear the floor', () => {
  const reviews = [
    ...spreadReviews({ count: 20, days: 15, rating: 1, dayOffsetStart: -29 }),
    ...spreadReviews({ count: 20, days: 15, rating: 3, dayOffsetStart: -14 }),
  ];
  const trends = trendsFor(reviews);

  assert.equal(trends.recall.direction, 'improving');
  assert.equal(trends.recall.from, 0);
  assert.equal(trends.recall.to, 1);
  assert.equal(trends.recall.sampleSize, 40);
  assert.match(trends.recall.note, /no longer overlap/);
});

test('recall declining is the mirror case', () => {
  const reviews = [
    ...spreadReviews({ count: 20, days: 15, rating: 3, dayOffsetStart: -29 }),
    ...spreadReviews({ count: 20, days: 15, rating: 1, dayOffsetStart: -14 }),
  ];
  assert.equal(trendsFor(reviews).recall.direction, 'declining');
});

test('identical windows are stable, not a story', () => {
  const reviews = [
    ...spreadReviews({ count: 20, days: 15, rating: 3, dayOffsetStart: -29 }),
    ...spreadReviews({ count: 20, days: 15, rating: 3, dayOffsetStart: -14 }),
  ];
  const recall = trendsFor(reviews).recall;
  assert.equal(recall.direction, 'stable');
  assert.equal(recall.change, 0);
});

test('ten reviews per window is not enough for a recall trend', () => {
  const reviews = [
    ...spreadReviews({ count: 10, days: 15, rating: 1, dayOffsetStart: -29 }),
    ...spreadReviews({ count: 10, days: 15, rating: 3, dayOffsetStart: -14 }),
  ];
  const recall = trendsFor(reviews).recall;
  assert.equal(recall.direction, 'insufficient_data');
  assert.equal(recall.change, null);
  assert.equal(recall.confidence.level, 'insufficient');
});

test('daily volume is tested on a complete calendar grid', () => {
  const reviews: ReviewLogEntry[] = [];
  for (let day = -29; day <= 0; day += 1) {
    const count = day + 30; // 1 … 30 reviews/day
    for (let index = 0; index < count; index += 1) {
      reviews.push(
        makeReview({
          cardId: `r-${day}-${index}`,
          rating: 3 as Rating,
          reviewedAt: at(day, 8, index),
        })
      );
    }
  }

  const trends = trendsFor(reviews);
  assert.equal(trends.series.points.length, 30);
  assert.equal(trends.series.total, 465);
  assert.equal(trends.volume.direction, 'improving');
  assert.ok(trends.volume.pValue !== null && trends.volume.pValue < 0.1);
  assert.ok(trends.volume.change !== null && trends.volume.change > 0);
  assert.match(trends.volume.note, /More reviews is not automatically better/);
});

test('zero-review days are true zeros, and they block a volume trend', () => {
  const reviews = [
    makeReview({ cardId: 'a', reviewedAt: at(-20, 9) }),
    makeReview({ cardId: 'b', reviewedAt: at(-10, 9) }),
    makeReview({ cardId: 'c', reviewedAt: at(0, 9) }),
  ];
  const trends = trendsFor(reviews);

  assert.equal(trends.series.points.length, 30);
  assert.equal(trends.series.points.filter((point) => point.value === 0).length, 27);
  assert.equal(trends.volume.direction, 'insufficient_data');
  assert.match(trends.volume.note, /30 days and 3 reviews/);
});

test('consistency compares active-day ratios between halves', () => {
  const reviews: ReviewLogEntry[] = [];
  for (let day = -14; day <= 0; day += 1) {
    for (let index = 0; index < 2; index += 1) {
      reviews.push(
        makeReview({ cardId: `c-${day}-${index}`, reviewedAt: at(day, 9, index * 10) })
      );
    }
  }

  const consistency = trendsFor(reviews).consistency;
  assert.equal(consistency.direction, 'improving');
  assert.equal(consistency.from, 0);
  assert.equal(consistency.to, 1);
});

test('a short range cannot support any trend beyond noise', () => {
  const reviews = spreadReviews({ count: 12, days: 5, rating: 3, dayOffsetStart: -4 });
  const trends = trendsFor(reviews, 5);

  assert.equal(trends.status, 'insufficient_data');
  assert.equal(trends.consistency.direction, 'insufficient_data');
  assert.match(trends.consistency.note, /at least 14 days/);
});

test('a clear outlier day is flagged with a robust z-score', () => {
  const cycle = [3, 4, 5, 6, 7];
  const reviews: ReviewLogEntry[] = [];
  for (let day = -29; day <= 0; day += 1) {
    const index = day + 29;
    const count = index === 20 ? 40 : cycle[index % cycle.length];
    for (let item = 0; item < count; item += 1) {
      reviews.push(
        makeReview({ cardId: `a-${day}-${item}`, reviewedAt: at(day, 8, item) })
      );
    }
  }

  const anomalies = trendsFor(reviews).anomalies;
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].value, 40);
  assert.equal(anomalies[0].direction, 'above');
  assert.ok(anomalies[0].zScore >= 2.5);
});

test('a flat series yields no anomalies instead of flagging every review day', () => {
  const reviews = Array.from({ length: 14 }, (_, index) =>
    makeReview({ cardId: `f-${index}`, reviewedAt: at(-index, 9) })
  );
  // 14 of 30 days active: the MAD is 0 because most days are identical zeros.
  assert.deepEqual(trendsFor(reviews).anomalies, []);
});

test('faster successful reviews per minute is an improving efficiency trend', () => {
  const slow = Array.from({ length: 20 }, (_, index) =>
    makeReview({
      cardId: `slow-${index}`,
      rating: 3,
      reviewedAt: at(-29 + Math.floor(index / 2), 9, index % 2),
      elapsedMs: 60_000,
    })
  );
  const fast = Array.from({ length: 20 }, (_, index) =>
    makeReview({
      cardId: `fast-${index}`,
      rating: 3,
      reviewedAt: at(-14 + Math.floor(index / 2), 9, index % 2),
      elapsedMs: 30_000,
    })
  );

  const efficiency = trendsFor([...slow, ...fast]).efficiency;
  assert.equal(efficiency.direction, 'improving');
  assert.equal(efficiency.from, 1);
  assert.equal(efficiency.to, 2);
  assert.ok(efficiency.change !== null && efficiency.change > 0);
});

test('an empty window has no series and no claims', () => {
  const trends = trendsFor([]);
  assert.equal(trends.status, 'empty');
  assert.equal(trends.series.total, 0);
  assert.equal(trends.volume.direction, 'insufficient_data');
  assert.equal(trends.efficiency.direction, 'insufficient_data');
});
