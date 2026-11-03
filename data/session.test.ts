/**
 * Study queue tests — the daily caps and ordering are what make a session feel
 * like Anki rather than an endless deck. Run with `npm test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyQueue } from './session';
import type { Deck, Flashcard, FSRSState, ReviewLogEntry } from './types';

const NOW = new Date('2026-03-10T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck',
    name: 'Deck',
    icon: 'language',
    color: '#fff',
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: false,
    learningSteps: ['12 hours'],
    masteredIntervalMultiplier: 2.5,
    createdAt: 0,
    ...overrides,
  };
}

function makeCard(
  id: string,
  state: FSRSState,
  due: number,
  createdAt = 0,
  stability = state === 'New' ? 0 : 5
): Flashcard {
  return {
    id,
    deckId: 'deck',
    front: { text: 'a', direction: 'ltr' },
    back: { text: 'b', direction: 'ltr' },
    createdAt,
    fsrs: {
      due: new Date(due).toISOString(),
      stability,
      difficulty: state === 'New' ? 0 : 5,
      elapsed_days: 0,
      scheduled_days: state === 'New' ? 0 : 5,
      reps: state === 'New' ? 0 : 1,
      lapses: 0,
      state,
      last_review: state === 'New' ? null : new Date(due - DAY).toISOString(),
      learning_steps: 0,
    },
  };
}

function log(
  cardId: string,
  state: FSRSState,
  cardWasNew = false,
  deckId = 'deck'
): ReviewLogEntry {
  return {
    cardId,
    deckId,
    rating: 3,
    reviewedAt: NOW - 60_000,
    elapsedMs: 1000,
    cardWasNew,
    fsrs: {
      rating: 3,
      state,
      due: new Date(NOW - DAY).toISOString(),
      stability: 5,
      difficulty: 5,
      elapsedDays: 5,
      lastElapsedDays: 5,
      scheduledDays: 5,
      learningStep: 0,
      review: NOW - 60_000,
    },
  };
}

test('cards due earlier come first', () => {
  const deck = makeDeck();
  const cards = [
    makeCard('late', 'Review', NOW - DAY),
    makeCard('earliest', 'Review', NOW - 3 * DAY),
    makeCard('middle', 'Review', NOW - 2 * DAY),
  ];

  const queue = buildStudyQueue(deck, cards, [], NOW);
  assert.deepEqual(
    queue.dueCards.map((c) => c.id),
    ['earliest', 'middle', 'late']
  );
  assert.equal(queue.total, 3);
});

test('learning steps do not consume the daily review cap', () => {
  const deck = makeDeck({ maxCardsPerDay: 1 });
  const cards = [
    makeCard('learning', 'Learning', NOW - 60_000),
    makeCard('review-a', 'Review', NOW - DAY),
    makeCard('review-b', 'Review', NOW - 2 * DAY),
  ];
  // One review card was already answered today, so the cap is spent.
  const reviewLog = [log('review-a', 'Review')];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.deepEqual(
    queue.dueCards.map((c) => c.id),
    ['learning'],
    'the learning card must still be shown after the review cap is spent'
  );
});

test('review cards are capped by reviews already done today', () => {
  const deck = makeDeck({ maxCardsPerDay: 3 });
  const cards = ['a', 'b', 'c', 'd'].map((id, i) =>
    makeCard(id, 'Review', NOW - (i + 1) * DAY)
  );
  const reviewLog = [log('x', 'Review'), log('y', 'Review')];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.equal(queue.dueCards.length, 1, '3/day cap minus 2 done = 1 more review card');
  assert.equal(queue.dueCards[0].id, 'd', 'the oldest due card is kept');
});

test("another deck's reviews do not spend this deck's review cap", () => {
  const deck = makeDeck({ id: 'deck', maxCardsPerDay: 1 });
  const otherDeck = makeDeck({ id: 'other', maxCardsPerDay: 1 });
  const cards = [makeCard('due', 'Review', NOW - DAY)];
  const reviewLog = [log('other-card', 'Review', false, otherDeck.id)];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.deepEqual(
    queue.dueCards.map((c) => c.id),
    ['due'],
    'a review in another deck must not consume this deck’s budget'
  );
});

test("another deck's new cards do not spend this deck's new-card cap", () => {
  const deck = makeDeck({ id: 'deck', newCardsPerDay: 1 });
  const otherDeck = makeDeck({ id: 'other', newCardsPerDay: 1 });
  const cards = [makeCard('new', 'New', NOW, 100)];
  // The other deck already introduced one new card today.
  const reviewLog = [log('other-new', 'Learning', true, otherDeck.id)];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.deepEqual(
    queue.newCards.map((c) => c.id),
    ['new'],
    'new-card introductions in another deck are a separate budget'
  );
});

test('learning repetitions with only stateBefore do not consume the review cap', () => {
  const deck = makeDeck({ maxCardsPerDay: 1 });
  const cards = [
    makeCard('learning', 'Learning', NOW - 60_000),
    makeCard('review', 'Review', NOW - DAY),
  ];
  // SM-2 has no FSRS snapshot, so the cap has to read the pre-review state.
  const reviewLog: ReviewLogEntry[] = [
    {
      cardId: 'learning',
      deckId: deck.id,
      rating: 3,
      reviewedAt: NOW - 60_000,
      elapsedMs: 1000,
      cardWasNew: false,
      stateBefore: 'Learning',
    },
  ];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.deepEqual(
    queue.dueCards.map((c) => c.id),
    ['learning', 'review'],
    'a learning repetition must not spend the review budget'
  );
});

test('new cards respect the daily new-card cap and creation order', () => {
  const deck = makeDeck({ newCardsPerDay: 2 });
  const cards = [
    makeCard('new-late', 'New', NOW, 300),
    makeCard('new-first', 'New', NOW, 100),
    makeCard('new-middle', 'New', NOW, 200),
  ];
  const reviewLog = [log('new-late', 'New', true)];

  const queue = buildStudyQueue(deck, cards, reviewLog, NOW);
  assert.equal(queue.newCards.length, 1, '2/day cap minus 1 distinct new card = 1');
  assert.equal(queue.newCards[0].id, 'new-first');
});

test('cards that are not due yet stay out of the session', () => {
  const deck = makeDeck();
  const cards = [
    makeCard('future', 'Review', NOW + DAY),
    makeCard('due', 'Review', NOW - 1000),
    makeCard('new', 'New', NOW),
  ];

  const queue = buildStudyQueue(deck, cards, [], NOW);
  assert.deepEqual(
    queue.dueCards.map((c) => c.id),
    ['due']
  );
  assert.deepEqual(
    queue.newCards.map((c) => c.id),
    ['new']
  );
  assert.equal(queue.total, 2);
});
