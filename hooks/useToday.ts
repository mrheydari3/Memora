import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/** A quiet clock for day- and minute-sensitive screens. */
const DEFAULT_TICK_MS = 60_000;

/**
 * Returns the current local timestamp and refreshes it when the calendar may
 * have moved or the app becomes active again.
 *
 * Home derives due counts and daily caps from this value. A render-only
 * `Date.now()` would leave those numbers frozen at the moment the screen
 * mounted: reopening a backgrounded PWA, crossing midnight, or a learning card
 * falling due would not change the shelf until some unrelated store update.
 * A minute tick keeps learning cards honest without turning Home into a
 * polling screen, and focus/visibility changes refresh immediately.
 */
export function useToday(tickMs = DEFAULT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let appActive = Platform.OS === 'web' ? true : AppState.currentState !== 'background';
    const refresh = () => {
      if (active) setNow(Date.now());
    };
    const visible = () =>
      Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      document.visibilityState !== 'hidden';
    const tick = () => {
      // A backgrounded app has no reader to update; do not spend work on a
      // calendar that will be refreshed on foreground anyway.
      if (appActive && visible()) refresh();
    };

    const timer = setInterval(tick, Math.max(15_000, tickMs));
    const appState = AppState.addEventListener('change', (state) => {
      appActive = state === 'active';
      if (appActive) refresh();
    });

    let onVisibility: (() => void) | undefined;
    let onFocus: (() => void) | undefined;
    let onPageShow: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      onVisibility = () => {
        if (document.visibilityState === 'visible') refresh();
      };
      onFocus = refresh;
      onPageShow = refresh;
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onFocus);
      window.addEventListener('pageshow', onPageShow);
    }

    return () => {
      active = false;
      clearInterval(timer);
      appState.remove();
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
      if (onFocus) window.removeEventListener('focus', onFocus);
      if (onPageShow) window.removeEventListener('pageshow', onPageShow);
    };
  }, [tickMs]);

  return now;
}