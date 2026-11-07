import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { computeStreak } from '../../data/streak';
import { exportJson } from '../../services/export';
import { MaterialIcons } from '../../components/Icon';
import { AppText, RevealItem, Screen, ToggleSwitch } from '../../components';
import { alpha, colors, fills, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import type { Deck } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const APP_VERSION = Constants.expoConfig?.version ?? '1.2.0';
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;

const PRESET_LABELS: Record<Deck['algorithmPreset'], string> = {
  fsrs: 'FSRS-6',
  fast: 'Fast repetition',
  general: 'Regular repetition',
};

const formatCount = (value: number) => value.toLocaleString('en-US');
const NUMERIC = { fontVariant: ['tabular-nums'] as const };

type RowProps = {
  icon: IconName;
  /** The glyph's colour; the tile itself stays a quiet control fill. */
  tone?: string;
  title: string;
  subtitle?: string;
  /** A short right-aligned state, e.g. "On" or the scheduler's name. */
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** The last row in a pane draws no divider. */
  last?: boolean;
};

/**
 * One settings line, v3: a 40px tile, a 15/600 title, a 13px subtitle and an
 * optional state. Rows that do something are buttons with a 64px minimum
 * target; switch rows stay inert containers so the switch owns the press.
 *
 * The divider starts at the title, not the card edge, so a pane reads as one
 * group instead of a stack of separate boxes.
 */
function SettingsLine({
  icon,
  tone = colors.primary,
  title,
  subtitle,
  value,
  onPress,
  trailing,
  last = false,
}: RowProps) {
  const [hovered, setHovered] = useState(false);

  const content = (
    <>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceControl,
          flexShrink: 0,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.lg} color={tone} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="bodySm" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        )}
      </View>

      {value && (
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {value}
        </AppText>
      )}
      {trailing}
      {onPress && (
        <MaterialIcons name="chevron-right" size={iconSize.lg} color={colors.outline} />
      )}
    </>
  );

  const baseStyle = {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  };

  return (
    <View>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          accessibilityRole="button"
          accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}${
            value ? `. ${value}` : ''
          }`}
          style={[baseStyle, hovered ? { backgroundColor: alpha(colors.surfaceTile, 0.5) } : null]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={baseStyle}>{content}</View>
      )}

      {!last && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 1, backgroundColor: colors.outlineVariant, marginStart: 68 }}
        />
      )}
    </View>
  );
}

type ChapterProps = {
  label: string;
  children: React.ReactNode;
};

/** A chapter title and its pane; the pane's radius matches a deck card. */
function Chapter({ label, children }: ChapterProps) {
  return (
    <View>
      <AppText
        variant="label"
        weight="semibold"
        tone="tertiary"
        headingLevel={2}
        className="uppercase"
        style={{ letterSpacing: 0.6, marginBottom: 10, paddingHorizontal: 4 }}
      >
        {label}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surfacePane,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Settings — v3 "Nocturne Focus".
 *
 * The index keeps its old content and behaviour, but the page now opens with
 * the same raised pane as Game: an eyebrow, the room's name, a status and a
 * three-cell ledger (cards, decks, scheduler). Below it each chapter is one
 * 22px pane of 64px lines, so the settings read as a desk drawer rather than a
 * form.
 *
 * Every route and switch is unchanged: the quiz sound and haptics switches keep
 * their exact accessible names, which the persistence flow relies on.
 */
export default function SettingsScreen() {
  const router = useRouter();

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const activeDecks = useMemo(() => decks.filter((deck) => !deck.archivedAt), [decks]);

  const totalCards = useMemo(
    () => activeDecks.reduce((sum, deck) => sum + (cardsByDeck[deck.id]?.length ?? 0), 0),
    [activeDecks, cardsByDeck]
  );

  const presetLabel = useMemo(() => {
    if (activeDecks.length === 0) return undefined;
    const [first] = activeDecks;
    const shared = activeDecks.every((deck) => deck.algorithmPreset === first.algorithmPreset);
    return shared ? PRESET_LABELS[first.algorithmPreset] : 'Per deck';
  }, [activeDecks]);

  const activeDeckIds = useMemo(() => new Set(activeDecks.map((deck) => deck.id)), [activeDecks]);
  const activeLog = useMemo(
    () => reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)),
    [reviewLog, activeDeckIds]
  );

  const xp = activeLog.length * XP_PER_REVIEW;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const streak = useMemo(() => computeStreak(activeLog.map((entry) => entry.reviewedAt)), [activeLog]);

  const handleExportAll = async () => {
    try {
      await exportJson('Memora export', {
        exportedAt: new Date().toISOString(),
        decks,
        cardsByDeck,
        reviewLog,
        settings,
      });
    } catch {
      // The user dismissed the share sheet.
    }
  };

  const header = (
    <View
      style={{
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingHorizontal: 20,
        backgroundColor: colors.appBarGlass,
      }}
    >
      <AppText
        variant="headline"
        weight="semibold"
        headingLevel={1}
        numberOfLines={1}
        style={{ letterSpacing: -0.4 }}
      >
        Settings
      </AppText>

      <Pressable
        onPress={() => pushOnce(router, '/profile')}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          }}
        >
          <MaterialIcons name="person" size={18} color={colors.onPrimary} />
        </View>
      </Pressable>
    </View>
  );

  const ledger = [
    { label: 'Cards', value: formatCount(totalCards) },
    { label: 'Decks', value: formatCount(activeDecks.length) },
    { label: 'Scheduler', value: presetLabel ?? '—' },
  ];

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={header}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <View
              testID="settings-hero"
              style={{
                backgroundColor: colors.surfaceCardFace,
                borderRadius: v3.radii.pane,
                borderWidth: 1,
                borderColor: alpha(colors.outlineSoft, 0.3),
                padding: 20,
                gap: 16,
              }}
            >
              <View style={{ gap: 6 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    tone="accent"
                    className="uppercase"
                    style={{ letterSpacing: 0.6 }}
                  >
                    Overview
                  </AppText>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: alpha(colors.success, 0.12),
                      borderWidth: 1,
                      borderColor: alpha(colors.success, 0.25),
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.success,
                      }}
                    />
                    <AppText variant="caption" tone="success">
                      On this device
                    </AppText>
                  </View>
                </View>

                <AppText weight="bold" style={v3.type.headlineMd}>
                  Your study room
                </AppText>
                <AppText variant="bodySm" tone="muted">
                  The scheduler, the voices and the archive.
                </AppText>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: colors.surfaceInset,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: alpha(colors.outlineSoft, 0.2),
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                }}
              >
                {ledger.map((cell, index) => (
                  <View
                    key={cell.label}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingStart: index === 0 ? 0 : 12,
                      borderStartWidth: index === 0 ? 0 : 1,
                      borderStartColor: colors.outlineVariant,
                    }}
                  >
                    <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                      {cell.label}
                    </AppText>
                    <AppText
                      variant="body"
                      weight="semibold"
                      numberOfLines={1}
                      style={[NUMERIC, { marginTop: 2 }]}
                    >
                      {cell.value}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          </RevealItem>

          <RevealItem index={1}>
            <Chapter label="Study">
              <SettingsLine
                icon="tune"
                title="Algorithm"
                subtitle="How reviews are scheduled"
                value={presetLabel}
                onPress={() => pushOnce(router, '/settings/algorithm')}
              />
              <SettingsLine
                icon="record-voice-over"
                title="Text-to-Speech"
                subtitle="Read cards aloud in two voices"
                value={settings.ttsEnabled ? 'On' : 'Off'}
                onPress={() => pushOnce(router, '/settings/tts')}
                last
              />
            </Chapter>
          </RevealItem>

          <RevealItem index={2}>
            <Chapter label="Game">
              <SettingsLine
                icon="volume-up"
                tone={colors.warning}
                title="Sound effects"
                subtitle="Cues for correct and wrong answers"
                trailing={
                  <ToggleSwitch
                    value={settings.soundEnabled !== false}
                    onToggle={(value) => updateSettings({ soundEnabled: value })}
                    accessibilityLabel="Quiz sound effects"
                  />
                }
              />
              <SettingsLine
                icon="vibration"
                tone={colors.warning}
                title="Haptics"
                subtitle="Taps for answers and combos"
                trailing={
                  <ToggleSwitch
                    value={settings.hapticsEnabled !== false}
                    onToggle={(value) => updateSettings({ hapticsEnabled: value })}
                    accessibilityLabel="Quiz haptics"
                  />
                }
                last
              />
            </Chapter>
          </RevealItem>

          <RevealItem index={3}>
            <Chapter label="Progress">
              <SettingsLine
                icon="person-outline"
                tone={colors.success}
                title="Profile"
                subtitle={
                  streak > 0
                    ? `Level ${level} · ${streak}-day streak`
                    : `Level ${level} · no streak yet`
                }
                onPress={() => pushOnce(router, '/profile')}
              />
              <SettingsLine
                icon="insights"
                tone={colors.success}
                title="Statistics"
                subtitle="Streak, knowledge and forecast"
                onPress={() => pushOnce(router, '/statistics')}
                last
              />
            </Chapter>
          </RevealItem>

          <RevealItem index={4}>
            <Chapter label="Data">
              <SettingsLine
                icon="cloud-off"
                title="Offline & install"
                subtitle="Study without a connection"
                value={settings.offlineCacheEnabled ? 'On' : 'Off'}
                onPress={() => pushOnce(router, '/settings/offline')}
              />
              <SettingsLine
                icon="upload"
                title="Export all data"
                subtitle="Decks, cards and review history"
                onPress={handleExportAll}
                last
              />
            </Chapter>
          </RevealItem>

          {__DEV__ && (
            <RevealItem index={5}>
              <Chapter label="Developer">
                <SettingsLine
                  icon="science"
                  tone={colors.warning}
                  title="Test data"
                  subtitle="Load, reset or wipe the library on this device"
                  onPress={() => pushOnce(router, '/dev')}
                  last
                />
              </Chapter>
            </RevealItem>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 4,
            }}
          >
            <MaterialIcons name="lock-outline" size={iconSize.sm} color={colors.outline} />
            <AppText variant="caption" tone="tertiary" style={{ flexShrink: 1 }}>
              Memora {APP_VERSION} · Exports are plain JSON. Keep a copy somewhere safe.
            </AppText>
          </View>
        </View>
      </View>
    </Screen>
  );
}
