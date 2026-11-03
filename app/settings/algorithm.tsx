import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import {
  MAX_INTERVAL_OPTIONS,
  RETENTION_HEAVY,
  RETENTION_MAX,
  RETENTION_MIN,
  RETENTION_STEP,
  formatMaxInterval,
  resolveFsrsParams,
} from '../../data/fsrs-params';
import {
  AppText,
  BottomSheetModal,
  Button,
  ListRow,
  PrimaryButton,
  RevealItem,
  Screen,
  SettingsCard,
  Stepper,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import type { Deck } from '../../data/types';
import { alpha, colors, fills, glassFill, iconSize, rims } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type PresetId = Deck['algorithmPreset'];
type Sheet = 'retention' | 'interval' | 'new' | 'max' | 'applyAll' | null;

type Preset = {
  id: PresetId;
  title: string;
  icon: IconName;
  short: string;
  description: string;
};

const PRESETS: readonly Preset[] = [
  {
    id: 'fsrs',
    title: 'FSRS',
    icon: 'psychology',
    short: 'Memory-model scheduling that adapts to every card.',
    description:
      'FSRS-6 models each card’s difficulty and stability, then schedules it just before you would forget it — more recall from fewer reviews.',
  },
  {
    id: 'fast',
    title: 'Fast Repetition',
    icon: 'bolt',
    short: 'No dates, no queue. Every card stays available.',
    description:
      'Cards stay available in order, with no dates. A quick pass through material you already know.',
  },
  {
    id: 'general',
    title: 'Regular Repetition',
    icon: 'event-repeat',
    short: 'Classic SM-2 intervals for older decks.',
    description:
      'The classic SM-2 algorithm: easy cards appear less often, hard ones more. Kept for decks created before FSRS became the default.',
  },
];

/** What the screen writes. A local copy keeps the preview alive with no deck. */
type Tuning = {
  preset: PresetId;
  retention: number;
  maximumInterval: number;
  fuzz: boolean;
  newPerDay: number;
  maxPerDay: number;
  shuffle: boolean;
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

function EngineSeal() {
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
      <MaterialIcons name="tune" size={iconSize.sm} color={colors.primary} />
      <AppText
        variant="caption"
        weight="bold"
        tone="accent"
        style={{ letterSpacing: 1.2, marginTop: 2 }}
      >
        TUNED
      </AppText>
      <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
        BY YOU
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

function PresetCard({
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      aria-checked={selected}
      style={({ pressed }) => ({
        borderRadius: 18,
        backgroundColor: selected ? alpha(colors.primary, 0.12) : fills.inset,
        borderWidth: 1,
        borderColor: selected ? alpha(colors.primary, 0.45) : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected
                ? alpha(colors.primary, 0.16)
                : alpha(colors.onSurface, 0.05),
              flexShrink: 0,
            }}
          >
            <MaterialIcons
              name={icon}
              size={iconSize.md}
              color={selected ? colors.primary : colors.onSurfaceVariant}
            />
          </View>
          <AppText variant="body" weight="semibold" style={{ flex: 1, minWidth: 0 }}>
            {title}
          </AppText>
          <MaterialIcons
            name={selected ? 'check-circle' : 'radio-button-unchecked'}
            size={iconSize.md}
            color={selected ? colors.primary : colors.outlineSoft}
          />
        </View>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 8 }}>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

function DeckTicket({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? alpha(colors.primary, 0.5) : alpha(colors.onSurface, 0.12),
        backgroundColor: active ? alpha(colors.primary, 0.12) : fills.inset,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText variant="bodySm" weight="medium" tone={active ? 'accent' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function TuningNote() {
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
        <MaterialIcons name="psychology" size={iconSize.sm} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="caption"
          weight="bold"
          tone="accent"
          style={{ letterSpacing: 1 }}
        >
          Tuning note
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          FSRS-6 · 21 parameters. Scheduling follows the memory model instead of hand-tuned
          intervals.
        </AppText>
      </View>
    </View>
  );
}

export default function AlgorithmSettingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const decks = useDeckStore((s) => s.decks);
  const updateDeck = useDeckStore((s) => s.updateDeck);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState<Tuning | null>(null);

  // Decks load asynchronously; keep a valid selection as the library changes.
  useEffect(() => {
    if (decks.length === 0) return;
    if (!selectedDeckId || !decks.some((d) => d.id === selectedDeckId)) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  const deck = decks.find((d) => d.id === selectedDeckId) ?? decks[0];
  const deckId = deck?.id ?? null;
  const params = resolveFsrsParams(deck ?? {});

  // A different deck starts a fresh readout, never the previous deck's draft.
  useEffect(() => {
    setDraft(null);
  }, [deckId]);

  const view: Tuning = draft ?? {
    preset: deck?.algorithmPreset ?? 'fsrs',
    retention: params.requestRetention,
    maximumInterval: params.maximumInterval,
    fuzz: params.enableFuzz,
    newPerDay: deck?.newCardsPerDay ?? 20,
    maxPerDay: deck?.maxCardsPerDay ?? 80,
    shuffle: deck?.shuffleCards ?? true,
  };

  /**
   * Update the readout immediately, then persist the same fields on the real
   * deck. With no deck (an empty library) the controls still respond, so the
   * screen stays usable before the first deck exists.
   */
  const tune = (partial: Partial<Tuning>) => {
    setDraft({ ...view, ...partial });
    if (!deck) return;

    const patch: Parameters<typeof updateDeck>[1] = {};
    if (partial.preset !== undefined) patch.algorithmPreset = partial.preset;
    if (partial.retention !== undefined) patch.requestRetention = partial.retention;
    if (partial.maximumInterval !== undefined) patch.maximumInterval = partial.maximumInterval;
    if (partial.fuzz !== undefined) patch.enableFuzz = partial.fuzz;
    if (partial.newPerDay !== undefined) patch.newCardsPerDay = partial.newPerDay;
    if (partial.maxPerDay !== undefined) patch.maxCardsPerDay = partial.maxPerDay;
    if (partial.shuffle !== undefined) patch.shuffleCards = partial.shuffle;
    void updateDeck(deck.id, patch);
  };

  /** Copy this pass to every deck in the library. */
  const applyToAll = async () => {
    const shared: Parameters<typeof updateDeck>[1] = {
      algorithmPreset: view.preset,
      requestRetention: view.retention,
      maximumInterval: view.maximumInterval,
      enableFuzz: view.fuzz,
      enableShortTerm: params.enableShortTerm,
      fsrsLearningSteps: params.fsrsLearningSteps,
      fsrsRelearningSteps: params.fsrsRelearningSteps,
      newCardsPerDay: view.newPerDay,
      maxCardsPerDay: view.maxPerDay,
      shuffleCards: view.shuffle,
    };
    if (deck) {
      shared.learningSteps = deck.learningSteps;
      shared.masteredIntervalMultiplier = deck.masteredIntervalMultiplier;
    }
    for (const d of decks) await updateDeck(d.id, shared);
    setDraft(null);
    setSheet(null);
  };

  const preset = view.preset;
  const presetMeta = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const retention = Math.round(view.retention * 100);

  const ledger: { label: string; value: string }[] =
    preset === 'fsrs'
      ? [
          { label: 'Retention', value: `${retention}%` },
          { label: 'Max interval', value: formatMaxInterval(view.maximumInterval) },
          { label: 'Daily limit', value: `${view.newPerDay} new · ${view.maxPerDay} total` },
        ]
      : preset === 'general'
        ? [
            { label: 'Learning steps', value: `${deck?.learningSteps.length ?? 0} steps` },
            { label: 'Starting multiplier', value: `× ${deck?.masteredIntervalMultiplier ?? 2.5}` },
            { label: 'Daily limit', value: `${view.newPerDay} new · ${view.maxPerDay} total` },
          ]
        : [
            { label: 'Schedule', value: 'No dates, no queue' },
            { label: 'Daily limit', value: `${view.maxPerDay} cards` },
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
              Study room · 05.1
            </AppText>
          </View>
        </View>
        <EngineSeal />
      </View>

      <AppText variant="title" headingLevel={2} style={{ marginTop: 8 }}>
        The engine room.
      </AppText>
      <AppText variant="bodySm" tone="muted" style={{ marginTop: 6, maxWidth: 540 }}>
        One model, a few numbers, and a pass you can read at a glance. Nothing here runs on luck.
      </AppText>
    </View>
  );

  const schedulerPass = (
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
                Scheduler pass
              </AppText>
            </View>
            <Stamp label="Per deck" color={colors.success} rotate={-2} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="headline">{deck?.name ?? 'No deck yet'}</AppText>
              <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
                {presetMeta.short}
              </AppText>
            </View>
            <AppText
              variant="caption"
              tone="muted"
              style={{ letterSpacing: 1, fontVariant: ['tabular-nums'] }}
            >
              PASS 01
            </AppText>
          </View>

          <View
            style={{
              flexDirection: wide ? 'row' : 'column',
              alignItems: wide ? 'center' : 'flex-start',
              gap: 16,
              marginTop: 14,
            }}
          >
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: alpha(colors.primary, 0.4),
                backgroundColor: alpha(colors.primary, 0.04),
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                alignSelf: wide ? 'flex-start' : 'center',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  left: 66,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.warning,
                }}
              />
              {preset === 'fsrs' ? (
                <>
                  <AppText
                    variant="display"
                    style={[
                      v2.type.display,
                      { color: colors.primary, fontVariant: ['tabular-nums'] },
                    ]}
                  >
                    {retention}
                  </AppText>
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={{ letterSpacing: 1.3, marginTop: -2 }}
                  >
                    % TARGET
                  </AppText>
                </>
              ) : (
                <>
                  <AppText
                    variant="headline"
                    style={{ color: colors.primary, fontSize: 28, lineHeight: 32 }}
                  >
                    {preset === 'fast' ? '∞' : 'SM-2'}
                  </AppText>
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={{ letterSpacing: 1.1, marginTop: 2 }}
                  >
                    {preset === 'fast' ? 'NO SCHEDULE' : 'CLASSIC'}
                  </AppText>
                </>
              )}
            </View>

            <View
              style={{
                flex: wide ? 1 : undefined,
                width: wide ? undefined : '100%',
                minWidth: 0,
              }}
            >
              {preset === 'fsrs' ? (
                <>
                  <AppText variant="headline" headingLevel={3}>
                    The edge of recall.
                  </AppText>
                  <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
                    Every review teaches FSRS how this card behaves. The next date lands just
                    before you would forget it.
                  </AppText>
                  <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                    <Stamp label="Adaptive" color={colors.primary} rotate={-1.5} />
                  </View>
                </>
              ) : preset === 'fast' ? (
                <>
                  <AppText variant="headline" headingLevel={3}>
                    No dates, no queue.
                  </AppText>
                  <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
                    Cards stay available in order. A session is a quick pass through what you
                    already know.
                  </AppText>
                  <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                    <Stamp label="Stateless" color={colors.warning} rotate={-1.5} />
                  </View>
                </>
              ) : (
                <>
                  <AppText variant="headline" headingLevel={3}>
                    The classic curve.
                  </AppText>
                  <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
                    Easy cards appear less often, hard ones more. Kept for decks created before
                    FSRS became the default.
                  </AppText>
                  <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                    <Stamp label="Legacy" color={colors.tertiary} rotate={-1.5} />
                  </View>
                </>
              )}
            </View>
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
              <View key={entry.label} style={{ flexGrow: 1, flexBasis: 120, minWidth: 0 }}>
                <AppText
                  variant="caption"
                  tone="muted"
                  style={{ letterSpacing: 0.8 }}
                >
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
              SHELF 05.1
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );

  const deckPicker =
    decks.length > 1 ? (
      <View style={{ marginBottom: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <AppText variant="caption" weight="bold" tone="accent" style={{ letterSpacing: 1.1 }}>
            Deck
          </AppText>
          <AppText variant="caption" tone="muted">
            The pass follows this deck
          </AppText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {decks.map((d) => (
            <DeckTicket
              key={d.id}
              label={d.name}
              active={d.id === deck?.id}
              onPress={() => {
                setSelectedDeckId(d.id);
                setDraft(null);
              }}
            />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const presetSection = (
    <RoomSection index="01" label="Scheduler" hint="Pick the model" color={colors.primary} first>
      <View style={{ padding: 12, gap: 10 }}>
        {PRESETS.map((p) => (
          <PresetCard
            key={p.id}
            icon={p.icon}
            title={p.title}
            description={p.description}
            selected={preset === p.id}
            onSelect={() => tune({ preset: p.id })}
          />
        ))}
      </View>
    </RoomSection>
  );

  const fsrsSection = (
    <RoomSection
      index="02"
      label="FSRS parameters"
      hint="The memory model"
      color={colors.primary}
    >
      <SettingsControl
        accent={colors.primary}
        icon="track-changes"
        title="Desired retention"
        subtitle="Higher means more reviews, stronger recall"
        onPress={() => setSheet('retention')}
        value={`${retention}%`}
      />
      <SettingsControl
        accent={colors.primary}
        icon="timeline"
        title="Maximum interval"
        subtitle="Longest gap FSRS may schedule"
        onPress={() => setSheet('interval')}
        value={formatMaxInterval(view.maximumInterval)}
      />
      <SettingsControl
        accent={colors.primary}
        icon="shuffle"
        title="Fuzz intervals"
        subtitle="Spread due dates so reviews don't clump"
        trailing={
          <ToggleSwitch
            value={view.fuzz}
            onToggle={(v) => tune({ fuzz: v })}
            accessibilityLabel="Fuzz intervals"
          />
        }
      />
      <SettingsControl
        accent={colors.primary}
        icon="tune"
        title="Learning steps"
        subtitle="Then FSRS takes over long-term scheduling"
        value={
          params.fsrsLearningSteps.length > 0 ? params.fsrsLearningSteps.join(' → ') : 'Auto'
        }
        onPress={() =>
          deck &&
          pushOnce(router, {
            pathname: '/settings/algorithm-advanced',
            params: { deckId: deck.id },
          })
        }
        isLast
      />
    </RoomSection>
  );

  const legacySection = (
    <RoomSection index="02" label="Legacy SM-2" hint="No memory model" color={colors.primary}>
      <SettingsControl
        accent={colors.primary}
        icon="history"
        title="Learning steps and intervals"
        subtitle="Classic SM-2 tuning — no memory model"
        onPress={() =>
          deck &&
          pushOnce(router, {
            pathname: '/settings/algorithm-advanced',
            params: { deckId: deck.id },
          })
        }
        isLast
      />
    </RoomSection>
  );

  const fastSection = (
    <RoomSection index="02" label="Fast repetition" hint="No dates" color={colors.primary}>
      <View style={{ padding: 16 }}>
        <AppText variant="bodySm" tone="muted">
          This preset has no schedule: cards are never given a due date and the review buttons
          only reorder the current session.
        </AppText>
      </View>
    </RoomSection>
  );

  const dailySection = (
    <RoomSection index="03" label="Daily limits" hint="How much one day holds" color={colors.primary}>
      <SettingsControl
        accent={colors.primary}
        icon="add-circle-outline"
        title="New cards per day"
        onPress={() => setSheet('new')}
        value={String(view.newPerDay)}
      />
      <SettingsControl
        accent={colors.primary}
        icon="stacked-bar-chart"
        title="Maximum cards per day"
        subtitle="Learning steps don't count against this"
        onPress={() => setSheet('max')}
        value={String(view.maxPerDay)}
      />
      <SettingsControl
        accent={colors.primary}
        icon="shuffle"
        title="Shuffle cards"
        subtitle="Mix reviews across the deck"
        trailing={
          <ToggleSwitch
            value={view.shuffle}
            onToggle={(v) => tune({ shuffle: v })}
            accessibilityLabel="Shuffle Cards"
          />
        }
        isLast
      />
    </RoomSection>
  );

  const sections = (
    <View>
      {presetSection}
      {preset === 'fsrs' ? fsrsSection : preset === 'general' ? legacySection : fastSection}
      {dailySection}
    </View>
  );

  const footer = (
    <View>
      {decks.length > 1 && (
        <View style={{ marginTop: 24 }}>
          <Button
            variant="secondary"
            label="Apply these settings to all decks"
            icon="copy-all"
            onPress={() => setSheet('applyAll')}
          />
        </View>
      )}
      {preset === 'fsrs' && <TuningNote />}
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Algorithm" back />}
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
            <RevealItem index={1}>{schedulerPass}</RevealItem>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <RevealItem index={2}>{deckPicker}</RevealItem>
            <RevealItem index={3}>{sections}</RevealItem>
            <RevealItem index={4}>{footer}</RevealItem>
          </View>
        </View>
      </View>

      <BottomSheetModal
        visible={sheet === 'retention'}
        onClose={() => setSheet(null)}
        title="Desired retention"
        subtitle="The recall probability FSRS aims for on each review."
      >
        <Stepper
          className="mb-3"
          value={
            <AppText variant="display" weight="bold">
              {retention}%
            </AppText>
          }
          decrementLabel="Decrease retention"
          incrementLabel="Increase retention"
          onDecrease={() =>
            tune({
              retention: Math.max(
                RETENTION_MIN,
                Math.round((view.retention - RETENTION_STEP) * 100) / 100
              ),
            })
          }
          onIncrease={() =>
            tune({
              retention: Math.min(
                RETENTION_MAX,
                Math.round((view.retention + RETENTION_STEP) * 100) / 100
              ),
            })
          }
        />
        <AppText variant="bodySm" tone="muted" className="mb-4">
          {view.retention >= RETENTION_HEAVY
            ? 'Above 95% the review load grows quickly for very little extra recall.'
            : '90% is the Anki default. Lower means fewer reviews, slightly weaker recall.'}
        </AppText>
        <PrimaryButton label="Done" onPress={() => setSheet(null)} />
      </BottomSheetModal>

      <BottomSheetModal
        visible={sheet === 'interval'}
        onClose={() => setSheet(null)}
        title="Maximum interval"
        subtitle="Caps how far into the future a card can be scheduled."
      >
        <SettingsCard>
          {MAX_INTERVAL_OPTIONS.map((days, i) => (
            <ListRow
              key={days}
              title={formatMaxInterval(days)}
              tile="none"
              density="compact"
              showChevron={false}
              highlighted={view.maximumInterval === days}
              divider={i < MAX_INTERVAL_OPTIONS.length - 1}
              trailing={
                view.maximumInterval === days ? (
                  <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
                ) : undefined
              }
              onPress={() => tune({ maximumInterval: days })}
              accessibilityLabel={formatMaxInterval(days)}
            />
          ))}
        </SettingsCard>
        <View className="mt-4">
          <PrimaryButton label="Done" onPress={() => setSheet(null)} />
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        visible={sheet === 'new' || sheet === 'max'}
        onClose={() => setSheet(null)}
        title={sheet === 'max' ? 'Maximum cards per day' : 'New cards per day'}
      >
        <Stepper
          className="mb-5"
          value={
            <AppText variant="display" weight="bold">
              {sheet === 'max' ? view.maxPerDay : view.newPerDay}
            </AppText>
          }
          decrementLabel="Decrease"
          incrementLabel="Increase"
          onDecrease={() =>
            tune(
              sheet === 'max'
                ? { maxPerDay: Math.max(10, view.maxPerDay - 10) }
                : { newPerDay: Math.max(5, view.newPerDay - 5) }
            )
          }
          onIncrease={() =>
            tune(
              sheet === 'max'
                ? { maxPerDay: Math.min(9999, view.maxPerDay + 10) }
                : { newPerDay: Math.min(500, view.newPerDay + 5) }
            )
          }
        />
        <PrimaryButton label="Done" onPress={() => setSheet(null)} />
      </BottomSheetModal>

      <BottomSheetModal
        visible={sheet === 'applyAll'}
        onClose={() => setSheet(null)}
        title="Apply to all decks"
        subtitle="Every deck will use this deck's scheduler, parameters and daily limits."
      >
        <PrimaryButton label={`Apply to ${decks.length} decks`} onPress={applyToAll} />
      </BottomSheetModal>
    </Screen>
  );
}
