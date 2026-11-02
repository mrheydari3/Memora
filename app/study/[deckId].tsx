import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getSchedulerForDeck } from '../../data/schedulers';
import { buildStudyQueue } from '../../data/session';
import { RatingButtonRow } from '../../components/RatingButtonRow';
import { FlashcardView } from '../../components/Flashcard';
import {
  AppText,
  Screen,
  IconButton,
  PrimaryButton,
  GhostButton,
  EmptyState,
} from '../../components';
import {
  alpha,
  colors,
  fills,
  glassFillStrong,
  heights,
  iconSize,
  motion,
} from '../../theme/tokens';
import { EASE, REVEAL_OPACITY_FLOOR, timingTo, useReveal } from '../../motion';
import { speakCard, speak } from '../../services/tts';
import type { Flashcard, FSRSLogSnapshot, Rating, RatingButtonLabel } from '../../data/types';

/** Format a stability value (in days) for the memory-state chip. */
function formatStability(days: number): string {
  if (days >= 1) return `${days.toFixed(1)}d`;
  const minutes = Math.round(days * 24 * 60);
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.max(1, minutes)}m`;
}

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();

  const deck = useDeckStore((s) => s.decks.find((d) => d.id === deckId));
  const updateCard = useDeckStore((s) => s.updateCard);
  const logReview = useReviewStore((s) => s.logReview);
  const removeLastReview = useReviewStore((s) => s.removeLastReview);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);

  // Session queue
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  // When the current card was first shown. Review time is recorded per card;
  // using time-since-session-start inflated the statistics by counting the
  // whole session again on every answer.
  const [cardShownAt, setCardShownAt] = useState(() => Date.now());
  // The last review, kept so it can be undone exactly.
  const [lastUndo, setLastUndo] = useState<{ preCard: Flashcard; log: FSRSLogSnapshot } | null>(
    null
  );

  // Session chrome motion: the progress bar eases between fractions and the
  // question-side controls settle in as each card arrives. The card itself
  // leaves in the rating's direction before the schedule advances.
  const progressValue = useRef(new Animated.Value(0)).current;
  const footerReveal = useRef(new Animated.Value(0)).current;
  const cardExit = useRef(new Animated.Value(0)).current;
  const exitShift = useRef(16);
  const [advancing, setAdvancing] = useState(false);

  const currentCard = queue[index];

  // Reset the exit once the next card is mounted, so the outgoing card never
  // flashes back for a frame between the two.
  useEffect(() => {
    cardExit.setValue(0);
  }, [currentCard?.id, cardExit]);

  // The memory chip, the completion panel and the footer each settle in once.
  const memoryReveal = useReveal(showAnswer, { duration: motion.base, distance: 6 });
  const doneReveal = useReveal(currentCard ? 'session' : 'done');

  const scheduler = useMemo(() => (deck ? getSchedulerForDeck(deck) : null), [deck]);

  // Build session queue on mount
  useEffect(() => {
    if (!deck) return;
    const cards = useDeckStore.getState().getCards(deck.id);
    const log = useReviewStore.getState().reviewLog;
    const { newCards, dueCards } = buildStudyQueue(deck, cards, log);

    let next = [...newCards, ...dueCards];
    if (deck.shuffleCards) {
      next = next.sort(() => Math.random() - 0.5);
    }
    setQueue(next);
  }, [deck]);

  // Compute interval previews for the current card. `now` is pinned to when the
  // card appeared: FSRS fuzz is seeded from the review instant, so recomputing
  // with `new Date()` on every render would make the four labels drift.
  const previewNow = useMemo(() => new Date(cardShownAt), [cardShownAt]);

  const previews: RatingButtonLabel[] = useMemo(() => {
    if (!currentCard || !scheduler) return [];
    return scheduler.getIntervalPreviews(currentCard, previewNow);
  }, [currentCard, scheduler, previewNow]);

  // Memory state (stability / difficulty / retrievability) before this review.
  const memoryState = useMemo(() => {
    if (!currentCard || !scheduler?.getRetrievability) return null;
    if (currentCard.fsrs.state === 'New' || currentCard.fsrs.stability <= 0) return null;
    const retrievability = scheduler.getRetrievability(currentCard, previewNow);
    if (retrievability === null) return null;
    return {
      stability: formatStability(currentCard.fsrs.stability),
      difficulty: currentCard.fsrs.difficulty.toFixed(1),
      retrievability: `${Math.round(retrievability * 100)}%`,
    };
  }, [currentCard, scheduler, previewNow]);

  // TTS: auto-play per settings when a new card appears
  useEffect(() => {
    if (!currentCard) return;
    speakCard(currentCard.front.text, currentCard.back.text, {
      ttsEnabled: settings.ttsEnabled,
      ttsReadWholeCard: settings.ttsReadWholeCard,
      ttsAutoPlay: settings.ttsAutoPlay,
      ttsFrontVoiceLang: settings.ttsFrontVoiceLang,
      ttsBackVoiceLang: settings.ttsBackVoiceLang,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id]);

  // TTS: read the back aloud on reveal (when not already reading whole card)
  useEffect(() => {
    if (!showAnswer || !currentCard || !settings.ttsEnabled || settings.ttsReadWholeCard) return;
    if (!settings.ttsAutoPlay) return;
    speak({ text: currentCard.back.text, language: settings.ttsBackVoiceLang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer]);

  const progressTarget =
    queue.length > 0 ? (index + (showAnswer ? 0.5 : 0)) / queue.length : 0;

  useEffect(() => {
    // Width is a layout property, so it cannot run on the native driver.
    timingTo(progressValue, progressTarget, {
      duration: motion.flip,
      easing: EASE.standard,
      nativeDriver: false,
    });
  }, [progressTarget, progressValue]);

  useEffect(() => {
    footerReveal.setValue(0);
    timingTo(footerReveal, 1, { duration: motion.slow, delay: 40 });
  }, [showAnswer, index, footerReveal]);

  const speakCurrentSide = () => {
    if (!currentCard || !settings.ttsEnabled) return;
    if (showAnswer) {
      speak({ text: currentCard.back.text, language: settings.ttsBackVoiceLang });
    } else {
      speak({ text: currentCard.front.text, language: settings.ttsFrontVoiceLang });
    }
  };

  const handleRate = async (rating: Rating) => {
    if (!currentCard || !deck || !scheduler || advancing) return;

    // Let the card leave first (the schedule updates behind it), so the next
    // card arrives instead of the old one snapping to a new layout.
    setAdvancing(true);
    exitShift.current = rating <= 2 ? -16 : 16;
    await timingTo(cardExit, 1, { duration: motion.fast, easing: EASE.standard });

    const now = Date.now();
    const { updatedCard, log } = scheduler.schedule(currentCard, rating, new Date(now));

    // Persist updated card + review log. The snapshot records the pre-review
    // memory state, which is what undo and (later) parameter optimization need.
    await updateCard(currentCard.id, { fsrs: updatedCard.fsrs });
    await logReview({
      cardId: currentCard.id,
      deckId: deck.id,
      rating,
      reviewedAt: now,
      elapsedMs: Math.max(0, now - cardShownAt),
      cardWasNew: currentCard.fsrs.state === 'New',
      fsrs: log,
    });

    setLastUndo(log ? { preCard: currentCard, log } : null);

    // Fast Repetition: no advancement — re-queue the card by rating.
    // Again = re-insert near front, Easy = push near back.
    if (deck.algorithmPreset === 'fast') {
      const next = [...queue];
      next.splice(index, 1);
      if (rating === 1) {
        next.splice(index, 0, currentCard);
      } else if (rating === 2) {
        next.splice(Math.min(next.length, index + Math.ceil((next.length - index) / 3)), 0, currentCard);
      } else if (rating === 3) {
        next.splice(Math.min(next.length, index + Math.ceil((2 * (next.length - index)) / 3)), 0, currentCard);
      } else {
        next.push(currentCard);
      }
      setQueue(next);
      setShowAnswer(false);
      setCardShownAt(Date.now());
      setAdvancing(false);
      cardExit.setValue(0);
      return;
    }

    // Advance. At the end of the queue this leaves `currentCard` undefined and
    // renders the completion screen instead of navigating away, so the last
    // review stays undoable.
    setIndex(index + 1);
    setShowAnswer(false);
    setCardShownAt(Date.now());
    setAdvancing(false);
  };

  const undoLastReview = async () => {
    if (!lastUndo) return;
    const { preCard } = lastUndo;

    await updateCard(preCard.id, { fsrs: preCard.fsrs });

    // Only pop the log if it is still this card's entry.
    const latest = reviewLog[reviewLog.length - 1];
    if (latest && latest.cardId === preCard.id) {
      await removeLastReview();
    }

    setLastUndo(null);
    setIndex(Math.max(0, index - 1));
    setShowAnswer(true);
    setCardShownAt(Date.now());
  };

  const studyHeader = (right?: React.ReactNode, center?: React.ReactNode) => (
    <View
      className="flex-row items-center justify-between px-2"
      style={[glassFillStrong, { height: heights.appbar }]}
    >
      <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close" />
      {center ?? <View />}
      {right ?? <View style={{ width: heights.icon }} />}
    </View>
  );

  if (!deck) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <AppText variant="body" tone="muted">
            Deck not found
          </AppText>
        </View>
      </Screen>
    );
  }

  if (!currentCard) {
    return (
      <Screen header={studyHeader()}>
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View style={doneReveal.style}>
          <EmptyState
            icon="check"
            title="All done"
            titleVariant="headline"
            description="You have completed every due card in this deck."
            action={
              <View>
                {lastUndo && (
                  <GhostButton label="Undo last review" className="px-6" onPress={undoLastReview} />
                )}
                <GhostButton className="mt-3 px-6" label="Back to deck" onPress={() => router.back()} />
              </View>
            }
          />
          </Animated.View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={studyHeader(
        <IconButton
          icon="undo"
          onPress={undoLastReview}
          disabled={!lastUndo}
          accessibilityLabel="Undo last review"
        />,
        <View className="rounded-full border border-hairline px-3 py-1">
          <AppText variant="bodySm" weight="semibold" tone="muted">
            {index + 1} / {queue.length}
          </AppText>
        </View>
      )}
    >
      {/* Progress */}
      <View style={{ height: 4, backgroundColor: fills.track }}>
        <Animated.View
          style={{
            height: '100%',
            minWidth: 6,
            borderRadius: 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 12px ${alpha(colors.primary, 0.55)}`,
            width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>

      {/* Card — capped to a readable column on wide screens. The wrapper owns
          the exit, the flashcard owns the entrance and the turn. */}
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Animated.View
          style={{
            flex: 1,
            opacity: cardExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              {
                translateX: cardExit.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, exitShift.current],
                }),
              },
              { scale: cardExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
            ],
          }}
        >
          <FlashcardView
            card={currentCard}
            showAnswer={showAnswer}
            full
            onSpeak={speakCurrentSide}
            speakLabel={showAnswer ? 'Read answer aloud' : 'Read card aloud'}
          />
        </Animated.View>
      </View>

      {/* Memory state — the standard way to confirm FSRS is actually driving
          the schedule. Hidden for new cards, which have no state yet. */}
      {showAnswer && memoryState && (
        <Animated.View style={memoryReveal.style}>
          <View className="w-full max-w-[620px] self-center px-5 pb-1">
            <View className="flex-row items-center justify-center gap-1.5 self-center rounded-full border border-hairline px-3 py-1">
              <MaterialIcons name="memory" size={iconSize.xs} color={colors.outline} />
              <AppText variant="caption" weight="medium" tone="muted">
                S {memoryState.stability} · D {memoryState.difficulty} · R {memoryState.retrievability}
              </AppText>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Footer — fixed height, so revealing the answer never resizes the card */}
      <View
        className="w-full max-w-[620px] self-center px-5 pb-8"
        style={{ height: heights.studyFooter, justifyContent: 'center' }}
      >
        {!showAnswer ? (
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              // The only action on the screen must be legible on its first frame.
              opacity: footerReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [REVEAL_OPACITY_FLOOR, 1],
              }),
              transform: [
                {
                  translateY: footerReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }}
          >
            <PrimaryButton
              variant="quiet"
              className="flex-1"
              label="Show answer"
              onPress={() => setShowAnswer(true)}
            />
          </Animated.View>
        ) : (
          <RatingButtonRow labels={previews} onRate={handleRate} disabled={advancing} />
        )}
      </View>
    </Screen>
  );
}
