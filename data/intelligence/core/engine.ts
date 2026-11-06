/**
 * AnalyticsEngine — the single entry point to the intelligence layer.
 *
 * It owns the order of operations and nothing else:
 *   normalize → scope → range → measure → analyse → predict → explain.
 *
 * All analysis functions are pure and independently testable; this module only
 * wires them together, adds the all-time bits the dashboard needs (streak,
 * coverage) and memoises the assembled report.
 */

import type {
  AnalyticsRange,
  DataCoverage,
  IntelligenceInput,
  IntelligenceReport,
  LearningOverview,
} from './types';
import { addDays, rangeLabel, startOfDay } from './dates';
import { normalizeReviewLog } from './normalize';
import { AnalyticsCache, intelligenceCacheKey } from './cache';
import { computePerformance, longestStreak } from '../analysis/metrics';
import { reviewsInRange } from '../analysis/series';
import { analyzeTrends } from '../analysis/trends';
import { analyzeMemory } from '../analysis/memory';
import { analyzeBehavior } from '../analysis/behavior';
import { analyzeDecks } from '../analysis/decks';
import { analyzeForecast } from '../prediction/forecast';
import { generateInsights } from '../insights/insights';
import { buildReports } from '../reports/reports';
import { computeStreak } from '../../streak';

const reportCache = new AnalyticsCache<IntelligenceReport>(6);

export function clearIntelligenceCache(): void {
  reportCache.clear();
}

function clampRangeDays(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return 30;
  return Math.max(1, Math.min(365, Math.floor(value)));
}

export function buildIntelligence(input: IntelligenceInput): IntelligenceReport {
  const now = input.now ?? Date.now();
  const rangeDays = clampRangeDays(input.rangeDays);
  const includeArchived = input.includeArchivedDecks === true;

  const key = intelligenceCacheKey({
    decks: input.decks,
    cardsByDeck: input.cardsByDeck,
    reviewLog: input.reviewLog,
    now,
    rangeDays,
    includeArchived,
  });

  const cached = reportCache.get(key);
  if (cached) return cached;

  const report = computeReport(input, now, rangeDays, includeArchived);
  reportCache.set(key, report);
  return report;
}

function computeReport(
  input: IntelligenceInput,
  now: number,
  rangeDays: number,
  includeArchived: boolean
): IntelligenceReport {
  const normalized = normalizeReviewLog(input.reviewLog, input.decks, now);

  // Archived decks are out of the way, not gone: their history must not inflate
  // library-wide numbers, matching Home, Profile and the old Statistics screen.
  const allReviews = includeArchived
    ? normalized.reviews
    : normalized.reviews.filter((review) => !review.archived);
  const activeDecks = includeArchived
    ? input.decks
    : input.decks.filter((deck) => !deck.archivedAt);

  const end = startOfDay(now);
  const start = addDays(end, -(rangeDays - 1));
  const range: AnalyticsRange = {
    days: rangeDays,
    start,
    end,
    label: rangeDays === 1 ? 'Today' : `Last ${rangeDays} days`,
  };

  const rangeReviews = reviewsInRange(allReviews, range.start, range.end);

  const performance = computePerformance(rangeReviews, range, now, allReviews);
  const trends = analyzeTrends(rangeReviews, range);
  const memory = analyzeMemory(activeDecks, input.cardsByDeck, rangeReviews, now);
  const behavior = analyzeBehavior(rangeReviews, performance, range.start, range.end);
  const decks = analyzeDecks({
    decks: input.decks,
    cardsByDeck: input.cardsByDeck,
    reviews: rangeReviews,
    allReviews,
    libraryRecall: performance.recall,
    range,
    now,
    includeArchived,
  });
  const forecast = analyzeForecast({
    decks: activeDecks,
    cardsByDeck: input.cardsByDeck,
    reviews: rangeReviews,
    allReviews,
    now,
  });
  const insights = generateInsights({
    range,
    performance,
    trends,
    memory,
    behavior,
    decks,
    forecast,
  });
  const reports = buildReports(allReviews, input.decks, now);

  const activeCards = activeDecks.reduce(
    (total, deck) => total + (input.cardsByDeck[deck.id]?.length ?? 0),
    0
  );
  const reviewedCardIds = new Set(allReviews.map((review) => review.cardId));
  const allDays = new Set(allReviews.map((review) => review.dayStart));

  const countSince = (from: number) =>
    allReviews.filter((review) => review.dayStart >= from).length;

  const overview: LearningOverview = {
    totalReviews: rangeReviews.length,
    activeDays: performance.volume.activeDays,
    studyTimeMs: rangeReviews.reduce(
      (total, review) => total + (review.elapsedMs ?? 0),
      0
    ),
    streak: computeStreak(allReviews.map((review) => review.reviewedAt), now),
    longestStreak: longestStreak([...allDays]),
    cards: activeCards,
    reviewedCards: reviewedCardIds.size,
    deckCount: activeDecks.length,
    successRate: performance.recall.successRate,
    successInterval: performance.recall.successInterval,
    todayReviews: countSince(end),
    weeklyReviews: countSince(addDays(end, -6)),
    monthlyReviews: countSince(addDays(end, -29)),
  };

  const coverage: DataCoverage = {
    activeDecks: activeDecks.length,
    archivedDecks: input.decks.length - activeDecks.length,
    cards: activeCards,
    reviewedCards: reviewedCardIds.size,
    fsrsDecks: activeDecks.filter((deck) => deck.algorithmPreset === 'fsrs').length,
    nonFsrsDecks: activeDecks.filter((deck) => deck.algorithmPreset !== 'fsrs').length,
    archivedReviewsExcluded: includeArchived ? 0 : normalized.archivedReviews,
    orphanReviews: normalized.orphanReviews,
    firstReviewAt: allReviews.length > 0 ? allReviews[0].reviewedAt : null,
    lastReviewAt: allReviews.length > 0 ? allReviews[allReviews.length - 1].reviewedAt : null,
  };

  return {
    generatedAt: now,
    range,
    dataQuality: {
      rawCount: normalized.rawCount,
      usableCount: normalized.usableCount,
      excludedCount: normalized.excludedCount,
      issues: normalized.issues,
    },
    coverage,
    overview,
    performance,
    memory,
    behavior,
    decks,
    trends,
    forecast,
    insights,
    reports,
  };
}

/**
 * The date span of the report, for the UI's sub-heading. Kept here so the screen
 * does not re-implement date formatting.
 */
export function reportRangeLabel(range: AnalyticsRange): string {
  return rangeLabel(range.start, range.end);
}
