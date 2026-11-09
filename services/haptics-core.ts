/**
 * Smart Haptic Engine — pure core.
 *
 * This module knows the interaction vocabulary, not the hardware: callers ask
 * for a semantic event ("reviewGood", "combo", "toggleOff") and the engine
 * picks one preset, enforces the global preference, suppresses duplicates and
 * fires through an injected driver. Keeping it free of React Native imports
 * lets the whole policy be unit-tested in Node with a recording driver.
 *
 * `services/haptics.ts` owns the platform drivers (iOS Taptic Engine, Android
 * semantic haptics, Web Vibration API) and the settings gate.
 */

export type HapticEvent =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'error'
  | 'warning'
  | 'toggleOn'
  | 'toggleOff'
  | 'cardFlip'
  | 'cardTransition'
  | 'reviewAgain'
  | 'reviewHard'
  | 'reviewGood'
  | 'reviewEasy'
  | 'combo'
  | 'gameOver'
  | 'achievement'
  | 'modalOpen'
  | 'modalClose'
  | 'navigation'
  | 'dragStart'
  | 'dragEnd'
  | 'actionComplete';

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type NotificationType = 'success' | 'warning' | 'error';

/**
 * Expo's AndroidHaptics members, as keys. The native adapter resolves them on
 * the enum, so a typo is a compile error instead of a silent no-op.
 */
export type AndroidHaptic =
  | 'Clock_Tick'
  | 'Confirm'
  | 'Context_Click'
  | 'Drag_Start'
  | 'Gesture_End'
  | 'Long_Press'
  | 'Reject'
  | 'Segment_Tick'
  | 'Toggle_Off'
  | 'Toggle_On'
  | 'Virtual_Key';

export type HapticNativePreset =
  | { kind: 'selection' }
  | { kind: 'impact'; style: ImpactStyle }
  | { kind: 'notification'; type: NotificationType };

export type HapticPreset = {
  /** Web Vibration API pattern (ms). Android Chrome honours these. */
  web: number | number[];
  /** iOS / fallback native feedback. */
  native: HapticNativePreset;
  /** Preferred Android semantic effect when the platform exposes it. */
  android?: AndroidHaptic;
  /**
   * Minimum gap between two dispatches of the same key. Deliberately short:
   * fast tapping still ticks, but one gesture cannot buzz twice.
   */
  cooldown: number;
};

/**
 * The calibrated vocabulary.
 *
 * Micro interactions stay in the 6–14ms range; confirmations are short
 * two-step patterns; nothing runs long enough to be annoying. The four study
 * ratings are distinguishable by weight, not by length: Again is firm, Hard is
 * soft, Good is the lightest tick, Easy is a medium settle.
 */
export const HAPTIC_PRESETS: Record<HapticEvent, HapticPreset> = {
  selection: { web: 8, native: { kind: 'selection' }, android: 'Segment_Tick', cooldown: 40 },
  light: { web: 10, native: { kind: 'impact', style: 'light' }, android: 'Virtual_Key', cooldown: 40 },
  medium: { web: 16, native: { kind: 'impact', style: 'medium' }, android: 'Context_Click', cooldown: 60 },
  heavy: { web: 26, native: { kind: 'impact', style: 'heavy' }, android: 'Long_Press', cooldown: 90 },

  success: {
    web: [10, 28, 14],
    native: { kind: 'notification', type: 'success' },
    android: 'Confirm',
    cooldown: 180,
  },
  error: {
    web: [22, 36, 22],
    native: { kind: 'notification', type: 'error' },
    android: 'Reject',
    cooldown: 220,
  },
  warning: {
    web: [14, 30, 14],
    native: { kind: 'notification', type: 'warning' },
    android: 'Reject',
    cooldown: 220,
  },

  toggleOn: { web: 8, native: { kind: 'selection' }, android: 'Toggle_On', cooldown: 60 },
  toggleOff: { web: 8, native: { kind: 'selection' }, android: 'Toggle_Off', cooldown: 60 },

  cardFlip: { web: 8, native: { kind: 'impact', style: 'soft' }, android: 'Segment_Tick', cooldown: 60 },
  cardTransition: {
    web: 10,
    native: { kind: 'impact', style: 'light' },
    android: 'Gesture_End',
    cooldown: 80,
  },

  reviewAgain: {
    web: 16,
    native: { kind: 'impact', style: 'rigid' },
    android: 'Segment_Tick',
    cooldown: 90,
  },
  reviewHard: {
    web: 10,
    native: { kind: 'impact', style: 'soft' },
    android: 'Segment_Tick',
    cooldown: 90,
  },
  reviewGood: {
    web: 8,
    native: { kind: 'impact', style: 'light' },
    android: 'Segment_Tick',
    cooldown: 90,
  },
  reviewEasy: {
    web: 14,
    native: { kind: 'impact', style: 'medium' },
    android: 'Confirm',
    cooldown: 90,
  },

  combo: { web: 18, native: { kind: 'impact', style: 'medium' }, android: 'Clock_Tick', cooldown: 300 },
  gameOver: {
    web: [16, 50, 16, 50, 24],
    native: { kind: 'notification', type: 'warning' },
    android: 'Reject',
    cooldown: 600,
  },
  achievement: {
    web: [12, 36, 12, 36, 20],
    native: { kind: 'notification', type: 'success' },
    android: 'Confirm',
    cooldown: 600,
  },

  modalOpen: { web: 8, native: { kind: 'impact', style: 'light' }, android: 'Context_Click', cooldown: 180 },
  modalClose: { web: 6, native: { kind: 'selection' }, android: 'Gesture_End', cooldown: 140 },
  navigation: { web: 8, native: { kind: 'selection' }, android: 'Segment_Tick', cooldown: 80 },
  dragStart: { web: 6, native: { kind: 'selection' }, android: 'Drag_Start', cooldown: 100 },
  dragEnd: { web: 8, native: { kind: 'impact', style: 'light' }, android: 'Gesture_End', cooldown: 100 },
  actionComplete: {
    web: 12,
    native: { kind: 'notification', type: 'success' },
    android: 'Confirm',
    cooldown: 200,
  },
};

/** The hardware surface the engine talks to. Every method is best-effort. */
export type HapticsDriver = {
  selection?: () => unknown;
  impact?: (style: ImpactStyle) => unknown;
  notification?: (type: NotificationType) => unknown;
  android?: (type: AndroidHaptic) => unknown;
  vibrate?: (pattern: number | number[]) => unknown;
};

export type HapticsEngineOptions = {
  driver: HapticsDriver;
  /** Global gate; defaults to enabled. */
  isEnabled?: () => boolean;
  /** Injectable clock for deterministic cooldown tests. */
  now?: () => number;
};

export type HapticsEngineCore = {
  /** Returns true when the event was dispatched, false when gated/duplicated. */
  play: (event: HapticEvent, options?: { key?: string; cooldown?: number }) => boolean;
  /** Test hook: forget every cooldown. */
  reset: () => void;
};

/** Settings already saved by older builds simply lack the field; that is "on". */
export function isHapticsAllowed(settings?: { hapticsEnabled?: boolean } | null): boolean {
  return settings?.hapticsEnabled !== false;
}

function settle(result: unknown): void {
  if (result && typeof (result as { then?: unknown }).then === 'function') {
    void (result as Promise<unknown>).catch(() => {
      // Hardware refused or the platform lacks the effect: stay silent.
    });
  }
}

export function createHapticsEngine({
  driver,
  isEnabled = () => true,
  now = () => Date.now(),
}: HapticsEngineOptions): HapticsEngineCore {
  /** Last dispatch per dedupe key. Bounded: keys are a closed vocabulary. */
  const lastDispatch = new Map<string, number>();
  let lastDispatchAt = Number.NEGATIVE_INFINITY;

  const fire = (preset: HapticPreset): void => {
    try {
      // Android's semantic engine is the preferred path where it exists; it
      // does not require the vibrator permission and matches the platform's
      // own feedback vocabulary.
      if (driver.android && preset.android) {
        settle(driver.android(preset.android));
        return;
      }

      // Web: one implementation, the Vibration API. No Taptic Engine exists in
      // Safari, so this is a vibration, never a promise of iOS-grade haptics.
      if (driver.vibrate) {
        settle(driver.vibrate(preset.web));
        return;
      }

      const native = preset.native;
      if (native.kind === 'impact') settle(driver.impact?.(native.style));
      else if (native.kind === 'notification') settle(driver.notification?.(native.type));
      else settle(driver.selection?.());
    } catch {
      // An unsupported device must never break the interaction it decorates.
    }
  };

  const play: HapticsEngineCore['play'] = (event, options) => {
    if (!isEnabled()) return false;

    const at = now();

    // A sheet's arrival belongs to the tap that opened it. Once the trigger has
    // ticked, the arrival cue would land in the same gesture and read as a
    // double buzz, so it waits for the next deliberate gesture instead.
    if (OVERLAY_EVENTS.has(event) && at - lastDispatchAt < GESTURE_COALESCE_MS) {
      return false;
    }

    const preset = HAPTIC_PRESETS[event];
    const key = options?.key ?? event;
    const cooldown = options?.cooldown ?? preset.cooldown;
    const previous = lastDispatch.get(key);
    if (previous !== undefined && at - previous < cooldown) return false;

    lastDispatch.set(key, at);
    lastDispatchAt = at;
    fire(preset);
    return true;
  };

  return {
    play,
    reset: () => {
      lastDispatch.clear();
      lastDispatchAt = Number.NEGATIVE_INFINITY;
    },
  };
}

/** Overlay cues are refinements of a tap, never a second event of their own. */
const OVERLAY_EVENTS: ReadonlySet<HapticEvent> = new Set(['modalOpen', 'modalClose']);
const GESTURE_COALESCE_MS = 60;
