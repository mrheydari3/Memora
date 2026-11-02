/**
 * FSRS-6 scheduler tests.
 *
 * Run with `npm test` (Node's built-in runner strips the TypeScript types).
 * The golden numbers come from FSRS-6 default parameters and are asserted on
 * the deck preset, so a change in ts-fsrs's model or in our parameter wiring
 * fails loudly instead of silently rescheduling every card.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFSRSScheduler } from './fsrs';
import { normalizeFsrsStep, isFsrsLearningStepValid, resolveFsrsParams } from '../fsrs-params';
import type { Deck, Flashcard } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-test',
    name: 'Test deck',
    icon: 'language',
    color: '#ffffff',
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: false,
    learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
    masteredIntervalMultiplier: 2.5,
    ...resolveFsrsParams({}),
    createdAt: 0,
    ...overrides,
  };
}

function makeNewCard(deckId: string, now: Date): Flashcard {
  return {
    id: 'card-1',
    deckId,
    front: { text: 'Schritt', direction: 'ltr' },
    back: { text: 'قدم', direction: 'rtl' },
    createdAt: now.getTime(),
    fsrs: {
      due: now.toISOString(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 'New',
      last_review: null,
      learning_steps: 0,
    },
  };
}

function assertClose(actual: number, expected: number, epsilon = 1e-3, label = '') {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label} expected ${expected} ± ${epsilon}, got ${actual}`
  );
}

const START = new Date('2026-01-01T00:00:00Z');

test('FSRS-6 default parameters produce the documented first-review state', () => {
  const deck = makeDeck({ enableFuzz: false });
  const scheduler = createFSRSScheduler(deck);
  const card = makeNewCard(deck.id, START);

  const again = scheduler.schedule(card, 1, START);
  assertClose(again.updatedCard.fsrs.stability, 0.212, 1e-4, 'Again S0');
  assertClose(again.updatedCard.fsrs.difficulty, 6.4133, 1e-3, 'Again D0');
  assert.equal(again.updatedCard.fsrs.state, 'Learning');
  assert.equal(again.updatedCard.fsrs.due, new Date(START.getTime() + 60_000).toISOString());

  const hard = scheduler.schedule(card, 2, START);
  assertClose(hard.updatedCard.fsrs.stability, 1.2931, 1e-3, 'Hard S0');
  assertClose(hard.updatedCard.fsrs.difficulty, 5.1122, 1e-3, 'Hard D0');

  const good = scheduler.schedule(card, 3, START);
  assertClose(good.updatedCard.fsrs.stability, 2.3065, 1e-3, 'Good S0');
  assertClose(good.updatedCard.fsrs.difficulty, 2.1181, 1e-3, 'Good D0');

  const easy = scheduler.schedule(card, 4, START);
  assertClose(easy.updatedCard.fsrs.stability, 8.2956, 1e-3, 'Easy S0');
  assertClose(easy.updatedCard.fsrs.difficulty, 1, 1e-6, 'Easy D0');
  assert.equal(easy.updatedCard.fsrs.state, 'Review');
  assert.equal(easy.updatedCard.fsrs.due, new Date(START.getTime() + 8 * DAY_MS).toISOString());
});

test('rating buttons preview exactly the due date that rating produces', () => {
  const deck = makeDeck({ enableFuzz: false });
  const scheduler = createFSRSScheduler(deck);
  const card = makeNewCard(deck.id, START);

  const previews = scheduler.getIntervalPreviews(card, START);
  assert.deepEqual(
    previews.map((p) => p.label),
    ['1m', '6m', '10m', '8d']
  );

  // `repeat` (previews) and `next` (the rating actually applied) must agree.
  for (const preview of previews) {
    const applied = scheduler.schedule(card, preview.rating, START);
    assert.equal(applied.intervalPreviewLabel, preview.label);
    assert.ok(new Date(applied.updatedCard.fsrs.due).getTime() > START.getTime());
  }
});

test('rollback reconstructs the pre-review card exactly', () => {
  const deck = makeDeck({ enableFuzz: false });
  const scheduler = createFSRSScheduler(deck);

  // Graduate a card into Review with Easy, then review it again a week later.
  const learned = scheduler.schedule(makeNewCard(deck.id, START), 4, START).updatedCard;
  const reviewAt = new Date(START.getTime() + 8 * DAY_MS);
  const result = scheduler.schedule(learned, 3, reviewAt);
  assert.ok(result.log);

  const restored = scheduler.rollback(result.updatedCard, result.log);
  assert.ok(restored, 'rollback should succeed for a FSRS log');
  assert.equal(restored.fsrs.due, learned.fsrs.due);
  assert.equal(restored.fsrs.last_review, learned.fsrs.last_review);
  assert.equal(restored.fsrs.state, learned.fsrs.state);
  assert.equal(restored.fsrs.scheduled_days, learned.fsrs.scheduled_days);
  assert.equal(restored.fsrs.learning_steps, learned.fsrs.learning_steps);
  assert.equal(restored.fsrs.reps, learned.fsrs.reps);
  assert.equal(restored.fsrs.lapses, learned.fsrs.lapses);
  assertClose(restored.fsrs.stability, learned.fsrs.stability, 1e-4, 'restored stability');
  assertClose(restored.fsrs.difficulty, learned.fsrs.difficulty, 1e-4, 'restored difficulty');
});

test('retrievability at t = S is about 90%', () => {
  const deck = makeDeck({ enableFuzz: false });
  const scheduler = createFSRSScheduler(deck);
  const learned = scheduler.schedule(makeNewCard(deck.id, START), 4, START).updatedCard;
  const stability = learned.fsrs.stability;

  const atStability = scheduler.getRetrievability(learned, new Date(START.getTime() + stability * DAY_MS));
  assert.ok(atStability !== null);
  assertClose(atStability, 0.9, 0.02, 'R(S,S)');

  // A new card has no memory state yet and must not read as "0% recall".
  assert.equal(scheduler.getRetrievability(makeNewCard(deck.id, START), START), null);
});

test('desired retention changes the interval monotonically', () => {
  const base = makeDeck({ enableFuzz: false, enableShortTerm: false });
  const learned = createFSRSScheduler(base).schedule(makeNewCard(base.id, START), 4, START).updatedCard;
  const reviewAt = new Date(START.getTime() + 8 * DAY_MS);

  const dueAt = (retention: number) => {
    const deck = makeDeck({ ...base, requestRetention: retention });
    return new Date(
      createFSRSScheduler(deck).schedule(learned, 3, reviewAt).updatedCard.fsrs.due
    ).getTime();
  };

  // A lower target retention lets recall decay further, so the next review comes
  // LATER (fewer reviews). Higher retention shortens every interval.
  const relaxed = dueAt(0.8);
  const standard = dueAt(0.9);
  const strict = dueAt(0.95);
  assert.ok(relaxed > standard, `0.8 (${relaxed}) should schedule later than 0.9 (${standard})`);
  assert.ok(standard > strict, `0.9 (${standard}) should schedule later than 0.95 (${strict})`);
});

test('decks with different parameters do not share scheduling state', () => {
  const now = START;
  const card = makeNewCard('deck-a', now);
  const deckA = makeDeck({ id: 'deck-a', enableFuzz: false, requestRetention: 0.9 });
  const deckB = makeDeck({ id: 'deck-b', enableFuzz: false, requestRetention: 0.75 });

  const learnedA = createFSRSScheduler(deckA).schedule(card, 4, now).updatedCard;
  const reviewAt = new Date(now.getTime() + 8 * DAY_MS);
  const dueA = createFSRSScheduler(deckA).schedule(learnedA, 3, reviewAt).updatedCard.fsrs.due;
  const dueB = createFSRSScheduler(deckB)
    .schedule({ ...learnedA, deckId: 'deck-b' }, 3, reviewAt).updatedCard.fsrs.due;

  assert.notEqual(dueA, dueB);
});

test('maximum interval caps the schedule', () => {
  const capped = makeDeck({ enableFuzz: false, maximumInterval: 5 });
  const uncapped = makeDeck({ enableFuzz: false, maximumInterval: 36500 });
  const card = makeNewCard(capped.id, START);

  // The graduation interval is clamped exactly.
  const cappedEasy = createFSRSScheduler(capped).schedule(card, 4, START).updatedCard.fsrs.due;
  assert.equal(cappedEasy, new Date(START.getTime() + 5 * DAY_MS).toISOString());

  const cappedLearned = createFSRSScheduler(capped).schedule(card, 4, START).updatedCard;
  const openLearned = createFSRSScheduler(uncapped).schedule(card, 4, START).updatedCard;
  const reviewAt = new Date(START.getTime() + 8 * DAY_MS);

  // ts-fsrs keeps Hard < Good < Easy by shifting intervals up by at most two
  // days after applying the cap, so compare against the uncapped deck instead
  // of asserting every interval is literally <= maximumInterval.
  for (const rating of [1, 2, 3, 4] as const) {
    const cappedDue = new Date(
      createFSRSScheduler(capped).schedule(cappedLearned, rating, reviewAt).updatedCard.fsrs.due
    ).getTime();
    const openDue = new Date(
      createFSRSScheduler(uncapped).schedule(openLearned, rating, reviewAt).updatedCard.fsrs.due
    ).getTime();
    assert.ok(cappedDue <= openDue, `rating ${rating}: cap must not schedule later than no cap`);
  }
});

test('fuzz is deterministic for a fixed review instant and absent when disabled', () => {
  const fuzzed = createFSRSScheduler(makeDeck({ enableFuzz: true }));
  const silent = createFSRSScheduler(makeDeck({ enableFuzz: false }));
  const card = makeNewCard('deck-test', START);

  const a = fuzzed.schedule(card, 4, START).updatedCard.fsrs.due;
  const b = fuzzed.schedule(card, 4, START).updatedCard.fsrs.due;
  assert.equal(a, b, 'same review instant must produce the same fuzzed due date');

  const exact = silent.schedule(card, 4, START).updatedCard.fsrs.due;
  assert.equal(exact, new Date(START.getTime() + 8 * DAY_MS).toISOString());
});

test('learning steps are normalised and held under one day', () => {
  assert.equal(normalizeFsrsStep('10 min'), '10m');
  assert.equal(normalizeFsrsStep('6h'), '6h');
  assert.equal(normalizeFsrsStep('soon'), null);
  assert.equal(normalizeFsrsStep('0m'), null);

  assert.equal(isFsrsLearningStepValid('10m'), true);
  assert.equal(isFsrsLearningStepValid('23h'), true);
  assert.equal(isFsrsLearningStepValid('1d'), false);

  // A day-scale step is not a valid FSRS learning step, so it falls back to
  // the Anki defaults rather than being silently passed to the scheduler.
  const resolved = resolveFsrsParams({ fsrsLearningSteps: ['1d', '2 days'] });
  assert.deepEqual(resolved.fsrsLearningSteps, ['1m', '10m']);
});

test('deck learning steps drive the short-term schedule', () => {
  const deck = makeDeck({ enableFuzz: false, fsrsLearningSteps: ['5m'] });
  const scheduler = createFSRSScheduler(deck);
  const card = makeNewCard(deck.id, START);

  // With a single step, Again stays in learning for that step; Good completes
  // the steps and graduates the card into the long-term schedule.
  const again = scheduler.schedule(card, 1, START).updatedCard;
  assert.equal(again.fsrs.state, 'Learning');
  assert.equal(again.fsrs.due, new Date(START.getTime() + 5 * 60_000).toISOString());

  const good = scheduler.schedule(card, 3, START).updatedCard;
  assert.equal(good.fsrs.state, 'Review');
  assert.ok(new Date(good.fsrs.due).getTime() > START.getTime() + DAY_MS);
});

test('retention and interval are clamped to the supported range', () => {
  const tooLow = resolveFsrsParams({ requestRetention: 0.2 });
  assert.equal(tooLow.requestRetention, 0.7);

  const tooHigh = resolveFsrsParams({ requestRetention: 0.999 });
  assert.equal(tooHigh.requestRetention, 0.97);

  const interval = resolveFsrsParams({ maximumInterval: 999999 });
  assert.equal(interval.maximumInterval, 36500);
});
