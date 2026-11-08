import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
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
import { AppText, EmptyState, QuizSkeleton, Screen } from '../../components';
import { ActionButton, MetricGrid, Surface } from '../../components/v3';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  motion,
  radii,
  rims,
} from '../../theme/tokens';
import { v3 } from '../../theme/v3';
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]), [role="radio"]:not([aria-disabled="true"]), [role="switch"]:not([aria-disabled="true"]), [role="checkbox"]:not([aria-disabled="true"]), [role="tab"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function formatTimer(ms: number): string {
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Split the card's optional bracket annotation from its prompt. */
function splitPrompt(front: string): { main: string; bracket: string | null } {
  const match = front.match(/^(.*?)(\[[^\]]+\])$/s);
  if (!match) return { main: front, bracket: null };
  return { main: match[1].trimEnd(), bracket: match[2] };
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
  const key = String(Math.min(4, Math.max(1, position)));
  const chipColor = tint?.glyph ?? colors.outline;

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
        <Surface
          tone="pane"
          radius="pane"
          padding="none"
          style={{
            flex: 1,
            minHeight: v3.heights.quizAnswer,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: rims.soft,
            opacity: dimmed ? 0.42 : 1,
            ...(tint ? { backgroundColor: tint.fill } : {}),
          }}
        >
        {/*
          The numeral and the state badge sit in the pad's gutters as overlays,
          not inside it. The pad's own text has to stay exactly the answer: the
          quiz flow finds the correct option by comparing that text with the
          card's back, and an inline keycap would prefix every match.
        */}
        <Pressable
          onPress={onPress}
          onPressIn={disabled ? undefined : press.onPressIn}
          onPressOut={disabled ? undefined : press.onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          testID={`answer-${position}`}
          accessibilityLabel={`Answer ${position}: ${text}`}
          accessibilityState={{ disabled, selected: state === 'correct' }}
          style={{
            flex: 1,
            minHeight: v3.heights.quizAnswer,
            paddingLeft: 48,
            paddingRight: tint ? 44 : 12,
            paddingVertical: 10,
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="body"
            weight="semibold"
            numberOfLines={4}
            language={direction === 'rtl' ? 'fa' : undefined}
            style={{
              writingDirection: direction,
              textAlign: direction === 'rtl' ? 'right' : 'left',
            }}
          >
            {text}
          </AppText>
        </Pressable>

        <View
          aria-hidden
          accessible={false}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { left: 10, right: undefined, alignItems: 'flex-start', justifyContent: 'center' },
          ]}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: v3.radii.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceControl,
              borderWidth: 1,
              borderColor: rims.soft,
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: chipColor }}>
              {key}
            </AppText>
          </View>
        </View>

        {tint && (
          <View
            aria-hidden
            accessible={false}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                left: undefined,
                right: 10,
                alignItems: 'flex-end',
                justifyContent: 'center',
              },
            ]}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radii.pill,
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
          </View>
        )}
        </Surface>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

type HeaderControlProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * The quiz app bar's control: the mockup's 40px tile on a 44px target. The tile
 * keeps its resting hairline and only takes a fill on hover, so the bar reads as
 * a header rather than a row of buttons.
 */
function HeaderControl({ icon, label, onPress, disabled = false }: HeaderControlProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: heights.hit,
        height: heights.hit,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: v3.radii.tile,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: hovered ? colors.outlineSoft : rims.soft,
          backgroundColor: hovered ? colors.surfaceControl : 'transparent',
        }}
      >
        <MaterialIcons name={icon} size={iconSize.lg} color={colors.onSurface} />
      </View>
    </Pressable>
  );
}

/**
 * Quiz — the 60-second arena.
 *
 * One centred session column: three HUD tiles, a progress rail, the question
 * stage, four numbered answer pads and a one-line footer. The round's real
 * logic is intact: every answer is scheduled through the deck's scheduler and
 * written to the review log, the round is submitted once, and pausing stops the
 * clock instead of only hiding it.
 */
export default function QuizScreen() {
  const { deckId, mode: modeParam } = useLocalSearchParams<{ deckId: string; mode?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
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
  const [scoreGain, setScoreGain] = useState(0);
  const [paused, setPaused] = useState(false);
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
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
    setScoreGain(0);
    setPaused(false);
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
      // Capture the opener before the shell turns inert. The browser blurs
      // focused inert content, so reading activeElement after the render would
      // remember <body> instead of the quiz control.
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const active = document.activeElement;
        returnFocusRef.current =
          active instanceof HTMLElement && active !== document.body ? active : null;
      }
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
    if (phase !== 'playing' || paused) return;
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
  }, [phase, paused]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The result is a dialog over a finished round. The shell behind it is inert,
  // so this effect owns the whole keyboard story: focus moves inside, Tab cycles
  // between the result actions, Escape takes the same exit as "Back to Game",
  // and focus returns to the control that was active before the round ended.
  const resultRef = useRef<React.ComponentRef<typeof Animated.View> | null>(null);
  useEffect(() => {
    if (phase !== 'over' || Platform.OS !== 'web') return;
    const panel = resultRef.current as unknown as HTMLElement | null;
    if (!panel) return;
    const doc = document;
    panel.focus();

    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        router.replace('/(tabs)/library');
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;
      if (!active || !panel.contains(active) || active === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [phase, router]);

  // Wait for the next live round before restoring focus: the shell's inert
  // effect has been cleaned up by then, so the remembered control can accept it.
  useEffect(() => {
    if (phase !== 'playing' || Platform.OS !== 'web') return;
    const target = returnFocusRef.current;
    if (!target) return;
    returnFocusRef.current = null;
    if (target.isConnected) target.focus();
  }, [phase]);

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
      if (phase !== 'playing' || !question || lockedRef.current || paused) return;
      lockedRef.current = true;
      setPicked(option.id);

      const at = Date.now();
      const previousScore = roundRef.current.score;
      const next = applyAnswer(roundRef.current, option.correct);
      roundRef.current = next;
      setRound(next);
      setScoreGain(Math.max(0, next.score - previousScore));

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
      paused,
    ]
  );

  // Web shortcut: the four answer pads are also keys 1–4. The pads stay the
  // primary control; this only mirrors their action and ignores form fields.
  useEffect(() => {
    if (Platform.OS !== 'web' || phase !== 'playing' || paused || !question) return;

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
  }, [phase, question, answer, paused]);

  const questionReveal = useReveal(question?.cardId ?? 'none', {
    duration: motion.base,
    distance: 10,
  });
  const scoreReveal = useReveal(round.score, { duration: motion.fast, distance: 0, scale: 0.92 });
  const comboReveal = useReveal(round.combo, { duration: motion.fast, distance: 0, scale: 0.8 });
  const resultReveal = useReveal(phase === 'over', { duration: motion.base, distance: 12 });

  const pauseRef = useRef<React.ComponentRef<typeof Animated.View> | null>(null);
  const pauseReturnRef = useRef<HTMLElement | null>(null);

  // Pausing is a dialog, not a dead control: focus moves to it, Tab stays
  // between its two actions, and Escape is the same as Resume. The shell behind
  // it is inert, so nothing else is reachable while the clock is stopped.
  useEffect(() => {
    if (!paused || Platform.OS !== 'web') return;
    const panel = pauseRef.current as unknown as HTMLElement | null;
    if (!panel) return;
    const doc = document;
    panel.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPaused(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [paused]);

  // The shell was inert while paused, so the browser dropped focus. Put it back
  // on the control that opened the overlay once the overlay is gone.
  useEffect(() => {
    if (paused || Platform.OS !== 'web') return;
    const target = pauseReturnRef.current;
    if (!target) return;
    pauseReturnRef.current = null;
    if (target.isConnected) target.focus();
  }, [paused]);

  const lowTime = round.timeLeftMs <= 10_000;
  const accuracyValue = accuracy(round);
  const timerProgress = round.timeLeftMs / ROUND_MS;
  const timerLabel = formatTimer(round.timeLeftMs);
  const combo = Math.min(round.combo, COMBO_CAP);
  const deckIcon = (deck?.icon ?? 'style') as IconName;
  // Three tiles at 320px leave 88px each: the ring alone keeps the clock legible,
  // while a label column beside it would only crowd the digits.
  const roomyHud = width >= 380;
  // The card's trailing bracket ("[Akk]") is the only annotation it carries; it
  // is set on its own line in the accent, and no grammar note is invented.
  const prompt = question ? splitPrompt(question.front) : { main: '', bracket: null };
  const promptVariant = (question?.front.length ?? 0) > 34 ? 'title' : 'display';
  const progress = order.length > 0 ? Math.min(1, (index + 1) / order.length) : 0;

  const header = (
    <View style={{ backgroundColor: colors.appBarGlass }}>
      <View style={styles.header}>
        <HeaderControl
          icon="arrow-back"
          label="Close quiz"
          onPress={() => goBackOr(router, '/(tabs)/library')}
        />
        <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
          <AppText
            variant="label"
            weight="semibold"
            tone="muted"
            numberOfLines={1}
            style={{ letterSpacing: 1.6 }}
          >
            ACTIVE SESSION
          </AppText>
          <AppText
            variant="bodySm"
            weight="semibold"
            headingLevel={1}
            numberOfLines={1}
            style={{ marginTop: 1 }}
          >
            {deck?.name ?? 'Quiz'}
          </AppText>
        </View>
        <HeaderControl
          icon="pause"
          label="Pause quiz"
          disabled={phase !== 'playing'}
          onPress={() => {
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
              const active = document.activeElement;
              pauseReturnRef.current =
                active instanceof HTMLElement && active !== document.body ? active : null;
            }
            setPaused(true);
          }}
        />
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
        <View style={styles.centered}>
          <EmptyState
            icon="search-off"
            title="Deck not found"
            titleVariant="headline"
            description="It may have been deleted. Go back to Game to pick another deck."
            action={
              <ActionButton
                label="Back to Game"
                fullWidth={false}
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
        <View style={styles.centered}>
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
              <ActionButton
                label="Back to deck"
                fullWidth={false}
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

  const hud = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Surface
        tone="pane"
        radius="card"
        padding="none"
        style={[styles.hudTile, { borderRadius: v3.radii.quizTile }]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: roomyHud ? 10 : 0,
            justifyContent: roomyHud ? 'flex-start' : 'center',
          }}
        >
          <TimerRing
            size={roomyHud ? 48 : 42}
            progress={timerProgress}
            low={lowTime}
            label={timerLabel}
          />
          {roomyHud && (
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={[styles.hudLabel, { flex: 1, minWidth: 0 }]}
            >
              TIME
            </AppText>
          )}
        </View>
      </Surface>

      <Surface
        tone="pane"
        radius="card"
        padding="none"
        style={[styles.hudTile, { borderRadius: v3.radii.quizTile }]}
      >
        <View style={styles.hudTop}>
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.hudLabel}>
            SCORE
          </AppText>
          <MaterialIcons name="star" size={iconSize.xs} color={colors.outline} />
        </View>
        <View style={styles.hudValueRow}>
          <Animated.View style={scoreReveal.style}>
            <AppText
              variant={roomyHud ? 'headline' : 'bodyLg'}
              weight="bold"
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.6, flexShrink: 1 }}
            >
              {round.score.toLocaleString('en-US')}
            </AppText>
          </Animated.View>
          {scoreGain > 0 && (
            <AppText
              variant="caption"
              weight="semibold"
              tone="success"
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              +{scoreGain}
            </AppText>
          )}
        </View>
      </Surface>

      <Surface
        tone="pane"
        radius="card"
        padding="none"
        style={[styles.hudTile, { borderRadius: v3.radii.quizTile }]}
      >
        <View style={styles.hudTop}>
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.hudLabel}>
            COMBO
          </AppText>
          <MaterialIcons name="local-fire-department" size={iconSize.xs} color={colors.outline} />
        </View>
        <Animated.View style={[{ alignSelf: 'flex-start' }, styles.hudValueRow, comboReveal.style]}>
          <View
            style={{
              maxWidth: '100%',
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: combo > 0 ? alpha(colors.warning, 0.4) : rims.soft,
              backgroundColor: combo > 0 ? alpha(colors.warning, 0.12) : fills.control,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              tone={combo > 0 ? 'warning' : 'muted'}
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              Streak ×{combo}
            </AppText>
          </View>
        </Animated.View>
      </Surface>
    </View>
  );

  const isRtl = question.direction === 'rtl';

  return (
    <>
      <Screen
        edges={['top', 'bottom']}
        header={header}
        backgroundInert={phase === 'over' || paused}
      >
        {/*
          One polite channel for the round: whether the pad was right, the score
          and the combo, in a sentence. The HUD stays visual so nothing is
          announced twice, and the region is mounted for the whole round so the
          next message replaces the last one instead of arriving on mount.
        */}
        <View role="status" aria-live="polite" aria-atomic style={styles.liveRegion}>
          <AppText variant="bodySm">{announcement}</AppText>
        </View>

        <View style={styles.column}>
          {hud}

          <View style={styles.progressRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <View aria-hidden accessible={false} style={styles.progressDot} />
              <AppText
                variant="caption"
                weight="semibold"
                tone="muted"
                numberOfLines={1}
                style={{ letterSpacing: 1.2 }}
              >
                {`QUESTION ${String(index + 1).padStart(2, '0')} / ${String(order.length).padStart(2, '0')}`}
              </AppText>
            </View>
            <View aria-hidden accessible={false} style={styles.rail}>
              <View style={[styles.railFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 0, justifyContent: 'center', marginTop: 18 }}>
            <Surface tone="pane" radius="pane" padding="none" style={styles.stage}>
              <View style={styles.scenePill}>
                <MaterialIcons name="translate" size={iconSize.sm} color={colors.outline} />
                <AppText
                  variant="caption"
                  weight="medium"
                  tone="muted"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {mode === 'reverse' ? 'Pick the matching word' : 'Pick the correct translation'}
                </AppText>
              </View>

              <Animated.View
                style={[{ width: '100%', marginTop: 18 }, questionReveal.style]}
              >
                <AppText
                  variant={promptVariant}
                  weight="bold"
                  align="center"
                  numberOfLines={4}
                  language={isRtl ? 'fa' : undefined}
                  style={{ writingDirection: question.direction }}
                >
                  {prompt.main}
                </AppText>
                {prompt.bracket && (
                  <AppText
                    variant="headline"
                    weight="bold"
                    tone="accent"
                    align="center"
                    numberOfLines={1}
                    language={isRtl ? 'fa' : undefined}
                    style={{ marginTop: 2, writingDirection: question.direction }}
                  >
                    {prompt.bracket}
                  </AppText>
                )}
              </Animated.View>
            </Surface>
          </View>

          <View style={styles.answers}>
            {Array.from(
              { length: Math.ceil(question.options.length / 2) },
              (_, row) => question.options.slice(row * 2, row * 2 + 2)
            ).map((rowOptions, row) => (
              <View key={row} style={styles.answerRow}>
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
                      position={row * 2 + offset + 1}
                      direction={answerDirections.get(option.id) ?? 'ltr'}
                    />
                  );
                })}
                {rowOptions.length < 2 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <MaterialIcons
                name={lowTime ? 'schedule' : 'add-circle'}
                size={iconSize.sm}
                color={lowTime ? colors.warning : colors.success}
              />
              <AppText
                variant="caption"
                weight="semibold"
                tone={lowTime ? 'warning' : 'success'}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {lowTime ? 'Hurry — under 10s' : 'Correct answers buy +3s'}
              </AppText>
            </View>
            {Platform.OS === 'web' && (
              <AppText
                variant="caption"
                tone="tertiary"
                numberOfLines={1}
                style={{ marginLeft: 'auto' }}
              >
                Press 1–4 to answer
              </AppText>
            )}
          </View>
        </View>
      </Screen>

      {paused && phase === 'playing' && (
        <Animated.View
          ref={pauseRef}
          tabIndex={-1}
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Quiz paused"
          aria-label="Quiz paused"
          style={styles.scrim}
        >
          <Surface tone="scene" radius="pane" padding="none" style={styles.pausePanel}>
            <View style={styles.pauseIcon}>
              <MaterialIcons name="pause" size={iconSize.lg} color={colors.primary} />
            </View>
            <AppText
              variant="headline"
              weight="semibold"
              align="center"
              headingLevel={2}
              style={{ marginTop: 14 }}
            >
              Paused
            </AppText>
            <AppText variant="bodySm" tone="muted" align="center" style={{ marginTop: 6 }}>
              The clock is stopped. Your round picks up where it left off.
            </AppText>
            <View style={{ width: '100%', marginTop: 20 }}>
              <ActionButton label="Resume round" icon="play-arrow" onPress={() => setPaused(false)} />
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <ActionButton
                label="Back to Game"
                tone="quiet"
                onPress={() => router.replace('/(tabs)/library')}
              />
            </View>
            {Platform.OS === 'web' && (
              <AppText variant="caption" tone="tertiary" align="center" style={{ marginTop: 12 }}>
                Escape to resume
              </AppText>
            )}
          </Surface>
        </Animated.View>
      )}

      {phase === 'over' && (
        <Animated.View
          ref={resultRef}
          tabIndex={-1}
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={`Round result: ${round.score} points`}
          aria-label={`Round result: ${round.score} points`}
          style={[styles.result, resultReveal.style]}
        >
          <ScrollView
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={styles.resultContent}
            showsVerticalScrollIndicator={false}
          >
            <Surface tone="scene" radius="pane" padding="none" style={styles.resultPanel}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.deckTile, { backgroundColor: alpha(deck.color, 0.16) }]}>
                  <MaterialIcons name={deckIcon} size={iconSize.md} color={deck.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="caption" tone="muted" className="uppercase">
                    Round complete
                  </AppText>
                  <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                    {deck.name}
                  </AppText>
                </View>
              </View>

              <AppText
                variant="label"
                weight="semibold"
                tone="accent"
                className="uppercase"
                style={{ marginTop: 18 }}
              >
                {round.cleared ? 'Deck cleared' : "Time's up"}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <AppText
                  variant="display"
                  style={{
                    fontVariant: ['tabular-nums'],
                    fontSize: v3.type.result.fontSize,
                    lineHeight: v3.type.result.lineHeight,
                    letterSpacing: v3.type.result.letterSpacing,
                  }}
                >
                  {round.score.toLocaleString('en-US')}
                </AppText>
                <AppText variant="bodySm" tone="muted">
                  points
                </AppText>
              </View>
              {round.cleared && (
                <AppText variant="caption" weight="medium" tone="success" style={{ marginTop: 2 }}>
                  Includes the +250 deck-cleared bonus
                </AppText>
              )}
              {newBest && (
                <View style={styles.bestChip}>
                  <MaterialIcons name="emoji-events" size={iconSize.xs} color={colors.primary} />
                  <AppText variant="caption" weight="semibold" tone="accent">
                    New best
                  </AppText>
                </View>
              )}

              <MetricGrid
                columns={2}
                style={{ marginTop: 20 }}
                items={[
                  { label: 'Correct', value: String(round.correct) },
                  { label: 'Wrong', value: String(round.wrong) },
                  {
                    label: 'Accuracy',
                    value: accuracyValue === null ? '—' : `${Math.round(accuracyValue * 100)}%`,
                  },
                  { label: 'Best combo', value: `×${round.bestCombo}` },
                ]}
              />

              <View style={{ marginTop: 20, gap: 8 }}>
                <ActionButton label="Play again" icon="replay" onPress={beginRound} />
                <ActionButton
                  label="Back to Game"
                  tone="quiet"
                  onPress={() => router.replace('/(tabs)/library')}
                />
              </View>
            </Surface>
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: heights.pageHeader,
    width: '100%',
    maxWidth: v3.layout.quizMeasure,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  liveRegion: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: v3.layout.quizMeasure,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  hudTile: {
    flex: 1,
    minWidth: 0,
    height: v3.heights.quizHud,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hudTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  hudLabel: {
    letterSpacing: 1.1,
    flexShrink: 1,
  },
  hudValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  rail: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: fills.track,
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    minWidth: 6,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  stage: {
    flex: 1,
    width: '100%',
    minHeight: v3.heights.quizQuestion,
    // A short prompt would otherwise stretch the pane to half the canvas on a
    // desktop window; the wrapper centres it in the space that is left over.
    maxHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: rims.soft,
    overflow: 'hidden',
  },
  scenePill: {
    maxWidth: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: rims.soft,
    backgroundColor: fills.inset,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  answers: {
    gap: 10,
    marginTop: 14,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 10,
    minHeight: v3.heights.quizAnswer,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: fills.track,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.background, 0.9),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
  },
  pausePanel: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    padding: 20,
  },
  pauseIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.14),
  },
  bestChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: alpha(colors.primary, 0.12),
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  deckTile: {
    width: 38,
    height: 38,
    borderRadius: v3.radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  resultContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  resultPanel: {
    width: '100%',
    maxWidth: v3.layout.quizMeasure,
    padding: 20,
  },
});

