/**
 * Review priority — FSRS decks only.
 *
 * This module does not calculate intervals. It orders cards that the existing
 * queue builder has already declared due. The ordering is lexicographic:
 *
 *   1. a learning/relearning step that is due,
 *   2. a review card whose FSRS R(now) is below its deck's desired retention,
 *   3. every other due review card,
 *   4. a new card (normally the queue builder keeps these separate).
 *
 * Within review cards, lower R comes first; ties fall back to days overdue,
 * lapses, difficulty, due time and finally card id. There is no weighted
 * composite, because no evidence supports exchanging one signal for another at
 * fixed weights. The reported `priority` is a queue percentile, not a
 * probability of recall.
 */

import type { Deck, Flashcard } from '../../types';
import type { NormalizedReview } from '../core/types';
import type {
  LearningDecision,
  LearningEvidence,
  PriorityResult,
  PrioritySignal,
  PrioritySignalKind,
} from '../engine/types';
import { DAY_MS, startOfDay } from '../core/dates';
import { createFSRSScheduler } from '../../schedulers/fsrs';
import { resolveFsrsParams } from '../../fsrs-params';

type Entry = {
  card: Flashcard;
  stage: number;
  retrievability: number | null;
  target: number | null;
  dueAt: number;
  overdueDays: number;
  lapses: number;
  difficulty: number;
  stability: number;
  recentReviews: number;
  recentSuccesses: number;
  recentAgainRate: number | null;
  reasons: string[];
  shortReason: string;
  signals: PrioritySignal[];
  confidence: LearningDecision['confidence'];
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function confidenceForPriority(
  card: Flashcard,
  retrievability: number | null,
  target: number | null
): LearningDecision['confidence'] {
  if (card.fsrs.state === 'New') {
    return {
      level: 'insufficient',
      score: 0.1,
      sampleSize: 0,
      rationale: 'No review history has been recorded for this card.',
    };
  }

  if (card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning') {
    return {
      level: 'high',
      score: 0.85,
      sampleSize: card.fsrs.reps,
      rationale:
        'The scheduler marks this learning step as due. That is a schedule fact, not a recall probability.',
    };
  }

  if (retrievability === null || target === null) {
    return {
      level: 'insufficient',
      score: 0.2,
      sampleSize: card.fsrs.reps,
      rationale:
        'No finite FSRS retrievability is available, so ordering falls back to due date and recorded history.',
    };
  }

  if (card.fsrs.reps >= 10) {
    return {
      level: 'medium',
      score: 0.65,
      sampleSize: card.fsrs.reps,
      rationale:
        'FSRS has at least ten reviews on this card. Retrievability is still a model estimate.',
    };
  }

  if (card.fsrs.reps >= 3) {
    return {
      level: 'low',
      score: 0.4,
      sampleSize: card.fsrs.reps,
      rationale: `Only ${card.fsrs.reps} reviews inform this card's FSRS state.`,
    };
  }

  return {
    level: 'insufficient',
    score: 0.2,
    sampleSize: card.fsrs.reps,
    rationale: `Only ${card.fsrs.reps} review${card.fsrs.reps === 1 ? '' : 's'} inform this card's FSRS state.`,
  };
}

function baselineDecision(card: Flashcard, deck: Deck): LearningDecision {
  const dueAt = new Date(card.fsrs.due).getTime();
  const evidence: LearningEvidence = {
    state: card.fsrs.state,
    retrievability: null,
    desiredRetention: null,
    stability: card.fsrs.stability,
    difficulty: card.fsrs.difficulty,
    lapses: card.fsrs.lapses,
    reps: card.fsrs.reps,
    dueAt: Number.isFinite(dueAt) ? dueAt : 0,
    overdueDays: 0,
    recentReviews: 0,
    recentSuccesses: 0,
    recentAgainRate: null,
  };

  return {
    cardId: card.id,
    deckId: deck.id,
    action: 'review_now',
    priority: 1,
    priorityRank: 1,
    priorityPercentile: 100,
    confidence: {
      level: 'insufficient',
      score: 0,
      sampleSize: 0,
      rationale:
        'This deck does not use FSRS, so memory estimates are unavailable. The existing due order is retained.',
    },
    reasons: ['Non-FSRS deck: the existing due order is retained.'],
    shortReason: 'Baseline order',
    signals: [],
    evidence,
    experimental: true,
  };
}

export function prioritizeDueCards(input: {
  deck: Deck;
  dueCards: Flashcard[];
  reviewsByCard: ReadonlyMap<string, NormalizedReview[]>;
  now: number;
}): PriorityResult {
  const { deck, dueCards, reviewsByCard, now } = input;

  if (deck.algorithmPreset !== 'fsrs') {
    return {
      decisions: dueCards.map((card) => baselineDecision(card, deck)),
      decisionsByCard: Object.fromEntries(
        dueCards.map((card) => [card.id, baselineDecision(card, deck)])
      ),
      ordered: [...dueCards],
      baseline: [...dueCards],
      status: 'insufficient_data',
      targetRetention: null,
      note:
        'Adaptive priority uses FSRS memory state. This deck uses another scheduler, so its due order is unchanged.',
    };
  }

  const scheduler = createFSRSScheduler(deck);
  const target = resolveFsrsParams(deck).requestRetention;
  const today = startOfDay(now);

  const entries: Entry[] = dueCards.map((card) => {
    const reviews = reviewsByCard.get(card.id) ?? [];
    const recent = reviews.filter(
      (review) =>
        review.reviewedAt >= now - 60 * DAY_MS && review.stateBefore === 'Review'
    );
    const recentSuccesses = recent.filter((review) => review.rating >= 2).length;
    const recentAgain = recent.filter((review) => review.rating === 1).length;

    const dueAt = new Date(card.fsrs.due).getTime();
    const safeDueAt = Number.isFinite(dueAt) ? dueAt : now;
    const overdueDays = Math.max(
      0,
      Math.round((today - startOfDay(safeDueAt)) / DAY_MS)
    );

    const isLearning =
      card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning';
    const isReview = card.fsrs.state === 'Review';
    // Only Review cards have a meaningful long-term retrievability. A learning
    // step is already due-or-not by its own schedule; mixing its partial state
    // into an R comparison would invent a memory claim.
    const retrievability = isReview
      ? scheduler.getRetrievability(card, new Date(now))
      : null;
    const belowTarget =
      isReview && retrievability !== null && retrievability < target;

    const reasons: string[] = [];
    const signals: PrioritySignal[] = [];

    if (isLearning) {
      reasons.push('A learning or relearning step is due.');
      signals.push({
        kind: 'learning_step',
        detail: 'The scheduler placed this card in a due learning step.',
      });
    }

    if (isReview && retrievability !== null) {
      if (belowTarget) {
        reasons.push(
          `FSRS estimates ${pct(retrievability)} recall now; this deck targets ${pct(target)}.`
        );
        signals.push({
          kind: 'below_target',
          detail: `R ${pct(retrievability)} < target ${pct(target)}.`,
        });
      } else {
        reasons.push(
          `FSRS estimates ${pct(retrievability)} recall now, at or above this deck's ${pct(target)} target.`
        );
      }
    }

    if (overdueDays > 0) {
      reasons.push(
        `Due ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago.`
      );
      signals.push({
        kind: 'overdue',
        detail: `${overdueDays} calendar day${overdueDays === 1 ? '' : 's'} overdue.`,
      });
    }

    if (card.fsrs.lapses >= 2) {
      reasons.push(`${card.fsrs.lapses} lapses are recorded.`);
      signals.push({
        kind: 'repeated_lapses',
        detail: `${card.fsrs.lapses} recorded lapses.`,
      });
    } else if (card.fsrs.lapses === 1) {
      reasons.push('One previous lapse is recorded.');
    }

    if (card.fsrs.difficulty >= 7) {
      reasons.push(`FSRS difficulty is ${card.fsrs.difficulty.toFixed(1)} of 10.`);
      signals.push({
        kind: 'high_difficulty',
        detail: `Difficulty ${card.fsrs.difficulty.toFixed(1)} / 10.`,
      });
    }

    if (card.fsrs.stability > 0 && card.fsrs.stability < 7) {
      reasons.push(`Stability is ${card.fsrs.stability.toFixed(1)} days.`);
      signals.push({
        kind: 'short_stability',
        detail: `Stability ${card.fsrs.stability.toFixed(1)} days.`,
      });
    }

    if (reasons.length === 0) {
      reasons.push('Due now; due time and card id break ties.');
    }

    let shortReason = 'Due now';
    if (isLearning) shortReason = 'Learning step due';
    else if (belowTarget && overdueDays > 0) shortReason = 'Below target · overdue';
    else if (belowTarget) shortReason = 'Below recall target';
    else if (overdueDays > 0) shortReason = 'Overdue';
    else if (card.fsrs.lapses >= 2) shortReason = 'Repeated lapses';
    else if (card.fsrs.difficulty >= 7) shortReason = 'High difficulty';

    const stage = isLearning
      ? 0
      : card.fsrs.state === 'New'
        ? 3
        : belowTarget
          ? 1
          : 2;

    return {
      card,
      stage,
      retrievability,
      target,
      dueAt: safeDueAt,
      overdueDays,
      lapses: card.fsrs.lapses,
      difficulty: card.fsrs.difficulty,
      stability: card.fsrs.stability,
      recentReviews: recent.length,
      recentSuccesses,
      recentAgainRate: recent.length > 0 ? recentAgain / recent.length : null,
      reasons: reasons.slice(0, 5),
      shortReason,
      signals: signals.slice(0, 4),
      confidence: confidenceForPriority(card, retrievability, target),
    };
  });

  entries.sort((a, b) => {
    if (a.stage !== b.stage) return a.stage - b.stage;

    if (a.stage === 0) {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      return a.card.id.localeCompare(b.card.id);
    }

    if (a.stage === 3) {
      if (a.card.createdAt !== b.card.createdAt) {
        return a.card.createdAt - b.card.createdAt;
      }
      return a.card.id.localeCompare(b.card.id);
    }

    // A finite R always sorts before a missing one.
    const aR = a.retrievability ?? 2;
    const bR = b.retrievability ?? 2;
    if (aR !== bR) return aR - bR;
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
    if (b.lapses !== a.lapses) return b.lapses - a.lapses;
    if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return a.card.id.localeCompare(b.card.id);
  });

  const count = entries.length;
  const decisions = entries.map((entry, index) => {
    const rank = index + 1;
    const priority = count > 1 ? (count - rank) / (count - 1) : 1;
    const evidence: LearningEvidence = {
      state: entry.card.fsrs.state,
      retrievability: entry.retrievability,
      desiredRetention: entry.target,
      stability: entry.stability,
      difficulty: entry.difficulty,
      lapses: entry.lapses,
      reps: entry.card.fsrs.reps,
      dueAt: entry.dueAt,
      overdueDays: entry.overdueDays,
      recentReviews: entry.recentReviews,
      recentSuccesses: entry.recentSuccesses,
      recentAgainRate: entry.recentAgainRate,
    };

    return {
      cardId: entry.card.id,
      deckId: deck.id,
      action: 'review_now' as const,
      priority,
      priorityRank: rank,
      priorityPercentile: Math.round(priority * 100),
      confidence: entry.confidence,
      reasons: entry.reasons,
      shortReason: entry.shortReason,
      signals: entry.signals,
      evidence,
      experimental: true as const,
    };
  });

  return {
    decisions,
    decisionsByCard: Object.fromEntries(decisions.map((decision) => [decision.cardId, decision])),
    ordered: entries.map((entry) => entry.card),
    baseline: [...dueCards],
    status: dueCards.length === 0 ? 'empty' : 'ok',
    targetRetention: target,
    note:
      'Queue ordering only. FSRS due dates, intervals and memory state are not modified.',
  };
}

export function prioritySignalLabel(kind: PrioritySignalKind): string {
  switch (kind) {
    case 'learning_step':
      return 'Learning step';
    case 'below_target':
      return 'Below target';
    case 'overdue':
      return 'Overdue';
    case 'repeated_lapses':
      return 'Repeated lapses';
    case 'high_difficulty':
      return 'High difficulty';
    case 'short_stability':
      return 'Short stability';
  }
}
