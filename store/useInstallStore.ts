import { create } from 'zustand';

/**
 * PWA install prompt store.
 *
 * Only used on web (Platform.OS === 'web'). Holds the cached
 * `beforeinstallprompt` event so the user can trigger install
 * manually from Settings → Offline & Install App.
 */
type InstallStore = {
  deferredPrompt: Event | null;
  installed: boolean;
  setDeferredPrompt: (event: Event) => void;
  promptInstall: () => Promise<boolean>;
  setInstalled: (value: boolean) => void;
};

export const useInstallStore = create<InstallStore>((set, get) => ({
  deferredPrompt: null,
  installed: false,

  setDeferredPrompt: (event) => {
    event.preventDefault();
    set({ deferredPrompt: event });
  },

  promptInstall: async () => {
    const prompt = get().deferredPrompt as any;
    if (!prompt?.prompt) return false;
    try {
      await prompt.prompt();
      const result = await (prompt as any).userChoice;
      const accepted = result?.outcome === 'accepted';
      if (accepted) set({ installed: true });
      set({ deferredPrompt: null });
      return accepted;
    } catch {
      return false;
    }
  },

  setInstalled: (value) => set({ installed: value }),
}));