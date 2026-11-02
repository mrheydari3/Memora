/**
 * FSRS-6 parameters, per deck.
 *
 * FSRS is not a fixed algorithm: the memory model is, but the *preset* around
 * it (desired retention, maximum interval, fuzz, learning steps) is what a user
 * actually tunes. Anki stores those per deck-options preset; we store them on
 * the deck itself and resolve defaults for decks saved before they existed.
 *
 * The scheduler instance is cached by parameter signature because building one
 * is not free and the study screen asks for it on every render.
 */

import { fsrs, generatorParameters } from 'ts-fsrs';
import type { FSRSParameters } from 'ts-fsrs';
import type { Deck } from './types';

export type ResolvedFsrsParams = {
  requestRetention: number;
  maximumInterval: number;
  enableFuzz: boolean;
  enableShortTerm: boolean;
  fsrsLearningSteps: string[];
  fsrsRelearningSteps: string[];
};

/** Reasonable range from the FSRS documentation; above 0.95 the load explodes. */
export const RETENTION_MIN = 0.7;
export const RETENTION_MAX = 0.97;
export const RETENTION_STEP = 0.01;
/** Warn (do not block) when the user goes past this. */
export const RETENTION_HEAVY = 0.95;

export const MAX_INTERVAL_OPTIONS = [30, 90, 365, 1825, 36500];

/** Anki-compatible defaults (FSRS-6 default weights live inside ts-fsrs). */
export const FSRS_DEFAULTS: ResolvedFsrsParams = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: true,
  enableShortTerm: true,
  fsrsLearningSteps: ['1m', '10m'],
  fsrsRelearningSteps: ['10m'],
};

const STEP_UNITS: Record<string, 'm' | 'h' | 'd'> = {
  m: 'm',
  min: 'm',
  mins: 'm',
  minute: 'm',
  minutes: 'm',
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',
  d: 'd',
  day: 'd',
  days: 'd',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise free-typed input to a ts-fsrs StepUnit (`'10m'`, `'6h'`, `'1d'`).
 * Returns null when the value is not a positive duration — the UI shows an
 * inline error instead of silently saving something the scheduler cannot read.
 */
export function normalizeFsrsStep(input: string): string | null {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '');
  const match = cleaned.match(/^(\d+)([a-z]+)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = STEP_UNITS[match[2]];
  if (!unit || !Number.isFinite(value) || value <= 0) return null;
  return `${value}${unit}`;
}

/** Minutes represented by a StepUnit, or null when unparseable. */
export function stepToMinutes(step: string): number | null {
  const normalized = normalizeFsrsStep(step);
  if (!normalized) return null;
  const value = parseInt(normalized.slice(0, -1), 10);
  const unit = normalized.slice(-1);
  if (unit === 'm') return value;
  if (unit === 'h') return value * 60;
  return value * 24 * 60;
}

/**
 * Anki's guidance for FSRS: every learning step must complete the same day
 * (below 24h). A step at or past a day belongs to the long-term schedule,
 * which FSRS owns.
 */
export function isFsrsLearningStepValid(step: string): boolean {
  const minutes = stepToMinutes(step);
  return minutes !== null && minutes > 0 && minutes < 24 * 60;
}

function sanitizeSteps(steps: string[] | undefined, fallback: string[]): string[] {
  if (!Array.isArray(steps)) return [...fallback];
  const cleaned = steps
    .map((step) => normalizeFsrsStep(String(step)))
    .filter((step): step is string => step !== null && isFsrsLearningStepValid(step));
  // An explicit empty array is meaningful: FSRS manages the steps itself.
  if (cleaned.length === 0 && steps.length > 0) return [...fallback];
  return cleaned;
}

/** Fill a deck's optional FSRS fields with Anki-compatible defaults. */
export function resolveFsrsParams(deck: Partial<Deck>): ResolvedFsrsParams {
  const retention = Number.isFinite(deck.requestRetention as number)
    ? clamp(deck.requestRetention as number, RETENTION_MIN, RETENTION_MAX)
    : FSRS_DEFAULTS.requestRetention;

  const maxIntervalRaw = Number.isFinite(deck.maximumInterval as number)
    ? (deck.maximumInterval as number)
    : FSRS_DEFAULTS.maximumInterval;

  return {
    requestRetention: Math.round(retention * 100) / 100,
    maximumInterval: Math.round(clamp(maxIntervalRaw, 1, 36500)),
    enableFuzz: deck.enableFuzz ?? FSRS_DEFAULTS.enableFuzz,
    enableShortTerm: deck.enableShortTerm ?? FSRS_DEFAULTS.enableShortTerm,
    fsrsLearningSteps: sanitizeSteps(deck.fsrsLearningSteps, FSRS_DEFAULTS.fsrsLearningSteps),
    fsrsRelearningSteps: sanitizeSteps(deck.fsrsRelearningSteps, FSRS_DEFAULTS.fsrsRelearningSteps),
  };
}

/** Convert resolved deck parameters into the object ts-fsrs expects. */
export function toFsrsParameters(params: ResolvedFsrsParams): FSRSParameters {
  return generatorParameters({
    request_retention: params.requestRetention,
    maximum_interval: params.maximumInterval,
    enable_fuzz: params.enableFuzz,
    enable_short_term: params.enableShortTerm,
    learning_steps: params.fsrsLearningSteps as FSRSParameters['learning_steps'],
    relearning_steps: params.fsrsRelearningSteps as FSRSParameters['relearning_steps'],
  });
}

type Scheduler = ReturnType<typeof fsrs>;

const schedulerCache = new Map<string, Scheduler>();

/**
 * Memoised scheduler per parameter set. Decks that share settings share one
 * instance; the cache is tiny and bounded, so editing settings cannot leak.
 */
export function getFsrsScheduler(params: ResolvedFsrsParams): Scheduler {
  const key = JSON.stringify(params);
  const cached = schedulerCache.get(key);
  if (cached) return cached;

  const scheduler = fsrs(toFsrsParameters(params));
  if (schedulerCache.size >= 32) schedulerCache.clear();
  schedulerCache.set(key, scheduler);
  return scheduler;
}

/** Human label for a maximum-interval value, e.g. 36500 → "100 years". */
export function formatMaxInterval(days: number): string {
  if (days >= 36500) return '100 years';
  if (days % 365 === 0) {
    const years = days / 365;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${days} days`;
}
