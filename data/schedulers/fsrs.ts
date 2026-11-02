/**
 * FSRS-6 scheduler wrapper around ts-fsrs.
 *
 * FSRS models memory as Difficulty / Stability / Retrievability:
 *   - Stability  = days until recall probability decays to 90%
 *   - Difficulty = 1..10, how hard the card is for this learner
 *   - R(t,S)     = (1 + FACTOR·t/S)^(-decay), with decay trainable (FSRS-6 w20)
 *
 * Scheduling is per deck: desired retention, maximum interval, fuzz and the
 * learning steps all come from the deck's preset (see data/fsrs-params.ts).
 * The scheduler maps between our persisted model (ISO dates, string states)
 * and ts-fsrs (Date objects, State/Rating enums).
 */

import { Rating, State } from 'ts-fsrs';
import type { Card, Grade, ReviewLog } from 'ts-fsrs';
import { getFsrsScheduler, resolveFsrsParams } from '../fsrs-params';
import type {
  Deck,
  Flashcard,
  FSRSLogSnapshot,
  IntervalPreviews,
  Rating as OurRating,
  RatingButtonLabel,
  ScheduleResult,
  SchedulerEngine,
} from '../types';

// ---- Conversion helpers -----------------------------------------------------

function toFSRSCard(card: Flashcard): Card {
  return {
    due: new Date(card.fsrs.due),
    stability: card.fsrs.stability,
    difficulty: card.fsrs.difficulty,
    elapsed_days: card.fsrs.elapsed_days,
    scheduled_days: card.fsrs.scheduled_days,
    reps: card.fsrs.reps,
    lapses: card.fsrs.lapses,
    state: stateToEnum(card.fsrs.state),
    last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined,
    // ts-fsrs uses this as the index into its learning steps. Dropping it resets
    // every learning card to step 0, so it must round-trip through our model.
    learning_steps: card.fsrs.learning_steps ?? 0,
  };
}

function fromFSRSCard(fsrsCard: Card): Flashcard['fsrs'] {
  return {
    due: fsrsCard.due.toISOString(),
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsed_days: fsrsCard.elapsed_days,
    scheduled_days: fsrsCard.scheduled_days,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: stateFromEnum(fsrsCard.state),
    last_review: fsrsCard.last_review ? fsrsCard.last_review.toISOString() : null,
    learning_steps: fsrsCard.learning_steps,
  };
}

function stateToEnum(state: string): State {
  switch (state) {
    case 'Learning': return State.Learning;
    case 'Review': return State.Review;
    case 'Relearning': return State.Relearning;
    default: return State.New;
  }
}

function stateFromEnum(state: State): 'New' | 'Learning' | 'Review' | 'Relearning' {
  switch (state) {
    case State.Learning: return 'Learning';
    case State.Review: return 'Review';
    case State.Relearning: return 'Relearning';
    default: return 'New';
  }
}

/** ts-fsrs logs the pre-review memory state; keep exactly what rollback needs. */
function toSnapshot(log: ReviewLog): FSRSLogSnapshot {
  return {
    rating: log.rating as OurRating,
    state: stateFromEnum(log.state),
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningStep: log.learning_steps,
    review: log.review.getTime(),
  };
}

function fromSnapshot(snapshot: FSRSLogSnapshot): ReviewLog {
  return {
    rating: snapshot.rating as Rating,
    state: stateToEnum(snapshot.state),
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    last_elapsed_days: snapshot.lastElapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningStep,
    review: new Date(snapshot.review),
  };
}

// ---- Interval formatting ----------------------------------------------------

function formatInterval(seconds: number): string {
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const months = days / 30;

  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${months.toFixed(1)}mo`;
}

/**
 * Interval shown on a rating button = time from `now` until the resulting due
 * date. Measuring from the card's previous review instead would add the elapsed
 * wait on top of the new interval and overstate every preview.
 */
function formatDueIn(due: Date | undefined, now: Date): string {
  if (!due) return '';
  const diffSeconds = (due.getTime() - now.getTime()) / 1000;
  if (diffSeconds < 60) return '<1m';
  return formatInterval(diffSeconds);
}

// ---- Engine -----------------------------------------------------------------

export type FSRSScheduler = SchedulerEngine & {
  getRetrievability(card: Flashcard, now?: Date): number | null;
  rollback(card: Flashcard, log: FSRSLogSnapshot): Flashcard | null;
};

/**
 * Build the engine for one deck. Cheap: the underlying ts-fsrs instance is
 * memoised by parameter signature, so repeated calls per render are safe.
 */
export function createFSRSScheduler(deck: Deck): FSRSScheduler {
  const scheduler = getFsrsScheduler(resolveFsrsParams(deck));

  return {
    getIntervalPreviews(card: Flashcard, now?: Date): IntervalPreviews {
      const at = now ?? new Date();
      const preview = scheduler.repeat(toFSRSCard(card), at);

      const labels: RatingButtonLabel[] = [
        { rating: 1, label: formatDueIn(preview[Rating.Again]?.card?.due, at) },
        { rating: 2, label: formatDueIn(preview[Rating.Hard]?.card?.due, at) },
        { rating: 3, label: formatDueIn(preview[Rating.Good]?.card?.due, at) },
        { rating: 4, label: formatDueIn(preview[Rating.Easy]?.card?.due, at) },
      ];

      return labels;
    },

    schedule(card: Flashcard, rating: OurRating, now?: Date): ScheduleResult {
      const at = now ?? new Date();
      // Our Rating: 1=Again, 2=Hard, 3=Good, 4=Easy — matches ts-fsrs exactly
      const result = scheduler.next(toFSRSCard(card), at, rating as Grade);

      return {
        updatedCard: { ...card, fsrs: fromFSRSCard(result.card) },
        intervalPreviewLabel: formatDueIn(result.card.due, at),
        log: toSnapshot(result.log),
      };
    },

    getRetrievability(card: Flashcard, now?: Date): number | null {
      // ts-fsrs returns 0 for New cards, which would render as a scary "0%".
      if (card.fsrs.state === 'New' || card.fsrs.stability <= 0) return null;
      const value = scheduler.get_retrievability(toFSRSCard(card), now ?? new Date(), false);
      return Number.isFinite(value) ? value : null;
    },

    rollback(card: Flashcard, log: FSRSLogSnapshot): Flashcard | null {
      try {
        const previous = scheduler.rollback(toFSRSCard(card), fromSnapshot(log));
        return { ...card, fsrs: fromFSRSCard(previous) };
      } catch {
        // A snapshot written by an older app version may not be replayable;
        // callers keep the in-memory pre-review card as a fallback.
        return null;
      }
    },
  };
}
