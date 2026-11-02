/**
 * Memora motion layer — the one place that starts animations.
 *
 * Screens describe intent (`useReveal`, `usePressFeedback`, `timingTo`) and this
 * module owns the curves, the native driver decision and the reduced-motion
 * switch, so a screen can never drift into its own hand-tuned duration. Every
 * helper reads the OS "reduce motion" preference at the moment it starts, so a
 * user who asked for less motion gets the end state immediately.
 *
 * Tokens live in `theme/palette.js` (`motion.fast|base|slow|flip|spring`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { motion } from '../theme/tokens';

export const IS_WEB = Platform.OS === 'web';
/** Layout properties (width, height) can never run on the native driver. */
export const USE_NATIVE_DRIVER = !IS_WEB;

/** The three curves the app uses. `standard` eases out, `flip` is symmetric. */
export const EASE = {
  standard: Easing.out(Easing.cubic),
  flip: Easing.inOut(Easing.cubic),
  press: Easing.out(Easing.quad),
} as const;

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** Native preference, read synchronously by the animation helpers. */
let nativeReduced = false;
let nativeListening = false;
const preferenceListeners = new Set<() => void>();

function notifyPreference() {
  for (const listener of preferenceListeners) listener();
}

function listenToNativePreference() {
  if (IS_WEB || nativeListening) return;
  nativeListening = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      nativeReduced = enabled;
      notifyPreference();
    })
    .catch(() => {
      // A platform without the API simply keeps the default (motion allowed).
    });
  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    nativeReduced = enabled;
    notifyPreference();
  });
}

/**
 * Synchronous check. The animation helpers call this as they start, so a change
 * in the OS setting applies to the very next transition without a re-render.
 */
export function prefersReducedMotion(): boolean {
  if (IS_WEB) {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(REDUCE_QUERY).matches;
  }
  listenToNativePreference();
  return nativeReduced;
}

/** Reactive mirror, for components that must skip rendering a transform entirely. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (IS_WEB) {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const query = window.matchMedia(REDUCE_QUERY);
      const update = () => setReduced(query.matches);
      update();
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    listenToNativePreference();
    const update = () => setReduced(nativeReduced);
    preferenceListeners.add(update);
    update();
    return () => {
      preferenceListeners.delete(update);
    };
  }, []);

  return reduced;
}

type TimingOptions = {
  duration: number;
  delay?: number;
  easing?: (value: number) => number;
  /** Jump straight to the end value instead of animating. */
  reduced?: boolean;
  /** Defaults to the platform driver; pass false for layout properties. */
  nativeDriver?: boolean;
};

/**
 * Ease one value to `toValue`. Resolves when the step finishes (or immediately
 * when the preference is reduce-motion), which is what sequencing relies on.
 */
export function timingTo(
  value: Animated.Value,
  toValue: number,
  options: TimingOptions
): Promise<void> {
  const reduced = options.reduced ?? prefersReducedMotion();
  if (reduced) {
    value.setValue(toValue);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Animated.timing(value, {
      toValue,
      duration: options.duration,
      delay: options.delay ?? 0,
      easing: options.easing ?? EASE.standard,
      useNativeDriver: options.nativeDriver ?? USE_NATIVE_DRIVER,
    }).start(() => resolve());
  });
}

/** Spring one value to `toValue` — used for press feedback, never for entrances. */
export function springTo(
  value: Animated.Value,
  toValue: number,
  options: { reduced?: boolean } = {}
): void {
  if (options.reduced ?? prefersReducedMotion()) {
    value.setValue(toValue);
    return;
  }
  Animated.spring(value, {
    toValue,
    ...motion.spring,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
}

/**
 * The liquid-glass settle: a spring with a little bounce, used by the tab bar's
 * travelling lens. Reduce motion jumps straight to the end value.
 */
export function springLiquidTo(
  value: Animated.Value,
  toValue: number,
  options: { reduced?: boolean } = {}
): void {
  if (options.reduced ?? prefersReducedMotion()) {
    value.setValue(toValue);
    return;
  }
  Animated.spring(value, {
    toValue,
    ...motion.liquidSpring,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
}

/**
 * Spring one value to `toValue` and resolve when it settles. Card paging uses
 * this so the swap waits for the physical motion instead of a clock, and
 * reduce-motion resolves on the same tick with the end state applied.
 */
export function springToAsync(
  value: Animated.Value,
  toValue: number,
  options: { reduced?: boolean } = {}
): Promise<void> {
  if (options.reduced ?? prefersReducedMotion()) {
    value.setValue(toValue);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Animated.spring(value, {
      toValue,
      ...motion.spring,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => resolve());
  });
}

type RevealOptions = {
  /** Delay in ms, for staggering siblings. */
  delay?: number;
  /** Defaults to motion.slow. */
  duration?: number;
  /** Vertical rise in px; 0 fades in place (used for list re-reveals). */
  distance?: number;
  /** Starting scale, when the block should settle rather than slide. */
  scale?: number;
};

/**
 * The opacity a reveal starts from.
 *
 * Not 0: a reveal wraps a whole screen's body, and a 0 start means the first
 * frames after a navigation paint nothing below the app bar — the "blank
 * screen" people read as a broken page. Starting part-way keeps the fade and
 * the rise while guaranteeing the content is on screen from the first frame.
 */
export const REVEAL_OPACITY_FLOOR = 0.6;

/**
 * A 0→1 reveal that replays whenever `key` changes (mount included). The
 * returned style is ready to spread on an Animated.View. Opacity travels
 * `REVEAL_OPACITY_FLOOR`→1 rather than 0→1, so a reveal can never hide content.
 */
export function useReveal(key: unknown, options: RevealOptions = {}) {
  const { delay = 0, duration = motion.slow, distance = 12, scale } = options;
  const value = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion()) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    Animated.timing(value, {
      toValue: 1,
      duration,
      delay,
      easing: EASE.standard,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [key, delay, duration, value]);

  const style = useMemo(() => {
    const transform: ({ translateY: Animated.AnimatedInterpolation<number> } | { scale: Animated.AnimatedInterpolation<number> })[] =
      [];
    if (distance !== 0) {
      transform.push({
        translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
      });
    }
    if (scale !== undefined) {
      transform.push({
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }),
      });
    }
    return {
      opacity: value.interpolate({
        inputRange: [0, 1],
        outputRange: [REVEAL_OPACITY_FLOOR, 1],
      }),
      transform,
    } as Animated.WithAnimatedValue<ViewStyle>;
  }, [value, distance, scale]);

  return { value, style, reduced };
}

type PressOptions = {
  /** Scale reached while pressed. Keep it above ~0.94 for full-width rows. */
  scale?: number;
};

/**
 * Press feedback: a spring from 1 to `scale` on press-in, back on release.
 * The raw value is returned too, so a row can drive a press veil with it.
 */
export function usePressFeedback(options: PressOptions = {}) {
  const { scale = 0.98 } = options;
  const value = useRef(new Animated.Value(0)).current;

  const onPressIn = () => springTo(value, 1);
  const onPressOut = () => springTo(value, 0);

  const style = useMemo(
    () =>
      ({
        transform: [
          { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
        ],
      }) as Animated.WithAnimatedValue<ViewStyle>,
    [value, scale]
  );

  /** Drop-in overlay style: a row can paint a press tint with this. */
  const veilStyle = useMemo(
    () => ({ opacity: value }) as Animated.WithAnimatedValue<ViewStyle>,
    [value]
  );

  return { value, style, veilStyle, onPressIn, onPressOut };
}

/**
 * Stagger — the delay for the nth member of an entrance group.
 *
 * Capped, because a 40-row deck list should not spend two seconds cascading:
 * past the cap every remaining row enters with the last group instead.
 */
export function staggerDelay(index: number, step = 40, cap = 8): number {
  return Math.min(Math.max(0, index), cap) * step;
}

/**
 * One shimmer clock for every skeleton on screen.
 *
 * Skeletons mount in groups (a list, a hero, a grid), and one loop per block
 * would put a dozen timers on the JS thread for no visual gain — they all sweep
 * in phase anyway. The loop runs only while at least one skeleton is mounted, so
 * a settled screen costs nothing.
 */
let shimmerValue: Animated.Value | null = null;
let shimmerUsers = 0;
let shimmerLoop: Animated.CompositeAnimation | null = null;

export function useSharedShimmer(): Animated.Value {
  const value = useMemo(() => {
    if (!shimmerValue) shimmerValue = new Animated.Value(0);
    return shimmerValue;
  }, []);

  useEffect(() => {
    shimmerUsers += 1;
    if (!shimmerLoop && !prefersReducedMotion()) {
      value.setValue(0);
      shimmerLoop = Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      shimmerLoop.start();
    }

    return () => {
      shimmerUsers -= 1;
      if (shimmerUsers > 0) return;
      shimmerLoop?.stop();
      shimmerLoop = null;
      shimmerUsers = 0;
      value.setValue(0);
    };
  }, [value]);

  return value;
}

type PresenceOptions = {
  /** Enter duration; the exit is capped at motion.fast so closing feels quick. */
  duration?: number;
  delay?: number;
};

/**
 * Mount/unmount choreography for overlays (sheets, transient panels).
 *
 * A native `Modal animationType` cannot be interrupted, hides the exit entirely
 * and always slides the same way; keeping the node mounted long enough to animate
 * out means a sheet leaves on the same curve it arrived on.
 */
export function usePresence(visible: boolean, options: PresenceOptions = {}) {
  const { duration = motion.base, delay = 0 } = options;
  const value = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (prefersReducedMotion()) {
      value.setValue(visible ? 1 : 0);
      setMounted(visible);
      return;
    }

    if (visible) {
      setMounted(true);
      value.setValue(0);
      Animated.timing(value, {
        toValue: 1,
        duration,
        delay,
        easing: EASE.standard,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      return;
    }

    Animated.timing(value, {
      toValue: 0,
      duration: Math.min(duration, motion.fast),
      easing: EASE.press,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, duration, delay, value]);

  return { mounted, value };
}
