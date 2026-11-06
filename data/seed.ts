import type { Deck, Flashcard, FSRSCardState } from './types';
import { FSRS_DEFAULTS } from './fsrs-params';
import { germanVocab } from './germanVocab';

/** Default FSRS state for a brand-new card. */
export function defaultFSRSState(): FSRSCardState {
  return {
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
    learning_steps: 0,
  };
}

// ---- Default Deck -----------------------------------------------------------
// The app ships with a single default deck built from the Schritt Plus Neu
// A2/B1 vocabulary list (German → Persian). The CSV is the source of truth;
// data/germanVocab.ts is auto-generated from it.

export const defaultDeckId = 'deck-german-a2b1';

export const sampleDecks: Deck[] = [
  {
    id: defaultDeckId,
    name: 'Schritt Plus Neu A2/B1',
    description: 'German vocabulary from Schritt Plus Neu A2/B1 with Persian translations',
    icon: 'language',
    color: '#FFD54F',
    rating: 4.8,
    parentId: null,
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    adaptiveOrdering: true,
    learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
    masteredIntervalMultiplier: 2.5,
    ...FSRS_DEFAULTS,
    createdAt: Date.now(),
  },
];

// ---- Default Cards ----------------------------------------------------------

export const sampleCards: Record<string, Flashcard[]> = {
  [defaultDeckId]: germanVocab.map((entry) => ({
    id: entry.id,
    deckId: defaultDeckId,
    front: { text: entry.front, direction: 'ltr' },
    back: { text: entry.back, direction: 'rtl' },
    example: entry.example,
    createdAt: Date.now(),
    fsrs: defaultFSRSState(),
  })),
};