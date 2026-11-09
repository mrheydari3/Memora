/**
 * Smart Haptic Engine — platform entry point.
 *
 * One source of truth for every haptic in Memora. UI code calls a semantic
 * method and never imports expo-haptics or the Vibration API:
 *
 *   HapticsEngine.reviewGood()
 *   HapticsEngine.toggleOff()
 *   HapticsEngine.gameOver()
 *
 * Platform mapping:
 *  - iOS: `expo-haptics` → the Taptic Engine (impact/selection/notification).
 *  - Android: `performAndroidHapticsAsync` when available, so the effect is the
 *    platform's own semantic one (toggle, confirm, reject, segment tick).
 *  - Web: the Web Vibration API, which is a vibration motor — not a Taptic
 *    Engine. Unsupported browsers and desktops simply stay silent.
 *
 * Dispatch is fire-and-forget: a rejected hardware promise can never delay a
 * review, a rating, a game answer or a navigation.
 */
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  createHapticsEngine,
  isHapticsAllowed,
  type AndroidHaptic,
  type HapticEvent,
  type HapticsDriver,
} from './haptics-core';

export type { HapticEvent } from './haptics-core';

/**
 * Service lock. While the tactile engine is under repair every dispatch is
 * suppressed, and Settings shows a locked "In repair" row instead of letting
 * the preference pretend feedback is available. Set this to false to resume;
 * the user's saved preference is left untouched.
 */
export const HAPTICS_REPAIR_MODE = true;

/** Reads the global preference at dispatch time, so a toggle applies at once. */
function hapticsAllowed(): boolean {
  if (HAPTICS_REPAIR_MODE) return false;
  try {
    return isHapticsAllowed(useSettingsStore.getState().settings);
  } catch {
    // A store that is not mounted yet must not silence a first interaction.
    return true;
  }
}

/** The Web Vibration API, guarded: no navigator, no vibrate, no problem. */
function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  const target = navigator as Navigator & { vibrate?: (input: number | number[]) => boolean };
  if (typeof target.vibrate !== 'function') return;
  target.vibrate(pattern);
}

const webDriver: HapticsDriver = { vibrate };



/**
 * The native driver is built once, lazily at module load on native only. On web
 * `expo-haptics` is never required; the Vibration API driver is used instead.
 */
function createNativeDriver(): HapticsDriver {
  // Required rather than imported: this module is also loaded by the web
  // bundle, where the native package has no role.
  const Haptics = require('expo-haptics') as typeof import('expo-haptics');

  const impactStyles = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
    soft: Haptics.ImpactFeedbackStyle.Soft,
    rigid: Haptics.ImpactFeedbackStyle.Rigid,
  } as const;
  const notificationTypes = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  } as const;

  const android =
    Platform.OS === 'android'
      ? (type: AndroidHaptic) =>
          Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics[type])
      : undefined;

  return {
    selection: () => Haptics.selectionAsync(),
    impact: (style) => Haptics.impactAsync(impactStyles[style]),
    notification: (type) => Haptics.notificationAsync(notificationTypes[type]),
    android,
  };
}

const core = createHapticsEngine({
  driver: Platform.OS === 'web' ? webDriver : createNativeDriver(),
  isEnabled: hapticsAllowed,
});

/**
 * The application's only haptic API. Methods are semantic: a caller states the
 * interaction, not the hardware effect.
 */
export const HapticsEngine = {
  selection: () => core.play('selection'),
  light: () => core.play('light'),
  medium: () => core.play('medium'),
  heavy: () => core.play('heavy'),

  success: () => core.play('success'),
  error: () => core.play('error'),
  warning: () => core.play('warning'),

  toggleOn: () => core.play('toggleOn'),
  toggleOff: () => core.play('toggleOff'),

  cardFlip: () => core.play('cardFlip'),
  cardTransition: () => core.play('cardTransition'),

  reviewAgain: () => core.play('reviewAgain'),
  reviewHard: () => core.play('reviewHard'),
  reviewGood: () => core.play('reviewGood'),
  reviewEasy: () => core.play('reviewEasy'),

  combo: () => core.play('combo'),
  gameOver: () => core.play('gameOver'),
  achievement: () => core.play('achievement'),

  modalOpen: () => core.play('modalOpen'),
  modalClose: () => core.play('modalClose'),
  navigation: () => core.play('navigation'),
  dragStart: () => core.play('dragStart'),
  dragEnd: () => core.play('dragEnd'),
  actionComplete: () => core.play('actionComplete'),

  /** Escape hatch used by tests and by a feature that needs a custom dedupe key. */
  play: (event: HapticEvent, options?: { key?: string; cooldown?: number }) =>
    core.play(event, options),
};

export type HapticsEngineApi = typeof HapticsEngine;
