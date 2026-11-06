/**
 * Deck intelligence — per-deck performance with fair comparison.
 *
 * A small deck can show 100% recall off three reviews. Comparison is therefore
 * gated at `MIN_DECK_SAMPLE` reviews, and two decks are only called different
 * when their Wilson intervals separate. Trend labels need a minimum in *each*
 * half, so a deck that was reviewed twice yesterday cannot be "declining".
 */

import type { Deck, Flashcard } from '../../types';
import type {
  AnalyticsRange,
  DeckAnalysis,
  DeckComparison,
  DeckIntelligence,
  DeckTrendDirection,
  NormalizedReview,
  RecallMetrics,
} from '../core/types';
import { addDays, startOfDay } from '../core/dates';
import { MIN_DECK_SAMPLE, MIN_RECALL_CHANGE } from '../core/constants';
import { confidenceFor } from '../core/stats';
import { computeDuration, computeRecall } from './metrics';
import { reviewsInRange } from './series';

const TREND_HALF_SAMPLE = 15;

type AnalyzeDecksParams = {
  decks: readonly Deck[];
  cardsByDeck: Record<string, Flashcard[]>;
  /** Reviews inside the analysed range. */
  reviews: readonly NormalizedReview[];
  /** Every usable review (all time), for last-studied timestamps. */
  allReviews: readonly NormalizedReview[];
  libraryRecall: RecallMetrics;
  range: AnalyticsRange;
  now: number;
  includeArchived: boolean;
};

function compareToLibrary(deck: RecallMetrics, library: RecallMetrics): DeckComparison {
  if (
    deck.sampleSize < MIN_DECK_SAMPLE ||
    library.sampleSize < MIN_DECK_SAMPLE ||
    !deck.successInterval ||
    !library.successInterval
  ) {
    return 'insufficient_data';
  }
  if (deck.successInterval.low > library.successInterval.high) return 'above';
  if (deck.successInterval.high < library.successInterval.low) return 'below';
  return 'typical';
}

function deckTrend(
  deckReviews: readonly NormalizedReview[],
  range: AnalyticsRange
): DeckTrendDirection {
  const middle = addDays(range.start, Math.floor(range.days / 2));
  const first = computeRecall(reviewsInRange(deckReviews, range.start, addDays(middle, -1)));
  const second = computeRecall(reviewsInRange(deckReviews, middle, range.end));

  if (
    first.sampleSize < TREND_HALF_SAMPLE ||
    second.sampleSize < TREND_HALF_SAMPLE ||
    first.successRate === null ||
    second.successRate === null ||
    !first.successInterval ||
    !second.successInterval
  ) {
    return 'insufficient_data';
  }

  const change = second.successRate - first.successRate;
  const separated =
    second.successInterval.low > first.successInterval.high ||
    second.successInterval.high < first.successInterval.low;

  if (!separated || Math.abs(change) < MIN_RECALL_CHANGE) return 'stable';
  return change > 0 ? 'improving' : 'declining';
}

export function analyzeDecks({
  decks,
  cardsByDeck,
  reviews,
  allReviews,
  libraryRecall,
  range,
  now,
  includeArchived,
}: AnalyzeDecksParams): DeckAnalysis {
  const today = startOfDay(now);
  const next7End = addDays(today, 6);
  const scopedDecks = decks.filter((deck) => includeArchived || !deck.archivedAt);

  const results: DeckIntelligence[] = scopedDecks.map((deck) => {
    const cards = cardsByDeck[deck.id] ?? [];
    const deckReviews = reviews.filter((review) => review.deckId === deck.id);
    const recall = computeRecall(deckReviews);
    const duration = computeDuration(deckReviews);

    const lapseSample = deckReviews.filter((review) => review.stateBefore === 'Review').length;
    const lapses = deckReviews.filter((review) => review.isLapse === true).length;

    let scheduled = 0;
    let overdue = 0;
    let newCards = 0;
    let next7 = 0;
    let studied = 0;

    for (const card of cards) {
      if (card.fsrs.last_review != null) studied += 1;
      if (card.fsrs.state === 'New') {
        newCards += 1;
        continue;
      }
      const dueAt = new Date(card.fsrs.due).getTime();
      if (!Number.isFinite(dueAt)) continue;
      const dueDay = startOfDay(dueAt);
      if (dueAt <= now) scheduled += 1;
      if (dueDay < today) overdue += 1;
      if (dueDay >= today && dueDay <= next7End) next7 += 1;
    }

    const lastReviewedAt =
      allReviews
        .filter((review) => review.deckId === deck.id)
        .reduce<number | null>(
          (latest, review) => (latest === null || review.reviewedAt > latest ? review.reviewedAt : latest),
          null
        ) ?? null;

    return {
      deckId: deck.id,
      name: deck.name,
      algorithm: deck.algorithmPreset,
      cardCount: cards.length,
      studiedCards: studied,
      progress: cards.length > 0 ? studied / cards.length : null,
      reviews: deckReviews.length,
      shareOfReviews: reviews.length > 0 ? deckReviews.length / reviews.length : 0,
      recall: {
        successRate: recall.successRate,
        interval: recall.successInterval,
        sampleSize: recall.sampleSize,
      },
      medianDurationMs: duration.medianMs,
      lapse: {
        lapses,
        rate: lapseSample >= MIN_DECK_SAMPLE ? lapses / lapseSample : null,
        sampleSize: lapseSample,
      },
      due: { scheduled, overdue, newCards, next7 },
      vsLibrary: compareToLibrary(recall, libraryRecall),
      trend: deckTrend(deckReviews, range),
      confidence: confidenceFor(recall.sampleSize, recall.successInterval, 'rated reviews in this deck'),
      lastReviewedAt,
    };
  });

  results.sort((a, b) => b.reviews - a.reviews || a.name.localeCompare(b.name));

  const comparableCount = results.filter((deck) => deck.recall.sampleSize >= MIN_DECK_SAMPLE).length;

  const needsAttention = results
    .filter((deck) => {
      const weakRecall =
        deck.recall.successRate !== null &&
        deck.recall.sampleSize >= MIN_DECK_SAMPLE &&
        deck.recall.successRate < 0.75;
      const highLapse = deck.lapse.rate !== null && deck.lapse.rate >= 0.2;
      return weakRecall || highLapse || deck.due.overdue >= 10;
    })
    .sort(
      (a, b) =>
        b.due.overdue - a.due.overdue ||
        (b.lapse.rate ?? 0) - (a.lapse.rate ?? 0) ||
        (a.recall.successRate ?? 1) - (b.recall.successRate ?? 1)
    )
    .slice(0, 3);

  return {
    status:
      results.length === 0
        ? 'empty'
        : comparableCount === 0
          ? 'insufficient_data'
          : 'ok',
    decks: results,
    comparableCount,
    needsAttention,
    excluded: {
      archived: decks.filter((deck) => Boolean(deck.archivedAt)).length,
      empty: results.filter((deck) => deck.cardCount === 0).length,
    },
  };
}
