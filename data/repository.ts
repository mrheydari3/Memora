/**
 * Repository module — wraps AsyncStorage for all Memora collections.
 *
 * One function per collection key. Swap this module for SQLite later
 * without touching any UI or store code — the interface stays the same.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Deck, DeckFolder, Flashcard, GameRecord, ReviewLogEntry, Settings } from './types';

// ---- Storage Keys -----------------------------------------------------------

const KEYS = {
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

// ---- Generic helpers --------------------------------------------------------

async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---- Decks ------------------------------------------------------------------

export async function loadDecks(): Promise<Deck[]> {
  return (await getJSON<Deck[]>(KEYS.decks)) ?? [];
}

export async function saveDecks(decks: Deck[]): Promise<void> {
  await setJSON(KEYS.decks, decks);
}

// ---- Folders ----------------------------------------------------------------

/**
 * Folders live in their own collection so an empty folder survives a reload —
 * deriving them from the decks would silently drop the one you just created.
 */
export async function loadFolders(): Promise<DeckFolder[]> {
  return (await getJSON<DeckFolder[]>(KEYS.folders)) ?? [];
}

export async function saveFolders(folders: DeckFolder[]): Promise<void> {
  await setJSON(KEYS.folders, folders);
}

// ---- Cards ------------------------------------------------------------------

/** Load all cards across all decks using the flat index. */
export async function loadAllCards(): Promise<Record<string, Flashcard[]>> {
  return (await getJSON<Record<string, Flashcard[]>>(KEYS.allCards)) ?? {};
}

/**
 * Save the flat card index. One write per change: the legacy per-deck keys are
 * not written any more (nothing reads them), so a review on a large library no
 * longer serializes every deck twice.
 */
export async function saveAllCards(allCards: Record<string, Flashcard[]>): Promise<void> {
  await setJSON(KEYS.allCards, allCards);
}

/** Drop a legacy per-deck card key left behind by an older build. */
export async function removeDeckCardsKey(deckId: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.cards(deckId));
}

// ---- Review Log -------------------------------------------------------------

export async function loadReviewLog(): Promise<ReviewLogEntry[]> {
  return (await getJSON<ReviewLogEntry[]>(KEYS.reviewLog)) ?? [];
}

export async function saveReviewLog(log: ReviewLogEntry[]): Promise<void> {
  await setJSON(KEYS.reviewLog, log);
}

// ---- Settings ---------------------------------------------------------------

export async function loadSettings(): Promise<Settings | null> {
  return getJSON<Settings>(KEYS.settings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setJSON(KEYS.settings, settings);
}

// ---- Quiz Game Records ------------------------------------------------------

export async function loadGameRecords(): Promise<Record<string, GameRecord>> {
  return (await getJSON<Record<string, GameRecord>>(KEYS.gameRecords)) ?? {};
}

export async function saveGameRecords(records: Record<string, GameRecord>): Promise<void> {
  await setJSON(KEYS.gameRecords, records);
}

// ---- First-run marker -------------------------------------------------------

/**
 * True once this install has stored a library. It distinguishes a genuine
 * first run (seed the shipped deck) from "the user deleted every deck" and
 * from a failed/corrupt read, neither of which may resurrect seed data.
 */
export async function isInitialized(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.initialized)) !== null;
}

export async function markInitialized(): Promise<void> {
  await AsyncStorage.setItem(KEYS.initialized, '1');
}