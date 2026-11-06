/**
 * Normalisation: every record is either usable or explicitly accounted for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReviewLog } from '../core/normalize';
import { MAX_REVIEW_DURATION_MS } from '../core/constants';
import { makeDeck, makeReview, NOW, at } from './fixtures';
import type { Rating } from '../../types';

const decks = [
  makeDeck({ id: 'deck-a' }),
  makeDeck({ id: 'deck-archived', archivedAt: NOW - 1000 }),
];

const countIssue = (
  issues: ReturnType<typeof normalizeReviewLog>['issues'],
  kind: string
) => issues.find((issue) => issue.kind === kind)?.count ?? 0;

test('valid reviews are sorted ascending and fully described', () => {
  const log = normalizeReviewLog(
    [
      makeReview({ cardId: 'b', reviewedAt: at(0, 9) }),
      makeReview({ cardId: 'a', reviewedAt: at(-1, 9) }),
    ],
    decks,
    NOW
  );

  assert.equal(log.usableCount, 2);
  assert.equal(log.excludedCount, 0);
  assert.deepEqual(log.reviews.map((review) => review.cardId), ['a', 'b']);
  assert.equal(log.reviews[0].algorithm, 'fsrs');
  assert.equal(log.reviews[0].archived, false);
  assert.equal(log.firstReviewedAt, log.reviews[0].reviewedAt);
});

test('a duplicate review is kept once and counted', () => {
  const entry = makeReview({ cardId: 'dup', reviewedAt: at(-1, 9) });
  const log = normalizeReviewLog([entry, { ...entry }], decks, NOW);

  assert.equal(log.usableCount, 1);
  assert.equal(log.excludedCount, 1);
  assert.equal(countIssue(log.issues, 'duplicate'), 1);
});

test('an invalid rating is excluded and counted', () => {
  const log = normalizeReviewLog(
    [makeReview({ rating: 5 as unknown as Rating })],
    decks,
    NOW
  );
  assert.equal(log.usableCount, 0);
  assert.equal(countIssue(log.issues, 'invalid_rating'), 1);
});

test('missing, zero and future timestamps are excluded with reasons', () => {
  const log = normalizeReviewLog(
    [
      makeReview({ cardId: 'nan', reviewedAt: Number.NaN }),
      makeReview({ cardId: 'zero', reviewedAt: 0 }),
      makeReview({ cardId: 'future', reviewedAt: NOW + 60 * 60 * 1000 }),
    ],
    decks,
    NOW
  );

  assert.equal(log.usableCount, 0);
  assert.equal(countIssue(log.issues, 'invalid_timestamp'), 2);
  assert.equal(countIssue(log.issues, 'future_timestamp'), 1);
});

test('a negative duration keeps the review but excludes its time', () => {
  const log = normalizeReviewLog(
    [makeReview({ cardId: 'neg', elapsedMs: -500, reviewedAt: at(-1, 9) })],
    decks,
    NOW
  );

  assert.equal(log.usableCount, 1);
  assert.equal(log.reviews[0].elapsedMs, null);
  assert.equal(countIssue(log.issues, 'invalid_duration'), 1);
});

test('a 31-minute review is an outlier, not study time', () => {
  const log = normalizeReviewLog(
    [
      makeReview({
        cardId: 'walked-away',
        elapsedMs: MAX_REVIEW_DURATION_MS + 60_000,
        reviewedAt: at(-1, 9),
      }),
    ],
    decks,
    NOW
  );

  assert.equal(log.reviews[0].elapsedMs, null);
  assert.equal(countIssue(log.issues, 'outlier_duration'), 1);
});

test('a review of a deleted deck is kept in totals and flagged as orphan', () => {
  const log = normalizeReviewLog(
    [makeReview({ deckId: 'gone', cardId: 'x', reviewedAt: at(-1, 9) })],
    decks,
    NOW
  );

  assert.equal(log.usableCount, 1);
  assert.equal(log.orphanReviews, 1);
  assert.equal(log.reviews[0].algorithm, null);
  assert.equal(countIssue(log.issues, 'orphan_deck'), 1);
});

test('archived decks are flagged, not dropped', () => {
  const log = normalizeReviewLog(
    [makeReview({ deckId: 'deck-archived', cardId: 'x', reviewedAt: at(-1, 9) })],
    decks,
    NOW
  );

  assert.equal(log.usableCount, 1);
  assert.equal(log.reviews[0].archived, true);
  assert.equal(log.archivedReviews, 1);
});

test('a lapse is Again on a Review card, not on a Learning card', () => {
  const log = normalizeReviewLog(
    [
      makeReview({ cardId: 'lapse', rating: 1, stateBefore: 'Review', reviewedAt: at(-2, 9) }),
      makeReview({ cardId: 'step', rating: 1, stateBefore: 'Learning', reviewedAt: at(-1, 9) }),
      makeReview({ cardId: 'unknown', rating: 1, reviewedAt: at(0, 9) }),
    ],
    decks,
    NOW
  );

  const byId = new Map(log.reviews.map((review) => [review.cardId, review]));
  assert.equal(byId.get('lapse')?.isLapse, true);
  assert.equal(byId.get('step')?.isLapse, false);
  assert.equal(byId.get('unknown')?.isLapse, null);
});

test('an empty log is an empty result, not an error', () => {
  const log = normalizeReviewLog([], decks, NOW);
  assert.equal(log.usableCount, 0);
  assert.equal(log.issues.length, 0);
  assert.equal(log.firstReviewedAt, null);
});
