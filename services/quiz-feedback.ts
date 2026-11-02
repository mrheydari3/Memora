/**
 * Quiz feedback — the only place the game makes noise or buzzes.
 *
 * The screen says what happened (`correct`, `wrong`, `combo`, `end`); this hook
 * owns the players, the platform guards and the settings checks. Any failure is
 * swallowed: a missing sound card or a blocked autoplay policy must never stop
 * the round.
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type QuizFeedbackKind = 'correct' | 'wrong' | 'combo' | 'end';

const SOURCES = {
  correct: require('../assets/sfx/correct.wav'),
  wrong: require('../assets/sfx/wrong.wav'),
  combo: require('../assets/sfx/combo.wav'),
  end: require('../assets/sfx/end.wav'),
} as const;

export function useQuizFeedback(options: { sound: boolean; haptics: boolean }) {
  const correctPlayer = useAudioPlayer(SOURCES.correct);
  const wrongPlayer = useAudioPlayer(SOURCES.wrong);
  const comboPlayer = useAudioPlayer(SOURCES.combo);
  const endPlayer = useAudioPlayer(SOURCES.end);

  const players = {
    correct: correctPlayer,
    wrong: wrongPlayer,
    combo: comboPlayer,
    end: endPlayer,
  };

  const play = useCallback(
    (kind: QuizFeedbackKind) => {
      if (!options.sound) return;
      try {
        const player = players[kind];
        // Rewind so repeated answers retrigger instead of being ignored.
        player.seekTo(0);
        player.play();
      } catch {
        // Web autoplay policy or a device without audio output.
      }
    },
    // Players are stable SharedObjects; re-creating the callback per render is
    // harmless, but keeping it tied to the setting avoids stale closures.
    [options.sound, correctPlayer, wrongPlayer, comboPlayer, endPlayer]
  );

  const buzz = useCallback(
    (kind: QuizFeedbackKind) => {
      if (!options.haptics || Platform.OS === 'web') return;
      try {
        switch (kind) {
          case 'correct':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'wrong':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case 'combo':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'end':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
        }
      } catch {
        // A device without a haptic engine.
      }
    },
    [options.haptics]
  );

  /** Sound + haptics for one event, with the combo buzz layered on top. */
  const signal = useCallback(
    (kind: QuizFeedbackKind, combo = 0) => {
      play(kind);
      buzz(kind);
      if (kind === 'correct' && combo >= 3) {
        play('combo');
        buzz('combo');
      }
    },
    [play, buzz]
  );

  return { signal };
}
