/**
 * Adaptive learning engine tests.
 *
 * These tests protect the boundary that matters most: FSRS owns intervals, the
 * engine only reorders cards that are already due, and weak evidence produces a
 * cautious label rather than a confident one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningEngine } from '../engine/learningEngine';
import { prioritizeDueCards } from '../scheduling/priority';
import { analyzeMastery } from '../learning/mastery';
import { analyzeWeaknesses } from '../learning/weaknesses';
import { buildStudyProfile } from '../personalization/profile';
import { buildSessionPlan } from '../optimization/session';
import { compareOrdering } from '../evaluation/ordering';
import { normalizeReviewLog } from '../core/normalize';
import { at, makeCard, makeDeck, makeReview, NOW } from './fixtures';
import type { Deck, Flashcard, ReviewLogEntry } from '../../types';

const DAY = 86_400_000;

function reviewsFor(entries: ReviewLogEntry[], decks: Deck[] = [makeDeck()]) {
  return normalizeReviewLog(entries, decks, NOW).reviews;
}

function decisionsFor(cards: Flashcard[], deck = makeDeck({ adaptiveOrdering: true })) {
  return prioritizeDueCards({
    deck,
    dueCards: cards,
    reviewsByCard: new Map(),
    now: NOW,
  });
}

test('adaptive priority puts a due learning step first and a low-R review before a stable review', () => {
  const learning = makeCard({
    id: 'learning',
    state: 'Learning',
    dueInDays: -1,
    stability: 0.5,
    lastReviewDaysAgo: 1,
  });
  const stable = makeCard({
    id: 'stable',
    state: 'Review',
    dueInDays: -1,
    stability: 1000,
    lastReviewDaysAgo: 10,
  });
  const risky = makeCard({
    id: 'risky',
    state: 'Review',
    dueInDays: -2,
    stability: 0.5,
    lastReviewDaysAgo: 10,
  });

  const result = decisionsFor([stable, risky, learning]);
  assert.deepEqual(
    result.ordered.map((card) => card.id),
    ['learning', 'risky', 'stable']
  );
  assert.equal(result.decisions[0].shortReason, 'Learning step due');
  assert.ok(result.decisions[1].evidence.retrievability !== null);
  assert.ok(
    (result.decisions[1].evidence.retrievability ?? 1) <
      (result.decisions[2].evidence.retrievability ?? 1)
  );
  assert.ok(result.decisions[1].signals.some((signal) => signal.kind === 'below_target'));
});

test('priority tie-breaks are deterministic and do not use a weighted composite', () => {
  const base = {
    state: 'Review' as const,
    stability: 5,
    lastReviewDaysAgo: 10,
  };
  const older = makeCard({ ...base, id: 'older', dueInDays: -6 });
  const newer = makeCard({ ...base, id: 'newer', dueInDays: -1 });
  const difficult = makeCard({
    ...base,
    id: 'difficult',
    dueInDays: -6,
    difficulty: 9,
    lapses: 4,
  });
  const easy = makeCard({ ...base, id: 'easy', dueInDays: -6, difficulty: 2, lapses: 0 });

  const result = decisionsFor([newer, easy, difficult, older]);
  const ids = result.ordered.map((card) => card.id);
  assert.ok(ids.indexOf('older') < ids.indexOf('newer'), 'more overdue comes first');
  assert.ok(ids.indexOf('difficult') < ids.indexOf('easy'), 'lapses break an otherwise equal tie');
  assert.deepEqual(result.ordered.map((card) => card.id), decisionsFor([newer, easy, difficult, older]).ordered.map((card) => card.id));
});

test('the engine is deterministic and never mutates the cards it ranks', () => {
  const deck = makeDeck({ adaptiveOrdering: true });
  const cards = [
    makeCard({ id: 'a', state: 'Review', dueInDays: -1, stability: 2, lastReviewDaysAgo: 8 }),
    makeCard({ id: 'b', state: 'Review', dueInDays: -5, stability: 20, lastReviewDaysAgo: 8 }),
    makeCard({ id: 'c', state: 'Review', dueInDays: -2, stability: 1, lastReviewDaysAgo: 20 }),
  ];
  const before = JSON.stringify(cards);
  const input = {
    decks: [deck],
    cardsByDeck: { [deck.id]: cards },
    reviewLog: [] as ReviewLogEntry[],
    deckId: deck.id,
    newCards: [],
    dueCards: cards,
    now: NOW,
  };

  const first = buildLearningEngine(input);
  const second = buildLearningEngine(input);

  assert.deepEqual(
    first.orderedDueCards.map((card) => card.id),
    second.orderedDueCards.map((card) => card.id)
  );
  assert.deepEqual(
    first.decisions.map((decision) => [decision.cardId, decision.priorityRank]),
    second.decisions.map((decision) => [decision.cardId, decision.priorityRank])
  );
  assert.equal(JSON.stringify(cards), before, 'ranking must not rewrite due dates or FSRS state');
  assert.equal(first.policy.affectsDueDates, false);
  assert.ok(first.decisions.every((decision) => Number.isFinite(decision.priority)));
});

test('adaptive ordering off preserves the existing due order; non-FSRS decks fall back too', () => {
  const cards = [
    makeCard({ id: 'first', state: 'Review', dueInDays: -1, stability: 1, lastReviewDaysAgo: 20 }),
    makeCard({ id: 'second', state: 'Review', dueInDays: -2, stability: 100, lastReviewDaysAgo: 2 }),
  ];
  const off = makeDeck({ adaptiveOrdering: false });
  const offResult = buildLearningEngine({
    decks: [off],
    cardsByDeck: { [off.id]: cards },
    reviewLog: [],
    deckId: off.id,
    newCards: [],
    dueCards: cards,
    now: NOW,
  });
  assert.deepEqual(offResult.orderedDueCards.map((card) => card.id), ['first', 'second']);

  const sm2 = makeDeck({ algorithmPreset: 'general', adaptiveOrdering: true });
  const sm2Result = buildLearningEngine({
    decks: [sm2],
    cardsByDeck: { [sm2.id]: cards },
    reviewLog: [],
    deckId: sm2.id,
    newCards: [],
    dueCards: cards,
    now: NOW,
  });
  assert.deepEqual(sm2Result.orderedDueCards.map((card) => card.id), ['first', 'second']);
  assert.equal(sm2Result.status, 'insufficient_data');
  assert.match(sm2Result.decisions[0].reasons[0], /Non-FSRS/);
});

test('mastery levels require post-graduation evidence and never upgrade a single Easy', () => {
  const deck = makeDeck();
  const card = (id: string, overrides: Partial<Parameters<typeof makeCard>[0]> = {}) =>
    makeCard({ id, state: 'Review', stability: 30, lapses: 0, reps: 5, ...overrides });

  const newCard = makeCard({ id: 'new', state: 'New' });
  const learningCard = makeCard({ id: 'learning', state: 'Learning', stability: 1 });
  const oneEasy = card('one-easy', { stability: 5, reps: 1 });
  const established = card('established');
  const strong = card('strong', { stability: 120, reps: 8 });
  const lapsed = card('lapsed', { lapses: 2, stability: 10, reps: 6 });

  const review = (cardId: string, index: number, rating: 1 | 2 | 3 | 4 = 3) =>
    makeReview({
      cardId,
      rating,
      stateBefore: 'Review',
      reviewedAt: at(-(index + 1) * 3, 10),
    });
  const entries = [
    review('one-easy', 0, 4),
    ...[0, 1, 2, 3, 4].map((index) => review('established', index)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((index) => review('strong', index)),
    ...[0, 1, 2].map((index) => review('lapsed', index, 3)),
    ...[3, 4].map((index) => review('lapsed', index, 1)),
  ];
  const normalized = reviewsFor(entries, [deck]);
  const byCard = new Map<string, typeof normalized>();
  for (const entry of normalized) {
    const list = byCard.get(entry.cardId);
    if (list) list.push(entry);
    else byCard.set(entry.cardId, [entry]);
  }

  const result = analyzeMastery({
    deck,
    cards: [newCard, learningCard, oneEasy, established, strong, lapsed],
    reviewsByCard: byCard,
    now: NOW,
  });
  const level = (id: string) => result.cards.find((entry) => entry.cardId === id)?.level;

  assert.equal(level('new'), 'new');
  assert.equal(level('learning'), 'learning');
  assert.equal(level('one-easy'), 'developing');
  assert.equal(level('established'), 'established');
  assert.equal(level('strong'), 'strong');
  assert.equal(level('lapsed'), 'developing');
  assert.ok(result.cards.find((entry) => entry.cardId === 'strong')!.confidence.score > 0);
});

test('Hard ratings are successful post-graduation evidence, never failures', () => {
  const deck = makeDeck();
  const card = makeCard({ id: 'hard-card', state: 'Review', stability: 30, reps: 10, lapses: 0 });
  const normalized = reviewsFor(
    Array.from({ length: 10 }, (_, index) =>
      makeReview({
        cardId: card.id,
        rating: 2,
        stateBefore: 'Review',
        reviewedAt: at(-index - 1, 10),
      })
    ),
    [deck]
  );
  const byCard = new Map([[card.id, normalized.filter((review) => review.cardId === card.id)]]);

  const mastery = analyzeMastery({ deck, cards: [card], reviewsByCard: byCard, now: NOW });
  assert.equal(mastery.cards[0].level, 'established');
  assert.equal(mastery.cards[0].evidence.successes, 10);
  assert.equal(mastery.cards[0].evidence.again, 0);

  const weaknesses = analyzeWeaknesses({
    deck,
    cards: [card],
    reviews: normalized,
    allReviews: normalized,
    now: NOW,
  });
  assert.ok(!weaknesses.items.some((item) => item.kind === 'recent_failures'));
});

test('weakness detection reports observed lapses, sample-gated recent failures, and a separated deck deficit', () => {
  const deck = makeDeck({ id: 'deck-a' });
  const other = makeDeck({ id: 'deck-b' });
  const lapsed = makeCard({ id: 'lapsed', state: 'Review', lapses: 3, reps: 6, stability: 10 });
  const difficult = makeCard({ id: 'difficult', state: 'Review', difficulty: 8, reps: 6 });
  const recentCard = makeCard({ id: 'recent', state: 'Review', reps: 10, stability: 10 });
  const recent = Array.from({ length: 10 }, (_, index) =>
    makeReview({
      cardId: 'recent',
      deckId: deck.id,
      rating: index < 2 ? 1 : 3,
      stateBefore: 'Review',
      reviewedAt: at(-index - 1, 10),
      elapsedMs: 1000,
    })
  );
  const deckReviews = Array.from({ length: 30 }, (_, index) =>
    makeReview({
      cardId: `deck-${index}`,
      deckId: deck.id,
      rating: index < 15 ? 3 : 1,
      stateBefore: 'Review',
      reviewedAt: at(-index - 1, 9),
    })
  );
  const otherReviews = Array.from({ length: 30 }, (_, index) =>
    makeReview({
      cardId: `other-${index}`,
      deckId: other.id,
      rating: index < 29 ? 3 : 1,
      stateBefore: 'Review',
      reviewedAt: at(-index - 1, 9),
    })
  );
  const allRaw = [...recent, ...deckReviews, ...otherReviews];
  const all = reviewsFor(allRaw, [deck, other]);
  const deckNormalized = all.filter((review) => review.deckId === deck.id);

  const result = analyzeWeaknesses({
    deck,
    cards: [lapsed, difficult, recentCard],
    reviews: deckNormalized,
    allReviews: all,
    now: NOW,
  });

  assert.ok(result.items.some((item) => item.cardId === 'lapsed' && item.kind === 'repeated_lapses'));
  assert.ok(result.items.some((item) => item.cardId === 'recent' && item.kind === 'recent_failures'));
  assert.ok(result.items.some((item) => item.cardId === 'difficult' && item.kind === 'high_difficulty'));
  assert.ok(result.items.some((item) => item.scope === 'deck' && item.kind === 'deck_below_library'));
});

test('profile stays empty or insufficient until the evidence floor is met', () => {
  assert.equal(buildStudyProfile([], NOW).status, 'empty');
  const small = reviewsFor(
    Array.from({ length: 8 }, (_, index) =>
      makeReview({ cardId: `small-${index}`, reviewedAt: at(-index, 10), elapsedMs: 8000 })
    )
  );
  const insufficient = buildStudyProfile(small, NOW);
  assert.equal(insufficient.status, 'insufficient_data');
  assert.equal(insufficient.pace.medianMs, null);
});

test('profile uses the learner’s own pace and only reports a study window when intervals separate', () => {
  const entries = [
    ...Array.from({ length: 30 }, (_, index) =>
      makeReview({
        cardId: `evening-${index}`,
        rating: 3,
        reviewedAt: at(-index - 1, 19, 10),
        elapsedMs: 9000,
        stateBefore: 'Review',
      })
    ),
    ...Array.from({ length: 30 }, (_, index) =>
      makeReview({
        cardId: `morning-${index}`,
        rating: 1,
        reviewedAt: at(-index - 1, 9, 10),
        elapsedMs: 9000,
        stateBefore: 'Review',
      })
    ),
  ];
  const normalized = reviewsFor(entries);
  const profile = buildStudyProfile(normalized, NOW);

  assert.equal(profile.pace.medianMs, 9000);
  assert.equal(profile.preferredWindow?.id, 'evening');
  assert.ok(profile.preferredWindow?.separated);
  assert.ok(profile.adaptations.some((adaptation) => adaptation.id === 'pace'));
  assert.ok(profile.adaptations.some((adaptation) => adaptation.id === 'study-window'));
});

test('session planning projects duration from the profile and never removes cards', () => {
  const entries = Array.from({ length: 20 }, (_, index) =>
    makeReview({
      cardId: `pace-${index}`,
      reviewedAt: at(-index, 10),
      elapsedMs: 10_000,
    })
  );
  const normalized = reviewsFor(entries);
  const profile = buildStudyProfile(normalized, NOW);
  const dueCards = Array.from({ length: 10 }, (_, index) =>
    makeCard({ id: `due-${index}`, state: 'Review', dueInDays: -1 })
  );
  const plan = buildSessionPlan({
    newCards: [],
    dueCards,
    decisionsByCard: {},
    profile,
  });

  assert.equal(plan.cardCount, 10);
  assert.equal(plan.dueCards, 10);
  assert.equal(plan.projectedDurationMs, 100_000);
  assert.equal(plan.projectedMinutes, 1.7);
  assert.equal(plan.breakSuggestion, null);
  assert.match(plan.note, /No cards are removed/);
});

test('a break cue is evidence-gated by late-session decline and the learner’s median session', () => {
  const entries: ReviewLogEntry[] = [];
  for (let session = 0; session < 10; session += 1) {
    for (let index = 0; index < 9; index += 1) {
      entries.push(
        makeReview({
          cardId: `s-${session}-${index}`,
          rating: index >= 6 ? 1 : 3,
          stateBefore: 'Review',
          reviewedAt: at(-(10 - session), 9, index * 2),
          elapsedMs: 5000,
        })
      );
    }
  }
  const normalized = reviewsFor(entries);
  const profile = buildStudyProfile(normalized, NOW);
  assert.equal(profile.intraSession.status, 'ok');
  assert.equal(profile.intraSession.direction, 'declining');

  const dueCards = Array.from({ length: 20 }, (_, index) =>
    makeCard({ id: `due-${index}`, state: 'Review', dueInDays: -1 })
  );
  const plan = buildSessionPlan({
    newCards: [],
    dueCards,
    decisionsByCard: {},
    profile,
  });

  assert.ok(plan.breakSuggestion);
  assert.equal(plan.breakSuggestion?.afterReviews, 9);
  assert.match(plan.breakSuggestion?.reason ?? '', /association, not a fatigue diagnosis/);
});

test('structural evaluation moves at-risk cards earlier without claiming an outcome improvement', () => {
  const risky = makeCard({
    id: 'risky',
    state: 'Review',
    dueInDays: -10,
    stability: 0.5,
    lastReviewDaysAgo: 20,
  });
  const stable = makeCard({
    id: 'stable',
    state: 'Review',
    dueInDays: -1,
    stability: 500,
    lastReviewDaysAgo: 5,
  });
  const priority = decisionsFor([stable, risky]);
  const evaluation = compareOrdering({
    before: [stable, risky],
    after: priority.ordered,
    decisionsByCard: priority.decisionsByCard,
  });

  assert.equal(evaluation.status, 'ok');
  assert.equal(evaluation.atRiskCards, 1);
  assert.ok(evaluation.firstAtRiskPosition.after! < evaluation.firstAtRiskPosition.before!);
  assert.match(evaluation.note, /Structural comparison only/);
  assert.ok(evaluation.limitations.some((limitation) => /cannot reveal/.test(limitation)));
});

test('a due card with no finite FSRS retrievability still produces deterministic, finite decisions', () => {
  const card = makeCard({
    id: 'missing-state',
    state: 'Review',
    dueInDays: -1,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
  });
  const result = decisionsFor([card]);
  assert.equal(result.ordered.length, 1);
  assert.equal(result.decisions[0].evidence.retrievability, null);
  assert.ok(Number.isFinite(result.decisions[0].priority));
  assert.equal(result.decisions[0].confidence.level, 'insufficient');
});

test('a missing deck and an empty queue return safe, non-fabricated results', () => {
  const missing = buildLearningEngine({
    decks: [],
    cardsByDeck: {},
    reviewLog: [],
    deckId: 'missing',
    newCards: [],
    dueCards: [],
    now: NOW,
  });
  assert.equal(missing.status, 'empty');
  assert.equal(missing.decisions.length, 0);
  assert.equal(missing.mastery.evaluated, 0);

  const deck = makeDeck({ adaptiveOrdering: true });
  const empty = buildLearningEngine({
    decks: [deck],
    cardsByDeck: { [deck.id]: [] },
    reviewLog: [],
    deckId: deck.id,
    newCards: [],
    dueCards: [],
    now: NOW,
  });
  assert.equal(empty.status, 'empty');
  assert.equal(empty.session.cardCount, 0);
  assert.equal(empty.decisions.length, 0);
});

test('large queues remain complete and deterministic', () => {
  const cards = Array.from({ length: 250 }, (_, index) =>
    makeCard({
      id: `bulk-${index}`,
      state: 'Review',
      dueInDays: -(index % 20),
      stability: (index % 40) + 0.5,
      lastReviewDaysAgo: 1 + (index % 30),
    })
  );
  const result = decisionsFor(cards);
  assert.equal(result.decisions.length, 250);
  assert.equal(new Set(result.ordered.map((card) => card.id)).size, 250);
  assert.ok(result.decisions.every((decision) => Number.isFinite(decision.priority)));
});
