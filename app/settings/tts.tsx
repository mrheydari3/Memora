import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { speak, stopSpeaking } from '../../services/tts';
import {
  BottomSheetModal,
  ListRow,
  RevealItem,
  Screen,
  ToggleSwitch,
} from '../../components';
import {
  SettingsBackHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../../components/v3';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en-US', name: 'English (en-US)' },
  { code: 'de-DE', name: 'German (de-DE)' },
  { code: 'fr-FR', name: 'French (fr-FR)' },
  { code: 'es-ES', name: 'Spanish (es-ES)' },
  { code: 'fa-IR', name: 'Persian (fa-IR)' },
  { code: 'ja-JP', name: 'Japanese (ja-JP)' },
];

/** A short line in each voice's own language, so a preview sounds natural. */
const SAMPLES: Record<string, string> = {
  'en-US': 'This is how your cards will sound.',
  'de-DE': 'So werden deine Karten klingen.',
  'fr-FR': 'Voici comment vos cartes sonneront.',
  'es-ES': 'Así sonarán tus tarjetas.',
  'fa-IR': 'کارت‌های شما این‌گونه خوانده می‌شوند.',
  'ja-JP': 'カードはこのように読み上げられます。',
};

/**
 * Speech — one voice per card side, v3 "Nocturne Focus".
 *
 * The hero reads the pair as one line (DE → FA) and its ledger names each half
 * plus what it reads, so the page's subject is legible before any switch. The
 * chapters then hold the three playback switches, the two voices and the sound
 * check as 64px lines in 22px panes.
 *
 * Every switch keeps its exact accessible name — the persistence flow and the
 * voice-picker sheet flow query them by name — and the pickers keep the sheet
 * they had, including the height cap on a short window.
 */
export default function TTSSettingsScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { settings, update } = useSettingsStore();
  const [pickerField, setPickerField] = useState<'front' | 'back' | null>(null);

  // The language list never takes more than half the window. On a short window
  // the sheet header and padding still fit, and the cap turns the list into a
  // real scroll region instead of letting the last language fall off-screen.
  const listMaxHeight = Math.max(160, Math.min(heights.sheetTall, Math.round(height * 0.5)));

  // Leaving the screen should never leave a sample talking in the background.
  useEffect(() => () => void stopSpeaking(), []);

  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const shortCode = (code: string) => code.split('-')[0]?.toUpperCase() ?? code;

  const front = settings.ttsFrontVoiceLang;
  const back = settings.ttsBackVoiceLang;
  const frontSample = SAMPLES[front] ?? SAMPLES['en-US'];
  const backSample = SAMPLES[back] ?? SAMPLES['en-US'];

  const active = pickerField === 'back' ? back : front;

  const previewVoices = () => {
    void stopSpeaking();
    void speak({
      text: frontSample,
      language: front,
      onDone: () => {
        void speak({ text: backSample, language: back });
      },
    });
  };

  const ledger = [
    { label: 'Front', value: shortCode(front) },
    { label: 'Back', value: shortCode(back) },
    { label: 'Reads', value: settings.ttsReadWholeCard ? 'Whole card' : 'Front only' },
  ];

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={<SettingsBackHeader title="Speech" onBack={() => goBackOr(router, '/settings')} />}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="tts-hero"
              eyebrow="Voice"
              status={{
                label: settings.ttsEnabled ? 'On this device' : 'Muted',
                tone: settings.ttsEnabled ? 'success' : 'muted',
              }}
              title={`${shortCode(front)} → ${shortCode(back)}`}
              description="One card, two voices. Each side is read in the language it was written in — by the speech engine already on this device."
              ledger={ledger}
            />
          </RevealItem>

          <RevealItem index={1}>
            <SettingsChapter label="Playback">
              <SettingsLine
                icon="record-voice-over"
                title="Text-to-Speech"
                subtitle={settings.ttsEnabled ? 'Speaks cards aloud' : 'Silent'}
                trailing={
                  <ToggleSwitch
                    value={settings.ttsEnabled}
                    onToggle={(v) => update({ ttsEnabled: v })}
                    accessibilityLabel="Text-to-Speech"
                  />
                }
              />
              <SettingsLine
                icon="volume-up"
                title="Read entire card"
                subtitle="Front, then back, in one pass"
                trailing={
                  <ToggleSwitch
                    value={settings.ttsReadWholeCard}
                    onToggle={(v) => update({ ttsReadWholeCard: v })}
                    accessibilityLabel="Read Entire Card"
                  />
                }
              />
              <SettingsLine
                icon="play-circle-outline"
                title="Automatic playback"
                subtitle="Starts speaking as soon as a card appears"
                trailing={
                  <ToggleSwitch
                    value={settings.ttsAutoPlay}
                    onToggle={(v) => update({ ttsAutoPlay: v })}
                    accessibilityLabel="Automatic Playback"
                  />
                }
                last
              />
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={2}>
            <SettingsChapter label="Voices">
              <SettingsLine
                icon="translate"
                tone={colors.info}
                title="Front language"
                subtitle="Used for every front card"
                value={langName(front)}
                onPress={() => setPickerField('front')}
              />
              <SettingsLine
                icon="translate"
                tone={colors.info}
                title="Back language"
                subtitle="Every back card answers in this voice"
                value={langName(back)}
                onPress={() => setPickerField('back')}
                last
              />
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={3}>
            <SettingsChapter label="Sound check">
              <SettingsLine
                icon="play-arrow"
                tone={colors.success}
                title="Preview voices"
                subtitle="Hear a sample in both languages — front first, then back"
                value="Play"
                onPress={previewVoices}
                last
              />
            </SettingsChapter>
          </RevealItem>

          <SettingsFootnote icon="hearing">
            Audio comes from the speech engine on your device. Once a voice is installed, it keeps
            reading offline — no audio leaves the device.
          </SettingsFootnote>
        </View>
      </View>

      <BottomSheetModal
        visible={pickerField !== null}
        onClose={() => setPickerField(null)}
        title={pickerField === 'back' ? 'Back language' : 'Front language'}
        subtitle={
          pickerField === 'back'
            ? 'Every back card answers in this voice.'
            : 'Every front card and the samples use this voice.'
        }
      >
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {LANGUAGES.map((lang) => (
            <ListRow
              key={lang.code}
              title={lang.name}
              tile="none"
              density="compact"
              gutter={0}
              showChevron={false}
              selected={lang.code === active}
              highlighted={lang.code === active}
              trailing={
                lang.code === active ? (
                  <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
                ) : undefined
              }
              onPress={async () => {
                if (pickerField === 'back') await update({ ttsBackVoiceLang: lang.code });
                else if (pickerField === 'front') await update({ ttsFrontVoiceLang: lang.code });
                setPickerField(null);
              }}
              accessibilityLabel={lang.name}
            />
          ))}
        </ScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
