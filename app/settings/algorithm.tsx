import { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
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
  Screen,
  TopAppBar,
  SectionHeader,
  RadioOptionCard,
  SettingsCard,
  SettingsPlate,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  ToggleSwitch,
  BottomSheetModal,
  PrimaryButton,
  Button,
  Chip,
  Stepper,
  ListRow,
} from '../../components';
import type { LedgerEntry } from '../../components';
import { colors, iconSize } from '../../theme/tokens';

const PRESETS = [
  {
    id: 'fsrs',
    title: 'FSRS',
    icon: 'psychology',
    description:
      'FSRS-6 models each card\u2019s difficulty and stability, then schedules it just before you would forget it — more recall from fewer reviews.',
    short: 'Memory-model scheduling that adapts to every card.',
  },
  {
    id: 'fast',
    title: 'Fast Repetition',
    icon: 'bolt',
    description:
      'Cards stay available in order, with no dates. A quick pass through material you already know.',
    short: 'No dates. Cards stay available on demand.'
  },
  {
    id: 'general',
    title: 'Regular Repetition',
    icon: 'event-repeat',
    description:
      'The classic SM-2 algorithm: easy cards appear less often, hard ones more. Kept for decks created before FSRS became the default.',
    short: 'Classic SM-2 intervals for older decks.'
  },
] as const;

type Sheet = 'new' | 'max' | 'retention' | 'interval' | 'applyAll' | null;

export default function AlgorithmSettingsScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  const updateDeck = useDeckStore((s) => s.updateDeck);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  // Decks load asynchronously; keep a valid selection as the library changes.
  useEffect(() => {
    if (decks.length === 0) return;
    if (!selectedDeckId || !decks.some((d) => d.id === selectedDeckId)) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  const deck = decks.find((d) => d.id === selectedDeckId) ?? decks[0];
  const preset = deck?.algorithmPreset ?? 'fsrs';
  const params = resolveFsrsParams(deck ?? {});
  const newPerDay = deck?.newCardsPerDay ?? 20;
  const maxPerDay = deck?.maxCardsPerDay ?? 80;
  const shuffle = deck?.shuffleCards ?? true;

  const update = (partial: Parameters<typeof updateDeck>[1]) => {
    if (!deck) return;
    return updateDeck(deck.id, partial);
  };

  /** Copy this deck's scheduling settings to every deck in the library. */
  const applyToAll = async () => {
    if (!deck) return;
    const shared = {
      algorithmPreset: deck.algorithmPreset,
      requestRetention: params.requestRetention,
      maximumInterval: params.maximumInterval,
      enableFuzz: params.enableFuzz,
      enableShortTerm: params.enableShortTerm,
      fsrsLearningSteps: params.fsrsLearningSteps,
      fsrsRelearningSteps: params.fsrsRelearningSteps,
      newCardsPerDay: deck.newCardsPerDay,
      maxCardsPerDay: deck.maxCardsPerDay,
      shuffleCards: deck.shuffleCards,
    };
    for (const d of decks) await updateDeck(d.id, shared);
    setSheet(null);
  };

  const retention = Math.round(params.requestRetention * 100);
  const presetMeta = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  // The plate's ledger is the configuration this screen writes, so a change
  // made below is visible in the readout above without opening a sheet.
  const ledger: LedgerEntry[] =
    preset === 'fsrs'
      ? [
          { label: 'Desired retention', value: `${retention}%`, accent: true },
          { label: 'Maximum interval', value: formatMaxInterval(params.maximumInterval) },
          { label: 'Daily limit', value: `${newPerDay} new · ${maxPerDay} total` },
        ]
      : preset === 'general'
        ? [
            { label: 'Learning steps', value: `${deck?.learningSteps.length ?? 0} steps` },
            { label: 'Starting multiplier', value: `× ${deck?.masteredIntervalMultiplier ?? 2.5}` },
            { label: 'Daily limit', value: `${newPerDay} new · ${maxPerDay} total` },
          ]
        : [
            { label: 'Schedule', value: 'None — always available' },
            { label: 'Daily limit', value: `${maxPerDay} cards` },
          ];

  return (
    <Screen scroll gutter header={<TopAppBar title="Algorithm" back />}>
      <SettingsPlate
        icon="event-repeat"
        eyebrow={presetMeta.title}
        title={deck?.name ?? 'No deck yet'}
        description={presetMeta.short}
        ledger={ledger}
      />

      {decks.length > 1 && (
        <>
          <SectionHeader className="mt-7" label="Deck" rule />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {decks.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                active={d.id === deck?.id}
                variant="select"
                onPress={() => setSelectedDeckId(d.id)}
              />
            ))}
          </ScrollView>
        </>
      )}

      <SectionHeader className="mt-7" label="Scheduler" rule />
      <View className="mt-3 gap-3">
        {PRESETS.map((p) => (
          <RadioOptionCard
            key={p.id}
            icon={p.icon as React.ComponentProps<typeof MaterialIcons>['name']}
            title={p.title}
            description={p.description}
            selected={preset === p.id}
            onSelect={() => update({ algorithmPreset: p.id })}
          />
        ))}
      </View>

      {preset === 'fsrs' && (
        <SettingsSection label="FSRS parameters" index={1}>
          <SettingsRow
            icon="track-changes"
            title="Desired retention"
            subtitle="Higher means more reviews, stronger recall"
            onPress={() => setSheet('retention')}
            value={`${retention}%`}
          />
          <SettingsRow
            icon="timeline"
            title="Maximum interval"
            subtitle="Longest gap FSRS may schedule"
            onPress={() => setSheet('interval')}
            value={formatMaxInterval(params.maximumInterval)}
          />
          <SettingsRow
            icon="shuffle"
            title="Fuzz intervals"
            subtitle="Spread due dates so reviews don't clump"
            trailing={
              <ToggleSwitch
                value={params.enableFuzz}
                onToggle={(v) => update({ enableFuzz: v })}
                accessibilityLabel="Fuzz intervals"
              />
            }
          />
          <SettingsRow
            icon="tune"
            title="Learning steps"
            subtitle="Then FSRS takes over long-term scheduling"
            value={
              params.fsrsLearningSteps.length > 0 ? params.fsrsLearningSteps.join(' → ') : 'Auto'
            }
            onPress={() =>
              deck &&
              pushOnce(router, { pathname: '/settings/algorithm-advanced', params: { deckId: deck.id } })
            }
            isLast
          />
        </SettingsSection>
      )}

      {preset === 'general' && (
        <SettingsSection label="Legacy SM-2" index={2}>
          <SettingsRow
            icon="history"
            title="Learning steps and intervals"
            subtitle="Classic SM-2 tuning — no memory model"
            onPress={() =>
              deck &&
              pushOnce(router, { pathname: '/settings/algorithm-advanced', params: { deckId: deck.id } })
            }
            isLast
          />
        </SettingsSection>
      )}

      {preset === 'fast' && (
        <SettingsSection label="Fast Repetition" index={3}>
          <View className="px-4 py-4">
            <AppText variant="bodySm" tone="muted">
              This preset has no schedule: cards are never given a due date and the review buttons
              only reorder the current session.
            </AppText>
          </View>
        </SettingsSection>
      )}

      <SettingsSection label="Daily limits" index={4}>
        <SettingsRow
          icon="add-circle-outline"
          title="New cards per day"
          onPress={() => setSheet('new')}
          value={String(newPerDay)}
        />
        <SettingsRow
          icon="stacked-bar-chart"
          title="Maximum cards per day"
          subtitle="Learning steps don't count against this"
          onPress={() => setSheet('max')}
          value={String(maxPerDay)}
        />
        <SettingsRow
          icon="shuffle"
          title="Shuffle cards"
          subtitle="Mix reviews across the deck"
          trailing={
            <ToggleSwitch
              value={shuffle}
              onToggle={(v) => update({ shuffleCards: v })}
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
            label="Apply these settings to all decks"
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

      {/* Retention stepper */}
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
            update({
              requestRetention: Math.max(
                RETENTION_MIN,
                Math.round((params.requestRetention - RETENTION_STEP) * 100) / 100
              ),
            })
          }
          onIncrease={() =>
            update({
              requestRetention: Math.min(
                RETENTION_MAX,
                Math.round((params.requestRetention + RETENTION_STEP) * 100) / 100
              ),
            })
          }
        />
        <AppText variant="bodySm" tone="muted" className="mb-4">
          {params.requestRetention >= RETENTION_HEAVY
            ? 'Above 95% the review load grows quickly for very little extra recall.'
            : '90% is the Anki default. Lower means fewer reviews, slightly weaker recall.'}
        </AppText>
        <PrimaryButton label="Done" onPress={() => setSheet(null)} />
      </BottomSheetModal>

      {/* Maximum interval options */}
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
              divider={i < MAX_INTERVAL_OPTIONS.length - 1}
              trailing={
                params.maximumInterval === days ? (
                  <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
                ) : undefined
              }
              onPress={() => update({ maximumInterval: days })}
              accessibilityLabel={formatMaxInterval(days)}
            />
          ))}
        </SettingsCard>
        <View className="mt-4">
          <PrimaryButton label="Done" onPress={() => setSheet(null)} />
        </View>
      </BottomSheetModal>

      {/* Daily steppers */}
      <BottomSheetModal
        visible={sheet === 'new' || sheet === 'max'}
        onClose={() => setSheet(null)}
        title={sheet === 'max' ? 'Maximum cards per day' : 'New cards per day'}
      >
        <Stepper
          className="mb-5"
          value={
            <AppText variant="display" weight="bold">
              {sheet === 'max' ? maxPerDay : newPerDay}
            </AppText>
          }
          decrementLabel="Decrease"
          incrementLabel="Increase"
          onDecrease={() =>
            update(
              sheet === 'max'
                ? { maxCardsPerDay: Math.max(10, maxPerDay - 10) }
                : { newCardsPerDay: Math.max(5, newPerDay - 5) }
            )
          }
          onIncrease={() =>
            update(
              sheet === 'max'
                ? { maxCardsPerDay: Math.min(9999, maxPerDay + 10) }
                : { newCardsPerDay: Math.min(500, newPerDay + 5) }
            )
          }
        />
        <PrimaryButton label="Done" onPress={() => setSheet(null)} />
      </BottomSheetModal>

      {/* Apply to all */}
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
