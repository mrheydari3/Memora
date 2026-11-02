import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { speak, stopSpeaking } from '../../services/tts';
import {
  AppText,
  Screen,
  TopAppBar,
  SettingsPlate,
  SettingsSection,
  SettingsRow,
  SettingsNote,
  ToggleSwitch,
  BottomSheetModal,
  SheetScrollView,
  ListRow,
  RevealItem,
} from '../../components';
import { colors, heights, iconSize } from '../../theme/tokens';

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

export default function TTSSettingsScreen() {
  const { settings, update } = useSettingsStore();
  const [pickerField, setPickerField] = useState<'front' | 'back' | null>(null);

  // Leaving the screen should never leave a sample talking in the background.
  useEffect(() => () => void stopSpeaking(), []);

  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

  const active =
    pickerField === 'back' ? settings.ttsBackVoiceLang : settings.ttsFrontVoiceLang;

  const previewVoices = () => {
    void stopSpeaking();
    const front = SAMPLES[settings.ttsFrontVoiceLang] ?? SAMPLES['en-US'];
    const back = SAMPLES[settings.ttsBackVoiceLang] ?? SAMPLES['en-US'];
    void speak({
      text: front,
      language: settings.ttsFrontVoiceLang,
      onDone: () => {
        void speak({ text: back, language: settings.ttsBackVoiceLang });
      },
    });
  };

  return (
    <Screen scroll gutter header={<TopAppBar title="Text-to-Speech" back />}>
      <RevealItem index={0}>
      <SettingsPlate
        icon="record-voice-over"
        eyebrow="Text-to-Speech"
        status={
          settings.ttsEnabled
            ? { label: 'Speaking', tone: 'success' }
            : { label: 'Muted', tone: 'muted' }
        }
        title="Two voices, one card"
        description="Each side is read in its own language by the speech engine on this device."
        ledger={[
          { label: 'Front voice', value: langName(settings.ttsFrontVoiceLang) },
          { label: 'Back voice', value: langName(settings.ttsBackVoiceLang) },
          { label: 'Playback', value: settings.ttsAutoPlay ? 'Automatic' : 'On tap' },
        ]}
      />
      </RevealItem>

      <SettingsSection label="Playback" index={1}>
        <SettingsRow
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
        <SettingsRow
          icon="volume-up"
          title="Read entire card"
          subtitle="Reads the whole card when nothing is selected"
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
          title="Automatic playback"
          subtitle="Starts speaking as soon as a card appears"
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
          title="Front language"
          value={langName(settings.ttsFrontVoiceLang)}
          onPress={() => setPickerField('front')}
        />
        <SettingsRow
          icon="translate"
          title="Back language"
          value={langName(settings.ttsBackVoiceLang)}
          onPress={() => setPickerField('back')}
        />
        <SettingsRow
          icon="hearing"
          title="Preview voices"
          subtitle="Hear a sample in both languages"
          onPress={previewVoices}
          trailing={<MaterialIcons name="play-arrow" size={iconSize.md} color={colors.primary} />}
          isLast
        />
      </SettingsSection>

      <SettingsNote icon="record-voice-over">
        Audio comes from the speech engine on your device, so it works offline once the voice is
        installed.
      </SettingsNote>

      {/* Language picker sheet */}
      <BottomSheetModal
        visible={pickerField !== null}
        onClose={() => setPickerField(null)}
        title={pickerField === 'back' ? 'Back language' : 'Front language'}
      >
        <SheetScrollView style={{ maxHeight: heights.sheetList }}>
          {LANGUAGES.map((lang) => {
            const selected = lang.code === active;
            return (
              <View key={lang.code} className="mb-1">
                <ListRow
                  title={lang.name}
                  tile="none"
                  density="compact"
                  divider
                  trailing={
                    selected ? (
                      <MaterialIcons name="check" size={iconSize.md} color={colors.primary} />
                    ) : undefined
                  }
                  onPress={async () => {
                    if (pickerField === 'back') await update({ ttsBackVoiceLang: lang.code });
                    else if (pickerField === 'front') await update({ ttsFrontVoiceLang: lang.code });
                    setPickerField(null);
                  }}
                  accessibilityLabel={lang.name}
                  highlighted={selected}
                  className="rounded-md"
                />
              </View>
            );
          })}
        </SheetScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
