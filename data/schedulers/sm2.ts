/**
 * SM-2 (General Regular Repetition) scheduler.
 *
 * Classic SM-2 algorithm:
 * - Ease factor starts at 2.5
 * - Again resets repetitions, drops ease by 0.2 (min 1.3) and counts a lapse
 * - Hard/Good/Easy grow the interval by the ease factor with a small multiplier per rating
 * - Respects deck.learningSteps for the initial learning phase
 * - Applies masteredIntervalMultiplier on first post-graduation interval
 *
 * NOTE: SM-2 has no column of its own in the data model, so its state is packed
 * into the FSRS fields (see parseSM2State/packSM2State). Switching a deck's
 * algorithm therefore does not translate the two representations.
 */

import type { Flashcard, Deck, Rating, SchedulerEngine, IntervalPreviews, ScheduleResult } from '../types';

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const FALLBACK_STEPS = ['1 day'];

// ---- Internal helpers -------------------------------------------------------

interface SM2CardState {
  ease: number;
  interval: number; // in days
  repetitions: number;
  nextReviewDate: string; // ISO
  learningStep: number; // 0-indexed step in learningSteps
  graduated: boolean;
  relearning: boolean;
  lapses: number;
}

function parseSM2State(card: Flashcard): SM2CardState {
  return {
    // stability = ease, difficulty = interval (days), elapsed_days = repetitions,
    // scheduled_days = learning step, state = 'New' | 'Learning' | 'Review'
    ease: card.fsrs.stability || DEFAULT_EASE,
    interval: card.fsrs.difficulty || 0,
    repetitions: card.fsrs.elapsed_days || 0,
    nextReviewDate: card.fsrs.due,
    learningStep: card.fsrs.scheduled_days || 0,
    graduated: card.fsrs.state === 'Review',
    relearning: card.fsrs.state === 'Relearning',
    lapses: card.fsrs.lapses || 0,
  };
}

function packSM2State(card: Flashcard, state: SM2CardState, now: Date): Flashcard {
  // This only runs after a rating, so an ungraduated card is by definition in
  // learning (or relearning) — never 'New'.
  const stateName: Flashcard['fsrs']['state'] = state.graduated
    ? 'Review'
    : state.relearning
      ? 'Relearning'
      : 'Learning';

  return {
    ...card,
    fsrs: {
      ...card.fsrs,
      stability: state.ease,
      difficulty: state.interval,
      elapsed_days: state.repetitions,
      scheduled_days: state.learningStep,
      due: state.nextReviewDate,
      state: stateName,
      // Keep the standard FSRS bookkeeping fields truthful so streak, statistics
      // and the daily caps work the same way they do under FSRS.
      reps: card.fsrs.reps + 1,
      lapses: state.lapses,
      last_review: now.toISOString(),
    },
  };
}

function formatIntervalDays(days: number): string {
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

function addDays(iso: string, days: number): string {
  // Elapsed time, not a calendar day: SM-2 steps can be fractions of a day
  // ("12 hours"), and Date#setDate truncates those to a whole day.
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/**
 * Learning steps are written by hand ("12 hours", "1 day"), so an unparseable
 * or missing value must degrade to a sane default instead of throwing.
 */
function parseStepToDays(step: string | undefined): number {
  if (!step) return 1;
  const match = step.match(
    /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i
  );
  if (!match) return 1; // default 1 day
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return value / (24 * 60);
  if (unit.startsWith('h')) return value / 24;
  return value; // days
}

/**
 * Validate a hand-typed SM-2 step before it is saved. Without this, a typo
 * like "twelve hours" would silently become the 1-day fallback above.
 */
export function isSM2StepValid(step: string): boolean {
  const match = step.trim().match(
    /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i
  );
  if (!match) return false;
  return parseInt(match[1], 10) > 0;
}

// ---- Engine -----------------------------------------------------------------

export function createSM2Scheduler(deck: Deck): SchedulerEngine {
  // A deck with no learning steps would crash the step lookup below.
  const steps = deck.learningSteps.length > 0 ? deck.learningSteps : FALLBACK_STEPS;
  const multiplier = deck.masteredIntervalMultiplier;

  return {
    getIntervalPreviews(card: Flashcard, now = new Date()): IntervalPreviews {
      const state = parseSM2State(card);
      const results: IntervalPreviews = [];

      for (const rating of [1, 2, 3, 4] as Rating[]) {
        const preview = simulateSM2(state, rating, steps, multiplier, now);
        results.push({ rating, label: preview.label });
      }

      return results;
    },

    schedule(card: Flashcard, rating: Rating, now = new Date()): ScheduleResult {
      const state = parseSM2State(card);
      const result = simulateSM2(state, rating, steps, multiplier, now);
      const updatedCard = packSM2State(card, result.state, now);

      return { updatedCard, intervalPreviewLabel: result.label };
    },
  };
}

function simulateSM2(
  state: SM2CardState,
  rating: Rating,
  steps: string[],
  multiplier: number,
  now: Date
): { state: SM2CardState; label: string } {
  const iso = now.toISOString();
  const newState = { ...state };

  if (rating === 1) {
    // Again — reset. A card that had graduated is relearning, not new; treating
    // it as New would let it count against the new-cards-per-day cap again.
    newState.learningStep = 0;
    newState.repetitions = 0;
    newState.ease = Math.max(MIN_EASE, state.ease - 0.2);
    newState.relearning = state.graduated || state.relearning || state.repetitions > 0;
    newState.lapses = state.lapses + 1;
    newState.graduated = false;

    newState.interval = parseStepToDays(steps[0]);
    newState.nextReviewDate = addDays(iso, newState.interval);
    return { state: newState, label: formatIntervalDays(newState.interval) };
  }

  if (!state.graduated) {
    // Still in the learning phase
    if (rating >= 3) {
      // Good/Easy: advance to next step
      newState.learningStep = Math.min(state.learningStep + 1, steps.length);
      if (newState.learningStep >= steps.length) {
        // Graduate!
        newState.graduated = true;
        newState.relearning = false;
        newState.repetitions = 1;
        newState.interval = 1 * multiplier; // First post-graduation interval
        newState.nextReviewDate = addDays(iso, newState.interval);
        return { state: newState, label: formatIntervalDays(newState.interval) };
      }
      newState.interval = parseStepToDays(steps[newState.learningStep]);
      newState.nextReviewDate = addDays(iso, newState.interval);
      return { state: newState, label: formatIntervalDays(newState.interval) };
    } else {
      // Hard (rating 2): stay on same step
      newState.interval = parseStepToDays(steps[newState.learningStep] ?? steps[0]);
      newState.nextReviewDate = addDays(iso, newState.interval);
      return { state: newState, label: formatIntervalDays(newState.interval) };
    }
  }

  // Graduated — apply SM-2 interval growth
  newState.repetitions += 1;

  // Small ±multiplier per rating: Hard grows slower than Good, Easy faster.
  const modifiers: Record<number, number> = { 2: 0.8, 3: 1.0, 4: 1.2 };
  const mod = modifiers[rating] ?? 1.0;

  if (newState.repetitions === 1) {
    newState.interval = 1;
  } else if (newState.repetitions === 2) {
    newState.interval = 6;
  } else {
    newState.interval = Math.round(state.interval * state.ease);
  }

  newState.interval = Math.max(1, Math.round(newState.interval * mod));
  newState.nextReviewDate = addDays(iso, newState.interval);

  // Adjust ease
  if (rating === 4) newState.ease = Math.min(3.0, state.ease + 0.15);
  else if (rating === 2) newState.ease = Math.max(MIN_EASE, state.ease - 0.15);

  return { state: newState, label: formatIntervalDays(newState.interval) };
}
