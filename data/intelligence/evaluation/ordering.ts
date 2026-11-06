/**
 * Structural queue evaluation.
 *
 * This compares two deterministic orderings of the same due cards using current
 * FSRS estimates. It answers a narrow question: did priority move at-risk cards
 * earlier in the queue? It is not a replay of future reviews, cannot estimate
 * the counterfactual rating a card would have received in another position, and
 * must not be presented as proof of improved retention.
 */

import type { Flashcard } from '../../types';
import type {
  LearningDecision,
  OrderingEvaluation,
} from '../engine/types';
import { median } from '../core/stats';

function positionMap(cards: Flashcard[]): Map<string, number> {
  return new Map(cards.map((card, index) => [card.id, index + 1]));
}

function atRiskPosition(
  cards: Flashcard[],
  decisionsByCard: Record<string, LearningDecision>
): number[] {
  const positions: number[] = [];
  cards.forEach((card, index) => {
    const decision = decisionsByCard[card.id];
    const R = decision?.evidence.retrievability;
    const target = decision?.evidence.desiredRetention;
    if (R !== null && R !== undefined && target !== null && target !== undefined && R < target) {
      positions.push(index + 1);
    }
  });
  return positions;
}

function firstHalfRisk(
  cards: Flashcard[],
  decisionsByCard: Record<string, LearningDecision>
): number | null {
  if (cards.length === 0) return null;
  const half = Math.max(1, Math.ceil(cards.length / 2));
  const positions = atRiskPosition(cards.slice(0, half), decisionsByCard);
  return positions.length / half;
}

export function compareOrdering(input: {
  before: Flashcard[];
  after: Flashcard[];
  decisionsByCard: Record<string, LearningDecision>;
}): OrderingEvaluation {
  const { before, after, decisionsByCard } = input;
  const sampleSize = before.filter((card) => {
    const decision = decisionsByCard[card.id];
    return (
      decision?.evidence.retrievability !== null &&
      decision?.evidence.retrievability !== undefined
    );
  }).length;

  if (sampleSize === 0) {
    return {
      status: 'insufficient_data',
      sampleSize: 0,
      atRiskCards: 0,
      firstAtRiskPosition: { before: null, after: null },
      medianAtRiskPosition: { before: null, after: null },
      firstHalfAtRiskShare: { before: null, after: null },
      overdueMovedEarlier: 0,
      note:
        'No finite FSRS retrievability is available, so the two orderings cannot be compared structurally.',
      limitations: [
        'This is a queue-order comparison using model estimates, not a learning-outcome experiment.',
      ],
    };
  }

  const beforePositions = atRiskPosition(before, decisionsByCard);
  const afterPositions = atRiskPosition(after, decisionsByCard);
  const beforeMap = positionMap(before);
  const afterMap = positionMap(after);

  let overdueMovedEarlier = 0;
  for (const card of before) {
    const decision = decisionsByCard[card.id];
    if (!decision || decision.evidence.overdueDays <= 0) continue;
    const oldPosition = beforeMap.get(card.id) ?? 0;
    const newPosition = afterMap.get(card.id) ?? 0;
    if (newPosition > 0 && newPosition < oldPosition) overdueMovedEarlier += 1;
  }

  return {
    status: sampleSize >= 2 ? 'ok' : 'insufficient_data',
    sampleSize,
    atRiskCards: beforePositions.length,
    firstAtRiskPosition: {
      before: beforePositions.length > 0 ? Math.min(...beforePositions) : null,
      after: afterPositions.length > 0 ? Math.min(...afterPositions) : null,
    },
    medianAtRiskPosition: {
      before: median(beforePositions),
      after: median(afterPositions),
    },
    firstHalfAtRiskShare: {
      before: firstHalfRisk(before, decisionsByCard),
      after: firstHalfRisk(after, decisionsByCard),
    },
    overdueMovedEarlier,
    note:
      'Structural comparison only: priority moved cards with lower FSRS-estimated recall earlier in the same queue. No future rating was simulated.',
    limitations: [
      'Historical replay cannot reveal the rating a card would have received in a different position.',
      'Moving a card earlier does not guarantee better retention and may have tradeoffs not visible in a review log.',
      'This evaluation must not be described as measured learning improvement.',
    ],
  };
}
