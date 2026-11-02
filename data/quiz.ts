/**
 * Quiz game logic — pure, framework-free, and the single source of truth for
 * "what is a question" and "what does an answer do to the round".
 *
 * The screen owns rendering, timers and persistence; everything that can be
 * reasoned about without React lives here so it can be tested with `npm test`.
 */

import type { Flashcard } from './types';

/** Round starts with 60 seconds on the clock. */
export const ROUND_MS = 60_000;
/** A correct answer buys time back. */
export const CORRECT_BONUS_MS = 3_000;
/** A wrong answer costs time on top of losing the combo. */
export const WRONG_PENALTY_MS = 2_000;
/** Ending a round by exhausting the deck is rewarded once. */
export const CLEAR_BONUS_POINTS = 250;
/** Combo stops multiplying past this. */
export const COMBO_CAP = 5;
/** A question needs the correct option plus three distractors. */
export const OPTION_COUNT = 4;
/** Base points for the first correct answer. */
export const BASE_POINTS = 100;

export type Rng = () => number;

export type QuizOption = {
  /** Card id the option text came from — stable key for rendering. */
  id: string;
  text: string;
  correct: boolean;
};

export type QuizQuestion = {
  cardId: string;
  front: string;
  direction: 'ltr' | 'rtl';
  options: QuizOption[];
};

export type RoundState = {
  timeLeftMs: number;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  /** The clock ran out. */
  finished: boolean;
  /** The deck was exhausted before the clock ran out. */
  cleared: boolean;
};

const text = (side: { text: string } | undefined): string => (side?.text ?? '').trim();
const normalise = (value: string): string => value.toLocaleLowerCase().replace(/\s+/g, ' ');

/** A card can be asked only if both sides carry text. */
export function isCardPlayable(card: Flashcard): boolean {
  return text(card.front).length > 0 && text(card.back).length > 0;
}

export function playableCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(isCardPlayable);
}

/**
 * A deck is playable when at least four distinct answers exist: the correct
 * option plus three distractors. Duplicate back texts cannot act as
 * distractors, so they do not count toward the four.
 */
export function isDeckPlayable(cards: Flashcard[]): boolean {
  const answers = new Set(playableCards(cards).map((card) => normalise(text(card.back))));
  return answers.size >= OPTION_COUNT;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one question for `card`, drawing distractors from the same deck.
 * Returns null when the deck cannot supply three distinct wrong answers.
 */
export function buildQuestion(
  card: Flashcard,
  cards: Flashcard[],
  rng: Rng = Math.random
): QuizQuestion | null {
  if (!isCardPlayable(card)) return null;

  const correctText = text(card.back);
  const correctKey = normalise(correctText);
  const seen = new Set<string>([correctKey]);
  const pool: Flashcard[] = [];

  for (const candidate of playableCards(cards)) {
    if (candidate.id === card.id) continue;
    const key = normalise(text(candidate.back));
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(candidate);
  }

  if (pool.length < OPTION_COUNT - 1) return null;

  const distractors = shuffle(pool, rng).slice(0, OPTION_COUNT - 1);
  const options = shuffle(
    [
      { id: card.id, text: correctText, correct: true },
      ...distractors.map((d) => ({ id: d.id, text: text(d.back), correct: false })),
    ],
    rng
  );

  return {
    cardId: card.id,
    front: text(card.front),
    direction: card.front.direction === 'rtl' ? 'rtl' : 'ltr',
    options,
  };
}

/**
 * Build a whole round up front: every playable card once, in random order.
 * Cards that cannot form a question are skipped, never rendered broken.
 */
export function buildRound(cards: Flashcard[], rng: Rng = Math.random): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const card of shuffle(playableCards(cards), rng)) {
    const question = buildQuestion(card, cards, rng);
    if (question) questions.push(question);
  }
  return questions;
}

/**
 * Points for a correct answer. `combo` is the combo *after* the increment, so
 * the first correct answer is worth BASE_POINTS and the cap is reached at
 * COMBO_CAP.
 */
export function scoreForAnswer(combo: number): number {
  const step = Math.max(1, Math.min(combo, COMBO_CAP));
  return BASE_POINTS * step;
}

export function createRound(): RoundState {
  return {
    timeLeftMs: ROUND_MS,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    finished: false,
    cleared: false,
  };
}

/** Count the clock down. Never mutates the previous state. */
export function tick(state: RoundState, elapsedMs: number): RoundState {
  if (state.finished || elapsedMs <= 0) return state;
  const timeLeftMs = Math.max(0, state.timeLeftMs - elapsedMs);
  return { ...state, timeLeftMs, finished: timeLeftMs <= 0 };
}

/** Apply one answered question to the round. */
export function applyAnswer(state: RoundState, isCorrect: boolean): RoundState {
  if (state.finished) return state;

  if (isCorrect) {
    const combo = state.combo + 1;
    return {
      ...state,
      score: state.score + scoreForAnswer(combo),
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      correct: state.correct + 1,
      timeLeftMs: Math.min(ROUND_MS, state.timeLeftMs + CORRECT_BONUS_MS),
    };
  }

  const timeLeftMs = Math.max(0, state.timeLeftMs - WRONG_PENALTY_MS);
  return {
    ...state,
    combo: 0,
    wrong: state.wrong + 1,
    timeLeftMs,
    finished: timeLeftMs <= 0,
  };
}

/** Close the round because the deck ran out, paying the clear bonus once. */
export function finishCleared(state: RoundState): RoundState {
  if (state.finished) return state;
  return {
    ...state,
    score: state.score + CLEAR_BONUS_POINTS,
    cleared: true,
    finished: true,
  };
}

/** 0..1, or null when nothing has been answered yet. */
export function accuracy(state: RoundState): number | null {
  const answered = state.correct + state.wrong;
  if (answered === 0) return null;
  return state.correct / answered;
}

/** True when this round beats the stored record. */
export function isNewBest(
  record: { bestScore: number } | undefined | null,
  score: number
): boolean {
  return score > 0 && score > (record?.bestScore ?? 0);
}
