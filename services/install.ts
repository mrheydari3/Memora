/**
 * PWA install service — web only.
 *
 * Listens for the beforeinstallprompt event, caches it in the
 * useInstallStore, and exposes a promptInstall() to trigger it
 * from Settings → Offline & Install App.
 *
 * Guarded behind Platform.OS === 'web' checks.
 */

import { Platform } from 'react-native';
import { useInstallStore } from '../store/useInstallStore';

/**
 * Initialize the install prompt listener.
 * Call this once at app boot on web.
 */
export function initInstallPromptListener(): void {
  if (Platform.OS !== 'web') return;

  // Listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    useInstallStore.getState().setDeferredPrompt(e);
  });

  // Listen for app installed
  window.addEventListener('appinstalled', () => {
    useInstallStore.getState().setInstalled(true);
    // Persist the flag so the Offline screen shows the installed state
    // across sessions (fallback signal for promptInstall()).
    import('../store/useSettingsStore').then(({ useSettingsStore }) =>
      useSettingsStore.getState().update({ pwaInstalled: true })
    );
  });

  // Check if already in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    useInstallStore.getState().setInstalled(true);
  }
}

/**
 * Register the service worker lazily — called when the user
 * opens Offline Settings or toggles Offline Study on.
 */
export async function registerServiceWorker(): Promise<void> {
  if (Platform.OS !== 'web') return;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered:', registration.scope);
    } catch (err) {
      console.error('[SW] Registration failed:', err);
    }
  }
}

/**
 * Turn offline caching back off: unregister the worker and drop its caches so
 * the toggle is reversible and an old cache can't keep serving stale bundles.
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (Platform.OS !== 'web') return;

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('memory-')).map((key) => caches.delete(key))
    );
  }
}

/**
 * Check if the browser supports PWA installation.
 */
export function canInstallPWA(): boolean {
  if (Platform.OS !== 'web') return false;
  const store = useInstallStore.getState();
  return !!store.deferredPrompt && !store.installed;
}