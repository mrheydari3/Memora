import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { speak, stopSpeaking } from '../../services/tts';
import {
  AppText,
  BottomSheetModal,
  RevealItem,
  Screen,
  SheetScrollView,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import { alpha, colors, fills, glassFill, heights, iconSize, rims } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

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

function Stamp({
  label,
  color,
  rotate = -2,
}: {
  label: string;
  color: string;
  rotate?: number;
}) {
  return (
    <View
      style={{
        transform: [{ rotate: `${rotate}deg` }],
        borderRadius: 5,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(color, 0.5),
        backgroundColor: alpha(color, 0.06),
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <AppText
        variant="caption"
        weight="bold"
        style={{ color, letterSpacing: 0.9, textTransform: 'uppercase' }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** The round shelf stamp in the masthead, decorative and hidden from AT. */
function ReadingSeal() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.primary, 0.5),
        backgroundColor: alpha(colors.primary, 0.05),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-7deg' }],
        flexShrink: 0,
      }}
    >
      <MaterialIcons name="record-voice-over" size={iconSize.sm} color={colors.primary} />
      <AppText
        variant="caption"
        weight="bold"
        tone="accent"
        style={{ letterSpacing: 1.2, marginTop: 2 }}
      >
        READ
      </AppText>
      <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
        ALOUD
      </AppText>
    </View>
  );
}

type SettingsControlProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  isLast?: boolean;
  accent: string;
};

/**
 * The same growing settings row the Settings screen uses: the value is a small
 * ticket beside the title, never an ellipsized fixed-width column.
 */
function SettingsControl({
  icon,
  title,
  subtitle,
  value,
  onPress,
  trailing,
  isLast = false,
  accent,
}: SettingsControlProps) {
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 58,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: alpha(colors.onSurface, 0.07),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(accent, 0.12),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.md} color={accent} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 3,
          }}
        >
          <AppText variant="body" weight="medium" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          {value ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: alpha(accent, 0.24),
                backgroundColor: alpha(accent, 0.06),
                borderRadius: 5,
                paddingHorizontal: 6,
                paddingVertical: 2,
                maxWidth: '100%',
                flexShrink: 1,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: accent, letterSpacing: 0.4 }}
              >
                {value}
              </AppText>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {trailing ??
        (onPress ? (
          <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
        ) : null)}
    </View>
  );

  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? alpha(accent, 0.05) : 'transparent',
      })}
    >
      {row}
    </Pressable>
  );
}

function RoomSection({
  index,
  label,
  hint,
  color,
  first = false,
  children,
}: {
  index: string;
  label: string;
  hint: string;
  color: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: first ? 0 : 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            minWidth: 30,
            minHeight: 30,
            borderRadius: 9,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: alpha(color, 0.55),
            backgroundColor: alpha(color, 0.08),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <AppText
            variant="caption"
            weight="bold"
            style={{ color, fontVariant: ['tabular-nums'] }}
          >
            {index}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="label"
            weight="semibold"
            headingLevel={2}
            style={{ color, letterSpacing: 1.2 }}
          >
            {label}
          </AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {hint}
          </AppText>
        </View>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: alpha(color, 0.18),
          marginTop: 10,
          marginBottom: 10,
        }}
      />

      <View
        style={[
          glassFill,
          {
            borderRadius: 24,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: alpha(color, 0.55),
          }}
        />
        {children}
      </View>
    </View>
  );
}

function VoiceLeg({
  index,
  label,
  language,
  code,
  sample,
}: {
  index: string;
  label: string;
  language: string;
  code: string;
  sample: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          minWidth: 30,
          minHeight: 30,
          borderRadius: 9,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: alpha(colors.primary, 0.5),
          backgroundColor: alpha(colors.primary, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          flexShrink: 0,
        }}
      >
        <AppText
          variant="caption"
          weight="bold"
          tone="accent"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {index}
        </AppText>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
          {label}
        </AppText>
        <AppText variant="headline" style={{ marginTop: 2 }}>
          {language}
        </AppText>
        <AppText
          variant="bodySm"
          tone="muted"
          language={code}
          style={{ marginTop: 4 }}
        >
          “{sample}”
        </AppText>
      </View>
    </View>
  );
}

/** The front → back route inside the pass, drawn rather than described. */
function VoiceConnector() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 10,
        marginLeft: 40,
      }}
    >
      <View
        style={{
          flex: 1,
          height: 1,
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderTopColor: alpha(colors.onSurface, 0.18),
        }}
      />
      <MaterialIcons name="south" size={iconSize.sm} color={colors.outline} />
    </View>
  );
}

function ReadingNote() {
  return (
    <View
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.primary, 0.24),
        backgroundColor: alpha(colors.primary, 0.04),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        transform: [{ rotate: '-0.6deg' }],
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.primary, 0.12),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name="hearing" size={iconSize.sm} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="caption"
          weight="bold"
          tone="accent"
          style={{ letterSpacing: 1 }}
        >
          Reading note
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          Audio comes from the speech engine on your device. Once a voice is installed, it keeps
          reading offline — no audio leaves the device.
        </AppText>
      </View>
    </View>
  );
}

/**
 * One language row in the picker sheet. It is deliberately not the fixed-height
 * ListRow: at 200% text size a language name has to wrap and grow instead of
 * being ellipsized.
 */
function LanguageRow({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: selected ? colors.accentFaint : fills.inset,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={({ pressed }) => ({
          minHeight: 52,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: pressed ? alpha(colors.primary, 0.06) : 'transparent',
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? alpha(colors.primary, 0.16) : fills.tile,
            flexShrink: 0,
          }}
        >
          <MaterialIcons
            name="translate"
            size={iconSize.md}
            color={selected ? colors.primary : colors.onSurfaceVariant}
          />
        </View>
        <AppText
          variant="body"
          weight="medium"
          style={{ flex: 1, minWidth: 0 }}
        >
          {name}
        </AppText>
        {selected ? (
          <MaterialIcons name="check" size={iconSize.md} color={colors.primary} />
        ) : null}
      </Pressable>
    </View>
  );
}

export default function TTSSettingsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { settings, update } = useSettingsStore();
  const [pickerField, setPickerField] = useState<'front' | 'back' | null>(null);

  // Leaving the screen should never leave a sample talking in the background.
  useEffect(() => () => void stopSpeaking(), []);

  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const shortCode = (code: string) => code.split('-')[0]?.toUpperCase() ?? code;

  const front = settings.ttsFrontVoiceLang;
  const back = settings.ttsBackVoiceLang;
  const frontSample = SAMPLES[front] ?? SAMPLES['en-US'];
  const backSample = SAMPLES[back] ?? SAMPLES['en-US'];
  const route = `${shortCode(front)} → ${shortCode(back)}`;

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

  const ledger: { label: string; value: string }[] = [
    { label: 'Route', value: route },
    { label: 'Mode', value: settings.ttsAutoPlay ? 'Automatic' : 'On tap' },
    { label: 'Reads', value: settings.ttsReadWholeCard ? 'Whole card' : 'Front only' },
  ];

  const masthead = (
    <View style={{ paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="auto-awesome" size={iconSize.sm} color={colors.primary} />
            <AppText
              variant="caption"
              weight="bold"
              tone="accent"
              style={{ letterSpacing: 1.4 }}
            >
              Study room · 05.2
            </AppText>
          </View>
        </View>
        <ReadingSeal />
      </View>

      <AppText variant="title" headingLevel={2} style={{ marginTop: 8 }}>
        The reading room.
      </AppText>
      <AppText variant="bodySm" tone="muted" style={{ marginTop: 6, maxWidth: 540 }}>
        One card, two voices. Each side is read in the language it was written in — by the
        speech engine already on this device.
      </AppText>
    </View>
  );

  const voicePass = (
    <View style={{ position: 'relative' }}>
      <View
        style={[
          glassFill,
          {
            borderRadius: v2.radii.pane,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: alpha(colors.primary, 0.12),
            right: -92,
            top: -108,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 170,
            height: 170,
            borderRadius: 85,
            backgroundColor: alpha(colors.warning, 0.07),
            left: -82,
            bottom: -108,
          }}
        />

        <View style={{ padding: v2.spacing.panel }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons
                name="confirmation-number"
                size={iconSize.sm}
                color={colors.primary}
              />
              <AppText
                variant="caption"
                weight="bold"
                tone="accent"
                style={{ letterSpacing: 1.1 }}
              >
                Voice pass
              </AppText>
            </View>
            <Stamp
              label={settings.ttsEnabled ? 'Per card' : 'Muted'}
              color={settings.ttsEnabled ? colors.success : colors.outline}
              rotate={-2}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <AppText
              variant="headline"
              headingLevel={3}
              style={{ flexShrink: 1 }}
            >
              Two voices, one card.
            </AppText>
            <AppText
              variant="caption"
              tone="muted"
              style={{ letterSpacing: 1, fontVariant: ['tabular-nums'] }}
            >
              PASS 02
            </AppText>
          </View>

          <View style={{ marginTop: 14 }}>
            <VoiceLeg
              index="01"
              label="Front voice"
              language={langName(front)}
              code={front}
              sample={frontSample}
            />
            <VoiceConnector />
            <VoiceLeg
              index="02"
              label="Back voice"
              language={langName(back)}
              code={back}
              sample={backSample}
            />
          </View>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.18),
              paddingTop: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {ledger.map((entry) => (
              <View key={entry.label} style={{ flexGrow: 1, flexBasis: 140, minWidth: 0 }}>
                <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
                  {entry.label}
                </AppText>
                <AppText
                  variant="bodySm"
                  weight="semibold"
                  style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
                >
                  {entry.value}
                </AppText>
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.14),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {Array.from({ length: 14 }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index % 4 === 0 ? 3 : 2,
                    height: index % 3 === 0 ? 14 : 9,
                    backgroundColor: alpha(colors.onSurfaceVariant, 0.45),
                  }}
                />
              ))}
            </View>
            <AppText variant="caption" tone="muted" style={{ letterSpacing: 1 }}>
              SHELF 05.2
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );

  const playbackSection = (
    <RoomSection
      index="01"
      label="Playback"
      hint="When the room speaks"
      color={colors.primary}
      first
    >
      <SettingsControl
        accent={colors.primary}
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
      <SettingsControl
        accent={colors.primary}
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
      <SettingsControl
        accent={colors.primary}
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
    </RoomSection>
  );

  const voicesSection = (
    <RoomSection
      index="02"
      label="Voices"
      hint="A language for each side"
      color={colors.primary}
    >
      <SettingsControl
        accent={colors.primary}
        icon="translate"
        title="Front language"
        value={langName(front)}
        onPress={() => setPickerField('front')}
      />
      <SettingsControl
        accent={colors.primary}
        icon="translate"
        title="Back language"
        value={langName(back)}
        onPress={() => setPickerField('back')}
        isLast
      />
    </RoomSection>
  );

  const soundCheckSection = (
    <RoomSection
      index="03"
      label="Sound check"
      hint="Hear both voices"
      color={colors.primary}
    >
      <Pressable
        onPress={previewVoices}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: pressed ? alpha(colors.primary, 0.05) : 'transparent',
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            minHeight: 88,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: alpha(colors.primary, 0.14),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MaterialIcons name="play-arrow" size={iconSize.lg} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="body" weight="semibold">
              Preview voices
            </AppText>
            <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
              Hear a sample in both languages.
            </AppText>
            <AppText
              variant="caption"
              tone="accent"
              style={{ marginTop: 6, letterSpacing: 0.6 }}
            >
              Front first, then back
            </AppText>
          </View>
        </View>
      </Pressable>
    </RoomSection>
  );

  const sections = (
    <View>
      {playbackSection}
      {voicesSection}
      {soundCheckSection}
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Speech" back />}
    >
      <View style={{ paddingBottom: 48 }}>
        <RevealItem index={0}>{masthead}</RevealItem>

        <View
          style={{
            marginTop: 24,
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'flex-start' : 'stretch',
            gap: wide ? 32 : 24,
          }}
        >
          <View style={{ width: wide ? 400 : undefined, flexShrink: 0 }}>
            <RevealItem index={1}>{voicePass}</RevealItem>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <RevealItem index={2}>{sections}</RevealItem>
            <RevealItem index={3}>
              <ReadingNote />
            </RevealItem>
          </View>
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
        <SheetScrollView style={{ maxHeight: heights.sheetList }}>
          <View style={{ gap: 6 }}>
            {LANGUAGES.map((lang) => (
              <LanguageRow
                key={lang.code}
                name={lang.name}
                selected={lang.code === active}
                onPress={async () => {
                  if (pickerField === 'back') await update({ ttsBackVoiceLang: lang.code });
                  else if (pickerField === 'front') await update({ ttsFrontVoiceLang: lang.code });
                  setPickerField(null);
                }}
              />
            ))}
          </View>
        </SheetScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
