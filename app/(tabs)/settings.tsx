import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { buildStudyQueue } from '../../data/session';
import { exportJson } from '../../services/export';
import {
  Screen,
  TopAppBar,
  SettingsPlate,
  SettingsSection,
  SettingsRow,
  SettingsNote,
  ToggleSwitch,
  RevealItem,
} from '../../components';
import type { Deck } from '../../data/types';

const APP_VERSION = '1.0.0';

const PRESET_LABELS: Record<Deck['algorithmPreset'], string> = {
  fsrs: 'FSRS-6',
  fast: 'Fast repetition',
  general: 'Regular repetition',
};

const formatCount = (value: number) => value.toLocaleString('en-US');

export default function SettingsScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  // Archived decks keep their cards and history, but they are not part of what
  // the library is currently working through.
  const activeDecks = useMemo(() => decks.filter((deck) => !deck.archivedAt), [decks]);

  const totalCards = useMemo(
    () => activeDecks.reduce((sum, deck) => sum + (cardsByDeck[deck.id]?.length ?? 0), 0),
    [activeDecks, cardsByDeck]
  );

  // The same queue the session builds, so "due today" here always matches the
  // number on the home card and on the deck screen.
  const dueToday = useMemo(
    () =>
      activeDecks.reduce(
        (sum, deck) => sum + buildStudyQueue(deck, cardsByDeck[deck.id] ?? [], reviewLog).total,
        0
      ),
    [activeDecks, cardsByDeck, reviewLog]
  );

  // Each deck owns its scheduler, so the index only names one when the whole
  // library agrees; otherwise it says so instead of showing deck one's setting.
  const presetLabel = useMemo(() => {
    if (activeDecks.length === 0) return undefined;
    const [first] = activeDecks;
    const shared = activeDecks.every((deck) => deck.algorithmPreset === first.algorithmPreset);
    return shared ? PRESET_LABELS[first.algorithmPreset] : 'Per deck';
  }, [activeDecks]);

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

  return (
    <Screen scroll gutter tabClearance header={<TopAppBar title="Settings" />}>
      {/* The plate: identity first, telemetry second. It is the one accent pane
          on this screen and the only place that reads the library. */}
      <RevealItem index={0}>
      <SettingsPlate
        tone="accent"
        icon="blur-on"
        eyebrow="Local-first"
        status={{ label: 'On this device', tone: 'success' }}
        title="Your library"
        description="No account, no sync. Everything you study stays on this device."
        ledger={[
          { label: 'Due today', value: formatCount(dueToday), accent: dueToday > 0 },
          { label: 'Cards', value: formatCount(totalCards) },
          { label: 'Decks', value: formatCount(activeDecks.length) },
        ]}
      />
      </RevealItem>

      <SettingsSection label="Study" index={1}>
        <SettingsRow
          icon="tune"
          title="Algorithm"
          subtitle="How reviews are scheduled"
          value={presetLabel}
          onPress={() => pushOnce(router, '/settings/algorithm')}
        />
        <SettingsRow
          icon="volume-up"
          title="Text-to-Speech"
          subtitle="Read cards aloud in two voices"
          value={settings.ttsEnabled ? 'On' : 'Off'}
          onPress={() => pushOnce(router, '/settings/tts')}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Game" index={2}>
        <SettingsRow
          icon="volume-up"
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
        <SettingsRow
          icon="vibration"
          title="Haptics"
          subtitle="A tap for answers, combos and the final score"
          trailing={
            <ToggleSwitch
              value={settings.hapticsEnabled !== false}
              onToggle={(value) => updateSettings({ hapticsEnabled: value })}
              accessibilityLabel="Quiz haptics"
            />
          }
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Data" index={3}>
        <SettingsRow
          icon="cloud-off"
          title="Offline & install"
          subtitle="Study without a connection"
          value={settings.offlineCacheEnabled ? 'Cache on' : 'Cache off'}
          onPress={() => pushOnce(router, '/settings/offline')}
        />
        <SettingsRow
          icon="download"
          title="Import cards"
          subtitle="Anki, Quizlet, CSV"
          onPress={() => pushOnce(router, '/mass-import')}
        />
        <SettingsRow
          icon="upload"
          title="Export all data"
          subtitle="Decks, cards and review history"
          onPress={handleExportAll}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Your progress" index={4}>
        <SettingsRow
          icon="person-outline"
          title="Profile"
          subtitle="Level, achievements and decks"
          onPress={() => pushOnce(router, '/profile')}
        />
        <SettingsRow
          icon="insights"
          title="Statistics"
          subtitle="Streak, knowledge and forecast"
          onPress={() => pushOnce(router, '/statistics')}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="About" index={5}>
        <SettingsRow icon="info-outline" title="Version" value={APP_VERSION} isLast />
      </SettingsSection>

      <SettingsNote icon="lock-outline">
        Exports are plain JSON: decks, cards and review history. Keep a copy somewhere safe, since
        this device is the only place your library lives.
      </SettingsNote>
    </Screen>
  );
}
