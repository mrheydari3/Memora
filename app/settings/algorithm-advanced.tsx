import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
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
  LearningStepRow,
  ToggleSwitch,
  BottomSheetModal,
  EmptyState,
  Field,
  Pill,
  IconButton,
  RevealItem,
} from '../../components';
import {
  ActionButton,
  PageHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
  Surface,
} from '../../components/v3';
import { colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

const DEFAULT_SM2_STEPS = ['12 hours', '1 day', '2 days', '3 days'];

const pluralSteps = (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`;

type StepList = 'fsrs' | 'relearn' | 'sm2';

export default function AlgorithmAdvancedScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string | string[] }>();
  const router = useRouter();
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
  const ledger: { label: string; value: string }[] =
    preset === 'general'
      ? [
          { label: 'Scheduler', value: 'SM-2' },
          { label: 'Steps', value: pluralSteps(deck?.learningSteps.length ?? steps.length) },
          {
            label: 'Multiplier',
            value: `× ${deck?.masteredIntervalMultiplier ?? multiplier}`,
          },
        ]
      : preset === 'fsrs'
        ? [
            { label: 'Learning', value: pluralSteps(savedParams.fsrsLearningSteps.length) },
            { label: 'Relearn', value: pluralSteps(savedParams.fsrsRelearningSteps.length) },
            { label: 'Reviews', value: savedParams.enableShortTerm ? 'Same day' : 'Off' },
          ]
        : [
            { label: 'Scheduler', value: 'Fast repetition' },
            { label: 'Due dates', value: 'None' },
            { label: 'Queue', value: 'In order' },
          ];

  const heroDescription =
    preset === 'fast'
      ? 'Fast repetition keeps every card available; there are no intervals to tune.'
      : preset === 'general'
        ? 'The SM-2 steps these cards pass through before long-term scheduling takes over.'
        : 'The steps these cards pass through before long-term scheduling takes over.';

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
  const header = (
    <PageHeader title="Advanced" back onBack={() => goBackOr(router, '/settings/algorithm')} />
  );

  // The store hydrates asynchronously, and the deck may legitimately have been
  // deleted while this screen was open. Say so instead of editing another deck.
  if (!deck && !loaded) {
    return (
      <Screen scroll gutter contentMaxWidth={v3.layout.contentMaxWidth} header={header}>
        <Surface tone="pane" radius="card" padding="md">
          <AppText variant="bodySm" tone="muted">
            Loading deck…
          </AppText>
        </Surface>
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen scroll gutter contentMaxWidth={v3.layout.contentMaxWidth} header={header}>
        <Surface tone="scene" padding="md">
          <EmptyState
            icon="layers-clear"
            title="No deck chosen"
            titleVariant="headline"
            description="Open this page from a deck's algorithm settings."
            action={
              <ActionButton
                label="Back"
                fullWidth={false}
                onPress={() => goBackOr(router, '/settings/algorithm')}
              />
            }
          />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={header}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="advanced-hero"
              eyebrow="Advanced"
              status={{
                label: preset === 'fsrs' ? 'FSRS' : preset === 'general' ? 'SM-2' : 'Fast',
                tone: 'accent',
              }}
              title={deckName}
              description={heroDescription}
              ledger={ledger}
            />
          </RevealItem>

          {preset === 'fast' && (
            <RevealItem index={1}>
              <SettingsChapter label="Fast repetition">
                <SettingsLine
                  icon="bolt"
                  tone={colors.warning}
                  title="No scheduling settings"
                  subtitle="Fast repetition never sets a due date; choose FSRS to tune spaced scheduling."
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          {preset === 'fsrs' && (
            <>
              <RevealItem index={1}>
                <SettingsChapter label="Learning phase">
                  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                    <AppText variant="bodySm" tone="muted">
                      New cards pass through short steps before FSRS takes over long-term scheduling.
                      Keep every step under one day — that is what the algorithm expects.
                    </AppText>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    {fsrsSteps.length === 0 ? (
                      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
                          label={`FSRS learning step ${i + 1}`}
                          isFirst={false}
                          onEdit={() => openStepEditor('fsrs', i, step)}
                          onRemove={() => removeStep('fsrs', i)}
                        />
                      ))
                    )}
                  </View>
                  <SettingsLine
                    icon="add"
                    title="Add learning step"
                    onPress={() => addStep('fsrs')}
                    last
                  />
                </SettingsChapter>
              </RevealItem>

              <RevealItem index={2}>
                <SettingsChapter label="Relearning phase">
                  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                    <AppText variant="bodySm" tone="muted">
                      Steps a review card goes through after you press Again.
                    </AppText>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    {relearnSteps.length === 0 ? (
                      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
                          label={`FSRS relearning step ${i + 1}`}
                          isFirst={false}
                          onEdit={() => openStepEditor('relearn', i, step)}
                          onRemove={() => removeStep('relearn', i)}
                        />
                      ))
                    )}
                  </View>
                  <SettingsLine
                    icon="add"
                    title="Add relearning step"
                    onPress={() => addStep('relearn')}
                    last
                  />
                </SettingsChapter>
              </RevealItem>

              <RevealItem index={3}>
                <SettingsChapter label="Scheduling behaviour">
                  <SettingsLine
                    icon="short-text"
                    title="Short-term"
                    subtitle="Use steps for same-day reviews"
                    trailing={
                      <ToggleSwitch
                        value={shortTerm}
                        onToggle={setShortTerm}
                        accessibilityLabel="Short-term scheduling"
                      />
                    }
                  />
                  <SettingsLine
                    icon="shuffle"
                    title="Fuzz intervals"
                    subtitle="Add randomness to long gaps"
                    trailing={
                      <ToggleSwitch
                        value={fuzz}
                        onToggle={setFuzz}
                        accessibilityLabel="Fuzz intervals"
                      />
                    }
                    last
                  />
                </SettingsChapter>
              </RevealItem>
            </>
          )}

          {preset === 'general' && (
            <>
              <RevealItem index={1}>
                <SettingsChapter label="Learning phase">
                  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                    <AppText variant="bodySm" tone="muted">
                      New cards go through a short learning phase with gradually increasing intervals
                      before graduating to the main schedule.
                    </AppText>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    {steps.map((step, i) => (
                      <LearningStepRow
                        key={`${step}-${i}`}
                        index={i}
                        step={step}
                        label={`SM-2 learning step ${i + 1}`}
                        isFirst={i === 0}
                        onEdit={() => openStepEditor('sm2', i, step)}
                        onRemove={() => removeStep('sm2', i)}
                      />
                    ))}
                  </View>
                  <SettingsLine icon="add" title="Add step" onPress={() => addStep('sm2')} last />
                </SettingsChapter>
              </RevealItem>

              <RevealItem index={2}>
                <SettingsChapter label="Mastered phase">
                  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                    <AppText variant="bodySm" tone="muted">
                      After graduating from the learning phase, cards enter the mastered phase with
                      longer intervals.
                    </AppText>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    <SettingsLine
                      icon="speed"
                      title="Starting interval"
                      subtitle="Multiplier applied to the first mastered interval"
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                      last
                    />
                  </View>
                </SettingsChapter>
              </RevealItem>
            </>
          )}

          {preset !== 'fast' && (
            <RevealItem index={4}>
              {dirty ? (
                <ActionButton
                  label="Save changes"
                  onPress={async () => {
                    await save();
                  }}
                />
              ) : (
                <SettingsFootnote icon="check-circle">No changes to save</SettingsFootnote>
              )}
            </RevealItem>
          )}
        </View>
      </View>

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
        <View style={{ marginTop: 12 }}>
          <ActionButton label="Save step" onPress={commitStep} />
        </View>
      </BottomSheetModal>
    </Screen>
  );
}
