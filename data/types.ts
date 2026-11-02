/**
 * Core data types for Memora flashcard app.
 *
 * These types represent the single source of truth for the data model.
 * They are used by the repository, stores, and UI components.
 */

// ---- Card Content -----------------------------------------------------------

export type CardSide = {
  text: string;
  imageUri?: string | null;
  /** Text direction flag — 'ltr' or 'rtl'. Does NOT affect app chrome. */
  direction: 'ltr' | 'rtl';
};

// ---- FSRS State -------------------------------------------------------------

export type FSRSState = 'New' | 'Learning' | 'Review' | 'Relearning';

export type FSRSCardState = {
  due: string; // ISO date string
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: FSRSState;
  last_review: string | null; // ISO date string or null
  /**
   * Index into ts-fsrs's learning steps. Optional because cards saved before
   * this field existed don't have it; treat a missing value as 0.
   */
  learning_steps?: number;
};

// ---- Flashcard --------------------------------------------------------------

export type Flashcard = {
  id: string;
  deckId: string;
  front: CardSide;
  back: CardSide;
  example?: string;
  synonyms?: string;
  createdAt: number; // epoch ms
  fsrs: FSRSCardState;
};

// ---- Deck -------------------------------------------------------------------

export type AlgorithmPreset = 'fsrs' | 'fast' | 'general';

export type Deck = {
  id: string;
  name: string;
  description?: string;
  icon: string; // material icon name
  color: string; // accent tint for the icon tile
  rating?: number; // community rating (0-5)
  parentId?: string | null;
  algorithmPreset: AlgorithmPreset;
  newCardsPerDay: number; // default 20
  maxCardsPerDay: number; // default 80
  shuffleCards: boolean; // default true
  learningSteps: string[]; // e.g. ['12 hours','1 day','2 days','3 days'] (SM-2 only)
  masteredIntervalMultiplier: number; // default 2.5 (SM-2 only)
  /**
   * FSRS-6 parameters. Optional so decks saved before this existed keep
   * working; data/fsrs-params.ts resolves the defaults (Anki-compatible).
   */
  requestRetention?: number; // desired retention, 0.70–0.97
  maximumInterval?: number; // days
  enableFuzz?: boolean;
  enableShortTerm?: boolean;
  fsrsLearningSteps?: string[]; // StepUnit, e.g. ['1m','10m']
  fsrsRelearningSteps?: string[]; // StepUnit, e.g. ['10m']
  createdAt: number;
  archivedAt?: number | null;
  saved?: boolean; // bookmark state on Library cards
};

// ---- Review Log -------------------------------------------------------------

export type Rating = 1 | 2 | 3 | 4; // Again=1, Hard=2, Good=3, Easy=4

/**
 * The pre-review memory state of a card, mirroring ts-fsrs's ReviewLog.
 * It is what `rollback()` needs to undo a review exactly, and what the FSRS
 * optimizer will train on once there is enough history.
 */
export type FSRSLogSnapshot = {
  rating: Rating;
  state: FSRSState; // state BEFORE this review
  due: string; // ISO — the due date the card had when it was answered
  stability: number; // stability BEFORE this review
  difficulty: number; // difficulty BEFORE this review
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  learningStep: number;
  review: number; // epoch ms
};

export type ReviewLogEntry = {
  cardId: string;
  deckId: string;
  rating: Rating;
  reviewedAt: number; // epoch ms
  elapsedMs: number;
  cardWasNew?: boolean; // enables Anki-style "new cards per day" caps from the log
  /** Present for FSRS reviews; absent on entries written before this existed. */
  fsrs?: FSRSLogSnapshot;
};

// ---- Settings ---------------------------------------------------------------

export type Settings = {
  ttsEnabled: boolean;
  ttsReadWholeCard: boolean;
  ttsAutoPlay: boolean;
  ttsFrontVoiceLang: string; // BCP-47, e.g. 'de-DE'
  ttsBackVoiceLang: string; // e.g. 'en-US'
  offlineCacheEnabled: boolean;
  pwaInstalled: boolean;
  /** Quiz sound effects. Optional so settings saved before the game keep working. */
  soundEnabled?: boolean;
  /** Quiz haptics. Optional for the same reason. */
  hapticsEnabled?: boolean;
};

// ---- Quiz Game --------------------------------------------------------------

/**
 * Per-deck quiz record. The game itself is stateless; only the best run is kept
 * so the start card can show something worth beating.
 */
export type GameRecord = {
  deckId: string;
  bestScore: number;
  bestCombo: number;
  plays: number;
  lastPlayedAt: number; // epoch ms
};

// ---- Scheduler Engine Interface ---------------------------------------------

export type RatingButtonLabel = {
  rating: Rating;
  label: string; // interval preview label e.g. "<12h", "1.2mo", or just "Again" for fast
};

export type ScheduleResult = {
  updatedCard: Flashcard;
  intervalPreviewLabel: string;
  /** Raw FSRS review log (absent for Fast Repetition, which does not schedule). */
  log?: FSRSLogSnapshot;
};

export type IntervalPreviews = RatingButtonLabel[];

export interface SchedulerEngine {
  /** Compute the 4 interval-preview labels before the user picks, for the rating-button row. */
  getIntervalPreviews(card: Flashcard, now?: Date): IntervalPreviews;
  /** Apply the user's chosen rating and return the updated card + summary label. */
  schedule(card: Flashcard, rating: Rating, now?: Date): ScheduleResult;
  /** FSRS only: current recall probability 0–1, or null for a never-reviewed card. */
  getRetrievability?(card: Flashcard, now?: Date): number | null;
  /** FSRS only: rebuild the pre-review card from the post-review card + its log. */
  rollback?(card: Flashcard, log: FSRSLogSnapshot): Flashcard | null;
}