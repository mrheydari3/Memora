/**
 * Memora Intelligence Engine — public API.
 *
 * Consumers (the Statistics screen, tests, future exports) import from here.
 * Internal modules stay free to change without touching the UI.
 */

export { buildIntelligence, clearIntelligenceCache, reportRangeLabel } from './core/engine';
export { normalizeReviewLog, RATING_ORDER } from './core/normalize';
export { computePerformance, computeRecall, computeDuration, longestStreak } from './analysis/metrics';
export { analyzeTrends } from './analysis/trends';
export { analyzeMemory } from './analysis/memory';
export { analyzeBehavior, buildSessions } from './analysis/behavior';
export { analyzeDecks } from './analysis/decks';
export { analyzeForecast } from './prediction/forecast';
export { generateInsights } from './insights/insights';
export { buildReports } from './reports/reports';
export { buildLearningEngine, ADAPTIVE_POLICY } from './engine/learningEngine';
export { MASTERY_LABELS, MASTERY_THRESHOLDS } from './learning/mastery';
export { prioritySignalLabel } from './scheduling/priority';
export { buildSeries, weeklySeries, reviewsInRange } from './analysis/series';
export { startOfDay, addDays, dayKey, dayLabel, eachDay, calendarDaysBetween } from './core/dates';
export { AnalyticsCache, intelligenceCacheKey } from './core/cache';

export {
  MIN_RECALL_SAMPLE,
  MIN_TREND_WINDOW_REVIEWS,
  MIN_DECK_SAMPLE,
  MIN_TREND_POINTS,
  MIN_FORECAST_DAYS,
  MIN_FORECAST_REVIEWS,
  SESSION_GAP_MS,
  MAX_REVIEW_DURATION_MS,
  LEECH_THRESHOLD,
  RANGE_OPTIONS,
} from './core/constants';

export type {
  AnalyticsRange,
  AnomalyPoint,
  AttentionCard,
  BacklogForecast,
  BehaviorMetrics,
  Confidence,
  DataQualityIssue,
  DataQualityIssueKind,
  DeckAnalysis,
  DeckIntelligence,
  DistributionBucket,
  ForecastBundle,
  HourPoint,
  Insight,
  InsightBundle,
  IntelligenceInput,
  IntelligenceReport,
  Interval,
  LearningOverview,
  MemoryMetrics,
  MetricStatus,
  NormalizedLog,
  NormalizedReview,
  PerformanceMetrics,
  PeriodReport,
  RatingKey,
  RecallMetrics,
  Recommendation,
  RecommendationPriority,
  ReportBundle,
  RetentionForecast,
  Series,
  SessionSummary,
  TrendAnalysis,
  TrendMetric,
  VolumeForecast,
  WeekdayPoint,
  WorkloadForecast,
} from './core/types';

export type {
  LearningDecision,
  LearningEngineInput,
  LearningEngineResult,
  LearningEvidence,
  LearningPolicy,
  LearningWeakness,
  MasteryAnalysis,
  MasteryEstimate,
  MasteryLevel,
  OrderingEvaluation,
  PriorityResult,
  PrioritySignal,
  PrioritySignalKind,
  ProfileAdaptation,
  SessionPlan,
  StudyProfile,
  StudyWindow,
  StudyWindowId,
  WeaknessAnalysis,
  WeaknessKind,
} from './engine/types';
