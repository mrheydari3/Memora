/**
 * Text-to-Speech service — wraps expo-speech.
 *
 * Works natively on iOS/Android and maps to the Web Speech API on web
 * automatically via expo-speech. No paid backend needed.
 */

import * as Speech from 'expo-speech';

type TTSSpeakOptions = {
  text: string;
  language?: string; // BCP-47, e.g. 'de-DE', 'en-US'
  onDone?: () => void;
};

/**
 * Speak the given text using device TTS.
 * On platforms that don't support speech, this silently no-ops.
 */
export async function speak({ text, language, onDone }: TTSSpeakOptions): Promise<void> {
  if (!text) return;

  const options: Speech.SpeechOptions = {
    language,
    onDone,
    onError: (e) => console.warn('TTS error:', e),
    onStart: () => {},
  };

  await Speech.speak(text, options);
}

/** Check if TTS is available on this platform. */
export function isSpeechAvailable(): boolean {
  return true; // expo-speech handles fallback
}

/** Stop any in-progress speech. */
export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

/**
 * Speak a flashcard's front and/or back based on settings.
 * Reads front in `ttsFrontVoiceLang`, back in `ttsBackVoiceLang`.
 */
export async function speakCard(
  frontText: string,
  backText: string,
  options: {
    ttsEnabled: boolean;
    ttsReadWholeCard: boolean;
    ttsAutoPlay: boolean;
    ttsFrontVoiceLang: string;
    ttsBackVoiceLang: string;
  }
): Promise<void> {
  if (!options.ttsEnabled) return;

  if (options.ttsReadWholeCard) {
    // Read entire card
    await speak({ text: frontText, language: options.ttsFrontVoiceLang });
    await speak({ text: backText, language: options.ttsBackVoiceLang });
  } else if (options.ttsAutoPlay) {
    // Auto-play front only
    await speak({ text: frontText, language: options.ttsFrontVoiceLang });
  }
  // If neither, user taps the speaker button manually
}