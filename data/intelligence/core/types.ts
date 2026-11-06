/**
 * Memora Intelligence Engine — contracts.
 *
 * Everything the engine reports is either:
 *   - a count of real review-log records (measured),
 *   - a proportion with a Wilson interval (measured, with uncertainty), or
 *   - an explicitly-labelled FSRS model estimate / statistical forecast.
 *
 * The types keep those apart on purpose: `RecallMetrics` is observed behaviour,
 * `RetentionForecast` is a model estimate, and `VolumeForecast` is a statistical
 * projection with its evidence and limitations attached.
 */

import type {
  AlgorithmPreset,
  Deck,
  Flashcard,
  FSRSLogSnapshot,
  FSRSState,
  Rating,
  ReviewLogEntry,
} from '../../types';

// ---- Shared primitives ------------------------------------------------------

export type MetricStatus = 'ok' | 'insufficient_data' | 'empty';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

/** A two-sided interval. `level` is the coverage, e.g. 0.95. */
export type Interval = { low: number; high: number; level: number };

export type Confidence = {
  level: ConfidenceLevel;
  /** 0–1, for ordering insights. Not a probability. */
  score: number;
  sampleSize: number;
  /** Plain-language reason, shown in the UI next to the number. */
  rationale: string;
};

export type RatingKey = 'again' | 'hard' | 'good' | 'easy';
export type RatingCounts = Record<RatingKey, number>;
/** Proportion per rating, or null when there are no rated reviews. */
export type RatingShares = Record<RatingKey, number | null>;

// ---- Normalised review log --------------------------------------------------

export type DataQualityIssueKind =
  | 'duplicate'
  | 'invalid_rating'
  | 'invalid_timestamp'
  | 'future_timestamp'
  | 'invalid_duration'
  | 'outlier_duration'
  | 'orphan_deck';

export type DataQualityIssue = {
  kind: DataQualityIssueKind;
  count: number;
  /** How the engine handled it — never just "ignored". */
  detail: string;
};

export type NormalizedReview = {
  cardId: string;
  deckId: string;
  rating: Rating;
  reviewedAt: number;
  /** Local midnight of the review's calendar day (DST-safe). */
  dayStart: number;
  dayKey: string;
  weekday: number;
  hour: number;
  /** Duration used by time metrics; null when missing/negative/extreme. */
  elapsedMs: number | null;
  cardWasNew: boolean;
  stateBefore: FSRSState | null;
  memory: FSRSLogSnapshot | null;
  /** Deck's scheduler, or null when the deck no longer exists. */
  algorithm: AlgorithmPreset | null;
  archived: boolean;
  /** Again on a card whose pre-review state was Review. Null when unknown. */
  isLapse: boolean | null;
};

export type NormalizedLog = {
  reviews: NormalizedReview[];
  issues: DataQualityIssue[];
  rawCount: number;
  usableCount: number;
  excludedCount: number;
  /** Valid reviews belonging to an archived deck. */
  archivedReviews: number;
  /** Valid reviews whose deck no longer exists. */
  orphanReviews: number;
  /** Epoch ms of the first/last usable review, or null. */
  firstReviewedAt: number | null;
  lastReviewedAt: number | null;
};

// ---- Series -----------------------------------------------------------------

export type DayPoint = {
  dayStart: number;
  dayKey: string;
  label: string;
  value: number;
  /** True when this day is today (local). */
  today: boolean;
};

export type Series = {
  points: DayPoint[];
  start: number;
  end: number;
  days: number;
  total: number;
  activeDays: number;
};

// ---- Performance ------------------------------------------------------------

export type WeekdayPoint = {
  weekday: number;
  label: string;
  reviews: number;
  activeDays: number;
  successRate: number | null;
};

export type HourPoint = {
  bucket: number;
  label: string;
  reviews: number;
  successRate: number | null;
};

export type RecallMetrics = {
  status: MetricStatus;
  /** (Hard + Good + Easy) / rated reviews. */
  successRate: number | null;
  successInterval: Interval | null;
  /** (Good + Easy) / rated reviews. */
  fluentRate: number | null;
  /** Hard / rated reviews — success with effort, NOT a failure. */
  difficultRate: number | null;
  againRate: number | null;
  sampleSize: number;
  counts: RatingCounts;
  shares: RatingShares;
  confidence: Confidence;
};

export type DurationMetrics = {
  status: MetricStatus;
  sampleSize: number;
  /** Records excluded from duration stats (missing, negative, > 30 min). */
  excluded: number;
  meanMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
  totalMs: number;
};

export type VolumeMetrics = {
  today: number;
  yesterday: number;
  last7: number;
  previous7: number;
  /** Reviews / every calendar day in the analysed range (zeros included). */
  perCalendarDay: number;
  /** Reviews / days with at least one review. Not the same number. */
  perActiveDay: number;
  activeDays: number;
  spanDays: number;
};

export type StreakMetrics = { current: number; longest: number };

export type EfficiencyMetrics = {
  status: MetricStatus;
  /** Successful reviews (Hard/Good/Easy) per minute of recorded review time. */
  successfulReviewsPerMinute: number | null;
  sampleSize: number;
};

export type PerformanceMetrics = {
  status: MetricStatus;
  totals: {
    reviews: number;
    activeDays: number;
    spanDays: number;
    ratedReviews: number;
  };
  volume: VolumeMetrics;
  recall: RecallMetrics;
  duration: DurationMetrics;
  streak: StreakMetrics;
  activity: Series;
  weekday: WeekdayPoint[];
  hours: HourPoint[];
  efficiency: EfficiencyMetrics;
};

// ---- Behaviour --------------------------------------------------------------

export type SessionSummary = {
  start: number;
  end: number;
  durationMs: number;
  reviews: number;
  deckIds: string[];
  ratings: RatingCounts;
  successRate: number | null;
  /** Successful recalls in the first third of this session, by position. */
  firstThird: { success: number; sample: number };
  /** …and in the last third. Positions, not an average of the whole session. */
  lastThird: { success: number; sample: number };
};

export type IntraSessionResult = {
  status: MetricStatus;
  /** Successful-recall rate in the first third of qualifying sessions. */
  firstRate: number | null;
  /** …and in the last third. */
  lastRate: number | null;
  delta: number | null;
  sampleSize: number;
  /**
   * "declining" here means later reviews in a session were successful less
   * often. It is an association, not evidence of fatigue.
   */
  direction: 'declining' | 'improving' | 'stable' | 'insufficient_data';
};

export type ConsistencyMetrics = {
  /** Days with a review / days in the analysed range. */
  activeDayRatio: number;
  /** SD / mean of daily review counts over the range (0 = perfectly even). */
  coefficientOfVariation: number | null;
  longestGapDays: number;
  currentStreak: number;
  longestStreak: number;
};

export type BehaviorMetrics = {
  status: MetricStatus;
  sessions: {
    count: number;
    meanReviews: number | null;
    medianReviews: number | null;
    meanDurationMs: number | null;
    medianDurationMs: number | null;
    reviewsPerMinute: number | null;
  };
  bestWeekday: WeekdayPoint | null;
  bestHour: HourPoint | null;
  consistency: ConsistencyMetrics;
  intraSession: IntraSessionResult;
};

// ---- Memory -----------------------------------------------------------------

export type MemoryStateCounts = Record<FSRSState, number>;

export type DistributionBucket = {
  key: string;
  label: string;
  count: number;
  /** Share of the sampled cards, or null when the sample is empty. */
  share: number | null;
};

export type MemoryCoverage = {
  fsrsDecks: number;
  nonFsrsDecks: number;
  fsrsCards: number;
  /** Cards that have been reviewed at least once (stability > 0). */
  cardsWithState: number;
  /** Cards from SM-2 / Fast decks — no FSRS memory state exists for them. */
  excludedCards: number;
  note: string;
};

export type AttentionCard = {
  cardId: string;
  deckId: string;
  deckName: string;
  front: string;
  state: FSRSState;
  stability: number;
  difficulty: number;
  lapses: number;
  /** FSRS-predicted recall probability now (0–1). Model estimate. */
  retrievability: number | null;
  dueAt: number;
  overdueDays: number;
};

export type MemoryMetrics = {
  status: MetricStatus;
  coverage: MemoryCoverage;
  states: MemoryStateCounts;
  /** Graduated to long-term intervals. NOT a claim of permanent mastery. */
  inReviewSchedule: { count: number; share: number | null };
  stability: { buckets: DistributionBucket[]; median: number | null; sampleSize: number };
  difficulty: { buckets: DistributionBucket[]; mean: number | null; sampleSize: number };
  lapses: {
    /** Sum of `fsrs.lapses` across cards. */
    total: number;
    /** Lapses / review-state reviews, from the log. */
    lapseRate: number | null;
    reviewStateReviews: number;
    cardsWithLapses: number;
    repeatedFailureCards: number;
    leeches: number;
  };
  retention: {
    /** Average desired retention of the decks in scope. */
    threshold: number | null;
    /** Cards whose FSRS R(now) is below their deck's desired retention. */
    atRisk: number;
    /** Cards within 5 points above the desired retention. */
    approaching: number;
    evaluatedCards: number;
    overdue: number;
    meanRetrievability: number | null;
  };
  attention: AttentionCard[];
};

// ---- Decks ------------------------------------------------------------------

export type DeckComparison = 'above' | 'below' | 'typical' | 'insufficient_data';
export type DeckTrendDirection = 'improving' | 'declining' | 'stable' | 'insufficient_data';

export type DeckIntelligence = {
  deckId: string;
  name: string;
  algorithm: AlgorithmPreset;
  cardCount: number;
  studiedCards: number;
  /** 0–1, or null for a deck with no cards. */
  progress: number | null;
  /** Reviews in the analysed range. */
  reviews: number;
  shareOfReviews: number;
  recall: { successRate: number | null; interval: Interval | null; sampleSize: number };
  medianDurationMs: number | null;
  lapse: { lapses: number; rate: number | null; sampleSize: number };
  due: { scheduled: number; overdue: number; newCards: number; next7: number };
  /** Compared with the library-wide rate, using interval separation. */
  vsLibrary: DeckComparison;
  /** First half vs second half of the range, gated on sample size. */
  trend: DeckTrendDirection;
  confidence: Confidence;
  lastReviewedAt: number | null;
};

export type DeckAnalysis = {
  status: MetricStatus;
  decks: DeckIntelligence[];
  comparableCount: number;
  needsAttention: DeckIntelligence[];
  excluded: { archived: number; empty: number };
};

// ---- Trends -----------------------------------------------------------------

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'insufficient_data';

export type TrendMetric = {
  direction: TrendDirection;
  /** Absolute change between the two windows, in the metric's own unit. */
  change: number | null;
  from: number | null;
  to: number | null;
  unit: 'ratio' | 'reviews' | 'reviews_per_day' | 'per_minute';
  /** Which test produced this, so the UI can say so. */
  method: string;
  /** Mann–Kendall p-value where applicable; null when not computed. */
  pValue: number | null;
  sampleSize: number;
  confidence: Confidence;
  note: string;
};

export type AnomalyPoint = {
  dayStart: number;
  label: string;
  value: number;
  median: number;
  zScore: number;
  direction: 'above' | 'below';
};

export type TrendAnalysis = {
  status: MetricStatus;
  volume: TrendMetric;
  recall: TrendMetric;
  consistency: TrendMetric;
  efficiency: TrendMetric;
  /** Days whose review count is far from the median (robust z ≥ 2.5). */
  anomalies: AnomalyPoint[];
  series: Series;
  weekly: Series;
  /** Days per comparison window. */
  windowDays: number;
};

// ---- Predictions ------------------------------------------------------------

export type ForecastStatus = 'ok' | 'insufficient_data' | 'empty';

export type VolumeForecast = {
  status: ForecastStatus;
  horizonDays: number;
  method: string;
  expectedReviews: number | null;
  expectedPerDay: number | null;
  interval: Interval | null;
  sampleDays: number;
  sampleReviews: number;
  activeDays: number;
  confidence: Confidence;
  assumptions: string[];
  limitations: string[];
};

export type WorkloadDay = {
  dayStart: number;
  label: string;
  count: number;
};

export type WorkloadForecast = {
  status: ForecastStatus;
  /** Scheduled cards (not New) whose due date has passed. */
  overdue: number;
  dueToday: number;
  next7: number;
  next30: number;
  next90: number;
  daily: WorkloadDay[];
  byDeck: { deckId: string; name: string; overdue: number; next7: number }[];
  scheduledCards: number;
};

export type BacklogForecast = {
  status: ForecastStatus;
  remainingNewCards: number;
  /** New cards introduced per week, from the last 28 days. */
  newPerWeek: number | null;
  weeks: number | null;
  interval: Interval | null;
  sampleNewCards: number;
  confidence: Confidence;
  assumptions: string[];
  limitations: string[];
};

export type RetentionForecast = {
  status: ForecastStatus;
  horizonDays: number;
  /** Cards with a scheduled due date inside the horizon. */
  dueCards: number;
  /** Mean FSRS R(due) — a model estimate, not measured retention. */
  meanPredictedRetrievability: number | null;
  desiredRetention: number | null;
  confidence: Confidence;
  note: string;
};

export type ForecastBundle = {
  workload: WorkloadForecast;
  volume: { seven: VolumeForecast; thirty: VolumeForecast; ninety: VolumeForecast };
  backlog: BacklogForecast;
  retention: RetentionForecast;
};

// ---- Insights ---------------------------------------------------------------

export type InsightTone = 'positive' | 'neutral' | 'attention';

export type InsightKind =
  | 'recall'
  | 'volume'
  | 'consistency'
  | 'efficiency'
  | 'memory'
  | 'workload'
  | 'deck'
  | 'behaviour';

export type Insight = {
  id: string;
  kind: InsightKind;
  tone: InsightTone;
  title: string;
  detail: string;
  /** Human-readable metric lines that support the claim. */
  evidence: string[];
  confidence: Confidence;
  period: string;
};

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type Recommendation = {
  id: string;
  action: string;
  reason: string;
  metrics: string[];
  priority: RecommendationPriority;
  confidence: Confidence;
  period: string;
  deckId?: string;
};

export type InsightBundle = {
  status: MetricStatus;
  insights: Insight[];
  recommendations: Recommendation[];
};

// ---- Reports ----------------------------------------------------------------

export type ReportPeriod = 'day' | 'week' | 'month';

export type PeriodReport = {
  period: ReportPeriod;
  label: string;
  start: number;
  end: number;
  days: number;
  reviews: number;
  activeDays: number;
  newCards: number;
  studyTimeMs: number;
  successRate: number | null;
  successInterval: Interval | null;
  topDeck: { deckId: string; name: string; reviews: number } | null;
};

export type ReportBundle = { daily: PeriodReport; weekly: PeriodReport; monthly: PeriodReport };

// ---- Engine -----------------------------------------------------------------

export type AnalyticsRange = {
  days: number;
  start: number;
  end: number;
  /** Human label, e.g. "Last 30 days". */
  label: string;
};

export type IntelligenceInput = {
  decks: Deck[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: ReviewLogEntry[];
  /** Fixed clock for deterministic runs. Defaults to Date.now(). */
  now?: number;
  /** Analysis window ending today. Defaults to 30. Clamped to 1–365. */
  rangeDays?: number;
  /** Archived decks are excluded by default, like every other Memora screen. */
  includeArchivedDecks?: boolean;
};

export type DataCoverage = {
  activeDecks: number;
  archivedDecks: number;
  cards: number;
  reviewedCards: number;
  fsrsDecks: number;
  nonFsrsDecks: number;
  archivedReviewsExcluded: number;
  orphanReviews: number;
  firstReviewAt: number | null;
  lastReviewAt: number | null;
};

export type LearningOverview = {
  totalReviews: number;
  activeDays: number;
  studyTimeMs: number;
  streak: number;
  longestStreak: number;
  cards: number;
  reviewedCards: number;
  deckCount: number;
  successRate: number | null;
  successInterval: Interval | null;
  todayReviews: number;
  weeklyReviews: number;
  monthlyReviews: number;
};

export type IntelligenceReport = {
  generatedAt: number;
  range: AnalyticsRange;
  dataQuality: {
    rawCount: number;
    usableCount: number;
    excludedCount: number;
    issues: DataQualityIssue[];
  };
  coverage: DataCoverage;
  overview: LearningOverview;
  performance: PerformanceMetrics;
  memory: MemoryMetrics;
  behavior: BehaviorMetrics;
  decks: DeckAnalysis;
  trends: TrendAnalysis;
  forecast: ForecastBundle;
  insights: InsightBundle;
  reports: ReportBundle;
};
