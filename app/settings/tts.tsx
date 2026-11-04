import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { speak, stopSpeaking } from '../../services/tts';
import {
  AppText,
  BottomSheetModal,
  ListRow,
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

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
 * Speech — one voice per card side.
 *
 * The page follows the settings rhythm: one plate with the current route and
 * its readouts, then chapters for playback, the two voices and a sound check.
 * Every control is a standard setting row; there are no stamps or rules.
 */
export default function TTSSettingsScreen() {
  const { height } = useWindowDimensions();
  const { settings, update } = useSettingsStore();
  const [pickerField, setPickerField] = useState<'front' | 'back' | null>(null);

  // The language list never takes more than half the window. On a short window
  // the sheet header and padding still fit, and the cap turns the list into a
  // real scroll region instead of letting the last language fall off-screen.
  const listMaxHeight = Math.max(
    160,
    Math.min(heights.sheetTall, Math.round(height * 0.5))
  );

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
    { label: 'Route', value: `${shortCode(front)} → ${shortCode(back)}` },
    { label: 'Mode', value: settings.ttsAutoPlay ? 'Automatic' : 'On tap' },
    { label: 'Reads', value: settings.ttsReadWholeCard ? 'Whole card' : 'Front only' },
  ];

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Speech" back />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="glass"
          icon="record-voice-over"
          eyebrow="Voice"
          title={`${shortCode(front)} → ${shortCode(back)}`}
          description="One card, two voices. Each side is read in the language it was written in — by the speech engine already on this device."
          status={{
            label: settings.ttsEnabled ? 'On this device' : 'Muted',
            tone: settings.ttsEnabled ? 'success' : 'muted',
          }}
          ledger={ledger}
        />
      </RevealItem>

      <SettingsSection label="Playback" index={1}>
        <SettingsRow
          icon="record-voice-over"
          iconTone="accent"
          title="Text-to-Speech"
          subtitle={settings.ttsEnabled ? 'Speaks cards aloud' : 'Silent'}
          iconPulseKey={settings.ttsEnabled}
          trailing={
            <ToggleSwitch
              value={settings.ttsEnabled}
              onToggle={(v) => update({ ttsEnabled: v })}
              accessibilityLabel="Text-to-Speech"
            />
          }
        />
        <SettingsRow
          icon="volume-up"
          iconTone="accent"
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
        <SettingsRow
          icon="play-circle-outline"
          iconTone="accent"
          title="Automatic playback"
          subtitle="Starts speaking as soon as a card appears"
          iconPulseKey={settings.ttsAutoPlay}
          trailing={
            <ToggleSwitch
              value={settings.ttsAutoPlay}
              onToggle={(v) => update({ ttsAutoPlay: v })}
              accessibilityLabel="Automatic Playback"
            />
          }
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Voices" index={2}>
        <SettingsRow
          icon="translate"
          iconTone="info"
          title="Front language"
          subtitle="Used for every front card"
          value={langName(front)}
          onPress={() => setPickerField('front')}
        />
        <SettingsRow
          icon="translate"
          iconTone="info"
          title="Back language"
          subtitle="Every back card answers in this voice"
          value={langName(back)}
          onPress={() => setPickerField('back')}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Sound check" index={3}>
        <SettingsRow
          icon="play-arrow"
          iconTone="success"
          title="Preview voices"
          subtitle="Hear a sample in both languages — front first, then back"
          value="Play"
          onPress={previewVoices}
          isLast
        />
      </SettingsSection>

      <SettingsNote icon="hearing">
        Audio comes from the speech engine on your device. Once a voice is installed, it keeps
        reading offline — no audio leaves the device.
      </SettingsNote>

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
        <ScrollView
          style={{ maxHeight: listMaxHeight }}
          showsVerticalScrollIndicator
        >
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
