/**
 * Repository module — wraps AsyncStorage for all Memora collections.
 *
 * One function per collection key. Swap this module for SQLite later
 * without touching any UI or store code — the interface stays the same.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Deck, Flashcard, GameRecord, ReviewLogEntry, Settings } from './types';

// ---- Storage Keys -----------------------------------------------------------

const KEYS = {
  decks: 'memory:decks',
  cards: (deckId: string) => `memory:cards:${deckId}`,
  allCards: 'memory:cards:all', // flat index for quick lookup across decks
  reviewLog: 'memory:reviewLog',
  settings: 'memory:settings',
  gameRecords: 'memory:gameRecords',
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

// ---- Cards ------------------------------------------------------------------

export async function loadCards(deckId: string): Promise<Flashcard[]> {
  return (await getJSON<Flashcard[]>(KEYS.cards(deckId))) ?? [];
}

export async function saveCards(deckId: string, cards: Flashcard[]): Promise<void> {
  await setJSON(KEYS.cards(deckId), cards);
}

/** Load all cards across all decks using the flat index. */
export async function loadAllCards(): Promise<Record<string, Flashcard[]>> {
  return (await getJSON<Record<string, Flashcard[]>>(KEYS.allCards)) ?? {};
}

/** Save all cards indexed by deckId. Also saves per-deck for faster single-deck loads. */
export async function saveAllCards(allCards: Record<string, Flashcard[]>): Promise<void> {
  await setJSON(KEYS.allCards, allCards);
  // Also persist per-deck for faster access
  for (const [deckId, cards] of Object.entries(allCards)) {
    await setJSON(KEYS.cards(deckId), cards);
  }
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

// ---- Seed / Reset -----------------------------------------------------------

/** Clear all Memora data. */
export async function clearAll(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const memoryKeys = allKeys.filter((k) => k.startsWith('memory:'));
  if (memoryKeys.length > 0) {
    await AsyncStorage.multiRemove(memoryKeys);
  }
}