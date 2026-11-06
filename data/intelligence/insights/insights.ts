/**
 * Insight + recommendation generation.
 *
 * This module never computes a new number. It reads the validated metrics and
 * only speaks when a configured evidence gate is met. Every insight carries the
 * confidence of the metric it came from, and every recommendation carries the
 * numbers behind it — no motivational filler, no causal claim, and no advice
 * from a sample too small to support it.
 */

import type {
  AnalyticsRange,
  BehaviorMetrics,
  DeckAnalysis,
  ForecastBundle,
  Insight,
  InsightBundle,
  InsightTone,
  MemoryMetrics,
  PerformanceMetrics,
  Recommendation,
  RecommendationPriority,
  TrendAnalysis,
} from '../core/types';
import { MIN_DECK_SAMPLE, MIN_RECALL_SAMPLE } from '../core/constants';

export type InsightInput = {
  range: AnalyticsRange;
  performance: PerformanceMetrics;
  trends: TrendAnalysis;
  memory: MemoryMetrics;
  behavior: BehaviorMetrics;
  decks: DeckAnalysis;
  forecast: ForecastBundle;
};

const pct = (value: number | null, digits = 0): string =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;

const num = (value: number | null, digits = 0): string =>
  value === null ? '—' : value.toFixed(digits);

const reviewWord = (value: number): string => (value === 1 ? 'review' : 'reviews');
const dayWord = (value: number): string => (value === 1 ? 'day' : 'days');
const weekWord = (value: number): string => (value === 1 ? 'week' : 'weeks');

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, neutral: 2 };
const PRIORITY_ORDER: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };

export function generateInsights(input: InsightInput): InsightBundle {
  const { range, performance, trends, memory, behavior, decks, forecast } = input;
  const period = range.label;
  const insights: Insight[] = [];
  const recommendations: Recommendation[] = [];

  // ---- Recall trend ---------------------------------------------------------
  if (trends.recall.direction === 'improving' || trends.recall.direction === 'declining') {
    const improving = trends.recall.direction === 'improving';
    insights.push({
      id: 'recall-trend',
      kind: 'recall',
      tone: improving ? 'positive' : 'attention',
      title: improving ? 'Recall is improving' : 'Recall has slipped',
      detail: `${improving ? 'Successful recall rose' : 'Successful recall fell'} from ${pct(
        trends.recall.from
      )} to ${pct(trends.recall.to)} across the two ${trends.windowDays}-day windows.`,
      evidence: [
        `${trends.recall.sampleSize} rated reviews compared`,
        trends.recall.note,
      ],
      confidence: trends.recall.confidence,
      period,
    });
  }

  // ---- Consistency ----------------------------------------------------------
  const consistency = behavior.consistency;
  if (
    trends.consistency.direction === 'improving' &&
    consistency.activeDayRatio >= 0.4
  ) {
    insights.push({
      id: 'consistency-up',
      kind: 'consistency',
      tone: 'positive',
      title: 'Your study routine is becoming more consistent',
      detail: `You studied on ${Math.round(
        trends.consistency.to !== null ? trends.consistency.to * 100 : 0
      )}% of recent days, up from ${Math.round(
        trends.consistency.from !== null ? trends.consistency.from * 100 : 0
      )}% earlier in the window.`,
      evidence: [
        `${performance.volume.activeDays} active days in ${range.days} days`,
        `${consistency.currentStreak}-day current streak`,
      ],
      confidence: trends.consistency.confidence,
      period,
    });
  } else if (
    performance.totals.reviews >= MIN_RECALL_SAMPLE &&
    consistency.activeDayRatio >= 0.05 &&
    consistency.longestGapDays >= 7
  ) {
    insights.push({
      id: 'consistency-gap',
      kind: 'consistency',
      tone: 'attention',
      title: 'There is a gap in your study history',
      detail: `The longest run without a review in this window is ${consistency.longestGapDays} ${dayWord(
        consistency.longestGapDays
      )}.`,
      evidence: [
        `${performance.volume.activeDays} of ${range.days} days active`,
        `${consistency.longestStreak}-day longest streak overall`,
      ],
      confidence: {
        level: 'low',
        score: 0.35,
        sampleSize: performance.totals.reviews,
        rationale: 'Based on the presence or absence of reviews, not on their quality.',
      },
      period,
    });
  }

  // ---- Volume trend ---------------------------------------------------------
  if (
    trends.volume.direction !== 'insufficient_data' &&
    trends.volume.direction !== 'stable' &&
    trends.volume.pValue !== null &&
    trends.volume.pValue < 0.1 &&
    trends.volume.sampleSize >= MIN_RECALL_SAMPLE
  ) {
    const rising = trends.volume.direction === 'improving';
    insights.push({
      id: 'volume-trend',
      kind: 'volume',
      tone: rising ? 'positive' : 'attention',
      title: rising ? 'You are reviewing more each day' : 'Your review volume is falling',
      detail: trends.volume.note,
      evidence: [
        `${trends.volume.from?.toFixed(1)} → ${trends.volume.to?.toFixed(1)} reviews/day (half-window averages)`,
        `${trends.volume.sampleSize} reviews, Mann–Kendall p ${
          (trends.volume.pValue ?? 1) < 0.01
            ? '< 0.01'
            : `= ${(trends.volume.pValue ?? 1).toFixed(2)}`
        }`,
      ],
      confidence: trends.volume.confidence,
      period,
    });
  }

  // ---- Memory risk ----------------------------------------------------------
  const retention = memory.retention;
  if (retention.evaluatedCards >= MIN_RECALL_SAMPLE && retention.atRisk > 0) {
    const attention = retention.atRisk >= 10;
    if (attention) {
      insights.push({
        id: 'memory-at-risk',
        kind: 'memory',
        tone: 'attention',
        title: `${retention.atRisk} cards are below your desired retention`,
        detail: `Their FSRS-predicted recall has fallen under the deck target of ${pct(
          retention.threshold
        )}. This is a model estimate, not a measured memory test.`,
        evidence: [
          `${num(retention.meanRetrievability)} mean predicted retrievability`,
          `${retention.overdue} scheduled cards are overdue`,
        ],
        confidence: {
          level: 'medium',
          score: 0.6,
          sampleSize: retention.evaluatedCards,
          rationale: `Based on FSRS state for ${retention.evaluatedCards} reviewed cards.`,
        },
        period,
      });

      recommendations.push({
        id: 'review-at-risk',
        action: `Review the ${retention.atRisk} at-risk cards first`,
        reason: `Their predicted recall is below the deck target, so they are the most likely to be forgotten next.`,
        metrics: [
          `${retention.atRisk} of ${retention.evaluatedCards} cards below ${pct(retention.threshold)}`,
          `${retention.approaching} more are approaching the threshold`,
        ],
        priority: 'high',
        confidence: {
          level: 'medium',
          score: 0.6,
          sampleSize: retention.evaluatedCards,
          rationale: 'FSRS model estimate over reviewed cards in FSRS decks.',
        },
        period,
      });
    }
  }

  // ---- Repeated failures ----------------------------------------------------
  if (memory.lapses.repeatedFailureCards >= 5) {
    insights.push({
      id: 'repeated-failures',
      kind: 'memory',
      tone: 'attention',
      title: `${memory.lapses.repeatedFailureCards} cards keep coming back`,
      detail: `These cards have lapsed at least twice${
        memory.lapses.leeches > 0
          ? `, and ${memory.lapses.leeches} have reached Anki's default leech threshold of 8`
          : ''
      }. Rewriting a card is often more effective than reviewing it again.`,
      evidence: [
        `${memory.lapses.total} total lapses recorded`,
        `${memory.lapses.cardsWithLapses} cards have lapsed at least once`,
      ],
      confidence: {
        level: 'medium',
        score: 0.55,
        sampleSize: memory.lapses.cardsWithLapses,
        rationale: 'Counts come from stored FSRS lapse counters.',
      },
      period,
    });

    recommendations.push({
      id: 'rewrite-leeches',
      action: 'Rewrite the most-lapsed cards instead of re-reviewing them',
      reason: 'Repeated lapses usually mean the prompt is ambiguous, too large, or lacks context — not that it needs more repetitions.',
      metrics: [
        `${memory.lapses.repeatedFailureCards} cards with 2+ lapses`,
        `${memory.lapses.leeches} cards at 8+ lapses`,
      ],
      priority: 'medium',
      confidence: {
        level: 'medium',
        score: 0.5,
        sampleSize: memory.lapses.cardsWithLapses,
        rationale: 'Lapse counts are exact; the cause of a lapse is not observable.',
      },
      period,
    });
  }

  // ---- Deck attention -------------------------------------------------------
  const weakest = decks.needsAttention[0];
  if (weakest) {
    const reason =
      weakest.due.overdue >= 10
        ? `${weakest.due.overdue} scheduled cards are overdue`
        : weakest.lapse.rate !== null && weakest.lapse.rate >= 0.2
          ? `${pct(weakest.lapse.rate)} of its review-state answers lapsed`
          : `${pct(weakest.recall.successRate)} successful recall over ${weakest.recall.sampleSize} reviews`;

    insights.push({
      id: `deck-attention-${weakest.deckId}`,
      kind: 'deck',
      tone: 'attention',
      title: `“${weakest.name}” needs attention`,
      detail: `${reason}.`,
      evidence: [
        `${weakest.reviews} ${reviewWord(weakest.reviews)} in this range`,
        `${weakest.due.scheduled} scheduled cards due now`,
      ],
      confidence: weakest.confidence,
      period,
    });

    recommendations.push({
      id: `start-deck-${weakest.deckId}`,
      action: `Start your next session with “${weakest.name}”`,
      reason: `${reason}; it ranks first among decks by overdue load and lapse rate.`,
      metrics: [
        `${weakest.recall.sampleSize} reviews in range`,
        `${weakest.lapse.lapses} lapses recorded`,
        `${weakest.due.newCards} new cards waiting`,
      ],
      priority: 'high',
      confidence: weakest.confidence,
      period,
      deckId: weakest.deckId,
    });
  }

  // ---- Overdue backlog ------------------------------------------------------
  const workload = forecast.workload;
  // `next7` already includes today, so adding `dueToday` here double-counts
  // the cards that make the backlog look smaller than it is.
  const upcoming = workload.overdue + workload.next7;
  if (workload.overdue >= 10 && upcoming > 0 && workload.overdue / upcoming >= 0.25) {
    const overdueShare = Math.round((workload.overdue / upcoming) * 100);
    recommendations.push({
      id: 'clear-overdue',
      action: `Clear the ${workload.overdue} overdue cards before adding new ones`,
      reason: `${overdueShare}% of the scheduled work in the next week is already overdue, so new material would compete with a growing backlog.`,
      metrics: [
        `${workload.overdue} overdue`,
        `${workload.dueToday} due today`,
        `${Math.max(0, workload.next7 - workload.dueToday)} due after today`,
      ],
      priority: 'high',
      confidence: {
        level: 'high',
        score: 0.85,
        sampleSize: workload.scheduledCards,
        rationale: 'Exact count of scheduled due dates.',
      },
      period,
    });
  }

  // ---- Session behaviour ----------------------------------------------------
  const intra = behavior.intraSession;
  if (intra.status === 'ok' && intra.direction === 'declining') {
    insights.push({
      id: 'session-decline',
      kind: 'behaviour',
      tone: 'attention',
      title: 'Recall is lower later in longer sessions',
      detail: `In sessions of nine or more reviews, the first third recalled ${pct(
        intra.firstRate
      )} successfully and the last third ${pct(
        intra.lastRate
      )}. This is an association in your data — it does not prove fatigue.`,
      evidence: [
        `${intra.sampleSize} positioned reviews compared`,
        `${behavior.sessions.count} sessions in this range`,
      ],
      confidence: {
        level: 'low',
        score: 0.35,
        sampleSize: intra.sampleSize,
        rationale: 'Observational comparison; session length is not assigned at random.',
      },
      period,
    });

    recommendations.push({
      id: 'shorter-sessions',
      action: 'Try splitting long sessions into two shorter blocks',
      reason: 'Later reviews in long sessions were less likely to succeed; a shorter block may avoid the same pattern.',
      metrics: [
        `first third ${pct(intra.firstRate)} vs last third ${pct(intra.lastRate)}`,
        `${behavior.sessions.count} sessions observed`,
      ],
      priority: 'medium',
      confidence: {
        level: 'low',
        score: 0.35,
        sampleSize: intra.sampleSize,
        rationale: 'An association, not a causal finding.',
      },
      period,
    });
  }

  // ---- Efficiency -----------------------------------------------------------
  if (
    trends.efficiency.direction === 'improving' &&
    trends.recall.direction !== 'declining'
  ) {
    insights.push({
      id: 'efficiency-up',
      kind: 'efficiency',
      tone: 'positive',
      title: 'You are recalling faster without losing accuracy',
      detail: `Successful reviews per minute rose from ${num(
        trends.efficiency.from,
        2
      )} to ${num(trends.efficiency.to, 2)} while successful recall did not fall.`,
      evidence: [
        `${trends.efficiency.sampleSize} timed reviews`,
        'Duration is total review time, not pure retrieval latency',
      ],
      confidence: trends.efficiency.confidence,
      period,
    });
  }

  // ---- New-card backlog -----------------------------------------------------
  const backlog = forecast.backlog;
  if (backlog.status === 'ok' && backlog.weeks !== null && backlog.weeks > 0) {
    const weeks = Math.ceil(backlog.weeks);
    insights.push({
      id: 'backlog-pace',
      kind: 'workload',
      tone: 'neutral',
      title: `New cards are being introduced at ${num(backlog.newPerWeek, 1)} per week`,
      detail: `At that pace, the remaining ${backlog.remainingNewCards} new cards take about ${weeks} ${weekWord(
        weeks
      )} to introduce.`,
      evidence: [
        `${backlog.sampleNewCards} new cards introduced in the last 28 days`,
        backlog.interval
          ? `95% range: ${Math.round(backlog.interval.low)}–${Math.round(backlog.interval.high)} weeks`
          : 'Too few new cards to bound the estimate',
      ],
      confidence: backlog.confidence,
      period,
    });
  }

  // ---- Study timing ---------------------------------------------------------
  if (behavior.bestWeekday && behavior.bestWeekday.reviews >= MIN_DECK_SAMPLE / 2) {
    const weekday = behavior.bestWeekday;
    insights.push({
      id: 'best-weekday',
      kind: 'behaviour',
      tone: 'neutral',
      title: `${weekday.label} is your most active study day`,
      detail: `${weekday.reviews} ${reviewWord(weekday.reviews)} landed on ${weekday.label}${
        weekday.successRate !== null ? `, with ${pct(weekday.successRate)} successful recall` : ''
      }.`,
      evidence: [
        `${weekday.activeDays} active ${weekday.label}s in this window`,
        behavior.bestHour
          ? `Most reviews happen ${behavior.bestHour.label} (${behavior.bestHour.reviews})`
          : 'No dominant study hour yet',
      ],
      confidence: {
        level: weekday.reviews >= 50 ? 'medium' : 'low',
        score: weekday.reviews >= 50 ? 0.5 : 0.35,
        sampleSize: weekday.reviews,
        rationale: 'Timing describes when you study; it does not show that the time causes better results.',
      },
      period,
    });
  }

  // ---- Sort and cap ---------------------------------------------------------
  const sortedInsights = insights
    .sort(
      (a, b) =>
        TONE_ORDER[a.tone] - TONE_ORDER[b.tone] ||
        b.confidence.score - a.confidence.score
    )
    .slice(0, 6);

  const sortedRecommendations = recommendations
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.confidence.score - a.confidence.score
    )
    .slice(0, 4);

  return {
    status:
      sortedInsights.length > 0
        ? 'ok'
        : performance.status === 'empty'
          ? 'empty'
          : 'insufficient_data',
    insights: sortedInsights,
    recommendations: sortedRecommendations,
  };
}
