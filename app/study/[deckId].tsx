import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Animated, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { goBackOr, pushOnce } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getSchedulerForDeck } from '../../data/schedulers';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import { buildLearningEngine } from '../../data/intelligence';
import type { LearningEngineResult } from '../../data/intelligence';
import { resolveFsrsParams } from '../../data/fsrs-params';
import {
  AppText,
  BottomSheetModal,
  Field,
  Screen,
  IconButton,
  EmptyState,
  TopAppBar,
} from '../../components';
import { ActionButton, HeaderIcon, RatingKeys, StudyCard, StudyTray, Surface } from '../../components/v3';
import { SessionSummary } from '../../components/v3/SessionSummary';
import {
  colors,
  fills,
  heights,
  iconSize,
  motion,
  radii,
  rims,
} from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { EASE, REVEAL_OPACITY_FLOOR, timingTo } from '../../motion';
import { speakCard, speak, stopSpeaking } from '../../services/tts';
import type { Flashcard, FSRSLogSnapshot, Rating, RatingButtonLabel } from '../../data/types';

/** Profile and Settings count ten XP per review; a session earns the same. */
const XP_PER_REVIEW = 10;

const RATING_NAMES: Record<Rating, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

/** The TTS settings' language codes, named for the card's language line. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  fa: 'Persian',
  ja: 'Japanese',
};

/** A real creation timestamp, not a mocked "studied ago" label. */
function formatAddedAgo(createdAt: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60_000));
  if (minutes < 60) return `Added ${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Added ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Added ${days}d ago`;
}

/** Format a stability value (in days) for the memory-state chip. */
function formatStability(days: number): string {
  if (days >= 1) return `${days.toFixed(1)}d`;
  const minutes = Math.round(days * 24 * 60);
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.max(1, minutes)}m`;
}

/** 75_000 → "in 1m 15s"; 8_000 → "in 8s". */
function formatWait(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `in ${seconds}s`;
  return `in ${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** A study card's next due date, rounded to its largest honest unit. */
function formatNextDue(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `in ${hours}h` : `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.floor(hours / 24)}d`;
}

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const deckFallback = `/deck/${deckId}` as Href;
  const { width, height } = useWindowDimensions();

  const decks = useDeckStore((s) => s.decks);
  const deck = decks.find((d) => d.id === deckId);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const updateCard = useDeckStore((s) => s.updateCard);
  const logReview = useReviewStore((s) => s.logReview);
  const removeLastReview = useReviewStore((s) => s.removeLastReview);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);

  const deckCards = deck ? (cardsByDeck[deck.id] ?? []) : [];

  // Session queue
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [learning, setLearning] = useState<LearningEngineResult | null>(null);
  const [index, setIndex] = useState(0);
  /**
   * The session's opening size. Re-queued learning cards grow `queue`, so it
   * cannot be the progress denominator: the bar and the "x / y" counter both
   * jumped backwards (26 → 27) the moment a card came back for another step.
   */
  const [sessionTotal, setSessionTotal] = useState(0);
  /** Reviews are counted from this instant, so the summary describes this visit. */
  const [sessionStartedAt] = useState(() => Date.now());
  /** The queue arrives in an effect; before it does, the session is not complete. */
  const [queueBuilt, setQueueBuilt] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  // When the current card was first shown. Review time is recorded per card;
  // using time-since-session-start inflated the statistics by counting the
  // whole session again on every answer.
  const [cardShownAt, setCardShownAt] = useState(() => Date.now());
  // The last review, kept so it can be undone exactly. The queue snapshot is
  // what makes undo safe once a learning step has been re-queued.
  const [lastUndo, setLastUndo] = useState<{
    preCard: Flashcard;
    log: FSRSLogSnapshot;
    queue: Flashcard[];
    index: number;
  } | null>(null);

  // Session chrome motion: the progress bar eases between fractions and the
  // question-side controls settle in as each card arrives. The card itself
  // leaves in the rating's direction before the schedule advances.
  const progressValue = useRef(new Animated.Value(0)).current;
  const footerReveal = useRef(new Animated.Value(0)).current;
  const cardExit = useRef(new Animated.Value(0)).current;
  const exitShift = useRef(16);
  const [advancing, setAdvancing] = useState(false);
  // Learning steps become due while the session is still open. `clock` keeps
  // the countdown honest; `studyNowId` lets the learner skip the wait once.
  const [clock, setClock] = useState(() => Date.now());
  const [studyNowId, setStudyNowId] = useState<string | null>(null);
  // The utility tray's two sheets: the card's note and the session's options.
  const [noteOpen, setNoteOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const currentCard = queue[index];

  // The queue keeps the card as it was when the session was built, so a mark or
  // a note written during the session has to be read back from the store. That
  // also means a reloaded session shows the flag it persisted.
  const storedCard = useDeckStore((s) =>
    currentCard
      ? s.cardsByDeck[currentCard.deckId]?.find((card) => card.id === currentCard.id)
      : undefined
  );
  const marked = storedCard?.marked === true;

  const dueAtMs = currentCard ? new Date(currentCard.fsrs.due).getTime() : 0;
  const waitingMs =
    currentCard &&
    studyNowId !== currentCard.id &&
    (currentCard.fsrs.state === 'Learning' || currentCard.fsrs.state === 'Relearning')
      ? Math.max(0, dueAtMs - clock)
      : 0;
  const waiting = waitingMs > 0;

  // Reset the exit once the next card is mounted, so the outgoing card never
  // flashes back for a frame between the two.
  useEffect(() => {
    cardExit.setValue(0);
  }, [currentCard?.id, cardExit]);

  // A learning card that is not due yet shows a countdown, not a card.
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  useEffect(() => {
    setClock(Date.now());
    setStudyNowId(null);
  }, [currentCard?.id]);

  // Review time starts when the card is actually visible, not while it waited.
  useEffect(() => {
    if (!currentCard || waiting) return;
    setCardShownAt(Date.now());
  }, [currentCard?.id, waiting]);

  const scheduler = useMemo(() => (deck ? getSchedulerForDeck(deck) : null), [deck]);
  const fsrsParams = useMemo(() => (deck ? resolveFsrsParams(deck) : null), [deck]);

  // The completion pane only speaks about this visit: reviews from before this
  // mount, including a session restored by a reload, are deliberately excluded.
  const sessionReviews = useMemo(
    () =>
      reviewLog.filter(
        (entry) => entry.deckId === deck?.id && entry.reviewedAt >= sessionStartedAt
      ),
    [reviewLog, deck, sessionStartedAt]
  );

  const activeDeckIds = useMemo(
    () => new Set(decks.filter((item) => !item.archivedAt).map((item) => item.id)),
    [decks]
  );
  const streak = useMemo(
    () =>
      computeStreak(
        reviewLog
          .filter((entry) => activeDeckIds.has(entry.deckId))
          .map((entry) => entry.reviewedAt)
      ),
    [reviewLog, activeDeckIds]
  );

  // Build the session queue. The intelligence engine only ranks cards the
  // existing capped queue already selected; FSRS still owns every due date.
  // The tray's restart runs this same builder and returns to the first card.
  const startSession = useCallback(() => {
    if (!deck) return;
    const cards = useDeckStore.getState().getCards(deck.id);
    const log = useReviewStore.getState().reviewLog;
    const now = Date.now();
    const { newCards, dueCards } = buildStudyQueue(deck, cards, log, now);

    let analysis: LearningEngineResult | null = null;
    try {
      analysis = buildLearningEngine({
        decks: useDeckStore.getState().decks,
        cardsByDeck: useDeckStore.getState().cardsByDeck,
        reviewLog: log,
        deckId: deck.id,
        newCards,
        dueCards,
        now,
      });
    } catch (error) {
      // An analysis failure must never block studying. Fall back to the exact
      // queue the app used before the engine existed.
      console.error('Failed to analyse the learning queue:', error);
    }
    setLearning(analysis);

    const shuffled = (items: Flashcard[]) => {
      // Fisher–Yates: `sort(() => Math.random() - 0.5)` is biased and leaves
      // some cards far more likely to stay near their original position.
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };

    const adaptive =
      analysis !== null &&
      deck.algorithmPreset === 'fsrs' &&
      deck.adaptiveOrdering === true;
    let nextNew = [...newCards];
    let nextDue = [...dueCards];
    if (deck.shuffleCards) {
      nextNew = shuffled(nextNew);
      if (!adaptive) nextDue = shuffled(nextDue);
    }
    if (adaptive && analysis) {
      nextDue = [...analysis.orderedDueCards];
    }

    const next = [...nextNew, ...nextDue];
    setQueue(next);
    setSessionTotal(next.length);
    setQueueBuilt(true);
    setIndex(0);
    setShowAnswer(false);
    setLastUndo(null);
    setStudyNowId(null);
    setClock(Date.now());
    setCardShownAt(Date.now());
  }, [deck]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Compute interval previews for the current card. `now` is pinned to when the
  // card appeared: FSRS fuzz is seeded from the review instant, so recomputing
  // with `new Date()` on every render would make the four labels drift.
  const previewNow = useMemo(() => new Date(cardShownAt), [cardShownAt]);

  const previews: RatingButtonLabel[] = useMemo(() => {
    if (!currentCard || !scheduler) return [];
    return scheduler.getIntervalPreviews(currentCard, previewNow);
  }, [currentCard, scheduler, previewNow]);

  const ratingKeys = useMemo(
    () =>
      previews.map((preview) => ({
        rating: preview.rating,
        label: RATING_NAMES[preview.rating],
        interval: preview.label,
      })),
    [previews]
  );

  const learningSteps = fsrsParams?.fsrsLearningSteps ?? [];
  const learningStep =
    currentCard &&
    learningSteps.length > 0 &&
    (currentCard.fsrs.state === 'Learning' || currentCard.fsrs.state === 'Relearning')
      ? `Step ${Math.min((currentCard.fsrs.learning_steps ?? 0) + 1, learningSteps.length)}/${learningSteps.length}`
      : null;
  const frontLanguageCode = settings.ttsFrontVoiceLang;
  const frontLanguage =
    LANGUAGE_NAMES[frontLanguageCode.split('-')[0] ?? ''] ?? frontLanguageCode;
  const audioLanguageCode = showAnswer ? settings.ttsBackVoiceLang : frontLanguageCode;
  const targetRetention = Math.round((fsrsParams?.requestRetention ?? 0.9) * 100);
  const dueLabel = currentCard
    ? new Date(currentCard.fsrs.due).getTime() <= Date.now()
      ? 'Due today'
      : `Due ${formatNextDue(new Date(currentCard.fsrs.due).getTime() - Date.now())}`
    : '';
  const addedLabel = currentCard ? formatAddedAgo(currentCard.createdAt) : '';

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
    if (!currentCard || waiting) return;
    void speakCard(currentCard.front.text, currentCard.back.text, {
      ttsEnabled: settings.ttsEnabled,
      ttsReadWholeCard: settings.ttsReadWholeCard,
      ttsAutoPlay: settings.ttsAutoPlay,
      ttsFrontVoiceLang: settings.ttsFrontVoiceLang,
      ttsBackVoiceLang: settings.ttsBackVoiceLang,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id, waiting]);

  // TTS: read the back aloud on reveal (when not already reading whole card)
  useEffect(() => {
    if (!showAnswer || !currentCard || !settings.ttsEnabled || settings.ttsReadWholeCard) return;
    if (!settings.ttsAutoPlay) return;
    speak({ text: currentCard.back.text, language: settings.ttsBackVoiceLang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer]);

  // Leaving the session must not leave a card talking in the background.
  useEffect(() => () => void stopSpeaking(), []);

  // Denominator is fixed at the session's opening size, and work that re-enters
  // the queue parks the bar at 100% instead of stretching it.
  const progressTarget =
    sessionTotal > 0 ? Math.min(1, (index + (showAnswer ? 0.5 : 0)) / sessionTotal) : 0;

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
    let succeeded = false;
    try {
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
        stateBefore: currentCard.fsrs.state,
        fsrs: log,
      });

      // Re-queue a card only when the session still owes it something:
      //  - FSRS cards in Learning/Relearning must see their next step today;
      //  - Fast Repetition repeats Again/Hard, while Good/Easy finish the pass,
      //    so the session can actually reach "All done".
      const refreshed =
        useDeckStore.getState().getCards(deck.id).find((card) => card.id === currentCard.id) ??
        currentCard;
      const inLearning =
        refreshed.fsrs.state === 'Learning' || refreshed.fsrs.state === 'Relearning';
      const requeue = deck.algorithmPreset === 'fast' ? rating <= 2 : inLearning;

      setLastUndo(log ? { preCard: currentCard, log, queue, index } : null);

      if (requeue) setQueue([...queue, refreshed]);
      setIndex(index + 1);
      setShowAnswer(false);
      setStudyNowId(null);
      setClock(Date.now());
      setCardShownAt(Date.now());
      succeeded = true;
    } catch (e) {
      // A failed write must not leave the card invisible and every rating
      // button disabled: the finally block restores it for another try.
      console.error('Failed to save review:', e);
    } finally {
      setAdvancing(false);
      if (!succeeded) cardExit.setValue(0);
    }
  };

  // Web shortcuts mirror the two controls: Space/Enter reveals, 1–4 rates.
  // They never fire while typing, so a form elsewhere on the page keeps its keys.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (!currentCard || waiting) return;

      if (!showAnswer && (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar')) {
        event.preventDefault();
        setShowAnswer(true);
        return;
      }
      if (showAnswer && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void handleRate(Number(event.key) as Rating);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, waiting, showAnswer, handleRate]);

  const undoLastReview = async () => {
    if (!lastUndo) return;
    const { preCard, queue: previousQueue, index: previousIndex } = lastUndo;

    try {
      await updateCard(preCard.id, { fsrs: preCard.fsrs });

      // Only pop the log if it is still this card's entry.
      const latest = reviewLog[reviewLog.length - 1];
      if (latest && latest.cardId === preCard.id) {
        await removeLastReview();
      }

      setLastUndo(null);
      setQueue(previousQueue);
      setIndex(previousIndex);
      setShowAnswer(true);
      setStudyNowId(preCard.id);
      setClock(Date.now());
      setCardShownAt(Date.now());
    } catch (e) {
      console.error('Failed to undo review:', e);
    }
  };

  const toggleMarked = () => {
    if (!currentCard) return;
    void updateCard(currentCard.id, { marked: !(storedCard?.marked === true) }).catch((e) => {
      console.error('Failed to mark card:', e);
    });
  };

  const openNoteEditor = () => {
    setNoteDraft(storedCard?.note ?? '');
    setNoteOpen(true);
  };

  const saveNote = async () => {
    if (!currentCard) return;
    const note = noteDraft.trim();
    try {
      await updateCard(currentCard.id, { note: note ? note : undefined });
      setNoteOpen(false);
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  };

  if (!deck) {
    return (
      <Screen header={<TopAppBar title="Study" back backFallback={deckFallback} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <EmptyState
            icon="layers-clear"
            title="Deck not found"
            titleVariant="bodyLg"
            description="Go back to your library and choose a deck."
          />
        </View>
      </Screen>
    );
  }

  const header = (
    <TopAppBar
      leftContent={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton
            icon="close"
            onPress={() => goBackOr(router, deckFallback)}
            accessibilityLabel="Close session"
          />
          <AppText
            variant="headline"
            weight="semibold"
            headingLevel={1}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            Study Session
          </AppText>
          <View
            style={{
              borderRadius: radii.pill,
              backgroundColor: fills.inset,
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <AppText variant="label" weight="semibold" tone="muted">
              {Math.min(index + 1, sessionTotal)} / {sessionTotal}
            </AppText>
          </View>
        </View>
      }
      rightContent={
        <View style={{ marginEnd: 4 }}>
          <IconButton
            icon="undo"
            onPress={undoLastReview}
            disabled={!lastUndo}
            accessibilityLabel="Undo last review"
          />
        </View>
      }
    />
  );

  const emptyDeck = deckCards.length === 0;

  const completionHeader = (
    <View style={{ backgroundColor: colors.appBarGlass }}>
      <View
        style={{
          height: heights.pageHeader,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ width: width >= 400 ? 100 : 44, alignItems: 'flex-start' }}>
          <HeaderIcon
            icon="close"
            label="Close session"
            onPress={() => goBackOr(router, deckFallback)}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
          <AppText
            variant="headline"
            weight="semibold"
            headingLevel={1}
            numberOfLines={1}
          >
            {emptyDeck ? 'Study' : 'Session Complete'}
          </AppText>
        </View>
        <View
          style={{
            width: width >= 400 ? 100 : 44,
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {width >= 400 ? (
            <View
              style={{
                maxWidth: 100,
                minHeight: 28,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: rims.soft,
                backgroundColor: colors.surfacePane,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <MaterialIcons name="folder" size={iconSize.xs} color={colors.primary} />
              <AppText
                variant="caption"
                weight="medium"
                tone="muted"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {deck.name}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!currentCard) {
    if (!queueBuilt) {
      return <Screen header={completionHeader}>{null}</Screen>;
    }

    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let durationMs = 0;
    for (const entry of sessionReviews) {
      switch (entry.rating) {
        case 1:
          counts[0] += 1;
          break;
        case 2:
          counts[1] += 1;
          break;
        case 3:
          counts[2] += 1;
          break;
        case 4:
          counts[3] += 1;
          break;
      }
      durationMs += Math.max(0, entry.elapsedMs);
    }

    const reviewed = sessionReviews.length;
    const recalled = counts[2] + counts[3];
    const now = Date.now();
    const upcoming = deckCards
      .map((card) => new Date(card.fsrs.due).getTime())
      .filter((due) => due > now);
    const nextDue =
      upcoming.length > 0 ? upcoming.reduce((earliest, due) => Math.min(earliest, due)) : null;
    const dueSoon = upcoming.filter((due) => due <= now + 86_400_000).length;
    const nextReview =
      nextDue === null
        ? null
        : `Next review ${formatNextDue(nextDue - now)}${
            dueSoon > 0
              ? ` · ${dueSoon} card${dueSoon === 1 ? '' : 's'} in the next 24h`
              : ''
          }`;

    return (
      <Screen header={completionHeader} scroll gutter contentMaxWidth={760}>
        <SessionSummary
          deckName={deck.name}
          deckColor={deck.color}
          emptyDeck={emptyDeck}
          reviewed={reviewed}
          recallPct={reviewed > 0 ? Math.round((recalled / reviewed) * 100) : 0}
          xpEarned={reviewed * XP_PER_REVIEW}
          streak={streak}
          durationMs={durationMs}
          ratings={counts}
          nextReview={nextReview}
          onAddCards={() => pushOnce(router, `/deck/${deck.id}/add-card`)}
          onUndo={lastUndo ? undoLastReview : null}
          onBack={() => goBackOr(router, deckFallback)}
        />
      </Screen>
    );
  }

  const cardStage = (
    <View style={{ flex: 1, minWidth: 0 }}>
      {waiting && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <MaterialIcons name="schedule" size={iconSize.xl} color={colors.primary} />
          <AppText variant="headline" headingLevel={2} align="center" className="mt-3">
            Next review {formatWait(waitingMs)}
          </AppText>
          <AppText variant="bodySm" tone="muted" align="center" className="mt-2">
            This card is in its learning steps. Wait for the interval, or study it now.
          </AppText>
          <View style={{ marginTop: 20, width: '100%', maxWidth: 260 }}>
            <ActionButton
              label="Study now"
              onPress={() => {
                setStudyNowId(currentCard.id);
                setClock(Date.now());
              }}
            />
          </View>
        </View>
      )}

      {!waiting && (
      <Animated.View
        style={{
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
        <StudyCard
          card={currentCard}
          showAnswer={showAnswer}
          stateLabel={currentCard.fsrs.state}
          stepLabel={learningStep}
          language={frontLanguage}
          languageCode={audioLanguageCode.split('-')[0]?.toUpperCase() ?? audioLanguageCode}
          targetRetention={targetRetention}
          dueLabel={dueLabel}
          addedLabel={addedLabel}
          memoryState={showAnswer ? memoryState : null}
          note={storedCard?.note}
          height={height < 760 ? 428 : 460}
          onSpeak={settings.ttsEnabled ? speakCurrentSide : undefined}
          speakLabel={showAnswer ? 'Read answer aloud' : 'Read card aloud'}
        />
      </Animated.View>
      )}

      {!waiting && (
        <StudyTray
          marked={marked}
          onToggleMark={toggleMarked}
          onEditNote={openNoteEditor}
          onOptions={() => setOptionsOpen(true)}
        />
      )}

      {!waiting && (
      <View
        style={{
          width: '100%',
          maxWidth: v3.layout.studyCard,
          alignSelf: 'center',
          minHeight: heights.studyFooter,
          justifyContent: 'center',
          paddingVertical: 6,
        }}
      >
        {!showAnswer ? (
          <Animated.View
            style={{
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
            <ActionButton
              label="Show answer"
              icon="visibility"
              onPress={() => setShowAnswer(true)}
            />
            {Platform.OS === 'web' && (
              <AppText variant="caption" tone="tertiary" align="center" className="mt-2">
                Space or Enter to reveal
              </AppText>
            )}
          </Animated.View>
        ) : (
          <View>
            <RatingKeys
              keys={ratingKeys}
              onRate={handleRate}
              disabled={advancing}
            />
            {Platform.OS === 'web' && (
              <AppText variant="caption" tone="tertiary" align="center" className="mt-2">
                Press 1–4 to rate
              </AppText>
            )}
          </View>
        )}
      </View>
      )}
    </View>
  );

  return (
    <>
      <Screen header={header}>
      <View style={{ height: 4, backgroundColor: fills.track }}>
        <Animated.View
          style={{
            height: '100%',
            minWidth: 6,
            borderRadius: 2,
            backgroundColor: colors.primary,
            width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>

      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: v3.layout.studyMeasure,
          alignSelf: 'center',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        {cardStage}
      </View>
    </Screen>

    <BottomSheetModal
      visible={noteOpen}
      onClose={() => setNoteOpen(false)}
      title="Edit note"
      subtitle={currentCard.front.text}
    >
      <Field
        label="Note"
        value={noteDraft}
        onChangeText={setNoteDraft}
        placeholder="A mnemonic, an example, anything worth keeping"
        multiline
        tall
        minHeight={132}
        maxLength={500}
        accessibilityLabel="Card note"
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 }}
      >
        <AppText variant="caption" tone="tertiary">
          {noteDraft.length} / 500
        </AppText>
        <AppText variant="caption" tone="tertiary">
          Shown with the answer
        </AppText>
      </View>
      <View style={{ marginTop: 16 }}>
        <ActionButton label="Save note" onPress={() => void saveNote()} />
      </View>
    </BottomSheetModal>

    <BottomSheetModal
      visible={optionsOpen}
      onClose={() => setOptionsOpen(false)}
      title="Options"
      subtitle={deck.name}
    >
      <Surface tone="inset" radius="control" padding="sm">
        <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
          {currentCard.front.text}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          {currentCard.back.text}
        </AppText>
        <AppText variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
          {currentCard.fsrs.state} · {dueLabel} · {currentCard.fsrs.reps} reps ·{' '}
          {currentCard.fsrs.lapses} lapses
        </AppText>
      </Surface>
      <View style={{ marginTop: 16, gap: 8 }}>
        <ActionButton
          label="Undo last review"
          tone="quiet"
          disabled={!lastUndo}
          onPress={() => {
            setOptionsOpen(false);
            void undoLastReview();
          }}
        />
        <ActionButton
          label="Restart session"
          tone="quiet"
          onPress={() => {
            setOptionsOpen(false);
            startSession();
          }}
        />
        <ActionButton
          label="Back to deck"
          tone="quiet"
          onPress={() => {
            setOptionsOpen(false);
            goBackOr(router, deckFallback);
          }}
        />
      </View>
    </BottomSheetModal>
  </>
  );
}
