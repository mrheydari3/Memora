import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { useTextScale } from '../../hooks/useTextScale';
import { goBackOr, pushOnce } from '../../services/navigation';
import { HapticsEngine } from '../../services/haptics';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useStreakStore } from '../../store/useStreakStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getSchedulerForDeck, schedulerLabel } from '../../data/schedulers';
import { buildFolderStudyQueue, buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import { buildLearningEngine } from '../../data/intelligence';
import type { LearningEngineResult } from '../../data/intelligence';
import { resolveFsrsParams } from '../../data/fsrs-params';
import {
  AppText,
  BottomSheetModal,
  EmptyState,
  Field,
  Menu,
  MenuItem,
  MenuSeparator,
  Screen,
} from '../../components';
import {
  ActionButton,
  HeaderIcon,
  PageHeader,
  RatingKeys,
  StudyCard,
  StudyTray,
  Surface,
} from '../../components/v3';
import { SessionSummary } from '../../components/v3/SessionSummary';
import { StudyWaiting } from '../../components/v3/StudyWaiting';
import { colors, fills, glass, heights, iconSize, motion, radii, spacing } from '../../theme/tokens';
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
  const { largeText } = useTextScale();
  // A folder session reuses this screen: `/study/folder/:folderId` resolves to
  // it with `folderId` instead of `deckId`. Every card still knows its own
  // deck, so scheduling, daily caps and reviews stay deck-accurate.
  const params = useLocalSearchParams<{ deckId?: string; folderId?: string }>();
  const deckId = typeof params.deckId === 'string' ? params.deckId : undefined;
  const folderId = typeof params.folderId === 'string' ? params.folderId : undefined;
  const folderMode = folderId != null;
  const router = useRouter();
  const { tablet } = useResponsive();
  const completionMaxWidth = tablet ? undefined : v3.layout.composerMaxWidth;
  const backTarget = (folderMode ? '/' : `/deck/${deckId}`) as Href;

  const decks = useDeckStore((s) => s.decks);
  const folders = useDeckStore((s) => s.folders);
  const deck = deckId ? decks.find((d) => d.id === deckId) : undefined;
  const folder = folderId
    ? folders.find((entry) => entry.id === folderId) ?? null
    : null;
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const updateCard = useDeckStore((s) => s.updateCard);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const logReview = useReviewStore((s) => s.logReview);
  const removeLastReview = useReviewStore((s) => s.removeLastReview);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);

  // The session's decks: one deck, or every active deck filed in the folder.
  const sessionDecks = useMemo(() => {
    if (folderId) {
      return decks.filter((entry) => !entry.archivedAt && entry.folderId === folderId);
    }
    return deck ? [deck] : [];
  }, [decks, folderId, deck]);
  const scopeCards = useMemo(
    () => sessionDecks.flatMap((entry) => cardsByDeck[entry.id] ?? []),
    [sessionDecks, cardsByDeck]
  );

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

  // Session chrome motion: the question-side controls settle in as each card
  // arrives, and the card leaves in the rating's direction before the schedule
  // advances.
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
  const optionsAnchorRef = useRef<React.ComponentRef<typeof View>>(null);
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

  // Scheduling follows the card, not the route: a folder session mixes decks
  // that may use different presets and FSRS parameters.
  const currentDeck = useMemo(
    () => (currentCard ? decks.find((entry) => entry.id === currentCard.deckId) ?? null : null),
    [decks, currentCard]
  );
  const scheduler = useMemo(
    () => (currentDeck ? getSchedulerForDeck(currentDeck) : null),
    [currentDeck]
  );
  const fsrsParams = useMemo(
    () => (currentDeck ? resolveFsrsParams(currentDeck) : null),
    [currentDeck]
  );

  const scopeTitle = folderMode ? folder?.name ?? 'Folder' : deck?.name ?? 'Study';
  const scopeColor = folderMode
    ? folder?.color ?? colors.primary
    : deck?.color ?? colors.primary;
  const scopeSchedulerLabel = useMemo(() => {
    if (!folderMode) return deck ? schedulerLabel(deck.algorithmPreset) : '';
    const labels = new Set(
      sessionDecks.map((entry) => schedulerLabel(entry.algorithmPreset))
    );
    return labels.size === 1 ? [...labels][0] : labels.size > 1 ? 'Mixed schedulers' : '';
  }, [folderMode, deck, sessionDecks]);

  // The completion pane only speaks about this visit: reviews from before this
  // mount, including a session restored by a reload, are deliberately excluded.
  const sessionDeckIds = useMemo(
    () => new Set(sessionDecks.map((entry) => entry.id)),
    [sessionDecks]
  );
  const sessionReviews = useMemo(
    () =>
      reviewLog.filter(
        (entry) => sessionDeckIds.has(entry.deckId) && entry.reviewedAt >= sessionStartedAt
      ),
    [reviewLog, sessionDeckIds, sessionStartedAt]
  );
  const sessionStats = useMemo(() => {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    const ratingDurations: [number, number, number, number] = [0, 0, 0, 0];
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
      const elapsed = Math.max(0, entry.elapsedMs);
      durationMs += elapsed;
      ratingDurations[entry.rating - 1] += elapsed;
    }
    return {
      counts,
      ratingDurations,
      durationMs,
      reviewed: sessionReviews.length,
      recalled: counts[2] + counts[3],
    };
  }, [sessionReviews]);
  const sessionRecallPct =
    sessionStats.reviewed > 0
      ? Math.round((sessionStats.recalled / sessionStats.reviewed) * 100)
      : 0;

  const archivedDeckIds = useMemo(
    () => new Set(decks.filter((item) => item.archivedAt).map((item) => item.id)),
    [decks]
  );
  const skips = useStreakStore((state) => state.skips);
  const skipDates = useMemo(() => skips.map((skip) => skip.date), [skips]);
  const streak = useMemo(
    () =>
      computeStreak(
        reviewLog
          .filter((entry) => !archivedDeckIds.has(entry.deckId))
          .map((entry) => entry.reviewedAt),
        Date.now(),
        skipDates
      ),
    [reviewLog, archivedDeckIds, skipDates]
  );

  // Build the session queue. The intelligence engine only ranks cards the
  // existing capped queue already selected; FSRS still owns every due date.
  // The tray's restart runs this same builder and returns to the first card.
  const startSession = useCallback(() => {
    const shuffled = (items: Flashcard[]) => {
      // Fisher–Yates: `sort(() => Math.random() - 0.5)` is biased and leaves
      // some cards far more likely to stay near their original position.
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };

    // A folder session is the union of each deck's own capped queue. Adaptive
    // ordering is deck-scoped, so it is not applied across the folder; if any
    // deck asks for shuffled cards, both joined lists are shuffled once.
    if (folderMode) {
      if (!folder) return;
      const store = useDeckStore.getState();
      const log = useReviewStore.getState().reviewLog;
      const now = Date.now();
      const scoped = store.decks.filter(
        (entry) => !entry.archivedAt && entry.folderId === folder.id
      );
      const { newCards, dueCards } = buildFolderStudyQueue(
        scoped,
        store.cardsByDeck,
        log,
        now
      );
      const shuffle = scoped.some((entry) => entry.shuffleCards);
      const next = [
        ...(shuffle ? shuffled([...newCards]) : newCards),
        ...(shuffle ? shuffled([...dueCards]) : dueCards),
      ];

      setLearning(null);
      setQueue(next);
      setSessionTotal(next.length);
      setQueueBuilt(true);
      setIndex(0);
      setShowAnswer(false);
      setLastUndo(null);
      setStudyNowId(null);
      setClock(Date.now());
      setCardShownAt(Date.now());
      return;
    }

    if (!deck || deck.archivedAt) return;
    const cards = useDeckStore.getState().getCards(deck.id);
    const log = useReviewStore.getState().reviewLog;
    const now = Date.now();
    const { newCards, dueCards } = buildStudyQueue(deck, cards, log, now);
    // Read skips at build time instead of closing over the render value: adding
    // them to this callback's dependencies would restart a live session when a
    // rest day is recorded elsewhere.
    const currentSkipDates = useStreakStore.getState().skips.map((skip) => skip.date);

    let analysis: LearningEngineResult | null = null;
    try {
      analysis = buildLearningEngine({
        decks: useDeckStore.getState().decks,
        cardsByDeck: useDeckStore.getState().cardsByDeck,
        reviewLog: log,
        skipDates: currentSkipDates,
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
  }, [deck, folder, folderMode]);

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

  const revealAnswer = useCallback(() => {
    HapticsEngine.cardFlip();
    setShowAnswer(true);
  }, []);

  const handleRate = async (rating: Rating) => {
    if (!currentCard || !currentDeck || !scheduler || advancing) return;

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
        deckId: currentDeck.id,
        rating,
        reviewedAt: now,
        elapsedMs: Math.max(0, now - cardShownAt),
        cardWasNew: currentCard.fsrs.state === 'New',
        stateBefore: currentCard.fsrs.state,
        fsrs: log,
      });

      // Only after the review is committed: four distinguishable, restrained
      // weights, never a success buzz before the schedule exists.
      if (rating === 1) HapticsEngine.reviewAgain();
      else if (rating === 2) HapticsEngine.reviewHard();
      else if (rating === 3) HapticsEngine.reviewGood();
      else HapticsEngine.reviewEasy();

      // Re-queue a card only when the session still owes it something:
      //  - FSRS cards in Learning/Relearning must see their next step today;
      //  - Fast Repetition repeats Again/Hard, while Good/Easy finish the pass,
      //    so the session can actually reach "All done".
      const refreshed =
        useDeckStore
          .getState()
          .getCards(currentDeck.id)
          .find((card) => card.id === currentCard.id) ?? currentCard;
      const inLearning =
        refreshed.fsrs.state === 'Learning' || refreshed.fsrs.state === 'Relearning';
      const requeue = currentDeck.algorithmPreset === 'fast' ? rating <= 2 : inLearning;

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
        revealAnswer();
        return;
      }
      if (showAnswer && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void handleRate(Number(event.key) as Rating);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, waiting, showAnswer, handleRate, revealAnswer]);

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
      HapticsEngine.actionComplete();
    } catch (e) {
      console.error('Failed to undo review:', e);
    }
  };

  const toggleMarked = () => {
    if (!currentCard) return;
    const nextMarked = !(storedCard?.marked === true);
    void updateCard(currentCard.id, { marked: nextMarked })
      .then(() => {
        if (nextMarked) HapticsEngine.toggleOn();
        else HapticsEngine.toggleOff();
      })
      .catch((e) => {
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
      HapticsEngine.actionComplete();
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  };

  /** One settle when the visit's last card is finished, once per mount. */
  const completionHapticRef = useRef(false);
  useEffect(() => {
    if (currentCard || !queueBuilt || completionHapticRef.current) return;
    if (sessionReviews.length === 0) return;
    completionHapticRef.current = true;
    HapticsEngine.success();
  }, [currentCard, queueBuilt, sessionReviews.length]);

  const restoreDeck = async () => {
    if (!deck) return;
    try {
      await updateDeck(deck.id, { archivedAt: null });
    } catch (e) {
      console.error('Failed to restore deck:', e);
    }
  };

  if (folderMode && !folder) {
    return (
      <Screen
        header={<PageHeader title="Study" back onBack={() => goBackOr(router, backTarget)} />}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <EmptyState
            icon="folder"
            title="Folder not found"
            titleVariant="bodyLg"
            description="Go back to your library and choose a folder."
          />
        </View>
      </Screen>
    );
  }

  if (!folderMode && !deck) {
    return (
      <Screen
        header={<PageHeader title="Study" back onBack={() => goBackOr(router, backTarget)} />}
      >
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

  if (!folderMode && deck && deck.archivedAt) {
    return (
      <Screen
        header={
          <PageHeader
            title={deck.name}
            back
            onBack={() => goBackOr(router, backTarget)}
          />
        }
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: v3.layout.contentMaxWidth,
            alignSelf: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.screen,
            paddingBottom: 48,
          }}
        >
          <EmptyState
            icon="archive"
            title="This deck is archived"
            titleVariant="headline"
            description="It stays out of your queue until you restore it. Restoring keeps every card and review exactly as they were."
          />
          <View
            style={{
              width: '100%',
              maxWidth: 280,
              alignSelf: 'center',
              marginTop: 20,
            }}
          >
            <ActionButton
              label="Restore deck"
              icon="unarchive"
              onPress={() => void restoreDeck()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  const sessionProgress = `${Math.min(index + 1, sessionTotal)} / ${sessionTotal}`;
  const header = (
    <PageHeader
      title={scopeTitle}
      leading={
        <HeaderIcon
          icon="close"
          label="Close session"
          onPress={() => goBackOr(router, backTarget)}
        />
      }
      meta={
        largeText ? undefined : (
          <View
            style={{
              borderRadius: radii.pill,
              backgroundColor: fills.inset,
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <AppText variant="label" weight="semibold" tone="muted">
              {sessionProgress}
            </AppText>
          </View>
        )
      }
      actions={
        <HeaderIcon
          icon="undo"
          label="Undo last review"
          onPress={undoLastReview}
          disabled={!lastUndo}
        />
      }
    />
  );

  const emptyDeck = scopeCards.length === 0;

  const completionHeader = (
    <PageHeader
      title={emptyDeck ? 'Study' : 'Session Complete'}
      maxWidth={completionMaxWidth}
      leading={
        <HeaderIcon
          icon="close"
          label="Close session"
          onPress={() => goBackOr(router, backTarget)}
        />
      }
      meta={
        <View
          style={{
            maxWidth: tablet ? 240 : 100,
            minHeight: 28,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: radii.pill,
            backgroundColor: glass.fill,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <MaterialIcons
            name={folderMode ? 'folder' : 'layers'}
            size={iconSize.xs}
            color={colors.primary}
          />
          <AppText
            variant="caption"
            weight="medium"
            tone="muted"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {scopeTitle}
          </AppText>
        </View>
      }
    />
  );

  if (!currentCard) {
    if (!queueBuilt) {
      return <Screen header={completionHeader}>{null}</Screen>;
    }

    const { counts, ratingDurations, durationMs, reviewed } = sessionStats;
    const now = Date.now();
    const upcoming = scopeCards
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
      <Screen
        header={completionHeader}
        scroll
        gutter
        contentMaxWidth={completionMaxWidth}
      >
        <SessionSummary
          deckName={scopeTitle}
          deckColor={scopeColor}
          schedulerLabel={scopeSchedulerLabel}
          scope={folderMode ? 'folder' : 'deck'}
          backLabel={folderMode ? 'Back to folder' : 'Back to deck'}
          emptyDeck={emptyDeck}
          reviewed={reviewed}
          recallPct={sessionRecallPct}
          xpEarned={reviewed * XP_PER_REVIEW}
          streak={streak}
          durationMs={durationMs}
          ratings={counts}
          ratingDurations={ratingDurations}
          nextReview={nextReview}
          onAddCards={
            !folderMode && deck
              ? () => pushOnce(router, `/deck/${deck.id}/add-card`)
              : undefined
          }
          onUndo={lastUndo ? undoLastReview : null}
          onBack={() => goBackOr(router, backTarget)}
        />
      </Screen>
    );
  }

  const cardStage = (
    <View style={{ flex: 1, minWidth: 0 }}>
      {waiting && (
        <StudyWaiting
          card={currentCard}
          note={storedCard?.note}
          learningStep={learningStep}
          waitLabel={formatWait(waitingMs)}
          targetRetention={targetRetention}
          frontLanguage={frontLanguage}
          deckName={scopeTitle}
          deckColor={scopeColor}
          addedLabel={addedLabel}
          reviewed={sessionStats.reviewed}
          recallPct={sessionRecallPct}
          durationMs={sessionStats.durationMs}
          xpEarned={sessionStats.reviewed * XP_PER_REVIEW}
          streak={streak}
          maxWidth={completionMaxWidth}
          onStudyNow={() => {
            setStudyNowId(currentCard.id);
            setClock(Date.now());
          }}
        />
      )}
      {!waiting && (
      <Animated.View
        style={{
          opacity: cardExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          flex: 1,
          minHeight: 0,
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
          onSpeak={settings.ttsEnabled ? speakCurrentSide : undefined}
          speakLabel={showAnswer ? 'Read answer aloud' : 'Read card aloud'}
        />
      </Animated.View>
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
              onPress={revealAnswer}
              haptic={false}
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

      {!waiting && (
        <StudyTray
          marked={marked}
          onToggleMark={toggleMarked}
          onEditNote={openNoteEditor}
          onOptions={() => setOptionsOpen(true)}
          optionsRef={optionsAnchorRef}
        />
      )}
    </View>
  );

  // Screen gutter is intentionally omitted: the study stage and its fixed
  // tray own the session's measure.
  return (
    <>
      <Screen header={header}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: v3.layout.contentMaxWidth,
          alignSelf: 'center',
          paddingHorizontal: spacing.screen,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        {largeText ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
            <View
              style={{
                borderRadius: radii.pill,
                backgroundColor: fills.inset,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <AppText variant="label" weight="semibold" tone="muted">
                {sessionProgress}
              </AppText>
            </View>
          </View>
        ) : null}
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

    <Menu
      open={optionsOpen}
      onClose={() => setOptionsOpen(false)}
      anchorRef={optionsAnchorRef}
      label="Session options"
      title="Options"
      subtitle={
        folderMode && currentDeck ? `${scopeTitle} · ${currentDeck.name}` : scopeTitle
      }
      width={300}
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
      <MenuSeparator />
      <MenuItem
        label="Undo last review"
        disabled={!lastUndo}
        onPress={() => {
          setOptionsOpen(false);
          void undoLastReview();
        }}
      />
      <MenuItem
        label="Restart session"
        onPress={() => {
          setOptionsOpen(false);
          startSession();
        }}
      />
      <MenuItem
        label={folderMode ? 'Back to folder' : 'Back to deck'}
        onPress={() => {
          setOptionsOpen(false);
          goBackOr(router, backTarget);
        }}
      />
    </Menu>
  </>
  );
}
