import { create } from 'zustand';
import type { ReviewLogEntry, Rating } from '../data/types';
import * as repo from '../data/repository';

type ReviewStore = {
  // State
  reviewLog: ReviewLogEntry[];
  loaded: boolean;
  /** Set when the first read fails, so a retry can replace the empty state. */
  loadError: string | null;

  // Actions
  load: () => Promise<void>;
  logReview: (entry: ReviewLogEntry) => Promise<void>;
  /** Pop the most recent entry (undo). Returns it, or null when the log is empty. */
  removeLastReview: () => Promise<ReviewLogEntry | null>;
  /** Drop a deck's history, used when its progress is reset or it is deleted. */
  clearDeckLog: (deckId: string) => Promise<void>;
  /** Put a deleted deck's history back when the deletion is undone. */
  restoreDeckLog: (entries: ReviewLogEntry[]) => Promise<void>;
  /** Drop one card's history, used when the card is deleted. */
  clearCardLog: (cardId: string) => Promise<void>;
  getLogsForCard: (cardId: string) => ReviewLogEntry[];
  getLogsForDeck: (deckId: string) => ReviewLogEntry[];
};

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviewLog: [],
  loaded: false,
  loadError: null,

  load: async () => {
    set({ loadError: null });
    try {
      const log = await repo.loadReviewLog();
      set({ reviewLog: log, loaded: true });
    } catch {
      set({ loadError: 'Your review history could not be read.' });
    }
  },

  logReview: async (entry) => {
    const reviewLog = [...get().reviewLog, entry];
    await repo.saveReviewLog(reviewLog);
    set({ reviewLog });
  },

  removeLastReview: async () => {
    const current = get().reviewLog;
    if (current.length === 0) return null;
    const [removed] = current.slice(-1);
    const reviewLog = current.slice(0, -1);
    await repo.saveReviewLog(reviewLog);
    set({ reviewLog });
    return removed;
  },

  clearDeckLog: async (deckId) => {
    const reviewLog = get().reviewLog.filter((e) => e.deckId !== deckId);
    await repo.saveReviewLog(reviewLog);
    set({ reviewLog });
  },

  restoreDeckLog: async (entries) => {
    if (entries.length === 0) return;
    // Keep the log one chronological run: `removeLastReview` reads the tail,
    // so restored entries must not land after newer reviews from other decks.
    const reviewLog = [...get().reviewLog, ...entries].sort((a, b) => a.reviewedAt - b.reviewedAt);
    await repo.saveReviewLog(reviewLog);
    set({ reviewLog });
  },

  clearCardLog: async (cardId) => {
    const reviewLog = get().reviewLog.filter((e) => e.cardId !== cardId);
    await repo.saveReviewLog(reviewLog);
    set({ reviewLog });
  },

  getLogsForCard: (cardId) => get().reviewLog.filter((e) => e.cardId === cardId),
  getLogsForDeck: (deckId) => get().reviewLog.filter((e) => e.deckId === deckId),
}));