/**
 * Adaptive learning engine contracts.
 *
 * The engine never schedules new intervals: FSRS owns due dates. It ranks the
 * cards that are already due, explains that ranking, and reports evidence-gated
 * observations. Every probability that appears here is an FSRS model estimate;
 * observed behaviour is always a count or a proportion with its sample size.
 */

import type { Deck, Flashcard, FSRSState, ReviewLogEntry } from '../../types';
import type {
  Confidence,
  IntraSessionResult,
  MetricStatus,
  NormalizedReview,
} from '../core/types';

// ---- Priority ---------------------------------------------------------------

export type PrioritySignalKind =
  | 'learning_step'
  | 'below_target'
  | 'overdue'
  | 'repeated_lapses'
  | 'high_difficulty'
  | 'short_stability';

export type PrioritySignal = {
  kind: PrioritySignalKind;
  detail: string;
};

export type LearningEvidence = {
  state: FSRSState;
  /** FSRS R(now). Model estimate, never measured retention. */
  retrievability: number | null;
  /** The deck's FSRS desired retention at the time of analysis. */
  desiredRetention: number | null;
  stability: number;
  difficulty: number;
  lapses: number;
  reps: number;
  dueAt: number;
  /** Calendar days past the due date; 0 for a card due later today. */
  overdueDays: number;
  /** Post-graduation reviews in the last 60 days, from the real log. */
  recentReviews: number;
  recentSuccesses: number;
  /** Again / recentReviews, or null with no recent reviews. */
  recentAgainRate: number | null;
};

export type LearningDecision = {
  cardId: string;
  deckId: string;
  action: 'review_now' | 'hold';
  /**
   * Relative queue percentile, 0–1, where 1 is the first card. This is an
   * ordering position, NOT a probability of recall or a scientific score.
   */
  priority: number;
  /** 1-based position produced by the policy. */
  priorityRank: number;
  priorityPercentile: number;
  /** Confidence in the evidence behind the ordering, not recall probability. */
  confidence: Confidence;
  reasons: string[];
  /** One line suitable for a compact UI. */
  shortReason: string;
  signals: PrioritySignal[];
  evidence: LearningEvidence;
  experimental: true;
};

export type PriorityResult = {
  decisions: LearningDecision[];
  decisionsByCard: Record<string, LearningDecision>;
  ordered: Flashcard[];
  baseline: Flashcard[];
  status: MetricStatus;
  targetRetention: number | null;
  note: string;
};

// ---- Mastery ----------------------------------------------------------------

export type MasteryLevel = 'new' | 'learning' | 'developing' | 'established' | 'strong';

export type MasteryEvidence = {
  /** Reviews whose pre-review state was Review; learning steps do not count. */
  reviewStateReviews: number;
  successes: number;
  again: number;
  lapses: number;
  stability: number;
  difficulty: number;
  retrievability: number | null;
  desiredRetention: number | null;
  lastReviewedAt: number | null;
};

export type MasteryEstimate = {
  cardId: string;
  deckId: string;
  level: MasteryLevel;
  label: string;
  confidence: Confidence;
  evidence: MasteryEvidence;
  rationale: string;
  limitations: string[];
};

export type MasteryAnalysis = {
  status: MetricStatus;
  evaluated: number;
  counts: Record<MasteryLevel, number>;
  cards: MasteryEstimate[];
  note: string;
};

// ---- Weaknesses -------------------------------------------------------------

export type WeaknessKind =
  | 'repeated_lapses'
  | 'recent_failures'
  | 'high_difficulty'
  | 'short_stability'
  | 'deck_below_library';

export type LearningWeakness = {
  id: string;
  kind: WeaknessKind;
  scope: 'card' | 'deck';
  cardId?: string;
  deckId: string;
  title: string;
  detail: string;
  evidence: string[];
  confidence: Confidence;
};

export type WeaknessAnalysis = {
  status: MetricStatus;
  items: LearningWeakness[];
  note: string;
};

// ---- Personal learning profile ---------------------------------------------

export type StudyWindowId = 'night' | 'morning' | 'afternoon' | 'evening';

export type StudyWindow = {
  id: StudyWindowId;
  label: string;
  reviews: number;
  successes: number;
  successRate: number | null;
  interval: { low: number; high: number; level: number } | null;
  /** Success rate in the other three windows, used for the contrast. */
  otherRate: number | null;
  /** True only when the 95% Wilson intervals do not overlap. */
  separated: boolean;
};

export type ProfileAdaptation = {
  id: string;
  text: string;
  confidence: Confidence;
};

export type StudyProfile = {
  status: MetricStatus;
  windowDays: number;
  reviewCount: number;
  pace: {
    status: MetricStatus;
    sampleSize: number;
    medianMs: number | null;
    p90Ms: number | null;
  };
  sessions: {
    status: MetricStatus;
    count: number;
    medianReviews: number | null;
    medianDurationMs: number | null;
  };
  usualLoad: {
    status: MetricStatus;
    activeDays: number;
    medianReviews: number | null;
  };
  preferredWindow: StudyWindow | null;
  consistency: {
    activeDayRatio: number;
    currentStreak: number;
    longestStreak: number;
  };
  intraSession: IntraSessionResult;
  adaptations: ProfileAdaptation[];
  limitations: string[];
};

// ---- Session planning -------------------------------------------------------

export type SessionPlan = {
  status: MetricStatus;
  cardCount: number;
  newCards: number;
  dueCards: number;
  atRiskCards: number;
  /** Median recorded review time × card count; not a countdown. */
  projectedDurationMs: number | null;
  projectedMinutes: number | null;
  breakSuggestion: {
    afterReviews: number;
    reason: string;
    confidence: Confidence;
  } | null;
  note: string;
};

// ---- Structural evaluation --------------------------------------------------

export type OrderingEvaluation = {
  status: MetricStatus;
  sampleSize: number;
  atRiskCards: number;
  firstAtRiskPosition: { before: number | null; after: number | null };
  medianAtRiskPosition: { before: number | null; after: number | null };
  firstHalfAtRiskShare: { before: number | null; after: number | null };
  overdueMovedEarlier: number;
  note: string;
  limitations: string[];
};

// ---- Engine -----------------------------------------------------------------

export type LearningEngineInput = {
  decks: Deck[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: ReviewLogEntry[];
  deckId: string;
  /** Cards selected by the existing capped study queue. */
  newCards: Flashcard[];
  dueCards: Flashcard[];
  /** Fixed clock for deterministic runs. Defaults to Date.now(). */
  now?: number;
};

export type LearningPolicy = {
  name: 'fsrs_priority_v1';
  description: string;
  affectsDueDates: false;
  experimental: true;
};

export type LearningEngineResult = {
  generatedAt: number;
  deckId: string;
  status: MetricStatus;
  adaptiveOrdering: boolean;
  reviewsAnalyzed: number;
  decisions: LearningDecision[];
  decisionsByCard: Record<string, LearningDecision>;
  orderedDueCards: Flashcard[];
  mastery: MasteryAnalysis;
  weaknesses: WeaknessAnalysis;
  profile: StudyProfile;
  session: SessionPlan;
  evaluation: OrderingEvaluation;
  policy: LearningPolicy;
};
