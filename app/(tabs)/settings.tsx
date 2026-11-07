import { useMemo } from 'react';
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
import { SettingsChapter as Chapter, SettingsLine, Surface } from '../../components/v3';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import type { Deck } from '../../data/types';

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
            <Surface tone="scene" testID="settings-hero" style={{ gap: 16 }}>
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
            </Surface>
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
