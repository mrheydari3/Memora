import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
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
  createRound,
  finishCleared,
  isDeckPlayable,
  playableCards,
  tick,
  type QuizMode,
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
  QuizSkeleton,
  Screen,
} from '../../components';
import { StartButton } from '../../components/v2';
import {
  alpha,
  colors,
  fills,
  glassFill,
  glassFillAppBar,
  heights,
  iconSize,
  layout,
  motion,
  rims,
} from '../../theme/tokens';
import { v2 } from '../../theme/v2';
import {
  springToAsync,
  timingTo,
  usePressFeedback,
  useReveal,
} from '../../motion';

const TICK_MS = 100;
const CORRECT_REVEAL_MS = 320;
const WRONG_REVEAL_MS = 700;
/** How long the red pad stays still before it starts leaving. */
const WRONG_HOLD_MS = 320;

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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

/**
 * The round's clock as a ring. The arc is the remaining time; the number in
 * the middle is the same clock every other surface shows. The ring turns to
 * the warning tone under 10 seconds and is decorative: the time is text.
 */
function TimerRing({
  size,
  progress,
  low,
  label,
}: {
  size: number;
  progress: number;
  low: boolean;
  label: string;
}) {
  const stroke = Math.max(5, Math.round(size / 20));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fills.track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={low ? colors.warning : colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/*
        Size and leading are inline on purpose. Setting them as `text-[…]`
        utilities lost to the variant's own font-size, so the 56px ring drew
        34px digits inside a 20px line box and cut them in half; matching values
        in one place keeps the two branches honest.
      */}
      <AppText
        variant="display"
        style={{
          fontVariant: ['tabular-nums'],
          color: low ? colors.warning : undefined,
          fontSize: size > 100 ? 32 : 17,
          lineHeight: size > 100 ? 36 : 22,
          letterSpacing: size > 100 ? -1.1 : -0.3,
        }}
      >
        {label}
      </AppText>
      {size > 100 && (
        <AppText variant="caption" tone="muted">
          left
        </AppText>
      )}
    </View>
  );
}

type ArenaAnswerState = 'idle' | 'correct' | 'wrong' | 'dimmed';

const ARENA_TINT: Record<
  Exclude<ArenaAnswerState, 'idle' | 'dimmed'>,
  { fill: string; glyph: string }
> = {
  correct: { fill: alpha(colors.success, 0.16), glyph: colors.success },
  wrong: { fill: alpha(colors.error, 0.26), glyph: colors.error },
};

type ArenaAnswerProps = {
  text: string;
  state: ArenaAnswerState;
  disabled: boolean;
  onPress: () => void;
  position: number;
  direction: 'ltr' | 'rtl';
  /** Wrong answers leave the grid instead of vanishing with the next card. */
  exiting?: boolean;
};

/**
 * One answer pad. A huge, quiet watermark numeral gives the game surface its
 * rhythm; the small keycap was removed so the answer itself is the only thing
 * competing for the eye. The pad dips and settles exactly like a rating key.
 */
function ArenaAnswer({
  text,
  state,
  disabled,
  onPress,
  position,
  direction,
  exiting = false,
}: ArenaAnswerProps) {
  const press = usePressFeedback({ scale: 0.975 });
  const pop = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const tint = state === 'correct' || state === 'wrong' ? ARENA_TINT[state] : null;
  const dimmed = state === 'dimmed';

  useEffect(() => {
    if (state !== 'correct' && state !== 'wrong') return;
    pop.setValue(0);
    // The pad pops and settles through the motion layer, which owns the driver
    // and the reduce-motion path: with the preference on, both steps land on
    // their end value at once and the pad stays still.
    void springToAsync(pop, 1).then(() => springToAsync(pop, 0));
  }, [state, pop]);

  // The red pad holds still just long enough to be read, then leaves the grid.
  // `timingTo` keeps the reduce-motion path (it jumps to the end) in one place.
  useEffect(() => {
    if (!exiting) {
      exit.setValue(0);
      return;
    }
    void timingTo(exit, 1, { duration: motion.fast });
  }, [exiting, exit]);

  const exitStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
      { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
    ],
  };

  return (
    <Animated.View style={[{ flex: 1 }, exitStyle]}>
      <Animated.View style={[{ flex: 1 }, press.style]}>
        <Animated.View
          style={{
            flex: 1,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }],
          }}
        >
        <Pressable
          onPress={onPress}
          onPressIn={disabled ? undefined : press.onPressIn}
          onPressOut={disabled ? undefined : press.onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          testID={`answer-${position}`}
          accessibilityState={{ disabled, selected: state === 'correct' }}
          style={{
            flex: 1,
            minHeight: heights.quizAnswer + 6,
            borderRadius: v2.radii.card,
            backgroundColor: tint?.fill ?? fills.tile,
            opacity: dimmed ? 0.42 : 1,
            overflow: 'hidden',
            borderTopWidth: 1,
            borderTopColor: rims.tile,
            paddingHorizontal: 14,
            paddingVertical: 12,
            justifyContent: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText
              variant="body"
              weight="semibold"
              numberOfLines={4}
              language={direction === 'rtl' ? 'fa' : undefined}
              style={{
                flex: 1,
                writingDirection: direction,
                textAlign: direction === 'rtl' ? 'right' : 'left',
              }}
            >
              {text}
            </AppText>

            {tint && (
              <View
                aria-hidden
                accessible={false}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(tint.glyph, 0.16),
                }}
              >
                <MaterialIcons
                  name={state === 'correct' ? 'check' : 'close'}
                  size={iconSize.sm}
                  color={tint.glyph}
                />
              </View>
            )}
          </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function RoundStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        backgroundColor: fills.inset,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: rims.tile,
      }}
    >
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

function ResultRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: fills.track,
      }}
    >
      <AppText variant="bodySm" tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText
        variant="bodySm"
        weight="semibold"
        style={{ marginLeft: 12, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Quiz — the 60-second arena.
 *
 * The round's clock is a ring, the score and streak live on a scoreboard, the
 * question sits on a lit stage, and the four answers are game pads. The real
 * round logic is intact: every answer is scheduled through the deck's
 * scheduler and written to the review log, and the round is submitted once.
 */
export default function QuizScreen() {
  const { deckId, mode: modeParam } = useLocalSearchParams<{ deckId: string; mode?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const mode: QuizMode = modeParam === 'reverse' ? 'reverse' : 'forward';

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
  const [exitingWrongId, setExitingWrongId] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  /** The round's result in words, for the polite live region below. */
  const [announcement, setAnnouncement] = useState('');

  const roundRef = useRef(round);
  const submittedRef = useRef(false);
  const lockedRef = useRef(false);
  const shownAtRef = useRef(Date.now());
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTickRef = useRef(Date.now());
  const mountedRef = useRef(true);

  const correctSound = useAudioPlayer(require('../../assets/sfx/correct.wav'));
  const wrongSound = useAudioPlayer(require('../../assets/sfx/wrong.wav'));
  const comboSound = useAudioPlayer(require('../../assets/sfx/combo.wav'));
  const endSound = useAudioPlayer(require('../../assets/sfx/end.wav'));

  const answerDirections = useMemo(
    () =>
      new Map<string, 'ltr' | 'rtl'>(
        (cards ?? []).map((card): [string, 'ltr' | 'rtl'] => [
          card.id,
          mode === 'reverse' ? card.front.direction : card.back.direction,
        ])
      ),
    [cards, mode]
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
    if (!isDeckPlayable(deckCards, mode)) return;
    const nextOrder = shuffleCards(playableCards(deckCards));
    const firstQuestion = nextOrder[0]
      ? buildQuestion(nextOrder[0], deckCards, Math.random, mode)
      : null;
    if (!firstQuestion) return;

    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setExitingWrongId(null);
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
  }, [commitRound, deck, mode]);

  // Decks and cards load asynchronously; start as soon as the deck is playable.
  useEffect(() => {
    if (phase !== 'loading' || !deck || !cards || !isDeckPlayable(cards, mode)) return;
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
      setAnnouncement(
        `${cleared ? 'Deck cleared' : "Time's up"}. ${final.score} points, ${final.correct} correct.`
      );
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
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

      // The pad answers with colour and sound; a screen reader gets the same
      // result as one sentence through the live region rendered below.
      setAnnouncement(
        option.correct
          ? `Correct. Score ${next.score}${
              next.combo >= 2 ? `, combo ${Math.min(next.combo, COMBO_CAP)}` : ''
            }.`
          : `Wrong. The answer was ${
              question.options.find((entry) => entry.correct)?.text ?? 'shown above'
            }. Score ${next.score}.`
      );

      void persistAnswer(question.cardId, option.correct, at);

      if (next.finished) {
        endRound(next, false);
        return;
      }

      if (!option.correct) {
        // Hold the red long enough to read, then let the pad leave the grid
        // while the next question is already on its way in.
        exitTimerRef.current = setTimeout(() => {
          exitTimerRef.current = null;
          setExitingWrongId(option.id);
        }, WRONG_HOLD_MS);
      }

      const answeredIndex = index;
      advanceRef.current = setTimeout(
        () => {
          advanceRef.current = null;
          if (submittedRef.current) return;
          const nextCard = order[answeredIndex + 1];
          const nextQuestion =
            nextCard && deck
              ? buildQuestion(
                  nextCard,
                  useDeckStore.getState().getCards(deck.id),
                  Math.random,
                  mode
                )
              : null;
          if (!nextCard || !nextQuestion) {
            endRoundRef.current(roundRef.current, true);
            return;
          }
          setIndex(answeredIndex + 1);
          setQuestion(nextQuestion);
          setPicked(null);
          setExitingWrongId(null);
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
      mode,
    ]
  );

  // Web shortcut: the four answer pads are also keys 1–4. The pads stay the
  // primary control; this only mirrors their action and ignores form fields.
  useEffect(() => {
    if (Platform.OS !== 'web' || phase !== 'playing' || !question) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      const optionIndex = Number(event.key) - 1;
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
        return;
      }
      event.preventDefault();
      const option = question.options[optionIndex];
      if (option) answer(option);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, question, answer]);

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
  const timerProgress = round.timeLeftMs / ROUND_MS;
  const timerLabel = formatClock(round.timeLeftMs);
  const deckIcon = (deck?.icon ?? 'style') as IconName;

  // Two columns at 320px leave roughly 50px for an answer, so a long Persian or
  // German translation is cut after three lines. Below 380px the pads stack
  // instead, and every option keeps its whole sentence.
  const answerColumns = width < 380 ? 1 : 2;

  const header = (
    <View
      className="flex-row items-center px-2"
      style={[glassFillAppBar, { height: heights.appbar }]}
    >
      <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close quiz" />
      <View className="flex-1 items-center px-2">
        <AppText variant="bodySm" weight="semibold" numberOfLines={1} headingLevel={1}>
          {deck?.name ?? 'Quiz'}
        </AppText>
        <AppText variant="caption" weight="medium" tone="muted">
          {phase === 'playing' && question ? `${index + 1} / ${order.length}` : '60s quiz'}
        </AppText>
      </View>
      <View style={{ width: heights.icon, height: heights.icon }} />
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

  if (!cards || !isDeckPlayable(cards, mode)) {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="quiz"
            title="Not enough cards"
            titleVariant="headline"
            description={
              mode === 'reverse'
                ? 'Reverse needs at least four cards with both sides filled in and four distinct words to choose from.'
                : 'The quiz needs at least four cards with both sides filled in and four distinct meanings to choose from.'
            }
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

  if (phase === 'loading' || !question) {
    return (
      <Screen edges={['top', 'bottom']} header={header}>
        <QuizSkeleton />
      </Screen>
    );
  }

  const scoreboard = (
    <View
      style={[
        glassFill,
        {
          // The row stretches both panels to the arena height; the board has to
          // opt into that height for its own middle band to be distributed.
          flex: 1,
          minHeight: 0,
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={{ padding: v2.spacing.panel, flex: 1, minHeight: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Round
          </AppText>
          {round.combo > 0 && (
            <Animated.View style={comboReveal.style}>
              <Pill label={`×${Math.min(round.combo, COMBO_CAP)}`} tone="accent" />
            </Animated.View>
          )}
        </View>

        {/* Both panels fill the arena, so the clock and score take the middle
            of the column instead of ending the board two thirds down it. */}
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 0 }}>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <TimerRing size={156} progress={timerProgress} low={lowTime} label={timerLabel} />
          </View>

          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <AppText variant="caption" tone="muted" className="uppercase">
              Score
            </AppText>
            <Animated.View style={scoreReveal.style}>
              <AppText
                variant="display"
                style={{
                  fontVariant: ['tabular-nums'],
                  fontSize: 44,
                  lineHeight: 48,
                  letterSpacing: -1.6,
                }}
              >
                {round.score.toLocaleString('en-US')}
              </AppText>
            </Animated.View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <RoundStat label="Streak" value={`×${Math.min(round.combo, COMBO_CAP)}`} />
          <RoundStat label="Correct" value={String(round.correct)} />
        </View>

        <View
          style={{
            marginTop: 16,
            borderTopWidth: 1,
            borderTopColor: fills.track,
            paddingTop: 14,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(deck.color, 0.16),
              }}
            >
              <MaterialIcons name={deckIcon} size={iconSize.md} color={deck.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                {deck.name}
              </AppText>
              <AppText variant="caption" tone="muted">
                Question {index + 1} of {order.length}
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="track-changes" size={iconSize.sm} color={colors.outline} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              {accuracyValue === null
                ? 'Accuracy appears after the first answer'
                : `${Math.round(accuracyValue * 100)}% accuracy`}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );

  const mobileHud = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 20,
        backgroundColor: fills.inset,
        borderTopWidth: 1,
        borderTopColor: rims.tile,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <TimerRing size={56} progress={timerProgress} low={lowTime} label={timerLabel} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="caption" tone="muted" className="uppercase">
          Score
        </AppText>
        <AppText
          variant="headline"
          style={{ fontVariant: ['tabular-nums'], fontSize: 24, lineHeight: 28 }}
        >
          {round.score.toLocaleString('en-US')}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="caption" tone="muted" className="uppercase">
          Streak
        </AppText>
        <Pill
          label={`×${Math.min(round.combo, COMBO_CAP)}`}
          tone={round.combo > 0 ? 'accent' : 'neutral'}
        />
      </View>
    </View>
  );

  const stage = (
    <View
      style={[
        glassFill,
        {
          flex: 1,
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
          overflow: 'hidden',
          padding: v2.spacing.panel,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Question {String(index + 1).padStart(2, '0')}
          </AppText>
          <AppText variant="caption" tone="muted">
            {mode === 'reverse' ? 'Pick the matching word' : 'Pick the correct translation'}
          </AppText>
        </View>
      </View>

      {/* The stage owns the leftover height, so the question sits in the middle
          of it and the pads stay on the bottom edge. Without this flex the
          panel kept a dead strip under the footer on a tall desktop window. */}
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
        <Animated.View style={questionReveal.style}>
          <AppText
            variant={frontType}
            weight="bold"
            align="center"
            numberOfLines={4}
            style={{ writingDirection: question.direction }}
          >
            {question.front}
          </AppText>
        </Animated.View>
      </View>

      <View style={{ gap: 10 }}>
        {Array.from(
          { length: Math.ceil(question.options.length / answerColumns) },
          (_, row) => question.options.slice(row * answerColumns, (row + 1) * answerColumns)
        ).map((rowOptions, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
            {rowOptions.map((option, offset) => {
              const state: ArenaAnswerState =
                picked === null
                  ? 'idle'
                  : option.correct
                    ? 'correct'
                    : picked === option.id
                      ? 'wrong'
                      : 'dimmed';
              return (
                <ArenaAnswer
                  key={option.id}
                  text={option.text}
                  state={state}
                  disabled={picked !== null}
                  exiting={option.id === exitingWrongId}
                  onPress={() => answer(option)}
                  position={row * answerColumns + offset + 1}
                  direction={answerDirections.get(option.id) ?? 'ltr'}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: fills.track,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText
            variant="caption"
            weight="semibold"
            tone={lowTime ? 'warning' : 'accent'}
            align="right"
          >
            {lowTime ? 'Hurry — under 10s' : 'Correct answers buy +3s'}
          </AppText>
          {Platform.OS === 'web' && (
            <AppText variant="caption" tone="tertiary" align="right" className="mt-1">
              Press 1–4 to answer
            </AppText>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      {/*
        One polite channel for the round: whether the pad was right, the score
        and the combo, in a sentence. The scoreboard stays visual so nothing is
        announced twice, and the region is mounted for the whole round so the
        next message replaces the last one instead of arriving on mount.
      */}
      <View
        role="status"
        aria-live="polite"
        aria-atomic
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        <AppText variant="bodySm">{announcement}</AppText>
      </View>

      <View
        className="w-full flex-1 self-center px-5 pb-6"
        style={{ maxWidth: v2.layout.contentMaxWidth }}
      >
        <View style={{ flex: 1, marginTop: 16 }}>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 20, flex: 1 }}>
              <View style={{ width: 300, flexShrink: 0 }}>{scoreboard}</View>
              <View style={{ flex: 1, minWidth: 0 }}>{stage}</View>
            </View>
          ) : (
            <View style={{ flex: 1, gap: 12 }}>
              {mobileHud}
              {stage}
            </View>
          )}
        </View>
      </View>

      {phase === 'over' && (
        <Animated.View style={[styles.result, resultReveal.style]}>
          <View className="w-full items-center px-5" style={{ maxWidth: layout.resultMaxWidth }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(deck.color, 0.16),
                }}
              >
                <MaterialIcons name={deckIcon} size={iconSize.md} color={deck.color} />
              </View>
              <View>
                <AppText variant="caption" tone="muted" className="uppercase">
                  Round complete
                </AppText>
                <AppText variant="bodySm" weight="semibold">
                  {deck.name}
                </AppText>
              </View>
            </View>

            <AppText variant="label" weight="semibold" tone="accent" className="uppercase">
              {round.cleared ? 'Deck cleared' : "Time's up"}
            </AppText>
            <AppText
              variant="display"
              className="mt-2"
              style={{
                fontVariant: ['tabular-nums'],
                fontSize: 64,
                lineHeight: 68,
                letterSpacing: -2.24,
              }}
            >
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

            <View style={{ marginTop: 24, width: '100%' }}>
              <StartButton label="Play again" onPress={beginRound} />
            </View>
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
