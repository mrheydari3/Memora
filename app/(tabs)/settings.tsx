import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { pushOnce } from '../../services/navigation';
import { HAPTICS_REPAIR_MODE } from '../../services/haptics';
import { useDeckStore } from '../../store/useDeckStore';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { loadReviewLog } from '../../data/repository';
import { schedulerLabel } from '../../data/schedulers';
import { exportJson } from '../../services/export';
import { MaterialIcons } from '../../components/Icon';
import { AppText, RevealItem, Screen, ToggleSwitch } from '../../components';
import {
  PageHeader,
  SettingsChapter as Chapter,
  SettingsHero,
  SettingsLine,
} from '../../components/v3';
import { colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

const APP_VERSION = Constants.expoConfig?.version;

const formatCount = (value: number) => value.toLocaleString('en-US');

/**
 * Settings — v3 "Nocturne Focus".
 *
 * Configuration only: the page opens with the shared SettingsHero — an eyebrow,
 * the room's name, a status and a three-cell ledger (cards, decks, scheduler).
 * Below it each chapter is one 22px pane of 64px lines, so the settings read as
 * a desk drawer rather than a form. Progress and Statistics live on Profile;
 * Settings never duplicates them.
 *
 * The interaction chapter owns the global haptics preference; the game chapter
 * keeps its sound switch. The switches keep the accessible names the
 * persistence flow relies on.
 */
export default function SettingsScreen() {
  const router = useRouter();

  const decks = useDeckStore((s) => s.decks);
  const folders = useDeckStore((s) => s.folders);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const gameRecords = useGameStore((s) => s.records);
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
    return shared ? schedulerLabel(first.algorithmPreset) : 'Per deck';
  }, [activeDecks]);

  const handleExportAll = async () => {
    try {
      // Read the log on demand: Settings renders no progression state, but the
      // export still contains the complete history.
      const reviewLog = await loadReviewLog();
      await exportJson('Memora export', {
        format: 'memora-backup',
        version: 1,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        decks,
        folders,
        cardsByDeck,
        reviewLog,
        gameRecords,
        settings,
      });
    } catch {
      // The user dismissed the share sheet.
    }
  };

  const header = <PageHeader title="Settings" />;

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
            <SettingsHero
              testID="settings-hero"
              eyebrow="Overview"
              status={{ label: 'On this device' }}
              title="Your study room"
              description="The scheduler, the voices and the archive."
              ledger={ledger}
            />
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
            <Chapter label="Interaction">
              <SettingsLine
                icon="vibration"
                tone={colors.warning}
                title="Haptic Feedback"
                subtitle={
                  HAPTICS_REPAIR_MODE
                    ? 'In repair — tactile feedback is temporarily paused.'
                    : 'Tactile feedback for navigation, actions and learning interactions.'
                }
                trailing={
                  <ToggleSwitch
                    value={HAPTICS_REPAIR_MODE ? false : settings.hapticsEnabled !== false}
                    onToggle={(value) => updateSettings({ hapticsEnabled: value })}
                    disabled={HAPTICS_REPAIR_MODE}
                    accessibilityLabel="Haptic feedback"
                  />
                }
                last
              />
            </Chapter>
          </RevealItem>

          <RevealItem index={3}>
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
                icon="file-download"
                title="Import data"
                subtitle="CSV, TSV, JSON or a Memora backup"
                onPress={() => pushOnce(router, '/mass-import')}
              />
              <SettingsLine
                icon="upload"
                title="Export all data"
                subtitle="Decks, cards, folders and review history"
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
              {APP_VERSION
                ? `Memora ${APP_VERSION} · Exports are plain JSON. Keep a copy somewhere safe.`
                : 'Exports are plain JSON. Keep a copy somewhere safe.'}
            </AppText>
          </View>
        </View>
      </View>
    </Screen>
  );
}
