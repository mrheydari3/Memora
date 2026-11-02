import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable } from '../../data/quiz';
import { Screen, TopAppBar, QuizStartCard, RevealItem } from '../../components';

/**
 * Game — the quiz only.
 *
 * The deck browser and Discover previews moved out of this tab; the one thing
 * left is the 60-second round, with the playable-deck picker that starts it.
 */
export default function GameScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const records = useGameStore((s) => s.records);
  const [quizDeckId, setQuizDeckId] = useState<string | null>(null);

  // Only decks that can supply four distinct answers can start a round. The
  // default is the deck with the most cards waiting, so Play always does
  // something useful without a first choice.
  const playableDecks = useMemo(
    () =>
      decks
        .filter((deck) => !deck.archivedAt && isDeckPlayable(cardsByDeck[deck.id] ?? []))
        .map((deck) => ({
          id: deck.id,
          name: deck.name,
          due: buildStudyQueue(deck, cardsByDeck[deck.id] ?? [], reviewLog).total,
        }))
        .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name)),
    [decks, cardsByDeck, reviewLog]
  );

  useEffect(() => {
    if (playableDecks.length === 0) {
      if (quizDeckId !== null) setQuizDeckId(null);
      return;
    }
    if (!quizDeckId || !playableDecks.some((deck) => deck.id === quizDeckId)) {
      setQuizDeckId(playableDecks[0].id);
    }
  }, [playableDecks, quizDeckId]);

  return (
    <Screen
      scroll
      gutter
      tabClearance
      header={
        <TopAppBar
          title="Game"
          actions={[
            { icon: 'add', accessibilityLabel: 'Add Deck', onPress: () => pushOnce(router, '/add-deck') },
            { icon: 'settings', accessibilityLabel: 'Settings', onPress: () => pushOnce(router, '/settings') },
          ]}
        />
      }
    >
      <RevealItem index={0}>
        <QuizStartCard
          className="mt-4"
          decks={playableDecks}
          selectedDeckId={quizDeckId}
          onSelectDeck={setQuizDeckId}
          bestScore={quizDeckId ? records[quizDeckId]?.bestScore : undefined}
          onPlay={() => quizDeckId && pushOnce(router, `/quiz/${quizDeckId}`)}
        />
      </RevealItem>
    </Screen>
  );
}
