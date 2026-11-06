/**
 * A tiny LRU cache for analytics reports.
 *
 * Building the report walks every card and every review, so the Statistics
 * screen must not repeat it on each render (or each minute tick that does not
 * change anything). The key contains everything the result depends on: the raw
 * log length and last timestamp, the deck configuration, card counts, the
 * selected range and the current minute.
 *
 * It is deliberately conservative: any change that could alter a number changes
 * the key, so a stale report is not possible within the same minute.
 */

import type { Deck, Flashcard, ReviewLogEntry } from '../../types';

export class AnalyticsCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 8) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (hit === undefined) return undefined;
    // Refresh recency so the common case (same key every render) survives.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, value);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export type CacheKeyInput = {
  decks: readonly Deck[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: readonly ReviewLogEntry[];
  now: number;
  rangeDays: number;
  includeArchived: boolean;
};

export function intelligenceCacheKey(input: CacheKeyInput): string {
  const { decks, cardsByDeck, reviewLog, now, rangeDays, includeArchived } = input;
  const lastReview = reviewLog.length > 0 ? reviewLog[reviewLog.length - 1].reviewedAt : 0;
  const deckSignature = decks
    .map(
      (deck) =>
        `${deck.id}:${deck.name}:${deck.archivedAt ? 1 : 0}:${deck.algorithmPreset}:${
          deck.requestRetention ?? 0
        }`
    )
    .join('|');
  const cardSignature = Object.keys(cardsByDeck)
    .sort()
    .map((key) => `${key}:${cardsByDeck[key].length}`)
    .join('|');

  return [
    rangeDays,
    includeArchived ? 1 : 0,
    Math.floor(now / 60_000),
    reviewLog.length,
    lastReview,
    deckSignature,
    cardSignature,
  ].join('~');
}
