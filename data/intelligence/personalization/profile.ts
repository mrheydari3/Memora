/**
 * Local learning profile — behavioural observations, not a learning style.
 *
 * The profile uses only stored review timestamps, ratings and durations. It
 * refuses to identify a "best time of day" unless the 95% Wilson intervals for
 * that window and the other windows do not overlap. Time of day is an
 * association, not a causal effect, and no user is assigned a cognitive type.
 */

import type { NormalizedReview } from '../core/types';
import type {
  ProfileAdaptation,
  StudyProfile,
  StudyWindow,
  StudyWindowId,
} from '../engine/types';
import { addDays, startOfDay } from '../core/dates';
import { analyzeIntraSession, buildSessions } from '../analysis/behavior';
import { longestStreak } from '../analysis/metrics';
import { confidenceFor, median, quantile, wilsonInterval } from '../core/stats';
import { computeStreak } from '../../streak';
import { MAX_REVIEW_DURATION_MS } from '../core/constants';
import type { IntraSessionResult } from '../core/types';

const PROFILE_WINDOW_DAYS = 90;
const MIN_PROFILE_REVIEWS = 30;
const MIN_PACE_SAMPLE = 20;
const MIN_LOAD_DAYS = 7;
const MIN_WINDOW_SAMPLE = 30;

const WINDOWS: readonly { id: StudyWindowId; label: string; from: number; to: number }[] = [
  { id: 'night', label: '00–06', from: 0, to: 6 },
  { id: 'morning', label: '06–12', from: 6, to: 12 },
  { id: 'afternoon', label: '12–18', from: 12, to: 18 },
  { id: 'evening', label: '18–24', from: 18, to: 24 },
];

function emptyIntraSession(): IntraSessionResult {
  return {
    status: 'insufficient_data',
    firstRate: null,
    lastRate: null,
    delta: null,
    sampleSize: 0,
    direction: 'insufficient_data',
  };
}

function preferredWindow(reviews: NormalizedReview[]): StudyWindow | null {
  if (reviews.length < MIN_WINDOW_SAMPLE * 2) return null;

  const windows = WINDOWS.map((window) => {
    const inWindow = reviews.filter(
      (review) => review.hour >= window.from && review.hour < window.to
    );
    const other = reviews.filter(
      (review) => review.hour < window.from || review.hour >= window.to
    );
    const successes = inWindow.filter((review) => review.rating >= 2).length;
    const otherSuccesses = other.filter((review) => review.rating >= 2).length;
    const interval = wilsonInterval(successes, inWindow.length);
    const otherInterval = wilsonInterval(otherSuccesses, other.length);
    return {
      id: window.id,
      label: window.label,
      reviews: inWindow.length,
      successes,
      successRate: inWindow.length > 0 ? successes / inWindow.length : null,
      interval,
      otherRate: other.length > 0 ? otherSuccesses / other.length : null,
      separated:
        inWindow.length >= MIN_WINDOW_SAMPLE &&
        other.length >= MIN_WINDOW_SAMPLE &&
        interval !== null &&
        otherInterval !== null &&
        interval.low > otherInterval.high,
    };
  });

  const separated = windows.filter((window) => window.separated);
  if (separated.length === 0) return null;

  separated.sort(
    (a, b) =>
      (b.successRate ?? 0) - (a.successRate ?? 0) ||
      b.reviews - a.reviews ||
      a.id.localeCompare(b.id)
  );
  return separated[0];
}

export function buildStudyProfile(
  reviews: NormalizedReview[],
  now: number,
  windowDays = PROFILE_WINDOW_DAYS
): StudyProfile {
  const today = startOfDay(now);
  const start = addDays(today, -(windowDays - 1));
  const windowReviews = reviews.filter((review) => review.reviewedAt >= start);

  const durations = windowReviews
    .map((review) => review.elapsedMs)
    .filter(
      (value): value is number =>
        value !== null && value >= 0 && value <= MAX_REVIEW_DURATION_MS
    )
    .sort((a, b) => a - b);

  const medianMs = durations.length >= MIN_PACE_SAMPLE ? median(durations) : null;
  const p90Ms = durations.length >= MIN_PACE_SAMPLE ? quantile(durations, 0.9) : null;

  const sessions = buildSessions(windowReviews);
  const sessionDurations = sessions.map((session) => session.durationMs);
  const intraSession = analyzeIntraSession(sessions);

  const loadStart = addDays(today, -27);
  const loadByDay = new Map<number, number>();
  for (const review of windowReviews) {
    if (review.reviewedAt < loadStart) continue;
    loadByDay.set(review.dayStart, (loadByDay.get(review.dayStart) ?? 0) + 1);
  }
  const loadDays = [...loadByDay.values()];
  const usualLoad = loadDays.length >= MIN_LOAD_DAYS ? median(loadDays) : null;

  const activeDays = new Set(windowReviews.map((review) => review.dayStart)).size;
  const streak = computeStreak(windowReviews.map((review) => review.reviewedAt), now);
  const longest = longestStreak([...new Set(windowReviews.map((review) => review.dayStart))]);

  const preferred = preferredWindow(windowReviews);

  const adaptations: ProfileAdaptation[] = [];
  if (medianMs !== null) {
    adaptations.push({
      id: 'pace',
      text: `Your median recorded review took ${Math.max(1, Math.round(medianMs / 1000))} seconds over ${durations.length} timed reviews.`,
      confidence: confidenceFor(durations.length, null, 'timed reviews'),
    });
  }
  if (sessions.length >= 3) {
    const medianSession = median(sessions.map((session) => session.reviews));
    if (medianSession !== null) {
      adaptations.push({
        id: 'session-size',
        text: `Your typical recorded session contains ${Math.round(medianSession)} reviews.`,
        confidence: confidenceFor(sessions.length, null, 'sessions'),
      });
    }
  }
  if (intraSession.status === 'ok' && intraSession.direction !== 'stable') {
    adaptations.push({
      id: 'late-session',
      text: `In longer sessions, observed recall was ${Math.round((intraSession.lastRate ?? 0) * 100)}% in the last third versus ${Math.round((intraSession.firstRate ?? 0) * 100)}% in the first. This is an association, not proof of fatigue.`,
      confidence: confidenceFor(intraSession.sampleSize, null, 'session-position reviews'),
    });
  }
  if (preferred) {
    adaptations.push({
      id: 'study-window',
      text: `Reviews recorded ${preferred.label} showed ${Math.round((preferred.successRate ?? 0) * 100)}% observed successful recall versus ${Math.round((preferred.otherRate ?? 0) * 100)}% in other windows. This is not a causal claim.`,
      confidence: confidenceFor(preferred.reviews, preferred.interval, 'window reviews'),
    });
  }

  const status =
    windowReviews.length === 0
      ? 'empty'
      : windowReviews.length < MIN_PROFILE_REVIEWS || sessions.length < 2
        ? 'insufficient_data'
        : 'ok';

  return {
    status,
    windowDays,
    reviewCount: windowReviews.length,
    pace: {
      status: medianMs === null ? 'insufficient_data' : 'ok',
      sampleSize: durations.length,
      medianMs,
      p90Ms,
    },
    sessions: {
      status: sessions.length >= 3 ? 'ok' : 'insufficient_data',
      count: sessions.length,
      medianReviews: sessions.length > 0 ? median(sessions.map((session) => session.reviews)) : null,
      medianDurationMs: sessionDurations.length > 0 ? median(sessionDurations) : null,
    },
    usualLoad: {
      status: usualLoad === null ? 'insufficient_data' : 'ok',
      activeDays: loadDays.length,
      medianReviews: usualLoad,
    },
    preferredWindow: preferred,
    consistency: {
      activeDayRatio: activeDays / windowDays,
      currentStreak: streak,
      longestStreak: longest,
    },
    intraSession,
    adaptations,
    limitations: [
      'Review duration includes reading, revealing and choosing a rating; it is not a pure retrieval-latency measurement.',
      'Time-of-day preferences require separated 95% intervals and are associations, not causal effects.',
      'The profile never assigns a learning style or a cognitive diagnosis.',
    ],
  };
}
