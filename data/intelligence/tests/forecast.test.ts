/**
 * Forecasts: exact workload counts, gated statistical projections, FSRS estimates.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeForecast } from '../prediction/forecast';
import { normalizeReviewLog } from '../core/normalize';
import { at, makeCard, makeDeck, makeReview, NOW, spreadReviews } from './fixtures';
import type { Flashcard, ReviewLogEntry } from '../../types';

const deck = makeDeck({ id: 'deck-a' });
const decks = [deck];

function forecastFor(
  cards: Flashcard[],
  reviews: ReviewLogEntry[],
  scopedDecks = decks
) {
  const normalized = normalizeReviewLog(reviews, scopedDecks, NOW);
  return analyzeForecast({
    decks: scopedDecks,
    cardsByDeck: { 'deck-a': cards },
    reviews: normalized.reviews,
    allReviews: normalized.reviews,
    now: NOW,
  });
}

test('volume forecast returns a mean and an 80% prediction interval', () => {
  const reviews: ReviewLogEntry[] = [];
  for (let day = -27; day <= 0; day += 1) {
    const count = (day + 28) % 2 === 0 ? 1 : 3;
    for (let index = 0; index < count; index += 1) {
      reviews.push(
        makeReview({ cardId: `v-${day}-${index}`, reviewedAt: at(day, 9, index) })
      );
    }
  }

  const volume = forecastFor([], reviews).volume.seven;
  assert.equal(volume.status, 'ok');
  assert.equal(volume.sampleDays, 28);
  assert.equal(volume.sampleReviews, 56);
  assert.equal(volume.expectedPerDay, 2);
  assert.equal(volume.expectedReviews, 14);
  assert.ok(volume.interval !== null);
  assert.ok(volume.interval.low < 14 && volume.interval.high > 14);
  assert.equal(volume.interval.level, 0.8);
  assert.ok(volume.assumptions.length >= 2);
  assert.ok(volume.limitations.length >= 2);
});

test('volume forecast refuses to extrapolate from three days', () => {
  const reviews = spreadReviews({ count: 20, days: 3, rating: 3, dayOffsetStart: -2 });
  const volume = forecastFor([], reviews).volume.thirty;

  assert.equal(volume.status, 'insufficient_data');
  assert.equal(volume.expectedReviews, null);
  assert.equal(volume.interval, null);
  assert.match(volume.confidence.rationale, /Needs 14 days/);
});

test('workload counts scheduled cards by local due day, excluding New', () => {
  const cards = [
    makeCard({ id: 'new', state: 'New' }),
    makeCard({ id: 'late-1', state: 'Review', dueInDays: -2 }),
    makeCard({ id: 'late-2', state: 'Review', dueInDays: -5 }),
    makeCard({ id: 'today', state: 'Review', dueInDays: 0 }),
    makeCard({ id: 'soon-1', state: 'Review', dueInDays: 3 }),
    makeCard({ id: 'soon-2', state: 'Review', dueInDays: 3 }),
    makeCard({ id: 'month', state: 'Review', dueInDays: 20 }),
    makeCard({ id: 'quarter', state: 'Review', dueInDays: 60 }),
  ];

  const workload = forecastFor(cards, []).workload;
  assert.equal(workload.status, 'ok');
  assert.equal(workload.scheduledCards, 7);
  assert.equal(workload.overdue, 2);
  assert.equal(workload.dueToday, 1);
  assert.equal(workload.next7, 3);
  assert.equal(workload.next30, 4);
  assert.equal(workload.next90, 5);
  assert.equal(workload.daily.length, 7);
  assert.equal(workload.daily[0].count, 1);
  assert.equal(workload.daily[3].count, 2);
  assert.deepEqual(workload.byDeck[0], {
    deckId: 'deck-a',
    name: 'Deck A',
    overdue: 2,
    next7: 3,
  });
});

test('a library with only New cards has no scheduled workload', () => {
  const workload = forecastFor([makeCard({ id: 'n' })], []).workload;
  assert.equal(workload.status, 'empty');
  assert.equal(workload.overdue, 0);
  assert.equal(workload.scheduledCards, 0);
});

test('backlog projects weeks from new cards introduced in the last 28 days', () => {
  const cards = [
    ...Array.from({ length: 20 }, (_, index) => makeCard({ id: `new-${index}` })),
    ...Array.from({ length: 8 }, (_, index) =>
      makeCard({ id: `studied-${index}`, state: 'Review' })
    ),
  ];
  const reviews = Array.from({ length: 8 }, (_, index) =>
    makeReview({
      cardId: `studied-${index}`,
      reviewedAt: at(-20 + index * 2, 9),
      cardWasNew: true,
    })
  );

  const backlog = forecastFor(cards, reviews).backlog;
  assert.equal(backlog.status, 'ok');
  assert.equal(backlog.sampleNewCards, 8);
  assert.equal(backlog.newPerWeek, 2);
  assert.equal(backlog.remainingNewCards, 20);
  assert.equal(backlog.weeks, 10);
  assert.ok(backlog.interval !== null);
  assert.ok(backlog.interval.low < 10 && backlog.interval.high > 10);
});

test('backlog is insufficient below eight introduced cards', () => {
  const cards = Array.from({ length: 20 }, (_, index) => makeCard({ id: `n-${index}` }));
  const reviews = Array.from({ length: 4 }, (_, index) =>
    makeReview({ cardId: `x-${index}`, reviewedAt: at(-10 + index, 9), cardWasNew: true })
  );

  const backlog = forecastFor(cards, reviews).backlog;
  assert.equal(backlog.status, 'insufficient_data');
  assert.equal(backlog.weeks, null);
  assert.match(backlog.confidence.rationale, /Needs 8 new cards/);
});

test('a finished new-card queue is empty rather than zero weeks', () => {
  const cards = [makeCard({ id: 'r', state: 'Review' })];
  const backlog = forecastFor(cards, []).backlog;
  assert.equal(backlog.status, 'empty');
  assert.equal(backlog.weeks, null);
});

test('retention forecast estimates R at each due date for ten cards', () => {
  const cards = Array.from({ length: 10 }, (_, index) =>
    makeCard({
      id: `due-${index}`,
      state: 'Review',
      stability: 5,
      lastReviewDaysAgo: 1,
      dueInDays: 2,
    })
  );

  const retention = forecastFor(cards, []).retention;
  assert.equal(retention.status, 'ok');
  assert.equal(retention.dueCards, 10);
  assert.equal(retention.desiredRetention, 0.9);
  assert.ok(
    retention.meanPredictedRetrievability !== null &&
      retention.meanPredictedRetrievability > 0 &&
      retention.meanPredictedRetrievability <= 1
  );
  assert.match(retention.note, /not a measured retention rate/);
});

test('retention forecast needs ten due cards and an FSRS deck', () => {
  const few = forecastFor(
    [makeCard({ id: 'one', state: 'Review', dueInDays: 2 })],
    []
  ).retention;
  assert.equal(few.status, 'insufficient_data');
  assert.equal(few.dueCards, 1);
  assert.equal(few.meanPredictedRetrievability !== null, true);

  const sm2 = makeDeck({ id: 'deck-a', algorithmPreset: 'general' });
  const none = forecastFor([makeCard({ id: 'one', state: 'Review' })], [], [sm2]).retention;
  assert.equal(none.status, 'empty');
  assert.equal(none.desiredRetention, null);
});
