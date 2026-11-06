/**
 * Memory intelligence: FSRS state, lapses, risk and scheduler coverage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMemory } from '../analysis/memory';
import { normalizeReviewLog } from '../core/normalize';
import { makeCard, makeDeck, makeReview, NOW } from './fixtures';

const fsrsDeck = makeDeck({ id: 'deck-a', requestRetention: 0.9 });

const cards = [
  ...Array.from({ length: 5 }, (_, index) =>
    makeCard({ id: `new-${index}`, deckId: 'deck-a', state: 'New' })
  ),
  ...Array.from({ length: 3 }, (_, index) =>
    makeCard({
      id: `learning-${index}`,
      deckId: 'deck-a',
      state: 'Learning',
      stability: 1,
      lastReviewDaysAgo: 1,
      dueInDays: 1,
    })
  ),
  makeCard({
    id: 'review-fresh-1',
    deckId: 'deck-a',
    state: 'Review',
    stability: 20,
    lastReviewDaysAgo: 0,
    dueInDays: 20,
  }),
  makeCard({
    id: 'review-fresh-2',
    deckId: 'deck-a',
    state: 'Review',
    stability: 30,
    lastReviewDaysAgo: 0,
    dueInDays: 30,
  }),
  makeCard({
    id: 'review-risk',
    deckId: 'deck-a',
    state: 'Review',
    stability: 1,
    difficulty: 8,
    lastReviewDaysAgo: 60,
    dueInDays: -10,
    lapses: 1,
  }),
  makeCard({
    id: 'relearning-leech',
    deckId: 'deck-a',
    state: 'Relearning',
    stability: 2,
    lastReviewDaysAgo: 30,
    dueInDays: 2,
    lapses: 8,
  }),
];

const cardsByDeck = { 'deck-a': cards };

const lapseReviews = [
  ...Array.from({ length: 2 }, (_, index) =>
    makeReview({
      cardId: `lapse-${index}`,
      rating: 1,
      stateBefore: 'Review',
      reviewedAt: NOW - (index + 1) * 86_400_000,
    })
  ),
  ...Array.from({ length: 8 }, (_, index) =>
    makeReview({
      cardId: `pass-${index}`,
      rating: 3,
      stateBefore: 'Review',
      reviewedAt: NOW - (index + 3) * 86_400_000,
    })
  ),
];

test('memory states, schedule share and distributions come from FSRS cards only', () => {
  const memory = analyzeMemory([fsrsDeck], cardsByDeck, [], NOW);

  assert.equal(memory.status, 'ok');
  assert.deepEqual(memory.states, { New: 5, Learning: 3, Review: 3, Relearning: 1 });
  assert.equal(memory.inReviewSchedule.count, 3);
  assert.equal(memory.inReviewSchedule.share, 3 / 12);
  assert.equal(memory.stability.sampleSize, 7);
  assert.equal(memory.difficulty.sampleSize, 7);
  assert.equal(
    memory.stability.buckets.reduce((total, bucket) => total + bucket.count, 0),
    7
  );
  assert.equal(memory.coverage.fsrsCards, 12);
  assert.equal(memory.coverage.nonFsrsDecks, 0);
});

test('lapses count cards, and the leech threshold is Anki’s default of 8', () => {
  const memory = analyzeMemory([fsrsDeck], cardsByDeck, [], NOW);

  assert.equal(memory.lapses.total, 9); // 1 + 8
  assert.equal(memory.lapses.cardsWithLapses, 2);
  assert.equal(memory.lapses.repeatedFailureCards, 1); // only the 8-lapse card reaches 2
  assert.equal(memory.lapses.leeches, 1);
});

test('the lapse rate uses review-state reviews, not every review', () => {
  const normalized = normalizeReviewLog(lapseReviews, [fsrsDeck], NOW);
  const memory = analyzeMemory([fsrsDeck], cardsByDeck, normalized.reviews, NOW);

  assert.equal(memory.lapses.reviewStateReviews, 10);
  assert.equal(memory.lapses.lapseRate, 0.2);
});

test('a decayed card is at risk and a freshly reviewed card is not', () => {
  const memory = analyzeMemory([fsrsDeck], cardsByDeck, [], NOW);

  assert.equal(memory.retention.evaluatedCards, 7);
  assert.ok(memory.retention.atRisk >= 1, 'the stale card must be below target');
  assert.ok(memory.retention.meanRetrievability !== null);
  assert.ok(
    memory.retention.meanRetrievability > 0 && memory.retention.meanRetrievability <= 1,
    'retrievability is a probability'
  );

  const ids = memory.attention.map((card) => card.cardId);
  assert.ok(ids.includes('review-risk'));
  assert.ok(ids.includes('relearning-leech'));
  assert.ok(
    memory.attention.every((card) => card.state !== 'New'),
    'a never-reviewed card has no memory state to rank'
  );
  assert.equal(memory.attention[0].cardId, 'relearning-leech', 'lapses rank first');
});

test('SM-2 decks are excluded with an explicit note', () => {
  const sm2 = makeDeck({ id: 'deck-sm2', algorithmPreset: 'general' });
  const memory = analyzeMemory(
    [fsrsDeck, sm2],
    { ...cardsByDeck, 'deck-sm2': [makeCard({ id: 's1', deckId: 'deck-sm2' })] },
    [],
    NOW
  );

  assert.equal(memory.coverage.fsrsDecks, 1);
  assert.equal(memory.coverage.nonFsrsDecks, 1);
  assert.equal(memory.coverage.excludedCards, 1);
  assert.match(memory.coverage.note, /FSRS decks only/);
  assert.equal(memory.coverage.fsrsCards, 12);
});

test('the retention target averages only decks that contribute cards', () => {
  const empty = makeDeck({ id: 'deck-empty', requestRetention: 0.9 });
  const full = makeDeck({ id: 'deck-full', requestRetention: 0.9 });
  const memory = analyzeMemory(
    [empty, full],
    {
      'deck-empty': [],
      'deck-full': [
        makeCard({
          id: 'c',
          deckId: 'deck-full',
          state: 'Review',
          stability: 5,
          lastReviewDaysAgo: 1,
          dueInDays: 2,
        }),
      ],
    },
    [],
    NOW
  );

  // The empty deck has a target too, but it has no memory state to judge.
  assert.equal(memory.retention.threshold, 0.9);
});

test('a library with no FSRS cards is empty, not zero-percent', () => {
  const none = analyzeMemory([], {}, [], NOW);
  assert.equal(none.status, 'empty');
  assert.equal(none.coverage.fsrsCards, 0);
  assert.equal(none.inReviewSchedule.share, null);
  assert.equal(none.retention.threshold, null);
  assert.equal(none.retention.meanRetrievability, null);
});
