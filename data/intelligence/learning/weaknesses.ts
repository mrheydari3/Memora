/**
 * Weakness detection — descriptive, sample-gated and intentionally modest.
 *
 * A repeated lapse is an observed event. A low success rate is an observed
 * proportion with a Wilson interval. FSRS difficulty and stability are model
 * estimates, so they can suggest an area to inspect but are never presented as
 * measured failure.
 *
 * A card gets at most one card-level item, ordered by how directly the evidence
 * is observed. A deck is compared with the rest of the library only when both
 * sides have at least 30 rated reviews and their Wilson intervals do not overlap.
 */

import type { Deck, Flashcard } from '../../types';
import type { NormalizedReview } from '../core/types';
import type {
  LearningWeakness,
  WeaknessAnalysis,
  WeaknessKind,
} from '../engine/types';
import { DAY_MS } from '../core/dates';
import { confidenceFor, wilsonInterval } from '../core/stats';

const RECENT_WINDOW_DAYS = 60;
const DECK_WINDOW_DAYS = 90;
const MIN_DECK_SAMPLE = 30;
const MIN_RECENT_FAILURE_SAMPLE = 10;

const SEVERITY: Record<WeaknessKind, number> = {
  recent_failures: 0,
  repeated_lapses: 1,
  deck_below_library: 2,
  high_difficulty: 3,
  short_stability: 4,
};

function cardWeakness(
  deck: Deck,
  card: Flashcard,
  reviews: NormalizedReview[],
  now: number
): LearningWeakness | null {
  const recent = reviews.filter(
    (review) => review.reviewedAt >= now - RECENT_WINDOW_DAYS * DAY_MS
  );
  const recentAgain = recent.filter((review) => review.rating === 1).length;
  const recentInterval = wilsonInterval(recentAgain, recent.length);

  if (
    recent.length >= MIN_RECENT_FAILURE_SAMPLE &&
    recentAgain >= 2 &&
    recentInterval !== null
  ) {
    return {
      id: `card:${card.id}:recent_failures`,
      kind: 'recent_failures',
      scope: 'card',
      cardId: card.id,
      deckId: deck.id,
      title: 'Repeated recent failures',
      detail: `${recentAgain} Again ratings in the last ${RECENT_WINDOW_DAYS} days.`,
      evidence: [
        `${recentAgain} of ${recent.length} recent reviews were Again.`,
        `95% Wilson interval for the Again rate: ${(recentInterval.low * 100).toFixed(0)}–${(recentInterval.high * 100).toFixed(0)}%.`,
      ],
      confidence: confidenceFor(recent.length, recentInterval, 'recent reviews'),
    };
  }

  if (card.fsrs.lapses >= 2) {
    return {
      id: `card:${card.id}:repeated_lapses`,
      kind: 'repeated_lapses',
      scope: 'card',
      cardId: card.id,
      deckId: deck.id,
      title: 'Repeated lapses',
      detail: `${card.fsrs.lapses} lapses are recorded for this card.`,
      evidence: [
        'A lapse is Again on a card that had already graduated to Review.',
        'The threshold of two is a product cue, not a diagnosis.',
      ],
      confidence: {
        level: 'medium',
        score: 0.6,
        sampleSize: card.fsrs.reps,
        rationale: `${card.fsrs.lapses} lapses are recorded events; the label is a review cue.`,
      },
    };
  }

  if (card.fsrs.difficulty >= 7 && card.fsrs.reps >= 5) {
    return {
      id: `card:${card.id}:high_difficulty`,
      kind: 'high_difficulty',
      scope: 'card',
      cardId: card.id,
      deckId: deck.id,
      title: 'High FSRS difficulty',
      detail: `Difficulty is ${card.fsrs.difficulty.toFixed(1)} of 10.`,
      evidence: [
        'Difficulty is a latent FSRS variable fitted to ratings, not an observed failure count.',
        `${card.fsrs.reps} reviews inform this card's state.`,
      ],
      confidence: {
        level: 'low',
        score: 0.35,
        sampleSize: card.fsrs.reps,
        rationale: 'This is a model estimate, not a measured failure.',
      },
    };
  }

  if (
    card.fsrs.state === 'Review' &&
    card.fsrs.stability > 0 &&
    card.fsrs.stability < 7 &&
    card.fsrs.reps >= 3
  ) {
    return {
      id: `card:${card.id}:short_stability`,
      kind: 'short_stability',
      scope: 'card',
      cardId: card.id,
      deckId: deck.id,
      title: 'Short memory stability',
      detail: `FSRS stability is ${card.fsrs.stability.toFixed(1)} days.`,
      evidence: [
        'Stability is the model’s interval at which recall is estimated at 90%.',
        `${card.fsrs.reps} reviews inform this estimate.`,
      ],
      confidence: {
        level: 'low',
        score: 0.3,
        sampleSize: card.fsrs.reps,
        rationale: 'Short stability is a model estimate and can improve with review.',
      },
    };
  }

  return null;
}

export function analyzeWeaknesses(input: {
  deck: Deck;
  cards: Flashcard[];
  reviews: NormalizedReview[];
  allReviews: NormalizedReview[];
  now: number;
}): WeaknessAnalysis {
  const { deck, cards, reviews, allReviews, now } = input;

  const since = now - DECK_WINDOW_DAYS * DAY_MS;
  const deckRecent = reviews.filter((review) => review.reviewedAt >= since);
  const libraryRecent = allReviews.filter(
    (review) =>
      !review.archived &&
      review.deckId !== deck.id &&
      review.reviewedAt >= since
  );

  const deckSuccesses = deckRecent.filter((review) => review.rating >= 2).length;
  const librarySuccesses = libraryRecent.filter((review) => review.rating >= 2).length;
  const deckInterval = wilsonInterval(deckSuccesses, deckRecent.length);
  const libraryInterval = wilsonInterval(librarySuccesses, libraryRecent.length);

  const items: LearningWeakness[] = [];
  const reviewsByCard = new Map<string, NormalizedReview[]>();
  for (const review of reviews) {
    const list = reviewsByCard.get(review.cardId);
    if (list) list.push(review);
    else reviewsByCard.set(review.cardId, [review]);
  }

  if (
    deckRecent.length >= MIN_DECK_SAMPLE &&
    libraryRecent.length >= MIN_DECK_SAMPLE &&
    deckInterval !== null &&
    libraryInterval !== null &&
    deckInterval.high < libraryInterval.low
  ) {
    items.push({
      id: `deck:${deck.id}:below_library`,
      kind: 'deck_below_library',
      scope: 'deck',
      deckId: deck.id,
      title: 'Observed recall is below the rest of the library',
      detail: `${(deckInterval.high * 100).toFixed(0)}% or less successful recall here, versus at least ${(libraryInterval.low * 100).toFixed(0)}% in other decks.`,
      evidence: [
        `${deckRecent.length} rated reviews in this deck, ${libraryRecent.length} in other decks, both in the last ${DECK_WINDOW_DAYS} days.`,
        'The 95% Wilson intervals do not overlap.',
      ],
      confidence: confidenceFor(deckRecent.length, deckInterval, 'deck reviews'),
    });
  }

  if (deck.algorithmPreset === 'fsrs') {
    for (const card of cards) {
      const weakness = cardWeakness(
        deck,
        card,
        reviewsByCard.get(card.id) ?? [],
        now
      );
      if (weakness) items.push(weakness);
    }
  }

  items.sort(
    (a, b) =>
      SEVERITY[a.kind] - SEVERITY[b.kind] ||
      b.confidence.score - a.confidence.score ||
      (a.cardId ?? '').localeCompare(b.cardId ?? '')
  );

  const status =
    reviews.length === 0 && items.length === 0
      ? 'empty'
      : items.length > 0
        ? 'ok'
        : deckRecent.length < MIN_DECK_SAMPLE
          ? 'insufficient_data'
          : 'ok';

  return {
    status,
    items: items.slice(0, 8),
    note:
      deck.algorithmPreset === 'fsrs'
        ? 'Weakness cues are ordered by directness of evidence. FSRS difficulty and stability are model estimates; repeated Again ratings are observed events.'
        : 'This deck uses a non-FSRS scheduler, so card-level memory weaknesses are unavailable. Only observed deck recall can be compared.',
  };
}
