import { create } from 'zustand';
import type { StreakSkip } from '../data/types';
import * as repo from '../data/repository';
import { normalizeStreakSkips, validateStreakSkip } from '../data/streak';

export type AddSkipResult =
  | { ok: true; skip: StreakSkip }
  | {
      ok: false;
      reason:
        | 'invalid'
        | 'future'
        | 'too-old'
        | 'studied'
        | 'used'
        | 'busy'
        | 'storage';
    };

type StreakStore = {
  skips: StreakSkip[];
  loaded: boolean;
  loadError: string | null;
  /** True synchronously from the first tap until persistence settles. */
  saving: boolean;

  load: () => Promise<void>;
  addSkip: (
    dateKey: string,
    reviewTimes: readonly number[],
    now?: number
  ) => Promise<AddSkipResult>;
};

export const useStreakStore = create<StreakStore>((set, get) => ({
  skips: [],
  loaded: false,
  loadError: null,
  saving: false,

  load: async () => {
    try {
      const raw = await repo.loadStreakSkips();
      const skips = normalizeStreakSkips(raw);
      set({ skips, loaded: true, loadError: null });
      // Persist the cleaned shape only when normalization actually dropped or
      // rewrote something. A read failure must never write an empty list.
      if (JSON.stringify(raw) !== JSON.stringify(skips)) {
        try {
          await repo.saveStreakSkips(skips);
        } catch {
          // The in-memory view is still safe; the next boot can retry cleanup.
        }
      }
    } catch {
      set({ loadError: 'Rest days could not be read.', loaded: true });
    }
  },

  addSkip: async (dateKey, reviewTimes, now = Date.now()) => {
    // `saving` is read synchronously. Two taps in the same frame both see the
    // first write before it can settle, so only one allowance is consumed.
    if (get().saving) return { ok: false, reason: 'busy' };
    // Never write before the stored list has been read: a failed or retrying
    // load must not be treated as an empty list.
    if (!get().loaded || get().loadError) return { ok: false, reason: 'storage' };

    set({ saving: true });
    try {
      const current = get().skips;
      const validation = validateStreakSkip(dateKey, current, reviewTimes, now);
      if (!validation.ok) return { ok: false, reason: validation.reason };

      const next = normalizeStreakSkips([...current, validation.skip], now);
      try {
        await repo.saveStreakSkips(next);
      } catch {
        return { ok: false, reason: 'storage' };
      }
      set({ skips: next });
      return { ok: true, skip: validation.skip };
    } finally {
      set({ saving: false });
    }
  },
}));
