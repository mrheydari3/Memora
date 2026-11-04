import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { computeStreak } from '../../data/streak';
import { exportJson } from '../../services/export';
import {
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import { v2 } from '../../theme/v2';
import type { Deck } from '../../data/types';

const APP_VERSION = Constants.expoConfig?.version ?? '1.1.0';
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;

const PRESET_LABELS: Record<Deck['algorithmPreset'], string> = {
  fsrs: 'FSRS-6',
  fast: 'Fast repetition',
  general: 'Regular repetition',
};

const formatCount = (value: number) => value.toLocaleString('en-US');

/**
 * Settings — the settings index, pinned to the design language.
 *
 * One plate opens the page (the only accent plate in the app), then one chapter
 * per subject: Study, Game, Data, Progress. Each chapter is `SettingsSection`
 * and its rows are `SettingsRow`, so the rhythm, the glass group and the value
 * alignment are never re-declared here. Nothing else is on the page: no
 * mastheads, seals, stamps or decorative rules, because the canvas holds one
 * subject at a time on the Home and deck screens too.
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

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Settings" />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="accent"
          icon="space-dashboard"
          eyebrow="Overview"
          title="Your study room"
          description="The scheduler, the voices and the archive."
          status={{ label: 'On this device', tone: 'success' }}
          ledger={[
            { label: 'Cards', value: formatCount(totalCards) },
            { label: 'Decks', value: formatCount(activeDecks.length) },
            { label: 'Scheduler', value: presetLabel ?? '—' },
          ]}
        />
      </RevealItem>

      <SettingsSection label="Study" index={1}>
        <SettingsRow
          icon="tune"
          iconTone="accent"
          title="Algorithm"
          subtitle="How reviews are scheduled"
          value={presetLabel}
          onPress={() => pushOnce(router, '/settings/algorithm')}
        />
        <SettingsRow
          icon="record-voice-over"
          iconTone="accent"
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
          iconTone="warning"
          iconPulseKey={settings.soundEnabled !== false}
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
          iconTone="warning"
          iconPulseKey={settings.hapticsEnabled !== false}
          title="Haptics"
          subtitle="Taps for answers and combos"
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

      <SettingsSection label="Progress" index={3}>
        <SettingsRow
          icon="person-outline"
          iconTone="success"
          title="Profile"
          subtitle={
            streak > 0 ? `Level ${level} · ${streak}-day streak` : `Level ${level} · no streak yet`
          }
          onPress={() => pushOnce(router, '/profile')}
        />
        <SettingsRow
          icon="insights"
          iconTone="success"
          title="Statistics"
          subtitle="Streak, knowledge and forecast"
          onPress={() => pushOnce(router, '/statistics')}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Data" index={4}>
        <SettingsRow
          icon="cloud-off"
          iconTone="info"
          title="Offline & install"
          subtitle="Study without a connection"
          value={settings.offlineCacheEnabled ? 'On' : 'Off'}
          onPress={() => pushOnce(router, '/settings/offline')}
        />
        <SettingsRow
          icon="download"
          iconTone="info"
          title="Import cards"
          subtitle="Anki, Quizlet, CSV"
          onPress={() => pushOnce(router, '/mass-import')}
        />
        <SettingsRow
          icon="upload"
          iconTone="info"
          title="Export all data"
          subtitle="Decks, cards and review history"
          onPress={handleExportAll}
          isLast
        />
      </SettingsSection>

      <SettingsNote icon="lock-outline">
        Memora {APP_VERSION} · Exports are plain JSON. Keep a copy somewhere safe.
      </SettingsNote>
    </Screen>
  );
}
