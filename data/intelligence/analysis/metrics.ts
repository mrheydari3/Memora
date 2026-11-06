/**
 * Performance metrics — observed behaviour only.
 *
 * Rating semantics follow Anki/FSRS exactly:
 *   Again = failed recall; Hard = recalled with difficulty (a PASS);
 *   Good  = successful recall; Easy = successful recall with ease.
 *
 * `successRate` therefore includes Hard and is never called "accuracy" in the UI:
 * the rating is a self-report, not a verified answer.
 */

import type { AnalyticsRange, NormalizedReview, PerformanceMetrics, RecallMetrics, DurationMetrics } from '../core/types';
import { addDays, startOfDay, WEEKDAY_LABELS } from '../core/dates';
import { MIN_RECALL_SAMPLE } from '../core/constants';
import { confidenceFor, median, quantile, rateOf, wilsonInterval } from '../core/stats';
import { computeStreak } from '../../streak';
import { buildSeries } from './series';
import { emptyRatingCounts, ratingKeyOf } from '../core/normalize';

const EMPTY_RATES = {
  successRate: null,
  fluentRate: null,
  difficultRate: null,
  againRate: null,
};

export function computeRecall(reviews: readonly NormalizedReview[]): RecallMetrics {
  const counts = emptyRatingCounts();
  for (const review of reviews) counts[ratingKeyOf(review.rating)] += 1;

  const sampleSize = reviews.length;
  const success = counts.hard + counts.good + counts.easy;
  const fluent = counts.good + counts.easy;

  // Below the evidence floor, a percentage is a coin flip presented as a fact.
  const reportable = sampleSize >= MIN_RECALL_SAMPLE;
  const successInterval = reportable ? wilsonInterval(success, sampleSize) : null;

  return {
    status: sampleSize === 0 ? 'empty' : reportable ? 'ok' : 'insufficient_data',
    successRate: reportable ? rateOf(success, sampleSize) : EMPTY_RATES.successRate,
    successInterval,
    fluentRate: reportable ? rateOf(fluent, sampleSize) : EMPTY_RATES.fluentRate,
    difficultRate: reportable ? rateOf(counts.hard, sampleSize) : EMPTY_RATES.difficultRate,
    againRate: reportable ? rateOf(counts.again, sampleSize) : EMPTY_RATES.againRate,
    sampleSize,
    counts,
    shares: {
      again: sampleSize > 0 ? counts.again / sampleSize : null,
      hard: sampleSize > 0 ? counts.hard / sampleSize : null,
      good: sampleSize > 0 ? counts.good / sampleSize : null,
      easy: sampleSize > 0 ? counts.easy / sampleSize : null,
    },
    confidence: confidenceFor(sampleSize, successInterval, 'rated reviews'),
  };
}

export function computeDuration(reviews: readonly NormalizedReview[]): DurationMetrics {
  const durations = reviews
    .map((review) => review.elapsedMs)
    .filter((value): value is number => value !== null);

  if (durations.length === 0) {
    return {
      status: 'empty',
      sampleSize: 0,
      excluded: reviews.length,
      meanMs: null,
      medianMs: null,
      p90Ms: null,
      totalMs: 0,
    };
  }

  const totalMs = durations.reduce((total, value) => total + value, 0);

  return {
    status: durations.length >= 5 ? 'ok' : 'insufficient_data',
    sampleSize: durations.length,
    excluded: reviews.length - durations.length,
    meanMs: totalMs / durations.length,
    medianMs: median(durations),
    p90Ms: quantile(durations, 0.9),
    totalMs,
  };
}

/** Longest run of consecutive active days in the set. */
export function longestStreak(days: readonly number[]): number {
  if (days.length === 0) return 0;
  const unique = [...new Set(days)].sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] === addDays(unique[index - 1], 1)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function weekdayPoints(reviews: readonly NormalizedReview[], days: readonly number[]) {
  const byWeekday = Array.from({ length: 7 }, () => ({
    reviews: 0,
    success: 0,
    sample: 0,
    active: new Set<number>(),
  }));

  for (const review of reviews) {
    const bucket = byWeekday[review.weekday];
    bucket.reviews += 1;
    bucket.sample += 1;
    if (review.rating >= 2) bucket.success += 1;
  }
  for (const day of days) {
    byWeekday[new Date(day).getDay()].active.add(day);
  }

  return byWeekday.map((bucket, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    reviews: bucket.reviews,
    activeDays: bucket.active.size,
    successRate:
      bucket.sample >= MIN_RECALL_SAMPLE ? rateOf(bucket.success, bucket.sample) : null,
  }));
}

const HOUR_BUCKETS = [
  { bucket: 0, from: 0, label: '00–03' },
  { bucket: 1, from: 4, label: '04–07' },
  { bucket: 2, from: 8, label: '08–11' },
  { bucket: 3, from: 12, label: '12–15' },
  { bucket: 4, from: 16, label: '16–19' },
  { bucket: 5, from: 20, label: '20–23' },
] as const;

function hourPoints(reviews: readonly NormalizedReview[]) {
  return HOUR_BUCKETS.map(({ bucket, label }) => {
    const bucketReviews = reviews.filter((review) => Math.floor(review.hour / 4) === bucket);
    const success = bucketReviews.filter((review) => review.rating >= 2).length;
    return {
      bucket,
      label,
      reviews: bucketReviews.length,
      successRate:
        bucketReviews.length >= MIN_RECALL_SAMPLE
          ? rateOf(success, bucketReviews.length)
          : null,
    };
  });
}

export function computePerformance(
  reviews: readonly NormalizedReview[],
  range: AnalyticsRange,
  now: number,
  /** All-time reviews, used only for the streak (which outlives the window). */
  streakSource: readonly NormalizedReview[] = reviews
): PerformanceMetrics {
  const today = startOfDay(now);
  const daySet = new Set(reviews.map((review) => review.dayStart));
  const activeDays = daySet.size;
  const streakDays = new Set(streakSource.map((review) => review.dayStart));

  const countFrom = (start: number) =>
    reviews.filter((review) => review.dayStart >= start).length;

  const last7 = countFrom(addDays(today, -6));
  const previous7 = reviews.filter(
    (review) => review.dayStart >= addDays(today, -13) && review.dayStart < addDays(today, -6)
  ).length;
  const todayReviews = reviews.filter((review) => review.dayStart === today).length;
  const yesterday = reviews.filter((review) => review.dayStart === addDays(today, -1)).length;

  const recall = computeRecall(reviews);
  const duration = computeDuration(reviews);
  const activity = buildSeries(reviews, range.start, range.end);
  const days = activity.points.map((point) => point.dayStart);
  const weekday = weekdayPoints(reviews, days);
  const hours = hourPoints(reviews);

  const successful = reviews.filter((review) => review.rating >= 2).length;
  const minutes = duration.totalMs / 60_000;
  const efficiencyRate =
    duration.sampleSize >= MIN_RECALL_SAMPLE && minutes > 0 ? successful / minutes : null;

  return {
    status: reviews.length === 0 ? 'empty' : recall.status === 'ok' ? 'ok' : 'insufficient_data',
    totals: {
      reviews: reviews.length,
      activeDays,
      spanDays: range.days,
      ratedReviews: recall.sampleSize,
    },
    volume: {
      today: todayReviews,
      yesterday,
      last7,
      previous7,
      perCalendarDay: range.days > 0 ? reviews.length / range.days : 0,
      perActiveDay: activeDays > 0 ? reviews.length / activeDays : 0,
      activeDays,
      spanDays: range.days,
    },
    recall,
    duration,
    streak: {
      current: computeStreak(streakSource.map((review) => review.reviewedAt), now),
      longest: longestStreak([...streakDays]),
    },
    activity,
    weekday,
    hours,
    efficiency: {
      status:
        efficiencyRate === null
          ? duration.sampleSize === 0
            ? 'empty'
            : 'insufficient_data'
          : 'ok',
      successfulReviewsPerMinute: efficiencyRate,
      sampleSize: duration.sampleSize,
    },
  };
}

/** Median reviews per active day, used by the session recommendation. */
export function medianActiveDay(reviews: readonly NormalizedReview[]): number | null {
  const counts = new Map<number, number>();
  for (const review of reviews) {
    counts.set(review.dayStart, (counts.get(review.dayStart) ?? 0) + 1);
  }
  return counts.size === 0 ? null : median([...counts.values()]);
}
