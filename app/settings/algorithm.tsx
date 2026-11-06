import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
  RadioOptionCard,
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  Stepper,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import type { Deck } from '../../data/types';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type PresetId = Deck['algorithmPreset'];
type Sheet = 'deck' | 'retention' | 'interval' | 'new' | 'max' | 'applyAll' | null;

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
  adaptive: boolean;
};

/**
 * Algorithm — one scheduler per deck.
 *
 * The page follows the same settings rhythm as the index: one plate with the
 * current deck and its readouts, then chapters for the deck, the model, the
 * model's parameters and the daily limits. Every control is a standard setting
 * row or radio option; there are no seals, stamps or decorative rules.
 */
export default function AlgorithmSettingsScreen() {
  const router = useRouter();

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
    adaptive: deck?.adaptiveOrdering ?? false,
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
    if (partial.adaptive !== undefined) patch.adaptiveOrdering = partial.adaptive;
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
      adaptiveOrdering: view.adaptive,
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
  const learningSteps = params.fsrsLearningSteps;

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

  const advancedSettings = deck
    ? () =>
        pushOnce(router, {
          pathname: '/settings/algorithm-advanced',
          params: { deckId: deck.id },
        })
    : undefined;

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Algorithm" back />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="accent"
          icon="tune"
          eyebrow="Scheduler"
          title={deck?.name ?? 'No deck yet'}
          description={presetMeta.description}
          status={{ label: 'Per deck', tone: 'muted' }}
          ledger={ledger}
        />
      </RevealItem>

      {decks.length > 1 && (
        <SettingsSection label="Deck" index={1}>
          <SettingsRow
            icon="style"
            iconTone="info"
            title="Current deck"
            subtitle={deck?.name ?? 'No deck yet'}
            value="Change"
            onPress={() => setSheet('deck')}
            isLast
          />
        </SettingsSection>
      )}

      <SettingsSection label="Model" index={2}>
        <View className="gap-2 p-3">
          {PRESETS.map((option) => (
            <RadioOptionCard
              key={option.id}
              icon={option.icon}
              title={option.title}
              description={option.short}
              selected={preset === option.id}
              onSelect={() => tune({ preset: option.id })}
            />
          ))}
        </View>
      </SettingsSection>

      {preset === 'fsrs' && (
        <SettingsSection label="FSRS parameters" index={3}>
          <SettingsRow
            icon="track-changes"
            iconTone="accent"
            title="Desired retention"
            subtitle="Higher means more reviews, stronger recall"
            value={`${retention}%`}
            onPress={() => setSheet('retention')}
          />
          <SettingsRow
            icon="timeline"
            iconTone="accent"
            title="Maximum interval"
            subtitle="Longest gap FSRS may schedule"
            value={formatMaxInterval(view.maximumInterval)}
            onPress={() => setSheet('interval')}
          />
          <SettingsRow
            icon="shuffle"
            iconTone="accent"
            title="Fuzz intervals"
            subtitle="Spread due dates so reviews don't clump"
            iconPulseKey={view.fuzz}
            trailing={
              <ToggleSwitch
                value={view.fuzz}
                onToggle={(value) => tune({ fuzz: value })}
                accessibilityLabel="Fuzz intervals"
              />
            }
          />
          <SettingsRow
            icon="insights"
            iconTone="accent"
            title="Adaptive review order"
            subtitle="Put cards with lower estimated recall first; due dates stay unchanged"
            iconPulseKey={view.adaptive}
            trailing={
              <ToggleSwitch
                value={view.adaptive}
                onToggle={(value) => tune({ adaptive: value })}
                accessibilityLabel="Adaptive review order"
              />
            }
          />
          <SettingsRow
            icon="tune"
            iconTone="accent"
            title="Learning steps"
            subtitle="Then FSRS takes over long-term scheduling"
            value={learningSteps.length > 0 ? learningSteps.join(' → ') : 'Auto'}
            onPress={advancedSettings}
            isLast
          />
        </SettingsSection>
      )}

      {preset === 'general' && (
        <SettingsSection label="SM-2" index={3}>
          <SettingsRow
            icon="history"
            iconTone="accent"
            title="Learning steps and intervals"
            subtitle="Classic SM-2 tuning — no memory model"
            onPress={advancedSettings}
            isLast
          />
        </SettingsSection>
      )}

      {preset === 'fast' && (
        <SettingsSection label="Fast repetition" index={3}>
          <SettingsRow
            icon="bolt"
            iconTone="warning"
            title="No dates, no queue"
            subtitle="Cards stay available in order; a session is a quick pass."
            isLast
          />
        </SettingsSection>
      )}

      <SettingsSection label="Daily limits" index={4}>
        <SettingsRow
          icon="add-circle-outline"
          iconTone="warning"
          title="New cards per day"
          value={String(view.newPerDay)}
          onPress={() => setSheet('new')}
        />
        <SettingsRow
          icon="stacked-bar-chart"
          iconTone="warning"
          title="Maximum cards per day"
          subtitle="Learning steps don't count against this"
          value={String(view.maxPerDay)}
          onPress={() => setSheet('max')}
        />
        <SettingsRow
          icon="shuffle"
          iconTone="warning"
          title="Shuffle cards"
          subtitle="Mix new cards; with adaptive order on, due priority is kept"
          iconPulseKey={view.shuffle}
          trailing={
            <ToggleSwitch
              value={view.shuffle}
              onToggle={(value) => tune({ shuffle: value })}
              accessibilityLabel="Shuffle Cards"
            />
          }
          isLast
        />
      </SettingsSection>

      {decks.length > 1 && (
        <View className="mt-6">
          <Button
            variant="secondary"
            label="Apply to all decks"
            icon="copy-all"
            onPress={() => setSheet('applyAll')}
          />
        </View>
      )}

      {preset === 'fsrs' && (
        <SettingsNote icon="psychology">
          FSRS-6 · 21 parameters. Scheduling follows the memory model instead of hand-tuned
          intervals.
        </SettingsNote>
      )}

      <BottomSheetModal
        visible={sheet === 'deck'}
        onClose={() => setSheet(null)}
        title="Choose a deck"
        subtitle="Scheduler settings follow the selected deck."
      >
        <ScrollView
          style={{ maxHeight: heights.sheetTall }}
          showsVerticalScrollIndicator={false}
        >
          {decks.map((entry) => (
            <ListRow
              key={entry.id}
              title={entry.name}
              tile="none"
              density="compact"
              gutter={0}
              showChevron={false}
              highlighted={entry.id === deck?.id}
              trailing={
                entry.id === deck?.id ? (
                  <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
                ) : undefined
              }
              onPress={() => {
                setSelectedDeckId(entry.id);
                setDraft(null);
                setSheet(null);
              }}
              accessibilityLabel={entry.name}
            />
          ))}
        </ScrollView>
      </BottomSheetModal>

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
        <View>
          {MAX_INTERVAL_OPTIONS.map((days) => (
            <ListRow
              key={days}
              title={formatMaxInterval(days)}
              tile="none"
              density="compact"
              gutter={0}
              showChevron={false}
              highlighted={view.maximumInterval === days}
              trailing={
                view.maximumInterval === days ? (
                  <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
                ) : undefined
              }
              onPress={() => tune({ maximumInterval: days })}
              accessibilityLabel={formatMaxInterval(days)}
            />
          ))}
        </View>
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
