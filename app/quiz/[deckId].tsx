import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useGameStore } from '../../store/useGameStore';
import { getSchedulerForDeck } from '../../data/schedulers';
import {
  COMBO_CAP,
  ROUND_MS,
  accuracy,
  applyAnswer,
  buildQuestion,
  playableCards,
  createRound,
  finishCleared,
  isDeckPlayable,
  tick,
  type QuizOption,
  type QuizQuestion,
  type RoundState,
} from '../../data/quiz';
import type { Flashcard } from '../../data/types';
import {
  AppText,
  EmptyState,
  GhostButton,
  GlassCard,
  IconButton,
  Pill,
  PrimaryButton,
  QuizAnswer,
  QuizSkeleton,
  Screen,
} from '../../components';
import type { QuizAnswerState } from '../../components';
import {
  alpha,
  colors,
  fills,
  glassFillAppBar,
  heights,
  iconSize,
  layout,
  motion,
} from '../../theme/tokens';
import { EASE, timingTo, useReveal } from '../../motion';

const TICK_MS = 100;
const CORRECT_REVEAL_MS = 320;
const WRONG_REVEAL_MS = 700;

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function QuizScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();

  const deck = useDeckStore((s) => s.decks.find((d) => d.id === deckId));
  const cards = useDeckStore((s) => s.cardsByDeck[deckId]);
  const loaded = useDeckStore((s) => s.loaded);
  const updateCard = useDeckStore((s) => s.updateCard);
  const logReview = useReviewStore((s) => s.logReview);
  const settings = useSettingsStore((s) => s.settings);

  const [phase, setPhase] = useState<'loading' | 'playing' | 'over'>('loading');
  // The order is fixed per round; the question itself is built lazily and
  // frozen, so a review that updates the store cannot reshuffle the options
  // while the answer is still on screen.
  const [order, setOrder] = useState<Flashcard[]>([]);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>(createRound);
  const [picked, setPicked] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);

  const roundRef = useRef(round);
  const submittedRef = useRef(false);
  const lockedRef = useRef(false);
  const shownAtRef = useRef(Date.now());
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTickRef = useRef(Date.now());
  const mountedRef = useRef(true);
  const timerWidth = useRef(new Animated.Value(1)).current;

  const correctSound = useAudioPlayer(require('../../assets/sfx/correct.wav'));
  const wrongSound = useAudioPlayer(require('../../assets/sfx/wrong.wav'));
  const comboSound = useAudioPlayer(require('../../assets/sfx/combo.wav'));
  const endSound = useAudioPlayer(require('../../assets/sfx/end.wav'));

  const answerDirections = useMemo(
    () =>
      new Map<string, 'ltr' | 'rtl'>(
        (cards ?? []).map((card): [string, 'ltr' | 'rtl'] => [card.id, card.back.direction])
      ),
    [cards]
  );

  const commitRound = useCallback((next: RoundState) => {
    roundRef.current = next;
    setRound(next);
  }, []);

  const playSfx = useCallback(
    (player: ReturnType<typeof useAudioPlayer>) => {
      if (settings.soundEnabled === false) return;
      try {
        void player
          .seekTo(0)
          .then(() => player.play())
          .catch(() => {});
      } catch {
        // Audio is garnish: a blocked player must never interrupt the round.
      }
    },
    [settings.soundEnabled]
  );

  const haptic = useCallback(
    (kind: 'success' | 'error' | 'combo' | 'end') => {
      if (Platform.OS === 'web' || settings.hapticsEnabled === false) return;
      try {
        if (kind === 'success') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (kind === 'error') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (kind === 'combo') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      } catch {
        // Unsupported device: silence is the correct fallback.
      }
    },
    [settings.hapticsEnabled]
  );

  // A game cue should sound even with the phone on silent; failure is harmless.
  useEffect(() => {
    try {
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    } catch {
      // Platform without an audio session.
    }
  }, []);

  const beginRound = useCallback(() => {
    if (!deck) return;
    const deckCards = useDeckStore.getState().getCards(deck.id);
    if (!isDeckPlayable(deckCards)) return;
    const nextOrder = shuffleCards(playableCards(deckCards));
    const firstQuestion = nextOrder[0] ? buildQuestion(nextOrder[0], deckCards) : null;
    if (!firstQuestion) return;

    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
    setOrder(nextOrder);
    setQuestion(firstQuestion);
    setIndex(0);
    setPicked(null);
    setNewBest(false);
    lockedRef.current = false;
    submittedRef.current = false;
    shownAtRef.current = Date.now();
    commitRound(createRound());
    setPhase('playing');
  }, [commitRound, deck]);

  // Decks and cards load asynchronously; start as soon as the deck is playable.
  useEffect(() => {
    if (phase !== 'loading' || !deck || !cards || !isDeckPlayable(cards)) return;
    beginRound();
  }, [phase, deck, cards, beginRound]);

  const endRound = useCallback(
    (state: RoundState, cleared: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const final = cleared ? finishCleared(state) : state;
      commitRound(final);
      setPhase('over');
      setPicked(null);
      playSfx(endSound);
      haptic('end');
      if (deck) {
        void useGameStore
          .getState()
          .submitRound(deck.id, final.score, final.bestCombo)
          .then((best) => {
            if (mountedRef.current) setNewBest(best);
          })
          .catch(() => {
            if (mountedRef.current) setNewBest(false);
          });
      }
    },
    [commitRound, deck, endSound, haptic, playSfx]
  );

  const endRoundRef = useRef(endRound);
  useEffect(() => {
    endRoundRef.current = endRound;
  }, [endRound]);

  // The clock only runs while a question is up and the round is live. Measure
  // real elapsed time: a throttled tab can fire this interval far less often
  // than 100ms, and a fixed decrement would then hand out a longer round.
  useEffect(() => {
    if (phase !== 'playing') return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      const next = tick(roundRef.current, elapsed);
      if (next === roundRef.current) return;
      roundRef.current = next;
      setRound(next);
      if (next.finished) endRoundRef.current(next, false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    timingTo(timerWidth, round.timeLeftMs / ROUND_MS, {
      duration: TICK_MS,
      easing: EASE.standard,
      nativeDriver: false,
    });
  }, [round.timeLeftMs, timerWidth]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
    },
    []
  );

  const persistAnswer = useCallback(
    async (cardId: string, correct: boolean, at: number) => {
      if (!deck) return;
      try {
        const scheduler = getSchedulerForDeck(deck);
        const card = useDeckStore.getState().getCards(deck.id).find((c) => c.id === cardId);
        if (!card) return;
        const { updatedCard, log } = scheduler.schedule(card, correct ? 3 : 1, new Date(at));
        await updateCard(card.id, { fsrs: updatedCard.fsrs });
        await logReview({
          cardId: card.id,
          deckId: deck.id,
          rating: correct ? 3 : 1,
          reviewedAt: at,
          elapsedMs: Math.max(0, at - shownAtRef.current),
          cardWasNew: card.fsrs.state === 'New',
          stateBefore: card.fsrs.state,
          fsrs: log,
        });
      } catch {
        // A malformed legacy card or a storage hiccup never stops the round.
      }
    },
    [deck, logReview, updateCard]
  );

  const answer = useCallback(
    (option: QuizOption) => {
      if (phase !== 'playing' || !question || lockedRef.current) return;
      lockedRef.current = true;
      setPicked(option.id);

      const at = Date.now();
      const next = applyAnswer(roundRef.current, option.correct);
      roundRef.current = next;
      setRound(next);

      if (option.correct) {
        playSfx(next.combo >= 3 ? comboSound : correctSound);
        haptic('success');
        if (next.combo >= 3) haptic('combo');
      } else {
        playSfx(wrongSound);
        haptic('error');
      }

      void persistAnswer(question.cardId, option.correct, at);

      if (next.finished) {
        endRound(next, false);
        return;
      }

      const answeredIndex = index;
      advanceRef.current = setTimeout(
        () => {
          advanceRef.current = null;
          if (submittedRef.current) return;
          const nextCard = order[answeredIndex + 1];
          const nextQuestion =
            nextCard && deck
              ? buildQuestion(nextCard, useDeckStore.getState().getCards(deck.id))
              : null;
          if (!nextCard || !nextQuestion) {
            endRoundRef.current(roundRef.current, true);
            return;
          }
          setIndex(answeredIndex + 1);
          setQuestion(nextQuestion);
          setPicked(null);
          lockedRef.current = false;
          shownAtRef.current = Date.now();
        },
        option.correct ? CORRECT_REVEAL_MS : WRONG_REVEAL_MS
      );
    },
    [
      phase,
      question,
      index,
      order,
      deck,
      playSfx,
      haptic,
      comboSound,
      correctSound,
      wrongSound,
      persistAnswer,
      endRound,
    ]
  );

  const questionReveal = useReveal(question?.cardId ?? 'none', {
    duration: motion.base,
    distance: 10,
  });
  const scoreReveal = useReveal(round.score, { duration: motion.fast, distance: 0, scale: 0.92 });
  const comboReveal = useReveal(round.combo, { duration: motion.fast, distance: 0, scale: 0.8 });
  const resultReveal = useReveal(phase === 'over', { duration: motion.base, distance: 12 });

  const lowTime = round.timeLeftMs <= 10_000;
  const accuracyValue = accuracy(round);
  const frontType = (question?.front.length ?? 0) > 34 ? 'title' : 'display';

  const header = (
    <View
      className="flex-row items-center px-2"
      style={[glassFillAppBar, { height: heights.appbar }]}
    >
      <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close quiz" />
      <View className="flex-1 items-center px-2">
        <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
          {deck?.name ?? 'Quiz'}
        </AppText>
        <AppText variant="caption" weight="medium" tone="muted">
          {phase === 'playing' && question ? `${index + 1} / ${order.length}` : '60s quiz'}
        </AppText>
      </View>
      <View className="items-end pr-2" style={{ minWidth: heights.icon }}>
        <View className="flex-row items-center gap-1">
          <MaterialIcons
            name="bolt"
            size={iconSize.xs}
            color={round.score > 0 ? colors.primary : colors.outline}
          />
          <Animated.View style={scoreReveal.style}>
            <AppText variant="bodyLg" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
              {round.score.toLocaleString('en-US')}
            </AppText>
          </Animated.View>
        </View>
      </View>
    </View>
  );

  // A missing card key is not a loading state: the store may legitimately have
  // no bucket for an old or empty deck. Only the store's own `loaded` flag can
  // tell us whether the first read has finished.
  if (!loaded) {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <QuizSkeleton />
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="search-off"
            title="Deck not found"
            titleVariant="headline"
            description="It may have been deleted. Go back to Game to pick another deck."
            action={
              <GhostButton
                label="Back to Game"
                className="px-6"
                onPress={() => router.replace('/(tabs)/library')}
              />
            }
          />
        </View>
      </Screen>
    );
  }

  if (!cards || !isDeckPlayable(cards)) {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="quiz"
            title="Not enough cards"
            titleVariant="headline"
            description="The quiz needs at least four cards with both sides filled in. Add a few more to this deck first."
            action={
              <GhostButton
                label="Back to deck"
                className="px-6"
                onPress={() => router.replace(`/deck/${deck.id}`)}
              />
            }
          />
        </View>
      </Screen>
    );
  }

  if (phase === 'loading') {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <QuizSkeleton />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      {/* Timer rail — 3px, refills on a correct answer, turns warning under 10s. */}
      <View style={{ height: 3, backgroundColor: fills.track }}>
        <Animated.View
          style={{
            height: '100%',
            width: timerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: lowTime ? colors.warning : colors.primary,
            borderRadius: 2,
            ...(lowTime ? {} : { boxShadow: `0 0 12px ${alpha(colors.primary, 0.45)}` }),
          }}
        />
      </View>

      {question ? (
        <View
          className="w-full flex-1 self-center px-5 pb-6"
          style={{ maxWidth: layout.contentMaxWidth }}
        >
          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons
                name="timer"
                size={iconSize.sm}
                color={lowTime ? colors.warning : colors.outline}
              />
              <AppText
                variant="bodySm"
                weight="semibold"
                tone={lowTime ? 'warning' : 'muted'}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatClock(round.timeLeftMs)}
              </AppText>
            </View>
            {round.combo > 0 && (
              <Animated.View style={comboReveal.style}>
                <Pill label={`×${Math.min(round.combo, COMBO_CAP)}`} tone="accent" />
              </Animated.View>
            )}
          </View>

          <View className="flex-1 justify-center py-4">
            <Animated.View style={questionReveal.style}>
              <GlassCard tone="accent">
                <AppText variant="label" weight="semibold" tone="accent" className="uppercase">
                  Pick the answer
                </AppText>
                <AppText
                  variant={frontType}
                  weight="bold"
                  align="center"
                  numberOfLines={4}
                  className="mt-3"
                  style={{ writingDirection: question.direction }}
                >
                  {question.front}
                </AppText>
              </GlassCard>
            </Animated.View>
          </View>

          <View className="gap-2.5">
            {[0, 2].map((start) => (
              <View key={start} className="flex-row gap-2.5">
                {question.options.slice(start, start + 2).map((option, offset) => {
                  const state: QuizAnswerState =
                    picked === null
                      ? 'idle'
                      : option.correct
                        ? 'correct'
                        : picked === option.id
                          ? 'wrong'
                          : 'dimmed';
                  return (
                    <QuizAnswer
                      key={option.id}
                      text={option.text}
                      state={state}
                      direction={answerDirections.get(option.id) ?? 'ltr'}
                      disabled={picked !== null}
                      onPress={() => answer(option)}
                      position={start + offset + 1}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {phase === 'over' && (
        <Animated.View style={[styles.result, resultReveal.style]}>
          <View className="w-full items-center px-5" style={{ maxWidth: layout.resultMaxWidth }}>
            <AppText variant="label" weight="semibold" tone="accent" className="uppercase">
              {round.cleared ? 'Deck cleared' : "Time's up"}
            </AppText>
            <AppText variant="display" className="mt-2" style={{ fontVariant: ['tabular-nums'] }}>
              {round.score.toLocaleString('en-US')}
            </AppText>
            <AppText variant="bodySm" tone="muted">
              points
            </AppText>
            {round.cleared && (
              <AppText variant="caption" weight="medium" tone="success" className="mt-1">
                Includes the +250 deck-cleared bonus
              </AppText>
            )}
            {newBest && (
              <View className="mt-3">
                <Pill label="New best" tone="accent" />
              </View>
            )}

            <GlassCard className="mt-6 w-full" padding="sm">
              <ResultRow label="Correct" value={String(round.correct)} />
              <ResultRow label="Wrong" value={String(round.wrong)} />
              <ResultRow
                label="Accuracy"
                value={accuracyValue === null ? '—' : `${Math.round(accuracyValue * 100)}%`}
              />
              <ResultRow label="Best combo" value={`×${round.bestCombo}`} last />
            </GlassCard>

            <PrimaryButton
              className="mt-6 w-full"
              label="Play again"
              icon="replay"
              onPress={beginRound}
            />
            <GhostButton
              className="mt-3"
              label="Back to Game"
              onPress={() => router.replace('/(tabs)/library')}
            />
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

/** Fisher-Yates: one uniform order per round, decided once. */
function shuffleCards<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One result readout; the same ledger rhythm as the settings plates. */
function ResultRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      className="flex-row items-center justify-between py-2.5"
    >
      <AppText variant="bodySm" tone="muted" className="flex-1">
        {label}
      </AppText>
      <AppText
        variant="bodySm"
        weight="semibold"
        className="ml-3"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  result: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
