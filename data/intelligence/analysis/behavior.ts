/**
 * Behavioural intelligence — how the learner actually studies.
 *
 * Sessions are contiguous blocks of reviews separated by a 30-minute gap. The
 * metrics describe behaviour (frequency, timing, duration) and deliberately stop
 * short of psychology: a timestamp log can show behavioural consistency, not
 * habit strength, and an association between session length and lower recall is
 * not evidence of fatigue.
 */

import type {
  BehaviorMetrics,
  ConsistencyMetrics,
  IntraSessionResult,
  NormalizedReview,
  PerformanceMetrics,
  SessionSummary,
} from '../core/types';
import { startOfDay } from '../core/dates';
import {
  MIN_DECK_SAMPLE,
  MIN_RECALL_SAMPLE,
  MIN_RECALL_CHANGE,
  SESSION_GAP_MS,
} from '../core/constants';
import { coefficientOfVariation, mean, median, rateOf } from '../core/stats';
import { emptyRatingCounts, ratingKeyOf } from '../core/normalize';

export function buildSessions(reviews: readonly NormalizedReview[]): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  let current: NormalizedReview[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const ratings = emptyRatingCounts();
    for (const review of current) ratings[ratingKeyOf(review.rating)] += 1;

    const start = current[0].reviewedAt;
    const last = current[current.length - 1];
    const end = Math.max(
      last.reviewedAt,
      ...current.map((review) => review.reviewedAt + (review.elapsedMs ?? 0))
    );
    const success = ratings.hard + ratings.good + ratings.easy;

    // Positions are recorded here, while the ordered reviews are still in hand.
    // Reconstructing them later from the session's average would make the
    // first-third and last-third rates identical by construction — a metric that
    // can never detect the pattern it claims to measure.
    const third = Math.floor(current.length / 3);
    const tally = (slice: readonly NormalizedReview[]) => ({
      success: slice.filter((review) => review.rating >= 2).length,
      sample: slice.length,
    });

    sessions.push({
      start,
      end,
      durationMs: Math.max(0, end - start),
      reviews: current.length,
      deckIds: [...new Set(current.map((review) => review.deckId))],
      ratings,
      successRate: rateOf(success, current.length),
      firstThird: tally(current.slice(0, third)),
      lastThird: tally(current.slice(current.length - third)),
    });
    current = [];
  };

  for (const review of reviews) {
    const previous = current[current.length - 1];
    if (previous && review.reviewedAt - previous.reviewedAt > SESSION_GAP_MS) flush();
    current.push(review);
  }
  flush();

  return sessions;
}

/**
 * First third vs last third of longer sessions.
 *
 * Pooled across sessions and gated at 30 reviews per pool. The result is an
 * association within the data, not proof that sessions cause decline.
 */
export function analyzeIntraSession(sessions: readonly SessionSummary[]): IntraSessionResult {
  let firstSuccess = 0;
  let firstSample = 0;
  let lastSuccess = 0;
  let lastSample = 0;

  for (const session of sessions) {
    if (session.reviews < 9) continue;
    firstSuccess += session.firstThird.success;
    firstSample += session.firstThird.sample;
    lastSuccess += session.lastThird.success;
    lastSample += session.lastThird.sample;
  }

  if (firstSample < MIN_DECK_SAMPLE || lastSample < MIN_DECK_SAMPLE) {
    return {
      status: 'insufficient_data',
      firstRate: null,
      lastRate: null,
      delta: null,
      sampleSize: firstSample + lastSample,
      direction: 'insufficient_data',
    };
  }

  const firstRate = firstSuccess / firstSample;
  const lastRate = lastSuccess / lastSample;
  const delta = lastRate - firstRate;

  return {
    status: 'ok',
    firstRate,
    lastRate,
    delta,
    sampleSize: firstSample + lastSample,
    direction:
      Math.abs(delta) < MIN_RECALL_CHANGE ? 'stable' : delta > 0 ? 'improving' : 'declining',
  };
}

function consistencyOf(
  performance: PerformanceMetrics,
  rangeStart: number,
  rangeEnd: number
): ConsistencyMetrics {
  const points = performance.activity.points;
  const values = points.map((point) => point.value);

  let longestGap = 0;
  let currentGap = 0;
  for (const value of values) {
    if (value === 0) {
      currentGap += 1;
      longestGap = Math.max(longestGap, currentGap);
    } else {
      currentGap = 0;
    }
  }

  return {
    activeDayRatio: points.length > 0 ? performance.volume.activeDays / points.length : 0,
    coefficientOfVariation: coefficientOfVariation(values),
    longestGapDays: longestGap,
    currentStreak: performance.streak.current,
    longestStreak: performance.streak.longest,
  };
}

export function analyzeBehavior(
  reviews: readonly NormalizedReview[],
  performance: PerformanceMetrics,
  rangeStart: number,
  rangeEnd: number
): BehaviorMetrics {
  const sessions = buildSessions(reviews);
  const durations = sessions.map((session) => session.durationMs);
  const sampleSessions = sessions.filter((session) => session.durationMs > 0);
  const timedMinutes = sampleSessions.reduce(
    (total, session) => total + session.durationMs / 60_000,
    0
  );

  const bestWeekday =
    performance.weekday.reduce<(typeof performance.weekday)[number] | null>(
      (best, point) => (point.reviews > (best?.reviews ?? 0) ? point : best),
      null
    ) ?? null;
  const bestHour =
    performance.hours.reduce<(typeof performance.hours)[number] | null>(
      (best, point) => (point.reviews > (best?.reviews ?? 0) ? point : best),
      null
    ) ?? null;

  return {
    status:
      reviews.length === 0
        ? 'empty'
        : sessions.length < 2 || reviews.length < MIN_RECALL_SAMPLE
          ? 'insufficient_data'
          : 'ok',
    sessions: {
      count: sessions.length,
      meanReviews: mean(sessions.map((session) => session.reviews)),
      medianReviews: median(sessions.map((session) => session.reviews)),
      meanDurationMs: mean(durations),
      medianDurationMs: median(durations),
      reviewsPerMinute:
        timedMinutes > 0 && sampleSessions.length >= 2
          ? reviews.length / timedMinutes
          : null,
    },
    bestWeekday: bestWeekday && bestWeekday.reviews > 0 ? bestWeekday : null,
    bestHour: bestHour && bestHour.reviews > 0 ? bestHour : null,
    consistency: consistencyOf(performance, rangeStart, rangeEnd),
    intraSession: analyzeIntraSession(sessions),
  };
}

/** Consecutive-day span helper used by the report module. */
export function activeDayCount(reviews: readonly NormalizedReview[]): number {
  return new Set(reviews.map((review) => review.dayStart)).size;
}
