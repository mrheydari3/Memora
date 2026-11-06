/**
 * Mastery and weakness evidence for FSRS cards.
 *
 * "Mastery" here is an evidence-gated label, not a measurement of the brain and
 * not a permanent property of a card. It requires post-graduation reviews,
 * observed successes, FSRS stability and the absence of recent lapses. A single
 * Easy rating can never make a card Established or Strong.
 */

import type { Deck, Flashcard } from '../../types';
import type { NormalizedReview } from '../core/types';
import type {
  MasteryAnalysis,
  MasteryEstimate,
  MasteryLevel,
} from '../engine/types';
import { DAY_MS } from '../core/dates';
import { confidenceFor, wilsonInterval } from '../core/stats';
import { createFSRSScheduler } from '../../schedulers/fsrs';
import { resolveFsrsParams } from '../../fsrs-params';

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  new: 'New',
  learning: 'Learning',
  developing: 'Developing',
  established: 'Established',
  strong: 'Strong retention',
};

/** Product evidence thresholds, not scientific laws. */
export const MASTERY_THRESHOLDS = {
  establishedReviews: 5,
  strongReviews: 8,
  establishedStabilityDays: 21,
  strongStabilityDays: 90,
  establishedSuccessRate: 0.8,
  strongSuccessRate: 0.85,
  maxEstablishedLapses: 1,
  maxStrongLapses: 0,
  recentLapseWindowDays: 60,
} as const;

const EMPTY_COUNTS: Record<MasteryLevel, number> = {
  new: 0,
  learning: 0,
  developing: 0,
  established: 0,
  strong: 0,
};

export function analyzeMastery(input: {
  deck: Deck;
  cards: Flashcard[];
  reviewsByCard: ReadonlyMap<string, NormalizedReview[]>;
  now: number;
}): MasteryAnalysis {
  const { deck, cards, reviewsByCard, now } = input;

  if (deck.algorithmPreset !== 'fsrs') {
    return {
      status: 'insufficient_data',
      evaluated: 0,
      counts: { ...EMPTY_COUNTS },
      cards: [],
      note:
        'Mastery evidence requires FSRS memory state. This deck uses another scheduler, so no mastery labels are produced.',
    };
  }

  const target = resolveFsrsParams(deck).requestRetention;

  const estimates: MasteryEstimate[] = cards.map((card) => {
    const allReviews = reviewsByCard.get(card.id) ?? [];
    // Learning-step ratings do not establish long-term mastery. Count only the
    // reviews whose pre-review state was already Review.
    const reviews = allReviews.filter((review) => review.stateBefore === 'Review');
    const successes = reviews.filter((review) => review.rating >= 2).length;
    const again = reviews.filter((review) => review.rating === 1).length;
    const recentLapses = reviews.filter(
      (review) =>
        review.rating === 1 &&
        review.reviewedAt >= now - MASTERY_THRESHOLDS.recentLapseWindowDays * DAY_MS
    ).length;
    const successRate = reviews.length > 0 ? successes / reviews.length : null;
    const interval = wilsonInterval(successes, reviews.length);
    const lastReviewedAt =
      reviews.length > 0
        ? reviews[reviews.length - 1].reviewedAt
        : card.fsrs.last_review
          ? new Date(card.fsrs.last_review).getTime()
          : null;
    const confidence = confidenceFor(reviews.length, interval, 'post-graduation reviews');

    let level: MasteryLevel;
    if (card.fsrs.state === 'New' && reviews.length === 0) {
      level = 'new';
    } else if (card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning') {
      level = 'learning';
    } else if (
      reviews.length >= MASTERY_THRESHOLDS.strongReviews &&
      successes >= MASTERY_THRESHOLDS.strongReviews &&
      successRate !== null &&
      successRate >= MASTERY_THRESHOLDS.strongSuccessRate &&
      card.fsrs.stability >= MASTERY_THRESHOLDS.strongStabilityDays &&
      card.fsrs.lapses <= MASTERY_THRESHOLDS.maxStrongLapses &&
      recentLapses === 0
    ) {
      level = 'strong';
    } else if (
      reviews.length >= MASTERY_THRESHOLDS.establishedReviews &&
      successes >= MASTERY_THRESHOLDS.establishedReviews &&
      successRate !== null &&
      successRate >= MASTERY_THRESHOLDS.establishedSuccessRate &&
      card.fsrs.stability >= MASTERY_THRESHOLDS.establishedStabilityDays &&
      card.fsrs.lapses <= MASTERY_THRESHOLDS.maxEstablishedLapses &&
      recentLapses === 0
    ) {
      level = 'established';
    } else {
      level = 'developing';
    }

    const rationale =
      level === 'new'
        ? 'No reviews yet.'
        : level === 'learning'
          ? 'The card is still in a learning or relearning step.'
          : reviews.length === 0
            ? 'No post-graduation reviews are available, so a strong label is not justified.'
            : `${successes} of ${reviews.length} post-graduation reviews were successful; FSRS stability is ${card.fsrs.stability.toFixed(1)} days and ${card.fsrs.lapses} lapse${card.fsrs.lapses === 1 ? '' : 's'} are recorded.`;

    return {
      cardId: card.id,
      deckId: deck.id,
      level,
      label: MASTERY_LABELS[level],
      confidence,
      evidence: {
        reviewStateReviews: reviews.length,
        successes,
        again,
        lapses: card.fsrs.lapses,
        stability: card.fsrs.stability,
        difficulty: card.fsrs.difficulty,
        retrievability:
          card.fsrs.state === 'New'
            ? null
            : createFSRSScheduler(deck).getRetrievability(card, new Date(now)),
        desiredRetention: target,
        lastReviewedAt,
      },
      rationale,
      limitations: [
        'A scheduler phase and an FSRS stability estimate are not measured real-world mastery.',
        'Recent failure history can lower the label; a single Easy rating cannot raise it to Established or Strong.',
      ],
    };
  });

  const counts = { ...EMPTY_COUNTS };
  for (const estimate of estimates) counts[estimate.level] += 1;

  const evaluated = estimates.filter(
    (estimate) => estimate.evidence.reviewStateReviews > 0
  ).length;

  return {
    status: cards.length === 0 ? 'empty' : evaluated === 0 ? 'insufficient_data' : 'ok',
    evaluated,
    counts,
    cards: estimates,
    note:
      'Mastery labels are evidence-gated summaries of observed reviews and FSRS state. They are not permanent and do not guarantee recall.',
  };
}
