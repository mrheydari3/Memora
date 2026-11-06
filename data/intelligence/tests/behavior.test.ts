/**
 * Behaviour intelligence: sessions, timing, consistency, intra-session shape.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBehavior,
  analyzeIntraSession,
  buildSessions,
} from '../analysis/behavior';
import { computePerformance } from '../analysis/metrics';
import { normalizeReviewLog } from '../core/normalize';
import { at, makeDeck, makeReview, NOW, rangeFor } from './fixtures';
import type { ReviewLogEntry } from '../../types';

const decks = [makeDeck()];

const normalize = (reviews: ReviewLogEntry[]) =>
  normalizeReviewLog(reviews, decks, NOW).reviews;

test('a 30-minute gap starts a new session', () => {
  const sessions = buildSessions(
    normalize([
      makeReview({ cardId: 'a', reviewedAt: at(-1, 10, 0) }),
      makeReview({ cardId: 'b', reviewedAt: at(-1, 10, 10) }),
      makeReview({ cardId: 'c', reviewedAt: at(-1, 11, 0) }),
    ])
  );

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].reviews, 2);
  assert.equal(sessions[1].reviews, 1);
  // The session ends when the last review's recorded time runs out, not at its start.
  assert.equal(sessions[0].durationMs, 10 * 60_000 + 5000);
});

test('later reviews in long sessions can show lower recall', () => {
  const reviews: ReviewLogEntry[] = [];
  for (let day = -7; day <= 0; day += 1) {
    for (let item = 0; item < 12; item += 1) {
      reviews.push(
        makeReview({
          cardId: `s-${day}-${item}`,
          rating: item >= 8 ? 1 : 3,
          reviewedAt: at(day, 10, item * 5),
        })
      );
    }
  }

  const sessions = buildSessions(normalize(reviews));
  assert.equal(sessions.length, 8);
  assert.equal(sessions[0].firstThird.sample, 4);
  assert.equal(sessions[0].lastThird.sample, 4);
  assert.equal(sessions[0].firstThird.success, 4);

  const intra = analyzeIntraSession(sessions);
  assert.equal(intra.status, 'ok');
  assert.equal(intra.sampleSize, 64);
  assert.equal(intra.firstRate, 1);
  assert.equal(intra.lastRate, 0);
  assert.equal(intra.direction, 'declining');
});

test('intra-session analysis needs 30 positioned reviews per pool', () => {
  const reviews: ReviewLogEntry[] = [];
  for (let day = -1; day <= 0; day += 1) {
    for (let item = 0; item < 12; item += 1) {
      reviews.push(
        makeReview({
          cardId: `t-${day}-${item}`,
          rating: item >= 8 ? 1 : 3,
          reviewedAt: at(day, 10, item * 5),
        })
      );
    }
  }

  const intra = analyzeIntraSession(buildSessions(normalize(reviews)));
  assert.equal(intra.status, 'insufficient_data');
  assert.equal(intra.direction, 'insufficient_data');
  assert.equal(intra.firstRate, null);
});

test('even daily study has perfect consistency and no gap', () => {
  const reviews = Array.from({ length: 20 }, (_, index) =>
    makeReview({
      cardId: `e-${index}`,
      reviewedAt: at(-(index % 10), 9, index),
    })
  );
  const normalized = normalize(reviews);
  const performance = computePerformance(normalized, rangeFor(10), NOW, normalized);
  const behavior = analyzeBehavior(normalized, performance, rangeFor(10).start, rangeFor(10).end);

  assert.equal(behavior.status, 'ok');
  assert.equal(behavior.consistency.activeDayRatio, 1);
  assert.equal(behavior.consistency.coefficientOfVariation, 0);
  assert.equal(behavior.consistency.longestGapDays, 0);
  assert.ok(behavior.sessions.count > 1);
  assert.ok(behavior.bestWeekday !== null && behavior.bestWeekday.reviews > 0);
});

test('a missing week is recorded as the longest gap', () => {
  const reviews = [
    makeReview({ cardId: 'a', reviewedAt: at(-20, 9) }),
    makeReview({ cardId: 'b', reviewedAt: at(-5, 9) }),
    makeReview({ cardId: 'c', reviewedAt: at(0, 9) }),
  ];
  const normalized = normalize(reviews);
  const range = rangeFor(21);
  const performance = computePerformance(normalized, range, NOW, normalized);
  const behavior = analyzeBehavior(normalized, performance, range.start, range.end);

  assert.ok(behavior.consistency.longestGapDays >= 14);
  assert.equal(behavior.sessions.count, 3);
});

test('empty history produces empty behaviour, not zero-value claims', () => {
  const performance = computePerformance([], rangeFor(30), NOW);
  const behavior = analyzeBehavior([], performance, rangeFor(30).start, rangeFor(30).end);

  assert.equal(behavior.status, 'empty');
  assert.equal(behavior.sessions.count, 0);
  assert.equal(behavior.sessions.meanReviews, null);
  assert.equal(behavior.sessions.reviewsPerMinute, null);
  assert.equal(behavior.bestWeekday, null);
  assert.equal(behavior.bestHour, null);
  assert.equal(behavior.intraSession.status, 'insufficient_data');
});
