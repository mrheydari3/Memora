/**
 * Session planning — estimates and suggestions over the real queue.
 *
 * Nothing is removed from the session. A projected duration is the user's own
 * median recorded review time multiplied by the number of cards. A break cue is
 * only produced when the log shows a late-session recall association with
 * enough reviews, and it uses the learner's own median session size as the cue
 * point rather than an arbitrary universal limit.
 */

import type { Flashcard } from '../../types';
import type {
  LearningDecision,
  SessionPlan,
  StudyProfile,
} from '../engine/types';
import { confidenceFor } from '../core/stats';

export function buildSessionPlan(input: {
  newCards: Flashcard[];
  dueCards: Flashcard[];
  decisionsByCard: Record<string, LearningDecision>;
  profile: StudyProfile;
}): SessionPlan {
  const { newCards, dueCards, decisionsByCard, profile } = input;
  const cardCount = newCards.length + dueCards.length;

  const atRiskCards = dueCards.filter((card) => {
    const decision = decisionsByCard[card.id];
    const R = decision?.evidence.retrievability;
    const target = decision?.evidence.desiredRetention;
    return R !== null && R !== undefined && target !== null && target !== undefined
      ? R < target
      : false;
  }).length;

  const medianMs = profile.pace.medianMs;
  const projectedDurationMs =
    medianMs !== null && cardCount > 0 ? Math.round(medianMs * cardCount) : null;
  const projectedMinutes =
    projectedDurationMs === null
      ? null
      : Math.round((projectedDurationMs / 60_000) * 10) / 10;

  const medianSession = profile.sessions.medianReviews;
  const lateSession = profile.intraSession;
  const breakSuggestion =
    lateSession.status === 'ok' &&
    lateSession.direction === 'declining' &&
    medianSession !== null &&
    medianSession > 0 &&
    cardCount > medianSession
      ? {
          afterReviews: Math.max(
            1,
            Math.min(cardCount - 1, Math.round(medianSession))
          ),
          reason: `Observed recall was lower late in longer sessions. Your median session is ${Math.round(medianSession)} reviews; a break there may be worth testing. This is an association, not a fatigue diagnosis.`,
          confidence: confidenceFor(
            lateSession.sampleSize,
            null,
            'session-position reviews'
          ),
        }
      : null;

  return {
    status:
      cardCount === 0
        ? 'empty'
        : medianMs === null
          ? 'insufficient_data'
          : 'ok',
    cardCount,
    newCards: newCards.length,
    dueCards: dueCards.length,
    atRiskCards,
    projectedDurationMs,
    projectedMinutes,
    breakSuggestion,
    note:
      projectedMinutes === null
        ? 'A duration estimate appears after at least 20 valid timed reviews.'
        : 'Duration is an estimate from your median recorded review time, not a countdown. No cards are removed from the queue.',
  };
}
