/**
 * One short tap for a completed transition.
 *
 * Browsers expose the Web Vibration API (mostly Android Chrome); iOS Safari and
 * most desktops have no vibration at all. Every call is best-effort: an
 * unsupported device must keep browsing silently, never throw.
 */
import { Platform, Vibration } from 'react-native';

export function selectionHaptic(ms = 8): void {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator === 'undefined' ? undefined : navigator;
      if (nav && typeof nav.vibrate === 'function') nav.vibrate(ms);
      return;
    }
    // React Native routes this to the platform vibrator (iOS ignores duration).
    Vibration.vibrate(ms);
  } catch {
    // Unsupported device: no feedback is better than a broken gesture.
  }
}
