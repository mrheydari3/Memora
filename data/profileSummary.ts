/**
 * Profile learning summary — the light, pure metrics layer shared by Home and
 * Profile.
 *
 * The full intelligence engine is the right tool for Statistics, but it builds
 * forecasts, insights and reports that a profile card does not show. This module
 * reuses the engine's normalizer and metric primitives, keeps the same scope
 * rules, and adds the all-time progression/profile facts the engine does not
 * expose:
 *
 *   - normalize once;
 *   - exclude archived decks;
 *   - keep orphan reviews in totals (as the engine does);
 *   - all-time XP/level/streak/active days;
 *   - a 30-day reviews/active-days/recall/activity preview.
 *
 * It is pure. No React, no theme, no icons, no storage access.
 */

import type { Deck, ReviewLogEntry } from './types';
import type {
  NormalizedLog,
  NormalizedReview,
  RecallMetrics,
  Series,
} from './intelligence/core/types';
import { normalizeReviewLog } from './intelligence/core/normalize';
import { computeRecall, longestStreak } from './intelligence/analysis/metrics';
import { buildSeries, reviewsInRange } from './intelligence/analysis/series';
import {
  addDays,
  rangeDays as clampRangeDays,
  startOfDay,
} from './intelligence/core/dates';
import { computeStreak } from './streak';
import { computeProgression } from './progression';

export type ProfileSummaryInput = {
  decks: readonly Deck[];
  reviewLog: readonly ReviewLogEntry[];
  /** Fixed clock for deterministic tests; defaults to Date.now(). */
  now?: number;
  /** Inclusive range ending today. Defaults to 30 and is clamped to 1–365. */
  rangeDays?: number;
};

export type LearningRange = {
  days: number;
  /** Local midnight of the first included day. */
  start: number;
  /** Local midnight of the last included day (today). */
  end: number;
  label: string;
};

export type LearningSummary = {
  allTime: {
    reviews: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    xp: number;
    level: number;
    xpIntoLevel: number;
    xpProgress: number;
  };
  range: {
    range: LearningRange;
    reviews: number;
    activeDays: number;
    recall: RecallMetrics;
    activity: Series;
  };
  dataQuality: {
    rawCount: number;
    usableCount: number;
    excludedCount: number;
    orphanReviews: number;
    archivedReviewsExcluded: number;
  };
};

export type AchievementId =
  | 'first-review'
  | 'seven-day-streak'
  | 'hundred-reviews'
  | 'night-owl'
  | 'speed-demon';

export type AchievementFact = {
  id: AchievementId;
  earned: boolean;
  /** False when the stored data cannot verify the condition at all. */
  available: boolean;
  progress: { current: number; target: number } | null;
  /** A short, factual line the UI can render next to the badge. */
  evidence: string;
};

export type ProfileSummaryBundle = {
  summary: LearningSummary;
  achievements: AchievementFact[];
};

type ProfileContext = {
  now: number;
  days: number;
  eligible: readonly NormalizedReview[];
  dataQuality: LearningSummary['dataQuality'];
};

function createContext(input: ProfileSummaryInput): ProfileContext {
  const now = input.now ?? Date.now();
  const days = clampRangeDays(input.rangeDays ?? 30);
  const normalized: NormalizedLog = normalizeReviewLog(input.reviewLog, input.decks, now);
  const eligible = normalized.reviews.filter((review) => !review.archived);

  return {
    now,
    days,
    eligible,
    dataQuality: {
      rawCount: normalized.rawCount,
      usableCount: normalized.usableCount,
      excludedCount: normalized.excludedCount,
      orphanReviews: normalized.orphanReviews,
      archivedReviewsExcluded: normalized.archivedReviews,
    },
  };
}

function summarize(context: ProfileContext): LearningSummary {
  const { now, days, eligible } = context;
  const dayStarts = eligible.map((review) => review.dayStart);
  const activeDays = new Set(dayStarts).size;
  const progression = computeProgression(eligible.length);
  const end = startOfDay(now);
  const start = addDays(end, -(days - 1));
  const rangeReviews = reviewsInRange(eligible, start, end);
  const activity = buildSeries(rangeReviews, start, end, now);

  return {
    allTime: {
      reviews: eligible.length,
      activeDays,
      currentStreak: computeStreak(
        eligible.map((review) => review.reviewedAt),
        now
      ),
      longestStreak: longestStreak(dayStarts),
      xp: progression.xp,
      level: progression.level,
      xpIntoLevel: progression.xpIntoLevel,
      xpProgress: progression.xpProgress,
    },
    range: {
      range: {
        days,
        start,
        end,
        label: days === 1 ? 'Today' : `Last ${days} days`,
      },
      reviews: rangeReviews.length,
      activeDays: activity.activeDays,
      recall: computeRecall(rangeReviews),
      activity,
    },
    dataQuality: context.dataQuality,
  };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function achievementsFor(context: ProfileContext): AchievementFact[] {
  const reviewCount = context.eligible.length;
  const currentStreak = computeStreak(
    context.eligible.map((review) => review.reviewedAt),
    context.now
  );
  // Night Owl counts distinct cards. Repeating one card at night should not
  // earn a badge that promises twenty different cards.
  const nightCards = new Set(
    context.eligible
      .filter((review) => review.hour >= 23 || review.hour < 5)
      .map((review) => review.cardId)
  );

  return [
    {
      id: 'first-review',
      earned: reviewCount >= 1,
      available: true,
      progress: { current: Math.min(reviewCount, 1), target: 1 },
      evidence: plural(reviewCount, 'review', 'reviews'),
    },
    {
      id: 'seven-day-streak',
      earned: currentStreak >= 7,
      available: true,
      progress: { current: Math.min(currentStreak, 7), target: 7 },
      evidence: `${plural(currentStreak, 'day', 'days')} in the current streak`,
    },
    {
      id: 'hundred-reviews',
      earned: reviewCount >= 100,
      available: true,
      progress: { current: Math.min(reviewCount, 100), target: 100 },
      evidence: `${reviewCount} of 100 reviews`,
    },
    {
      id: 'night-owl',
      earned: nightCards.size >= 20,
      available: true,
      progress: { current: Math.min(nightCards.size, 20), target: 20 },
      evidence: `${plural(nightCards.size, 'card', 'cards')} reviewed between 23:00 and 04:59`,
    },
    {
      id: 'speed-demon',
      earned: false,
      available: false,
      progress: null,
      evidence: 'Quiz accuracy is not stored in game records yet.',
    },
  ];
}

/**
 * All-time progression and the requested range's learning metrics.
 *
 * Use this for Home's streak chip or any screen that needs only the summary.
 * Profile should use `buildProfileBundle` so the review log is normalized once
 * for both its summary and achievements.
 */
export function buildLearningSummary(input: ProfileSummaryInput): LearningSummary {
  return summarize(createContext(input));
}

/** Evidence-backed achievement facts for the Profile screen. */
export function buildAchievementFacts(input: ProfileSummaryInput): AchievementFact[] {
  return achievementsFor(createContext(input));
}

/**
 * Profile's single entry point: one normalization feeds both the summary and
 * the achievement facts. Stateless and safe to memoise by the caller.
 */
export function buildProfileBundle(input: ProfileSummaryInput): ProfileSummaryBundle {
  const context = createContext(input);
  return {
    summary: summarize(context),
    achievements: achievementsFor(context),
  };
}
