/**
 * Learning intelligence engine — the integration point for the study screen.
 *
 * Input is the real library and the queue the existing caps already selected.
 * Output is an evidence-explained due order plus mastery, weakness, profile and
 * session summaries. It is deterministic for a fixed clock and does not mutate
 * cards, review history, FSRS parameters or due dates.
 */

import type { LearningEngineInput, LearningEngineResult } from './types';
import { normalizeReviewLog } from '../core/normalize';
import { prioritizeDueCards } from '../scheduling/priority';
import { analyzeMastery } from '../learning/mastery';
import { analyzeWeaknesses } from '../learning/weaknesses';
import { buildStudyProfile } from '../personalization/profile';
import { buildSessionPlan } from '../optimization/session';
import { compareOrdering } from '../evaluation/ordering';

export const ADAPTIVE_POLICY = {
  name: 'fsrs_priority_v1' as const,
  description:
    'Orders already-due cards by FSRS-estimated recall risk. The existing FSRS schedule remains the only source of due dates.',
  affectsDueDates: false as const,
  experimental: true as const,
};

function emptyMastery() {
  return {
    status: 'empty' as const,
    evaluated: 0,
    counts: { new: 0, learning: 0, developing: 0, established: 0, strong: 0 },
    cards: [],
    note: 'The deck could not be found.',
  };
}

export function buildLearningEngine(input: LearningEngineInput): LearningEngineResult {
  const now = input.now ?? Date.now();
  const deck = input.decks.find((entry) => entry.id === input.deckId);

  if (!deck) {
    const profile = buildStudyProfile([], now);
    return {
      generatedAt: now,
      deckId: input.deckId,
      status: 'empty',
      adaptiveOrdering: false,
      reviewsAnalyzed: 0,
      decisions: [],
      decisionsByCard: {},
      orderedDueCards: [...input.dueCards],
      mastery: emptyMastery(),
      weaknesses: {
        status: 'empty',
        items: [],
        note: 'The deck could not be found.',
      },
      profile,
      session: buildSessionPlan({
        newCards: input.newCards,
        dueCards: input.dueCards,
        decisionsByCard: {},
        profile,
      }),
      evaluation: {
        status: 'insufficient_data',
        sampleSize: 0,
        atRiskCards: 0,
        firstAtRiskPosition: { before: null, after: null },
        medianAtRiskPosition: { before: null, after: null },
        firstHalfAtRiskShare: { before: null, after: null },
        overdueMovedEarlier: 0,
        note: 'The deck could not be found.',
        limitations: ['No analysis was run.'],
      },
      policy: ADAPTIVE_POLICY,
    };
  }

  const normalized = normalizeReviewLog(input.reviewLog, input.decks, now);
  const allReviews = normalized.reviews.filter((review) => !review.archived);
  const deckReviews = allReviews.filter((review) => review.deckId === deck.id);

  const reviewsByCard = new Map<string, typeof deckReviews>();
  for (const review of deckReviews) {
    const list = reviewsByCard.get(review.cardId);
    if (list) list.push(review);
    else reviewsByCard.set(review.cardId, [review]);
  }

  const priority = prioritizeDueCards({
    deck,
    dueCards: input.dueCards,
    reviewsByCard,
    now,
  });

  const adaptiveOrdering = deck.adaptiveOrdering === true;
  const orderedDueCards = adaptiveOrdering
    ? priority.ordered
    : [...input.dueCards];

  const cards = input.cardsByDeck[deck.id] ?? [];
  const mastery = analyzeMastery({
    deck,
    cards,
    reviewsByCard,
    now,
  });
  const weaknesses = analyzeWeaknesses({
    deck,
    cards,
    reviews: deckReviews,
    allReviews,
    now,
  });
  const profile = buildStudyProfile(allReviews, now);
  const decisionsByCard = priority.decisionsByCard;
  const session = buildSessionPlan({
    newCards: input.newCards,
    dueCards: orderedDueCards,
    decisionsByCard,
    profile,
  });
  const evaluation = compareOrdering({
    before: input.dueCards,
    after: priority.ordered,
    decisionsByCard,
  });

  return {
    generatedAt: now,
    deckId: deck.id,
    status: deck.algorithmPreset === 'fsrs' ? priority.status : 'insufficient_data',
    adaptiveOrdering,
    reviewsAnalyzed: allReviews.length,
    decisions: orderedDueCards
      .map((card) => decisionsByCard[card.id])
      .filter((decision): decision is NonNullable<typeof decision> => Boolean(decision)),
    decisionsByCard,
    orderedDueCards,
    mastery,
    weaknesses,
    profile,
    session,
    evaluation,
    policy: ADAPTIVE_POLICY,
  };
}
