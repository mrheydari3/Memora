/**
 * Storage keys owned by the repository.
 *
 * Kept in their own module with no AsyncStorage import so test fixtures can
 * seed exactly the keys the app reads without pulling the native module into
 * Node.
 */
export const STORAGE_KEYS = {
  decks: 'memory:decks',
  folders: 'memory:folders',
  /** Legacy per-deck key, only read to clean it up. */
  cards: (deckId: string) => `memory:cards:${deckId}`,
  allCards: 'memory:cards:all', // flat index for quick lookup across decks
  reviewLog: 'memory:reviewLog',
  settings: 'memory:settings',
  gameRecords: 'memory:gameRecords',
  initialized: 'memory:initialized',
} as const;
