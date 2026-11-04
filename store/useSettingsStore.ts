import { create } from 'zustand';
import type { Settings } from '../data/types';
import * as repo from '../data/repository';

const defaultSettings: Settings = {
  ttsEnabled: true,
  ttsReadWholeCard: false,
  ttsAutoPlay: true,
  ttsFrontVoiceLang: 'de-DE',
  // The shipped deck answers in Persian; a new install should read the back
  // side in the language it is actually written in.
  ttsBackVoiceLang: 'fa-IR',
  offlineCacheEnabled: false,
  pwaInstalled: false,
  soundEnabled: true,
  hapticsEnabled: true,
};

type SettingsStore = {
  settings: Settings;
  loaded: boolean;
  /** Set when the first read fails; the app offers a retry instead of defaults. */
  loadError: string | null;

  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  loadError: null,

  load: async () => {
    set({ loadError: null });
    try {
      const saved = await repo.loadSettings();
      // Merge rather than replace: settings saved by an earlier build lack the
      // newer game toggles, which must keep their defaults instead of undefined.
      set({
        settings: saved ? { ...defaultSettings, ...saved } : defaultSettings,
        loaded: true,
      });
    } catch {
      set({ loadError: 'Your settings could not be read.' });
    }
  },

  update: async (partial) => {
    const settings = { ...get().settings, ...partial };
    await repo.saveSettings(settings);
    set({ settings });
  },
}));