/**
 * Insights: silence when the evidence is thin, specific claims when it is not.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligence } from '../core/engine';
import {
  at,
  makeCard,
  makeDeck,
  makeReview,
  NOW,
  spreadReviews,
} from './fixtures';
import type { Deck, Flashcard, ReviewLogEntry } from '../../types';

const deck = makeDeck({ id: 'deck-a' });

function reportFor(decks: Deck[], cards: Flashcard[], reviews: ReviewLogEntry[]) {
  return buildIntelligence({
    decks,
    cardsByDeck: Object.fromEntries(
      decks.map((item) => [item.id, cards.filter((card) => card.deckId === item.id)])
    ),
    reviewLog: reviews,
    now: NOW,
    rangeDays: 30,
  });
}

test('no history means no insights and no recommendations', () => {
  const report = reportFor([], [], []);
  assert.equal(report.insights.status, 'empty');
  assert.deepEqual(report.insights.insights, []);
  assert.deepEqual(report.insights.recommendations, []);
});

test('two reviews produce no claim about learning', () => {
  const cards = [makeCard({ id: 'c', deckId: 'deck-a', state: 'New' })];
  const reviews = [
    makeReview({ cardId: 'c', reviewedAt: at(-1, 9) }),
    makeReview({ cardId: 'c', reviewedAt: at(0, 9) }),
  ];
  const report = reportFor([deck], cards, reviews);

  assert.equal(report.insights.status, 'insufficient_data');
  assert.deepEqual(report.insights.insights, []);
});

test('separated recall windows generate a specific, sourced insight', () => {
  const cards = [makeCard({ id: 'c', deckId: 'deck-a' })];
  const reviews = [
    ...spreadReviews({ count: 20, days: 15, rating: 1, dayOffsetStart: -29 }),
    ...spreadReviews({ count: 20, days: 15, rating: 3, dayOffsetStart: -14 }),
  ];
  const report = reportFor([deck], cards, reviews);

  const insight = report.insights.insights.find((item) => item.id === 'recall-trend');
  assert.ok(insight, 'expected a recall trend insight');
  assert.equal(insight.tone, 'positive');
  assert.match(insight.detail, /0%.*100%/);
  assert.ok(insight.evidence.length >= 2);
  assert.ok(insight.confidence.sampleSize > 0);
});

test('repeated lapses recommend rewriting the cards', () => {
  const cards = Array.from({ length: 6 }, (_, index) =>
    makeCard({
      id: `leech-${index}`,
      deckId: 'deck-a',
      state: 'Review',
      lapses: index + 2,
    })
  );
  const reviews = spreadReviews({ count: 30, days: 30, rating: 3, dayOffsetStart: -29 });
  const report = reportFor([deck], cards, reviews);

  const recommendation = report.insights.recommendations.find(
    (item) => item.id === 'rewrite-leeches'
  );
  assert.ok(recommendation, 'expected the rewrite recommendation');
  assert.ok(recommendation.metrics.some((metric) => metric.includes('2+ lapses')));
  assert.ok(report.insights.insights.some((item) => item.id === 'repeated-failures'));
});

test('a large overdue load outranks new material', () => {
  const cards = Array.from({ length: 12 }, (_, index) =>
    makeCard({
      id: `late-${index}`,
      deckId: 'deck-a',
      state: 'Review',
      dueInDays: -5,
      stability: 5,
      lastReviewDaysAgo: 20,
    })
  );
  const reviews = spreadReviews({ count: 30, days: 30, rating: 3, dayOffsetStart: -29 });
  const report = reportFor([deck], cards, reviews);

  const overdue = report.insights.recommendations.find((item) => item.id === 'clear-overdue');
  assert.ok(overdue, 'expected the overdue recommendation');
  assert.equal(overdue.priority, 'high');
  assert.ok(overdue.metrics[0].includes('12'));
  assert.ok(report.forecast.workload.overdue >= 12);
});

test('the overdue share counts each scheduled card once', () => {
  const cards = [
    ...Array.from({ length: 12 }, (_, index) =>
      makeCard({
        id: `late-${index}`,
        deckId: 'deck-a',
        state: 'Review',
        dueInDays: -2,
        stability: 5,
        lastReviewDaysAgo: 20,
      })
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      makeCard({
        id: `today-${index}`,
        deckId: 'deck-a',
        state: 'Review',
        dueInDays: 0,
        stability: 5,
        lastReviewDaysAgo: 10,
      })
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      makeCard({
        id: `soon-${index}`,
        deckId: 'deck-a',
        state: 'Review',
        dueInDays: 3,
        stability: 5,
        lastReviewDaysAgo: 5,
      })
    ),
  ];
  const reviews = spreadReviews({ count: 30, days: 30, rating: 3, dayOffsetStart: -29 });
  const report = reportFor([deck], cards, reviews);
  const recommendation = report.insights.recommendations.find(
    (item) => item.id === 'clear-overdue'
  );

  assert.ok(recommendation, 'expected the overdue recommendation');
  // 12 overdue out of 24 scheduled (12 + 8 today + 4 later) is 50%.
  assert.match(recommendation.reason, /50%/);
  assert.ok(recommendation.metrics.includes('4 due after today'));
});

test('every claim carries evidence and the lists stay capped', () => {
  const cards = [
    ...Array.from({ length: 8 }, (_, index) =>
      makeCard({
        id: `leech-${index}`,
        deckId: 'deck-a',
        state: 'Review',
        lapses: 8,
        dueInDays: -3,
        stability: 1,
        lastReviewDaysAgo: 60,
      })
    ),
    ...Array.from({ length: 20 }, (_, index) =>
      makeCard({ id: `late-${index}`, deckId: 'deck-a', state: 'Review', dueInDays: 0 })
    ),
  ];
  const reviews = spreadReviews({ count: 60, days: 30, rating: 2, dayOffsetStart: -29 });
  const report = reportFor([deck], cards, reviews);

  assert.ok(report.insights.insights.length <= 6);
  assert.ok(report.insights.recommendations.length <= 4);
  for (const insight of report.insights.insights) {
    assert.ok(insight.evidence.length > 0, `${insight.id} has no evidence`);
    assert.ok(insight.title.length > 0 && insight.detail.length > 0);
    assert.ok(insight.confidence.rationale.length > 0);
  }
  for (const recommendation of report.insights.recommendations) {
    assert.ok(recommendation.metrics.length > 0, `${recommendation.id} has no metrics`);
    assert.ok(recommendation.reason.length > 10);
  }
});
