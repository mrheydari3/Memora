/**
 * Memory intelligence — FSRS decks only.
 *
 * The FSRS fields are reused by the SM-2 scheduler (`stability` holds ease,
 * `difficulty` holds the interval), so reading them from a non-FSRS deck would
 * invent memory numbers that mean nothing. Those cards are excluded and the
 * exclusion is reported.
 *
 * Three different things are exposed and never merged:
 *   - scheduler states (New / Learning / Review / Relearning) — a schedule phase,
 *   - lapses and stability/difficulty — FSRS model state,
 *   - retrievability R(now) and R(due) — FSRS probability estimates.
 *
 * None of them is measured memory retention. A Review card is not "mastered":
 * it has simply graduated to long-term intervals and still carries a finite
 * stability.
 */

import type { Deck, Flashcard } from '../../types';
import type {
  AttentionCard,
  DistributionBucket,
  MemoryMetrics,
  MemoryStateCounts,
  NormalizedReview,
} from '../core/types';
import { DAY_MS, startOfDay } from '../core/dates';
import {
  LEECH_THRESHOLD,
  MIN_RECALL_SAMPLE,
  REPEATED_FAILURE_THRESHOLD,
} from '../core/constants';
import { createFSRSScheduler } from '../../schedulers/fsrs';
import { resolveFsrsParams } from '../../fsrs-params';

const EMPTY_STATES: MemoryStateCounts = { New: 0, Learning: 0, Review: 0, Relearning: 0 };

function bucketize(
  values: readonly number[],
  buckets: readonly { key: string; label: string; test: (value: number) => boolean }[]
): DistributionBucket[] {
  const sample = values.length;
  return buckets.map((bucket) => {
    const count = values.filter(bucket.test).length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      share: sample > 0 ? count / sample : null,
    };
  });
}

const STABILITY_BUCKETS = [
  { key: 'lt1', label: 'Under 1 day', test: (value: number) => value > 0 && value < 1 },
  { key: '1to7', label: '1–7 days', test: (value: number) => value >= 1 && value < 7 },
  { key: '7to30', label: '7–30 days', test: (value: number) => value >= 7 && value < 30 },
  { key: '30to90', label: '30–90 days', test: (value: number) => value >= 30 && value < 90 },
  { key: '90plus', label: '90+ days', test: (value: number) => value >= 90 },
] as const;

const DIFFICULTY_BUCKETS = [
  { key: 'easy', label: '1–3 easy', test: (value: number) => value >= 1 && value < 3 },
  { key: 'moderate', label: '3–5 moderate', test: (value: number) => value >= 3 && value < 5 },
  { key: 'hard', label: '5–7 hard', test: (value: number) => value >= 5 && value < 7 },
  { key: 'veryhard', label: '7–10 very hard', test: (value: number) => value >= 7 },
] as const;

export function analyzeMemory(
  decks: readonly Deck[],
  cardsByDeck: Record<string, Flashcard[]>,
  reviews: readonly NormalizedReview[],
  now: number
): MemoryMetrics {
  const fsrsDecks = decks.filter((deck) => deck.algorithmPreset === 'fsrs');
  const nonFsrsDecks = decks.length - fsrsDecks.length;
  const states: MemoryStateCounts = { ...EMPTY_STATES };

  const stabilities: number[] = [];
  const difficulties: number[] = [];
  const candidates: AttentionCard[] = [];

  let fsrsCards = 0;
  let cardsWithState = 0;
  let cardsWithLapses = 0;
  let repeatedFailureCards = 0;
  let leeches = 0;
  let totalLapses = 0;
  let evaluated = 0;
  let atRisk = 0;
  let approaching = 0;
  let overdue = 0;
  let retrievabilitySum = 0;
  let thresholdSum = 0;
  // Only decks that actually contribute cards may enter the average; dividing
  // by every FSRS deck made an empty deck drag the target down (0.9 became 0.72).
  let thresholdDecks = 0;

  const today = startOfDay(now);

  for (const deck of fsrsDecks) {
    const cards = cardsByDeck[deck.id] ?? [];
    if (cards.length === 0) continue;

    const scheduler = createFSRSScheduler(deck);
    const target = resolveFsrsParams(deck).requestRetention;
    thresholdSum += target;
    thresholdDecks += 1;

    for (const card of cards) {
      fsrsCards += 1;
      states[card.fsrs.state] += 1;
      totalLapses += Math.max(0, card.fsrs.lapses || 0);

      if (card.fsrs.stability > 0) {
        cardsWithState += 1;
        stabilities.push(card.fsrs.stability);
      }
      if (card.fsrs.difficulty > 0) difficulties.push(card.fsrs.difficulty);

      if (card.fsrs.lapses > 0) cardsWithLapses += 1;
      if (card.fsrs.lapses >= REPEATED_FAILURE_THRESHOLD) repeatedFailureCards += 1;
      if (card.fsrs.lapses >= LEECH_THRESHOLD) leeches += 1;

      const dueAt = new Date(card.fsrs.due).getTime();
      const isScheduled = card.fsrs.state === 'Review' || card.fsrs.state === 'Relearning';
      if (isScheduled && Number.isFinite(dueAt) && dueAt <= now) overdue += 1;

      // The scheduler's own curve and the deck's own parameters — never a
      // re-implementation of R(t, S).
      const retrievability = scheduler.getRetrievability(card, new Date(now));
      if (retrievability === null) continue;

      evaluated += 1;
      retrievabilitySum += retrievability;
      if (retrievability < target) atRisk += 1;
      else if (retrievability < target + 0.05) approaching += 1;

      const needsAttention =
        retrievability < target ||
        card.fsrs.lapses >= REPEATED_FAILURE_THRESHOLD ||
        (isScheduled && dueAt <= today);
      if (!needsAttention) continue;

      candidates.push({
        cardId: card.id,
        deckId: deck.id,
        deckName: deck.name,
        front: card.front.text,
        state: card.fsrs.state,
        stability: card.fsrs.stability,
        difficulty: card.fsrs.difficulty,
        lapses: card.fsrs.lapses,
        retrievability,
        dueAt,
        overdueDays:
          Number.isFinite(dueAt) && dueAt < today
            ? Math.max(0, Math.round((today - startOfDay(dueAt)) / DAY_MS))
            : 0,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.lapses - a.lapses || (a.retrievability ?? 1) - (b.retrievability ?? 1)
  );

  const reviewStateReviews = reviews.filter((review) => review.stateBefore === 'Review').length;
  const logLapses = reviews.filter((review) => review.isLapse === true).length;
  const medianStability =
    stabilities.length === 0
      ? null
      : [...stabilities].sort((a, b) => a - b)[Math.floor(stabilities.length / 2)];
  const meanDifficulty =
    difficulties.length === 0
      ? null
      : difficulties.reduce((total, value) => total + value, 0) / difficulties.length;

  return {
    status: fsrsCards === 0 ? 'empty' : cardsWithState === 0 ? 'insufficient_data' : 'ok',
    coverage: {
      fsrsDecks: fsrsDecks.length,
      nonFsrsDecks,
      fsrsCards,
      cardsWithState,
      excludedCards: decks
        .filter((deck) => deck.algorithmPreset !== 'fsrs')
        .reduce((total, deck) => total + (cardsByDeck[deck.id]?.length ?? 0), 0),
      note:
        nonFsrsDecks > 0
          ? `Memory analytics cover FSRS decks only. ${nonFsrsDecks} deck${
              nonFsrsDecks === 1 ? '' : 's'
            } on another scheduler ${
              nonFsrsDecks === 1 ? 'is' : 'are'
            } excluded: their state reuses the FSRS fields for different values.`
          : 'All decks use FSRS, so every reviewed card has a memory state.',
    },
    states,
    inReviewSchedule: {
      count: states.Review,
      share: fsrsCards > 0 ? states.Review / fsrsCards : null,
    },
    stability: {
      buckets: bucketize(stabilities, STABILITY_BUCKETS),
      median: medianStability,
      sampleSize: stabilities.length,
    },
    difficulty: {
      buckets: bucketize(difficulties, DIFFICULTY_BUCKETS),
      mean: meanDifficulty,
      sampleSize: difficulties.length,
    },
    lapses: {
      total: totalLapses,
      lapseRate:
        reviewStateReviews >= MIN_RECALL_SAMPLE
          ? logLapses / reviewStateReviews
          : null,
      reviewStateReviews,
      cardsWithLapses,
      repeatedFailureCards,
      leeches,
    },
    retention: {
      threshold: thresholdDecks > 0 ? thresholdSum / thresholdDecks : null,
      atRisk,
      approaching,
      evaluatedCards: evaluated,
      overdue,
      meanRetrievability: evaluated > 0 ? retrievabilitySum / evaluated : null,
    },
    attention: candidates.slice(0, 8),
  };
}
