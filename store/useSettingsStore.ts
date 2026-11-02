import { create } from 'zustand';
import type { Settings } from '../data/types';
import * as repo from '../data/repository';

const defaultSettings: Settings = {
  ttsEnabled: true,
  ttsReadWholeCard: false,
  ttsAutoPlay: true,
  ttsFrontVoiceLang: 'de-DE',
  ttsBackVoiceLang: 'en-US',
  offlineCacheEnabled: false,
  pwaInstalled: false,
  soundEnabled: true,
  hapticsEnabled: true,
};

type SettingsStore = {
  settings: Settings;
  loaded: boolean;

  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async () => {
    try {
      const saved = await repo.loadSettings();
      // Merge rather than replace: settings saved by an earlier build lack the
      // newer game toggles, which must keep their defaults instead of undefined.
      set({
        settings: saved ? { ...defaultSettings, ...saved } : defaultSettings,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  update: async (partial) => {
    const settings = { ...get().settings, ...partial };
    await repo.saveSettings(settings);
    set({ settings });
  },
}));