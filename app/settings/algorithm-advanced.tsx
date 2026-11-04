import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import {
  isFsrsLearningStepValid,
  normalizeFsrsStep,
  resolveFsrsParams,
} from '../../data/fsrs-params';
import { isSM2StepValid } from '../../data/schedulers/sm2';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  LearningStepRow,
  SettingsPlate,
  SettingsSection,
  SettingsRow,
  ToggleSwitch,
  BottomSheetModal,
  PrimaryButton,
  Field,
  Pill,
  IconButton,
} from '../../components';
import { colors, iconSize } from '../../theme/tokens';

const DEFAULT_SM2_STEPS = ['12 hours', '1 day', '2 days', '3 days'];

const pluralSteps = (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`;

type StepList = 'fsrs' | 'relearn' | 'sm2';

export default function AlgorithmAdvancedScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string | string[] }>();
  const decks = useDeckStore((s) => s.decks);
  const loaded = useDeckStore((s) => s.loaded);
  const updateDeck = useDeckStore((s) => s.updateDeck);

  // Never fall back to `decks[0]` for a stale or missing id: that silently
  // tuned a different deck than the one the user opened.
  const requestedId = Array.isArray(deckId) ? deckId[0] : deckId;
  const deck = requestedId ? decks.find((d) => d.id === requestedId) : undefined;
  const preset = deck?.algorithmPreset ?? 'fsrs';

  const [steps, setSteps] = useState<string[]>(DEFAULT_SM2_STEPS);
  const [multiplier, setMultiplier] = useState<number>(2.5);
  const [fsrsSteps, setFsrsSteps] = useState<string[]>([]);
  const [relearnSteps, setRelearnSteps] = useState<string[]>([]);
  const [shortTerm, setShortTerm] = useState(true);
  const [fuzz, setFuzz] = useState(true);

  const [editTarget, setEditTarget] = useState<{ list: StepList; index: number } | null>(null);
  const [stepDraft, setStepDraft] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Decks load asynchronously, so this screen can mount before the first deck
  // exists. Fill the editor once it does; otherwise it would show the defaults
  // and saving would overwrite the real values.
  useEffect(() => {
    if (!deck || hydratedFor === deck.id) return;
    const params = resolveFsrsParams(deck);
    setSteps(deck.learningSteps.length > 0 ? deck.learningSteps : DEFAULT_SM2_STEPS);
    setMultiplier(deck.masteredIntervalMultiplier ?? 2.5);
    setFsrsSteps(params.fsrsLearningSteps);
    setRelearnSteps(params.fsrsRelearningSteps);
    setShortTerm(params.enableShortTerm);
    setFuzz(params.enableFuzz);
    setHydratedFor(deck.id);
  }, [deck, hydratedFor]);

  // The plate reads what is saved, not the draft: a half-edited step list must
  // never look like the deck's current schedule.
  const savedParams = resolveFsrsParams(deck ?? {});
  const ledger: { label: string; value: string; accent?: boolean }[] =
    preset === 'general'
      ? [
          { label: 'Scheduler', value: 'SM-2' },
          { label: 'Learning steps', value: pluralSteps(deck?.learningSteps.length ?? steps.length) },
          {
            label: 'Starting multiplier',
            value: `× ${deck?.masteredIntervalMultiplier ?? multiplier}`,
          },
        ]
      : preset === 'fsrs'
        ? [
            {
              label: 'Learning steps',
              value: pluralSteps(savedParams.fsrsLearningSteps.length),
              accent: true,
            },
            { label: 'Relearning steps', value: pluralSteps(savedParams.fsrsRelearningSteps.length) },
            { label: 'Short-term', value: savedParams.enableShortTerm ? 'On' : 'Off' },
          ]
        : [{ label: 'Scheduler', value: 'Fast repetition' }];

  const sm2Dirty =
    JSON.stringify(steps) !== JSON.stringify(deck?.learningSteps ?? DEFAULT_SM2_STEPS) ||
    multiplier !== (deck?.masteredIntervalMultiplier ?? 2.5);

  const fsrsDirty =
    JSON.stringify(fsrsSteps) !== JSON.stringify(resolveFsrsParams(deck ?? {}).fsrsLearningSteps) ||
    JSON.stringify(relearnSteps) !==
      JSON.stringify(resolveFsrsParams(deck ?? {}).fsrsRelearningSteps) ||
    shortTerm !== resolveFsrsParams(deck ?? {}).enableShortTerm ||
    fuzz !== resolveFsrsParams(deck ?? {}).enableFuzz;

  const dirty = preset === 'general' ? sm2Dirty : preset === 'fsrs' ? fsrsDirty : false;

  const save = async () => {
    if (!deck) return;
    if (preset === 'general') {
      await updateDeck(deck.id, {
        learningSteps: steps,
        masteredIntervalMultiplier: multiplier,
      });
    } else if (preset === 'fsrs') {
      await updateDeck(deck.id, {
        fsrsLearningSteps: fsrsSteps,
        fsrsRelearningSteps: relearnSteps,
        enableShortTerm: shortTerm,
        enableFuzz: fuzz,
      });
    }
  };

  const openStepEditor = (list: StepList, index: number, value: string) => {
    setStepDraft(value);
    setStepError(null);
    setEditTarget({ list, index });
  };

  const addStep = (list: StepList) => {
    if (list === 'sm2') {
      const next = [...steps, `${steps.length + 2} days`];
      setSteps(next);
      openStepEditor('sm2', next.length - 1, next[next.length - 1]);
      return;
    }
    const next = [...(list === 'fsrs' ? fsrsSteps : relearnSteps), '10m'];
    if (list === 'fsrs') setFsrsSteps(next);
    else setRelearnSteps(next);
    openStepEditor(list, next.length - 1, next[next.length - 1]);
  };

  const removeStep = (list: StepList, index: number) => {
    if (list === 'fsrs') setFsrsSteps(fsrsSteps.filter((_, i) => i !== index));
    else if (list === 'relearn') setRelearnSteps(relearnSteps.filter((_, i) => i !== index));
    else setSteps(steps.filter((_, i) => i !== index));
  };

  const commitStep = () => {
    if (!editTarget) return;
    const { list, index } = editTarget;

    if (list === 'sm2') {
      const candidate = stepDraft.trim();
      if (!candidate) return;
      if (!isSM2StepValid(candidate)) {
        setStepError('Use a duration like 30m, 12 hours or 2 days.');
        return;
      }
      const next = [...steps];
      next[index] = candidate;
      setSteps(next);
      setEditTarget(null);
      return;
    }

    const normalized = normalizeFsrsStep(stepDraft);
    if (!normalized) {
      setStepError('Use a duration like 10m, 6h or 1d.');
      return;
    }
    // Anki's rule: every learning step completes the same day. Anything at a
    // day or beyond belongs to the long-term schedule FSRS owns.
    if (!isFsrsLearningStepValid(normalized)) {
      setStepError('FSRS learning steps must be shorter than one day.');
      return;
    }

    if (list === 'fsrs') {
      const next = [...fsrsSteps];
      next[index] = normalized;
      setFsrsSteps(next);
    } else {
      const next = [...relearnSteps];
      next[index] = normalized;
      setRelearnSteps(next);
    }
    setEditTarget(null);
  };

  const deckName = deck?.name ?? 'this deck';

  // The store hydrates asynchronously, and the deck may legitimately have been
  // deleted while this screen was open. Say so instead of editing another deck.
  if (!deck && !loaded) {
    return (
      <Screen header={<TopAppBar title="Advanced" back />}>
        <GlassCard className="mt-4">
          <AppText variant="bodySm" tone="muted">
            Loading deck…
          </AppText>
        </GlassCard>
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen header={<TopAppBar title="Advanced" back />}>
        <GlassCard className="mt-4">
          <AppText variant="body" weight="medium">
            Deck not found
          </AppText>
          <AppText variant="bodySm" tone="muted" className="mt-1">
            This deck may have been deleted. Go back and pick a deck that still exists.
          </AppText>
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen scroll gutter header={<TopAppBar title="Advanced" back />}>
      <SettingsPlate
        icon="tune"
        eyebrow="Advanced"
        title={deckName}
        description="The steps these cards pass through before long-term scheduling takes over."
        ledger={ledger}
      />

      {preset === 'fast' && (
        <GlassCard className="mt-4">
          <AppText variant="body" weight="medium">
            No scheduling settings
          </AppText>
          <AppText variant="bodySm" tone="muted" className="mt-1">
            Fast Repetition never sets a due date, so there is nothing to tune here. Pick FSRS on
            the Algorithm screen if you want spaced scheduling.
          </AppText>
        </GlassCard>
      )}

      {preset === 'fsrs' && (
        <>
          <SettingsSection label="Learning phase" index={1}>
            <View className="px-4 pt-4">
              <AppText variant="bodySm" tone="muted">
                New cards pass through short steps before FSRS takes over long-term scheduling.
                Keep every step under one day — that is what the algorithm expects.
              </AppText>
            </View>
            <View className="mt-3">
              {fsrsSteps.length === 0 ? (
                <View className="px-4 py-3">
                  <AppText variant="bodySm" tone="tertiary">
                    No steps — FSRS schedules the same day too.
                  </AppText>
                </View>
              ) : (
                fsrsSteps.map((step, i) => (
                  <LearningStepRow
                    key={`${step}-${i}`}
                    index={i}
                    step={step}
                    isFirst={false}
                    onEdit={() => openStepEditor('fsrs', i, step)}
                    onRemove={() => removeStep('fsrs', i)}
                  />
                ))
              )}
            </View>
            <AddStepButton onPress={() => addStep('fsrs')} label="Add learning step" />
          </SettingsSection>

          <SettingsSection label="Relearning phase" index={2}>
            <View className="px-4 pt-4">
              <AppText variant="bodySm" tone="muted">
                Steps a review card goes through after you press Again.
              </AppText>
            </View>
            <View className="mt-3">
              {relearnSteps.length === 0 ? (
                <View className="px-4 py-3">
                  <AppText variant="bodySm" tone="tertiary">
                    No steps — FSRS schedules the lapse itself.
                  </AppText>
                </View>
              ) : (
                relearnSteps.map((step, i) => (
                  <LearningStepRow
                    key={`${step}-${i}`}
                    index={i}
                    step={step}
                    isFirst={false}
                    onEdit={() => openStepEditor('relearn', i, step)}
                    onRemove={() => removeStep('relearn', i)}
                  />
                ))
              )}
            </View>
            <AddStepButton onPress={() => addStep('relearn')} label="Add relearning step" />
          </SettingsSection>

          <SettingsSection label="Scheduling behaviour" index={3}>
            <SettingsRow
              icon="short-text"
              title="Short-term scheduling"
              subtitle="Use steps for same-day reviews"
              trailing={
                <ToggleSwitch
                  value={shortTerm}
                  onToggle={setShortTerm}
                  accessibilityLabel="Short-term scheduling"
                />
              }
            />
            <SettingsRow
              icon="shuffle"
              title="Fuzz intervals"
              subtitle="Add a little randomness to long gaps"
              trailing={
                <ToggleSwitch value={fuzz} onToggle={setFuzz} accessibilityLabel="Fuzz intervals" />
              }
              isLast
            />
          </SettingsSection>
        </>
      )}

      {preset === 'general' && (
        <>
          <SettingsSection label="Learning phase" index={1}>
            <View className="px-4 pt-4">
              <AppText variant="bodySm" tone="muted">
                New cards go through a short learning phase with gradually increasing intervals
                before graduating to the main schedule.
              </AppText>
            </View>
            <View className="mt-3">
              {steps.map((step, i) => (
                <LearningStepRow
                  key={`${step}-${i}`}
                  index={i}
                  step={step}
                  isFirst={i === 0}
                  onEdit={() => openStepEditor('sm2', i, step)}
                  onRemove={() => removeStep('sm2', i)}
                />
              ))}
            </View>
            <AddStepButton onPress={() => addStep('sm2')} label="Add step" />
          </SettingsSection>

          <SettingsSection label="Mastered phase" index={2}>
            <View className="px-4 pt-4">
              <AppText variant="bodySm" tone="muted">
                After graduating from the learning phase, cards enter the mastered phase with
                longer intervals.
              </AppText>
            </View>
            <View className="mt-3">
              <SettingsRow
                icon="speed"
                title="Starting interval"
                subtitle="Multiplier applied to the first mastered interval"
                isLast
                trailing={
                  <View className="flex-row items-center gap-2">
                    <IconButton
                      icon="remove"
                      size="sm"
                      glyphSize={iconSize.sm}
                      onPress={() =>
                        setMultiplier(Math.max(1, Math.round((multiplier - 0.5) * 10) / 10))
                      }
                      accessibilityLabel="Decrease multiplier"
                    />
                    <Pill label={`× ${multiplier}`} />
                    <IconButton
                      icon="add"
                      size="sm"
                      glyphSize={iconSize.sm}
                      onPress={() =>
                        setMultiplier(Math.min(10, Math.round((multiplier + 0.5) * 10) / 10))
                      }
                      accessibilityLabel="Increase multiplier"
                    />
                  </View>
                }
              />
            </View>
          </SettingsSection>
        </>
      )}

      {preset !== 'fast' && (
        <View className="mt-7">
          {dirty ? (
            <PrimaryButton
              label="Save changes"
              onPress={async () => {
                await save();
              }}
            />
          ) : (
            <View className="flex-row items-center justify-center gap-2 py-3">
              <MaterialIcons name="check-circle" size={iconSize.sm} color={colors.success} />
              <AppText variant="bodySm" weight="medium" tone="muted">
                No changes to save
              </AppText>
            </View>
          )}
        </View>
      )}

      {/* Step editor sheet */}
      <BottomSheetModal
        visible={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget?.list === 'sm2' ? 'Edit step' : 'Edit interval'}
        subtitle={
          editTarget?.list === 'sm2'
            ? 'e.g. 12 hours, 1 day'
            : 'Steps shorter than one day, e.g. 1m, 10m, 6h'
        }
      >
        <Field
          value={stepDraft}
          onChangeText={(value) => {
            setStepDraft(value);
            setStepError(null);
          }}
          placeholder={editTarget?.list === 'sm2' ? 'e.g. 12 hours' : 'e.g. 10m'}
          accessibilityLabel="Step interval"
        />
        {stepError && (
          <AppText variant="bodySm" tone="danger" className="mt-3">
            {stepError}
          </AppText>
        )}
        <View className="mt-3">
          <PrimaryButton label="Save step" onPress={commitStep} />
        </View>
      </BottomSheetModal>
    </Screen>
  );
}

function AddStepButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      className="mx-4 my-3 flex-row items-center justify-center gap-2 rounded-md border border-dashed border-hairline-strong py-3 active:opacity-70"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name="add" size={iconSize.md} color={colors.primary} />
      <AppText variant="bodySm" weight="semibold" tone="accent">
        {label}
      </AppText>
    </Pressable>
  );
}
