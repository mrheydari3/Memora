/**
 * Data normaliser — every review record is validated once, explicitly.
 *
 * The engine never silently drops a record. Anything unusable is counted, with
 * the reason and the handling, and surfaced in the dashboard's data-quality
 * block. The rules:
 *
 *   - duplicate   (same card + instant + rating) → keep the first, count it
 *   - bad rating  (not 1–4)                    → excluded, counted
 *   - bad time    (non-finite / ≤ 0 / future)  → excluded, counted
 *   - bad duration (negative / non-finite)      → record kept, time excluded
 *   - extreme duration (> 30 min)               → record kept, time excluded
 *   - orphan deck (deck deleted)                → record kept in library totals,
 *                                                 excluded from per-deck analysis
 *   - archived deck                             → kept, flagged; scope decides
 */

import type { Deck, ReviewLogEntry } from '../../types';
import {
  FUTURE_TIMESTAMP_TOLERANCE_MS,
  MAX_REVIEW_DURATION_MS,
} from './constants';
import { dayKey, hourOf, startOfDay, weekdayOf } from './dates';
import type {
  DataQualityIssue,
  DataQualityIssueKind,
  NormalizedLog,
  NormalizedReview,
  RatingKey,
} from './types';

const RATING_VALID = new Set([1, 2, 3, 4]);

/** The four rating buckets, in the order the UI shows them. */
export const RATING_ORDER: readonly { key: RatingKey; rating: 1 | 2 | 3 | 4; label: string }[] = [
  { key: 'again', rating: 1, label: 'Again' },
  { key: 'hard', rating: 2, label: 'Hard' },
  { key: 'good', rating: 3, label: 'Good' },
  { key: 'easy', rating: 4, label: 'Easy' },
];

export function emptyRatingCounts(): Record<RatingKey, number> {
  return { again: 0, hard: 0, good: 0, easy: 0 };
}

export function ratingKeyOf(rating: 1 | 2 | 3 | 4): RatingKey {
  return RATING_ORDER[rating - 1].key;
}

const ISSUE_DETAIL: Record<DataQualityIssueKind, string> = {
  duplicate: 'Identical card, instant and rating — the first record is kept.',
  invalid_rating: 'Rating was not Again/Hard/Good/Easy — excluded.',
  invalid_timestamp: 'Timestamp was missing or not a positive instant — excluded.',
  future_timestamp: 'Timestamp is in the future beyond clock-skew tolerance — excluded.',
  invalid_duration: 'Duration was negative or not a number — record kept, time excluded.',
  outlier_duration: 'Duration exceeded 30 minutes (walked away) — record kept, time excluded.',
  orphan_deck: 'Deck no longer exists — kept in totals, excluded from deck comparison.',
};

export function normalizeReviewLog(
  reviewLog: readonly ReviewLogEntry[],
  decks: readonly Deck[],
  now: number = Date.now()
): NormalizedLog {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const seen = new Set<string>();
  const issues = new Map<DataQualityIssueKind, number>();
  const reviews: NormalizedReview[] = [];

  let archivedReviews = 0;
  let orphanReviews = 0;

  const flag = (kind: DataQualityIssueKind) => {
    issues.set(kind, (issues.get(kind) ?? 0) + 1);
  };

  for (const entry of reviewLog) {
    // A duplicate is the same review written twice, not two reviews of the same
    // card: no human can answer one card twice in the same millisecond.
    const key = `${entry.cardId}|${entry.reviewedAt}|${entry.rating}`;
    if (seen.has(key)) {
      flag('duplicate');
      continue;
    }
    seen.add(key);

    if (!RATING_VALID.has(entry.rating as number)) {
      flag('invalid_rating');
      continue;
    }
    if (!Number.isFinite(entry.reviewedAt) || entry.reviewedAt <= 0) {
      flag('invalid_timestamp');
      continue;
    }
    if (entry.reviewedAt > now + FUTURE_TIMESTAMP_TOLERANCE_MS) {
      flag('future_timestamp');
      continue;
    }

    let elapsedMs: number | null = null;
    if (!Number.isFinite(entry.elapsedMs) || entry.elapsedMs < 0) {
      flag('invalid_duration');
    } else if (entry.elapsedMs > MAX_REVIEW_DURATION_MS) {
      flag('outlier_duration');
    } else {
      elapsedMs = entry.elapsedMs;
    }

    const deck = deckById.get(entry.deckId);
    if (!deck) {
      flag('orphan_deck');
      orphanReviews += 1;
    }
    if (deck?.archivedAt) archivedReviews += 1;

    // The pre-review state is the only honest basis for a lapse: "Again" on a
    // Learning card is a failed learning step, not a relapse of a mature card.
    const stateBefore = entry.fsrs?.state ?? entry.stateBefore ?? null;
    const isLapse =
      stateBefore === null ? null : stateBefore === 'Review' ? entry.rating === 1 : false;

    reviews.push({
      cardId: entry.cardId,
      deckId: entry.deckId,
      rating: entry.rating,
      reviewedAt: entry.reviewedAt,
      dayStart: startOfDay(entry.reviewedAt),
      dayKey: dayKey(entry.reviewedAt),
      weekday: weekdayOf(entry.reviewedAt),
      hour: hourOf(entry.reviewedAt),
      elapsedMs,
      cardWasNew: entry.cardWasNew === true,
      stateBefore,
      memory: entry.fsrs ?? null,
      algorithm: deck?.algorithmPreset ?? null,
      archived: Boolean(deck?.archivedAt),
      isLapse,
    });
  }

  // Ascending order is the contract the session grouping and trend code relies on.
  reviews.sort((a, b) => a.reviewedAt - b.reviewedAt);

  const issueList: DataQualityIssue[] = [...issues.entries()].map(([kind, count]) => ({
    kind,
    count,
    detail: ISSUE_DETAIL[kind],
  }));

  return {
    reviews,
    issues: issueList,
    rawCount: reviewLog.length,
    usableCount: reviews.length,
    excludedCount: reviewLog.length - reviews.length,
    archivedReviews,
    orphanReviews,
    firstReviewedAt: reviews.length > 0 ? reviews[0].reviewedAt : null,
    lastReviewedAt: reviews.length > 0 ? reviews[reviews.length - 1].reviewedAt : null,
  };
}
