/**
 * Daily / weekly / monthly reports.
 *
 * These are deliberately separate from the selected dashboard range: a report
 * answers "how did this week go?" regardless of whether the charts are showing
 * 7, 30 or 90 days. Windows end today and include zero-review days.
 */

import type {
  NormalizedReview,
  PeriodReport,
  ReportBundle,
  ReportPeriod,
} from '../core/types';
import type { Deck } from '../../types';
import { addDays, startOfDay } from '../core/dates';
import { MIN_RECALL_SAMPLE } from '../core/constants';
import { wilsonInterval } from '../core/stats';
import { computeRecall } from '../analysis/metrics';
import { reviewsInRange } from '../analysis/series';

const LABELS: Record<ReportPeriod, string> = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
};

const WINDOWS: Record<ReportPeriod, number> = { day: 1, week: 7, month: 30 };

function buildPeriod(
  period: ReportPeriod,
  reviews: readonly NormalizedReview[],
  decks: readonly Deck[],
  now: number
): PeriodReport {
  const end = startOfDay(now);
  const days = WINDOWS[period];
  const start = addDays(end, -(days - 1));
  const window = reviewsInRange(reviews, start, end);
  const recall = computeRecall(window);
  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));

  const perDeck = new Map<string, number>();
  for (const review of window) {
    perDeck.set(review.deckId, (perDeck.get(review.deckId) ?? 0) + 1);
  }
  const top = [...perDeck.entries()].sort((a, b) => b[1] - a[1])[0];

  const success = window.filter((review) => review.rating >= 2).length;

  return {
    period,
    label: LABELS[period],
    start,
    end,
    days,
    reviews: window.length,
    activeDays: new Set(window.map((review) => review.dayStart)).size,
    newCards: new Set(
      window.filter((review) => review.cardWasNew).map((review) => review.cardId)
    ).size,
    studyTimeMs: window.reduce((total, review) => total + (review.elapsedMs ?? 0), 0),
    successRate: recall.successRate,
    successInterval:
      window.length >= MIN_RECALL_SAMPLE ? wilsonInterval(success, window.length) : null,
    topDeck: top
      ? { deckId: top[0], name: deckNames.get(top[0]) ?? 'Deleted deck', reviews: top[1] }
      : null,
  };
}

export function buildReports(
  reviews: readonly NormalizedReview[],
  decks: readonly Deck[],
  now: number
): ReportBundle {
  return {
    daily: buildPeriod('day', reviews, decks, now),
    weekly: buildPeriod('week', reviews, decks, now),
    monthly: buildPeriod('month', reviews, decks, now),
  };
}
