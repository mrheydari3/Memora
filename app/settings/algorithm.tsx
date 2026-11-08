import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr, pushOnce } from '../../services/navigation';
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
  Menu,
  PrimaryButton,
  RadioOptionCard,
  RevealItem,
  Screen,
  Stepper,
  ToggleSwitch,
} from '../../components';
import type { MenuAction } from '../../components';
import {
  PageHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../../components/v3';
import type { Deck } from '../../data/types';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

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
 * Algorithm — one scheduler per deck, v3 "Nocturne Focus".
 *
 * The page keeps the index's drawer rhythm: a raised hero states the deck and
 * the three numbers the scheduler is set by, then chapters hold the model, its
 * parameters and the daily limits as 64px lines in 22px panes.
 *
 * Every control and its accessible name are unchanged — the scheduler flow and
 * the focus-trapping sheet flows query them by name — and the retention draft
 * still writes once on close, not on every 1% step.
 */
export default function AlgorithmSettingsScreen() {
  const router = useRouter();

  const decks = useDeckStore((s) => s.decks);
  const updateDeck = useDeckStore((s) => s.updateDeck);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState<Tuning | null>(null);
  const [retentionDraft, setRetentionDraft] = useState<number | null>(null);
  const deckAnchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const intervalAnchorRef = useRef<React.ComponentRef<typeof View>>(null);

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
    setRetentionDraft(null);
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

  /**
   * Retention is a sheet-local value until the sheet closes. A 1% step must not
   * serialize the whole deck on every press; one update on close is enough, and
   * closing without a change writes nothing. Closing via Done, the scrim, the
   * close control or Escape all take the same path, so a change is never lost.
   */
  const openRetention = () => {
    setRetentionDraft(view.retention);
    setSheet('retention');
  };

  const closeRetention = () => {
    const next = retentionDraft;
    setRetentionDraft(null);
    setSheet(null);
    if (next === null || next === view.retention) return;

    setDraft({ ...view, retention: next });
    if (deck) void updateDeck(deck.id, { requestRetention: next });
  };

  const adjustRetention = (delta: number) => {
    const current = retentionDraft ?? view.retention;
    const next = Math.min(
      RETENTION_MAX,
      Math.max(RETENTION_MIN, Math.round((current + delta) * 100) / 100)
    );
    setRetentionDraft(next);
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
  const retentionDraftValue = retentionDraft ?? view.retention;
  const retentionDraftPercent = Math.round(retentionDraftValue * 100);
  const learningSteps = params.fsrsLearningSteps;

  const ledger: { label: string; value: string }[] =
    preset === 'fsrs'
      ? [
          { label: 'Retention', value: `${retention}%` },
          { label: 'Max interval', value: formatMaxInterval(view.maximumInterval) },
          { label: 'Daily', value: `${view.newPerDay} new · ${view.maxPerDay} total` },
        ]
      : preset === 'general'
        ? [
            { label: 'Steps', value: `${deck?.learningSteps.length ?? 0} steps` },
            { label: 'Multiplier', value: `× ${deck?.masteredIntervalMultiplier ?? 2.5}` },
            { label: 'Daily', value: `${view.newPerDay} new · ${view.maxPerDay} total` },
          ]
        : [
            { label: 'Schedule', value: 'No dates' },
            { label: 'Queue', value: 'In order' },
            { label: 'Daily', value: `${view.maxPerDay} cards` },
          ];

  const advancedSettings = deck
    ? () =>
        pushOnce(router, {
          pathname: '/settings/algorithm-advanced',
          params: { deckId: deck.id },
        })
    : undefined;

  const deckActions: MenuAction[] = decks.map((entry) => ({
    key: entry.id,
    label: entry.name,
    selected: entry.id === deck?.id,
    onPress: () => {
      setSelectedDeckId(entry.id);
      setDraft(null);
      setSheet(null);
    },
  }));

  const intervalActions: MenuAction[] = MAX_INTERVAL_OPTIONS.map((days) => ({
    key: String(days),
    label: formatMaxInterval(days),
    selected: view.maximumInterval === days,
    onPress: () => tune({ maximumInterval: days }),
  }));

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={<PageHeader title="Algorithm" back onBack={() => goBackOr(router, '/settings')} />}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="algorithm-hero"
              eyebrow="Scheduler"
              status={{ label: 'Per deck', tone: 'accent' }}
              title={deck?.name ?? 'No deck yet'}
              description={presetMeta.description}
              ledger={ledger}
            />
          </RevealItem>

          {decks.length > 1 && (
            <RevealItem index={1}>
              <SettingsChapter label="Deck">
                <View ref={deckAnchorRef} collapsable={false}>
                  <SettingsLine
                    icon="style"
                    tone={colors.info}
                    title="Current deck"
                    subtitle={deck?.name ?? 'No deck yet'}
                    value="Change"
                    onPress={() => setSheet('deck')}
                    ariaExpanded={sheet === 'deck'}
                    ariaHasPopup="menu"
                    last
                  />
                </View>
              </SettingsChapter>
            </RevealItem>
          )}

          <RevealItem index={2}>
            <SettingsChapter label="Model">
              <View style={{ gap: 8, padding: 12 }}>
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
            </SettingsChapter>
          </RevealItem>

          {preset === 'fsrs' && (
            <RevealItem index={3}>
              <SettingsChapter label="FSRS parameters">
                <SettingsLine
                  icon="track-changes"
                  title="Desired retention"
                  subtitle="Higher means more reviews, stronger recall"
                  value={`${retention}%`}
                  onPress={openRetention}
                />
                <View ref={intervalAnchorRef} collapsable={false}>
                  <SettingsLine
                    icon="timeline"
                    title="Maximum interval"
                    subtitle="Longest gap FSRS may schedule"
                    value={formatMaxInterval(view.maximumInterval)}
                    onPress={() => setSheet('interval')}
                    ariaExpanded={sheet === 'interval'}
                    ariaHasPopup="menu"
                  />
                </View>
                <SettingsLine
                  icon="shuffle"
                  title="Fuzz intervals"
                  subtitle="Spread due dates so reviews don't clump"
                  trailing={
                    <ToggleSwitch
                      value={view.fuzz}
                      onToggle={(value) => tune({ fuzz: value })}
                      accessibilityLabel="Fuzz intervals"
                    />
                  }
                />
                <SettingsLine
                  icon="insights"
                  title="Adaptive review order"
                  subtitle="Put cards with lower estimated recall first; due dates stay unchanged"
                  trailing={
                    <ToggleSwitch
                      value={view.adaptive}
                      onToggle={(value) => tune({ adaptive: value })}
                      accessibilityLabel="Adaptive review order"
                    />
                  }
                />
                <SettingsLine
                  icon="tune"
                  title="Learning steps"
                  subtitle="Then FSRS takes over long-term scheduling"
                  value={learningSteps.length > 0 ? learningSteps.join(' → ') : 'Auto'}
                  onPress={advancedSettings}
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          {preset === 'general' && (
            <RevealItem index={3}>
              <SettingsChapter label="SM-2">
                <SettingsLine
                  icon="history"
                  title="Learning steps and intervals"
                  subtitle="Classic SM-2 tuning — no memory model"
                  onPress={advancedSettings}
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          {preset === 'fast' && (
            <RevealItem index={3}>
              <SettingsChapter label="Fast repetition">
                <SettingsLine
                  icon="bolt"
                  tone={colors.warning}
                  title="No dates, no queue"
                  subtitle="Cards stay available in order; a session is a quick pass."
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          <RevealItem index={4}>
            <SettingsChapter label="Daily limits">
              <SettingsLine
                icon="add-circle-outline"
                tone={colors.warning}
                title="New cards per day"
                value={String(view.newPerDay)}
                onPress={() => setSheet('new')}
              />
              <SettingsLine
                icon="stacked-bar-chart"
                tone={colors.warning}
                title="Maximum cards per day"
                subtitle="Learning steps don't count against this"
                value={String(view.maxPerDay)}
                onPress={() => setSheet('max')}
              />
              <SettingsLine
                icon="shuffle"
                tone={colors.warning}
                title="Shuffle cards"
                subtitle="Mix new cards; with adaptive order on, due priority is kept"
                trailing={
                  <ToggleSwitch
                    value={view.shuffle}
                    onToggle={(value) => tune({ shuffle: value })}
                    accessibilityLabel="Shuffle Cards"
                  />
                }
                last
              />
            </SettingsChapter>
          </RevealItem>

          {decks.length > 1 && (
            <RevealItem index={5}>
              <SettingsChapter label="Library">
                <SettingsLine
                  icon="copy-all"
                  title="Apply to all decks"
                  subtitle="Copy this scheduler, its parameters and daily limits everywhere"
                  onPress={() => setSheet('applyAll')}
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          {preset === 'fsrs' && (
            <SettingsFootnote icon="psychology">
              FSRS-6 · 21 parameters. Scheduling follows the memory model instead of hand-tuned
              intervals.
            </SettingsFootnote>
          )}
        </View>
      </View>

      <Menu
        open={sheet === 'deck'}
        onClose={() => setSheet(null)}
        anchorRef={deckAnchorRef}
        label="Choose a deck"
        title="Choose a deck"
        subtitle="Scheduler settings follow the selected deck."
        actions={deckActions}
      />

      <BottomSheetModal
        visible={sheet === 'retention'}
        onClose={closeRetention}
        title="Desired retention"
        subtitle="The recall probability FSRS aims for on each review."
      >
        <Stepper
          className="mb-3"
          value={
            <AppText variant="display" weight="bold">
              {retentionDraftPercent}%
            </AppText>
          }
          decrementLabel="Decrease retention"
          incrementLabel="Increase retention"
          onDecrease={() => adjustRetention(-RETENTION_STEP)}
          onIncrease={() => adjustRetention(RETENTION_STEP)}
        />
        <AppText variant="bodySm" tone="muted" className="mb-4">
          {retentionDraftValue >= RETENTION_HEAVY
            ? 'Above 95% the review load grows quickly for very little extra recall.'
            : '90% is the Anki default. Lower means fewer reviews, slightly weaker recall.'}
        </AppText>
        <PrimaryButton label="Done" onPress={closeRetention} />
      </BottomSheetModal>

      <Menu
        open={sheet === 'interval'}
        onClose={() => setSheet(null)}
        anchorRef={intervalAnchorRef}
        label="Maximum interval"
        title="Maximum interval"
        subtitle="Caps how far into the future a card can be scheduled."
        actions={intervalActions}
      />

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
          decrementLabel={`Decrease ${sheet === 'max' ? 'maximum' : 'new'} cards per day`}
          incrementLabel={`Increase ${sheet === 'max' ? 'maximum' : 'new'} cards per day`}
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
