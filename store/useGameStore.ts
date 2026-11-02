import { create } from 'zustand';
import type { GameRecord } from '../data/types';
import * as repo from '../data/repository';

type GameStore = {
  /** Records keyed by deck id. */
  records: Record<string, GameRecord>;
  loaded: boolean;

  load: () => Promise<void>;
  getRecord: (deckId: string) => GameRecord | undefined;
  /**
   * Store one finished round. Returns true when the score beat the previous
   * best (so the result screen can celebrate a new record).
   */
  submitRound: (deckId: string, score: number, bestCombo: number) => Promise<boolean>;
  clearDeckRecord: (deckId: string) => Promise<void>;
};

export const useGameStore = create<GameStore>((set, get) => ({
  records: {},
  loaded: false,

  load: async () => {
    try {
      const records = await repo.loadGameRecords();
      set({ records, loaded: true });
    } catch {
      set({ records: {}, loaded: true });
    }
  },

  getRecord: (deckId) => get().records[deckId],

  submitRound: async (deckId, score, bestCombo) => {
    const previous = get().records[deckId];
    const isBest = score > (previous?.bestScore ?? 0);

    const record: GameRecord = {
      deckId,
      bestScore: Math.max(score, previous?.bestScore ?? 0),
      bestCombo: Math.max(bestCombo, previous?.bestCombo ?? 0),
      plays: (previous?.plays ?? 0) + 1,
      lastPlayedAt: Date.now(),
    };

    const records = { ...get().records, [deckId]: record };
    // Keep the in-memory record even if the write fails: the round already
    // happened, and losing the best score silently would be worse than a
    // slightly stale disk copy.
    set({ records });
    try {
      await repo.saveGameRecords(records);
    } catch {
      // Storage is unavailable (private mode, quota). In-memory only.
    }
    return isBest;
  },

  clearDeckRecord: async (deckId) => {
    const records = { ...get().records };
    delete records[deckId];
    set({ records });
    try {
      await repo.saveGameRecords(records);
    } catch {
      // Same reasoning as submitRound.
    }
  },
}));
