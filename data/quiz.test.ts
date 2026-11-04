/**
 * Quiz logic tests — questions, scoring and the clock. Run with `npm test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBO_CAP,
  CORRECT_BONUS_MS,
  ROUND_MS,
  WRONG_PENALTY_MS,
  accuracy,
  applyAnswer,
  buildQuestion,
  buildRound,
  createRound,
  finishCleared,
  isDeckPlayable,
  isNewBest,
  scoreForAnswer,
  tick,
} from './quiz';
import type { Flashcard } from './types';

/** Deterministic RNG so question order and option order are reproducible. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCard(id: string, front: string, back: string, direction: 'ltr' | 'rtl' = 'ltr'): Flashcard {
  return {
    id,
    deckId: 'deck',
    front: { text: front, direction },
    back: { text: back, direction },
    createdAt: 0,
    fsrs: {
      due: '2026-03-10T12:00:00.000Z',
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 'New',
      last_review: null,
    },
  };
}

const deck = () => [
  makeCard('a', 'Haus', 'house'),
  makeCard('b', 'Baum', 'tree'),
  makeCard('c', 'Wasser', 'water'),
  makeCard('d', 'Buch', 'book'),
  makeCard('e', 'Straße', 'street'),
];

test('buildQuestion returns four unique options including the correct answer', () => {
  const cards = deck();
  const question = buildQuestion(cards[0], cards, seeded(1));

  assert.ok(question);
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((o) => o.text)).size, 4);
  assert.equal(question.options.filter((o) => o.correct).length, 1);
  assert.equal(question.options.find((o) => o.correct)?.text, 'house');
  assert.equal(question.front, 'Haus');
});

test('reverse mode asks the back and answers with the front', () => {
  const cards = deck();
  const question = buildQuestion(cards[0], cards, seeded(6), 'reverse');

  assert.ok(question);
  assert.equal(question.front, 'house');
  assert.equal(question.options.find((o) => o.correct)?.text, 'Haus');
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((o) => o.text)).size, 4);
});

test('reverse mode takes the prompt direction from the back side', () => {
  const first = makeCard('a', 'book', 'کتاب', 'ltr');
  first.back = { text: 'کتاب', direction: 'rtl' };
  const cards = [
    first,
    makeCard('b', 'Baum', 'tree'),
    makeCard('c', 'Wasser', 'water'),
    makeCard('d', 'Buch', 'book2'),
  ];
  const question = buildQuestion(cards[0], cards, seeded(7), 'reverse');
  assert.equal(question?.front, 'کتاب');
  assert.equal(question?.direction, 'rtl');
});

test('reverse playability counts distinct fronts, not backs', () => {
  const cards = [
    makeCard('a', 'eins', 'same'),
    makeCard('b', 'zwei', 'same'),
    makeCard('c', 'drei', 'same'),
    makeCard('d', 'vier', 'same'),
  ];
  assert.equal(isDeckPlayable(cards), false);
  assert.equal(isDeckPlayable(cards, 'reverse'), true);

  const question = buildQuestion(cards[0], cards, seeded(8), 'reverse');
  assert.ok(question);
  assert.equal(question.options.filter((o) => o.correct).length, 1);
  assert.equal(question.options.find((o) => o.correct)?.text, 'eins');
});

test('buildQuestion keeps the card direction', () => {
  const cards = [
    makeCard('a', 'کتاب', 'book', 'rtl'),
    makeCard('b', 'Baum', 'tree'),
    makeCard('c', 'Wasser', 'water'),
    makeCard('d', 'Buch', 'book2'),
  ];
  const question = buildQuestion(cards[0], cards, seeded(2));
  assert.equal(question?.direction, 'rtl');
});

test('duplicate answers are never used as distractors', () => {
  const cards = [
    makeCard('a', 'Haus', 'house'),
    makeCard('b', 'Gebäude', 'house'),
    makeCard('c', 'Baum', 'tree'),
    makeCard('d', 'Wasser', 'water'),
    makeCard('e', 'Buch', 'book'),
  ];
  const question = buildQuestion(cards[0], cards, seeded(3));
  assert.ok(question);
  assert.equal(question.options.filter((o) => o.text === 'house').length, 1);
});

test('a deck with fewer than four distinct answers is not playable', () => {
  const cards = [
    makeCard('a', 'Haus', 'house'),
    makeCard('b', 'Gebäude', 'house'),
    makeCard('c', 'Baum', 'tree'),
    makeCard('d', 'Wasser', 'water'),
  ];
  assert.equal(isDeckPlayable(cards), false);
  assert.equal(buildQuestion(cards[0], cards, seeded(4)), null);
});

test('cards with an empty side are ignored', () => {
  const cards = [
    makeCard('a', 'Haus', ''),
    makeCard('b', 'Baum', 'tree'),
    makeCard('c', 'Wasser', 'water'),
    makeCard('d', 'Buch', 'book'),
    makeCard('e', 'Straße', 'street'),
  ];
  assert.equal(buildQuestion(cards[0], cards, seeded(5)), null);
  assert.equal(isDeckPlayable(cards), true);
  const question = buildQuestion(cards[1], cards, seeded(5));
  assert.ok(question);
  assert.ok(!question.options.some((o) => o.id === 'a'));
});

test('question building is deterministic for a seeded rng', () => {
  const cards = deck();
  const first = buildQuestion(cards[0], cards, seeded(42));
  const second = buildQuestion(cards[0], cards, seeded(42));
  assert.deepEqual(first, second);
});

test('buildRound asks each playable card at most once', () => {
  const cards = deck();
  const round = buildRound(cards, seeded(7));
  assert.equal(round.length, cards.length);
  assert.equal(new Set(round.map((q) => q.cardId)).size, round.length);
});

test('score grows with the combo and stops at the cap', () => {
  assert.equal(scoreForAnswer(1), 100);
  assert.equal(scoreForAnswer(2), 200);
  assert.equal(scoreForAnswer(COMBO_CAP), 500);
  assert.equal(scoreForAnswer(COMBO_CAP + 3), 500);
  assert.equal(scoreForAnswer(0), 100);
});

test('a correct answer adds time, score and combo', () => {
  const start = tick(createRound(), 10_000); // 50s left
  const next = applyAnswer(start, true);

  assert.equal(next.timeLeftMs, start.timeLeftMs + CORRECT_BONUS_MS);
  assert.equal(next.score, 100);
  assert.equal(next.combo, 1);
  assert.equal(next.bestCombo, 1);
  assert.equal(next.correct, 1);
  assert.equal(next.finished, false);
});

test('correct answers never push the clock past the round length', () => {
  const start = tick(createRound(), 500);
  const next = applyAnswer(start, true);
  assert.equal(next.timeLeftMs, ROUND_MS);
});

test('a wrong answer costs time and resets the combo', () => {
  const start = applyAnswer(applyAnswer(createRound(), true), true);
  assert.equal(start.combo, 2);

  const next = applyAnswer(start, false);
  assert.equal(next.combo, 0);
  assert.equal(next.wrong, 1);
  assert.equal(next.timeLeftMs, start.timeLeftMs - WRONG_PENALTY_MS);
  assert.equal(next.bestCombo, 2);
  assert.equal(next.finished, false);
});

test('the round finishes when the clock reaches zero', () => {
  const start = tick(createRound(), ROUND_MS - 1_000);
  const next = applyAnswer(start, false); // −2s from 1s left
  assert.equal(next.timeLeftMs, 0);
  assert.equal(next.finished, true);

  // Nothing changes once finished.
  assert.equal(applyAnswer(next, true), next);
  assert.equal(tick(next, 5_000), next);
});

test('tick counts down and clamps at zero', () => {
  const start = createRound();
  assert.equal(tick(start, 5_000).timeLeftMs, ROUND_MS - 5_000);
  assert.equal(tick(start, ROUND_MS * 2).timeLeftMs, 0);
  assert.equal(tick(start, 0), start);
});

test('clearing the deck pays the bonus exactly once', () => {
  const state = applyAnswer(createRound(), true);
  const cleared = finishCleared(state);

  assert.equal(cleared.cleared, true);
  assert.equal(cleared.finished, true);
  assert.equal(cleared.score, state.score + 250);
  assert.equal(finishCleared(cleared), cleared);
});

test('accuracy is null until something is answered', () => {
  assert.equal(accuracy(createRound()), null);
  const answered = applyAnswer(applyAnswer(createRound(), true), false);
  assert.equal(accuracy(answered), 0.5);
});

test('a new best needs a score above the stored one', () => {
  assert.equal(isNewBest(undefined, 0), false);
  assert.equal(isNewBest(undefined, 120), true);
  assert.equal(isNewBest({ bestScore: 120 }, 120), false);
  assert.equal(isNewBest({ bestScore: 120 }, 130), true);
});
