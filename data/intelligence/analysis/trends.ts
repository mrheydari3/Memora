/**
 * Trend intelligence.
 *
 * Three rules keep this honest:
 *   1. Daily counts are a complete calendar series, zeros included.
 *   2. A direction is reported only when the evidence gate is met — Wilson
 *      intervals must separate for recall, and Mann–Kendall needs enough points
 *      and a p-value below 0.10 for volume.
 *   3. Every metric names the method and its sample size, so the UI can print
 *      "no change beyond noise" instead of inventing a story.
 *
 * Daily reviews are serially correlated. That makes Mann–Kendall
 * anti-conservative, so its result is labelled descriptive and is never the sole
 * basis for a recommendation.
 */

import type {
  AnalyticsRange,
  AnomalyPoint,
  NormalizedReview,
  RecallMetrics,
  TrendAnalysis,
  TrendDirection,
  TrendMetric,
} from '../core/types';
import { addDays, dayLabel, startOfDay } from '../core/dates';
import {
  ANOMALY_Z_THRESHOLD,
  MIN_RECALL_CHANGE,
  MIN_RECALL_SAMPLE,
  MIN_TREND_POINTS,
  MIN_TREND_WINDOW_REVIEWS,
} from '../core/constants';
import {
  confidenceFor,
  isAnomaly,
  mannKendall,
  mean,
  median,
  relativeChange,
  robustZScores,
  senSlope,
} from '../core/stats';
import { buildSeries, reviewsInRange, weeklySeries } from './series';
import { computeDuration, computeRecall } from './metrics';

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function halfMeans(values: readonly number[]): { from: number; to: number } {
  if (values.length === 0) return { from: 0, to: 0 };
  const middle = Math.floor(values.length / 2);
  const first = values.slice(0, middle);
  const second = values.slice(middle);
  return {
    from: first.length > 0 ? (mean(first) ?? 0) : 0,
    to: second.length > 0 ? (mean(second) ?? 0) : 0,
  };
}

function insufficient(
  direction: TrendDirection,
  unit: TrendMetric['unit'],
  method: string,
  sampleSize: number,
  note: string
): TrendMetric {
  return {
    direction,
    change: null,
    from: null,
    to: null,
    unit,
    method,
    pValue: null,
    sampleSize,
    confidence: {
      level: 'insufficient',
      score: 0.1,
      sampleSize,
      rationale: note,
    },
    note,
  };
}

/**
 * Compare recall in two equal, adjacent windows with Wilson intervals.
 * A direction needs `MIN_TREND_WINDOW_REVIEWS` in each window AND separated
 * intervals — a 5-point move on 20 reviews is noise.
 */
function recallTrend(
  reviews: readonly NormalizedReview[],
  range: AnalyticsRange,
  windowDays: number
): TrendMetric {
  const today = startOfDay(range.end);
  const recentStart = addDays(today, -(windowDays - 1));
  const previousEnd = addDays(recentStart, -1);
  const previousStart = addDays(previousEnd, -(windowDays - 1));

  const previous = computeRecall(reviewsInRange(reviews, previousStart, previousEnd));
  const recent = computeRecall(reviewsInRange(reviews, recentStart, today));
  const sampleSize = previous.sampleSize + recent.sampleSize;
  const method = `Wilson 95% intervals on ${windowDays}-day windows`;
  const requirement = `${MIN_TREND_WINDOW_REVIEWS} rated reviews in each window`;

  if (
    previous.sampleSize < MIN_TREND_WINDOW_REVIEWS ||
    recent.sampleSize < MIN_TREND_WINDOW_REVIEWS ||
    previous.successRate === null ||
    recent.successRate === null ||
    previous.successInterval === null ||
    recent.successInterval === null
  ) {
    return insufficient(
      'insufficient_data',
      'ratio',
      method,
      sampleSize,
      `Needs ${requirement}; the two windows hold ${previous.sampleSize} and ${recent.sampleSize}.`
    );
  }

  const change = recent.successRate - previous.successRate;
  const separated =
    recent.successInterval.low > previous.successInterval.high ||
    recent.successInterval.high < previous.successInterval.low;
  const direction: TrendDirection =
    separated && Math.abs(change) >= MIN_RECALL_CHANGE
      ? change > 0
        ? 'improving'
        : 'declining'
      : 'stable';

  const confidence = confidenceFor(
    Math.min(previous.sampleSize, recent.sampleSize),
    recent.successInterval,
    'rated reviews per window'
  );

  const note =
    direction === 'stable'
      ? `No change large enough to separate from noise (${(change * 100).toFixed(1)} points).`
      : `Successful recall moved from ${Math.round(previous.successRate * 100)}% to ${Math.round(
          recent.successRate * 100
        )}% and the intervals no longer overlap.`;

  return {
      direction,
      change: round(change),
      from: round(previous.successRate),
      to: round(recent.successRate),
      unit: 'ratio',
      method,
      pValue: null,
      sampleSize,
      confidence,
      note,
  };
}

/** Sen's slope + Mann–Kendall over the daily count series (zeros included). */
function volumeTrend(reviews: readonly NormalizedReview[], range: AnalyticsRange): TrendMetric {
  const series = buildSeries(reviews, range.start, range.end);
  const values = series.points.map((point) => point.value);
  const method = "Sen's slope with Mann–Kendall (tie-corrected)";

  if (values.length < MIN_TREND_POINTS || series.total < MIN_TREND_WINDOW_REVIEWS) {
    return insufficient(
      'insufficient_data',
      'reviews_per_day',
      method,
      series.total,
      `Needs ${MIN_TREND_POINTS} days and ${MIN_TREND_WINDOW_REVIEWS} reviews; the window holds ${values.length} days and ${series.total} reviews.`
    );
  }

  const slope = senSlope(series.points.map((point, index) => ({ x: index, y: point.value })));
  const kendall = mannKendall(values);
  const halves = halfMeans(values);
  const change = halves.to - halves.from;

  const direction: TrendDirection =
    kendall.trend === 'increasing'
      ? 'improving'
      : kendall.trend === 'decreasing'
        ? 'declining'
        : 'stable';

  const confidence = confidenceFor(series.total, null, 'reviews');

  const pText =
    kendall.pValue === null
      ? '—'
      : kendall.pValue < 0.01
        ? '< 0.01'
        : `= ${kendall.pValue.toFixed(2)}`;
  const note =
    direction === 'stable'
      ? `No monotonic volume trend detected${kendall.pValue === null ? '' : ` (Mann–Kendall p ${pText})`}.`
      : `Daily volume is trending ${
          direction === 'improving' ? 'up' : 'down'
        } by about ${Math.abs(slope ?? 0).toFixed(2)} reviews/day (p ${pText}). More reviews is not automatically better — read it with recall and workload.`;

  return {
      direction,
      change: round(change, 2),
      from: round(halves.from, 2),
      to: round(halves.to, 2),
      unit: 'reviews_per_day',
      method,
      pValue: kendall.pValue,
      sampleSize: series.total,
      confidence,
      note,
  };
}

/** Share of days studied, first half vs second half of the analysed range. */
function consistencyTrend(
  reviews: readonly NormalizedReview[],
  range: AnalyticsRange
): TrendMetric {
  const series = buildSeries(reviews, range.start, range.end);
  const method = 'Active-day ratio, first half vs second half';
  const values = series.points.map((point) => point.value);

  if (values.length < 14) {
    return insufficient(
      'insufficient_data',
      'ratio',
      method,
      series.total,
      'Needs at least 14 days to compare two halves.'
    );
  }

  const middle = Math.floor(values.length / 2);
  const ratio = (slice: readonly number[]) =>
    slice.length === 0 ? 0 : slice.filter((value) => value > 0).length / slice.length;

  const from = ratio(values.slice(0, middle));
  const to = ratio(values.slice(middle));
  const change = to - from;
  const direction: TrendDirection =
    change >= 0.15 ? 'improving' : change <= -0.15 ? 'declining' : 'stable';

  const note =
    direction === 'stable'
      ? `Study frequency is steady (${Math.round(from * 100)}% of days → ${Math.round(to * 100)}%).`
      : `You studied on ${Math.round(to * 100)}% of recent days, up from ${Math.round(
          from * 100
        )}% earlier in the window.`;

  return {
      direction,
      change: round(change),
      from: round(from),
      to: round(to),
      unit: 'ratio',
      method,
      pValue: null,
      sampleSize: series.activeDays,
      confidence: confidenceFor(series.total, null, 'reviews'),
      note,
  };
}

/** Successful reviews per minute of recorded review time, halves compared. */
function efficiencyTrend(
  reviews: readonly NormalizedReview[],
  range: AnalyticsRange
): TrendMetric {
  const middle = addDays(range.start, Math.floor(range.days / 2));
  const first = reviewsInRange(reviews, range.start, addDays(middle, -1));
  const second = reviewsInRange(reviews, middle, range.end);
  const method = 'Successful reviews per minute, halves compared';
  const firstDuration = computeDuration(first);
  const secondDuration = computeDuration(second);

  if (
    firstDuration.sampleSize < MIN_TREND_WINDOW_REVIEWS ||
    secondDuration.sampleSize < MIN_TREND_WINDOW_REVIEWS ||
    firstDuration.totalMs === 0 ||
    secondDuration.totalMs === 0
  ) {
    return insufficient(
      'insufficient_data',
      'per_minute',
      method,
      firstDuration.sampleSize + secondDuration.sampleSize,
      `Needs ${MIN_TREND_WINDOW_REVIEWS} timed reviews in each half.`
    );
  }

  const rate = (records: readonly NormalizedReview[], durationMinutes: number) =>
    records.length === 0 ? 0 : records.filter((review) => review.rating >= 2).length / durationMinutes;

  const firstRate = rate(first, firstDuration.totalMs / 60_000);
  const secondRate = rate(second, secondDuration.totalMs / 60_000);
  const change = relativeChange(firstRate, secondRate);

  const direction: TrendDirection =
    change === null || Math.abs(change) < 0.15
      ? 'stable'
      : change > 0
        ? 'improving'
        : 'declining';

  const note =
    direction === 'stable'
      ? 'Learning efficiency (successful reviews per minute) is unchanged.'
      : `Learning efficiency ${direction === 'improving' ? 'improved' : 'declined'} by ${Math.abs(
          (change ?? 0) * 100
        ).toFixed(0)}% between the two halves.`;

  return {
      direction,
      change: change === null ? null : round(change),
      from: round(firstRate, 2),
      to: round(secondRate, 2),
      unit: 'per_minute',
      method,
      pValue: null,
      sampleSize: firstDuration.sampleSize + secondDuration.sampleSize,
      confidence: confidenceFor(
        Math.min(firstDuration.sampleSize, secondDuration.sampleSize),
        null,
        'timed reviews per half'
      ),
      note,
  };
}

/** Days whose count is far from the median, using a robust z-score. */
function findAnomalies(reviews: readonly NormalizedReview[], range: AnalyticsRange): AnomalyPoint[] {
  const series = buildSeries(reviews, range.start, range.end);
  const values = series.points.map((point) => point.value);
  const robust = robustZScores(values);
  // MAD is 0 when more than half the days are identical (usually all zero).
  // Flagging every non-zero day as an "anomaly" would be worse than silence.
  if (!robust.reliable || robust.median === null) return [];

  return series.points
    .map((point, index) => ({
      dayStart: point.dayStart,
      label: dayLabel(point.dayStart),
      value: point.value,
      median: robust.median ?? 0,
      zScore: robust.scores[index],
      direction: (robust.scores[index] >= 0 ? 'above' : 'below') as 'above' | 'below',
    }))
    .filter((point) => isAnomaly(point.zScore))
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 3);
}

export function analyzeTrends(
  reviews: readonly NormalizedReview[],
  range: AnalyticsRange
): TrendAnalysis {
  const series = buildSeries(reviews, range.start, range.end);
  const windowDays = Math.min(21, Math.max(3, Math.floor(range.days / 2)));

  return {
    status:
      reviews.length === 0
        ? 'empty'
        : series.days < MIN_TREND_POINTS || reviews.length < MIN_RECALL_SAMPLE
          ? 'insufficient_data'
          : 'ok',
    recall: recallTrend(reviews, range, windowDays),
    volume: volumeTrend(reviews, range),
    consistency: consistencyTrend(reviews, range),
    efficiency: efficiencyTrend(reviews, range),
    anomalies: findAnomalies(reviews, range),
    series,
    weekly: weeklySeries(series),
    windowDays,
  };
}

/** Exported for the daily report: the median of a window's daily counts. */
export function medianDailyReviews(reviews: readonly NormalizedReview[], range: AnalyticsRange): number {
  const series = buildSeries(reviews, range.start, range.end);
  return median(series.points.map((point) => point.value)) ?? 0;
}

export const TREND_ANOMALY_THRESHOLD = ANOMALY_Z_THRESHOLD;
