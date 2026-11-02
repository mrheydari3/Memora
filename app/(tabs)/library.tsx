import { useState, useEffect, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable } from '../../data/quiz';
import {
  AppText,
  Screen,
  TopAppBar,
  SearchBar,
  Chip,
  DeckCard,
  GlassCard,
  SectionHeader,
  SegmentedControl,
  EmptyState,
  QuizStartCard,
  RevealItem,
  DeckCardGridSkeleton,
} from '../../components';
import { spacing } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

// A deck's category is derived from its icon (the only category signal a deck
// actually carries), so the chips filter real data instead of doing nothing.
const CATEGORY_ICONS: Record<string, string[] | null> = {
  'All Decks': null,
  Languages: ['language'],
  Medical: ['medical-services'],
  Law: ['gavel'],
  'Computer Science': ['terminal'],
};
const CATEGORIES = Object.keys(CATEGORY_ICONS);

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const decks = useDeckStore((s) => s.decks);
  // Subscribe to the card map directly: selecting the stable getCards function
  // never re-rendered, so counts went stale after adding or importing cards.
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const records = useGameStore((s) => s.records);
  const loaded = useDeckStore((s) => s.loaded);

  const [activeTab, setActiveTab] = useState<'mydecks' | 'discover'>(
    params.tab === 'discover' ? 'discover' : 'mydecks'
  );
  const [activeCategory, setActiveCategory] = useState('All Decks');
  const [query, setQuery] = useState('');
  const [quizDeckId, setQuizDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'discover') setActiveTab('discover');
  }, [params.tab]);

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

  const filteredDecks = decks.filter((deck) => {
    if (deck.archivedAt) return false;

    // The field says "Search decks and cards", so a query has to match either
    // the deck's own name or any card inside it. Searching only titles sent
    // people to "No decks found" for words they could see on their cards.
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      const matchesName = deck.name.toLowerCase().includes(q);
      const matchesCard = (cardsByDeck[deck.id] ?? []).some(
        (card) =>
          card.front.text.toLowerCase().includes(q) || card.back.text.toLowerCase().includes(q)
      );
      if (!matchesName && !matchesCard) return false;
    }

    const icons = CATEGORY_ICONS[activeCategory];
    return icons === null || icons.includes(deck.icon);
  });

  return (
    <Screen
      scroll
      gutter
      tabClearance
      header={
        <TopAppBar
          title="Library"
          actions={[
            { icon: 'add', accessibilityLabel: 'Add Deck', onPress: () => pushOnce(router, '/add-deck') },
            { icon: 'settings', accessibilityLabel: 'Settings', onPress: () => pushOnce(router, '/settings') },
          ]}
        />
      }
    >
      {/* Library opens on the game: a 60-second round with a real deck. */}
      {activeTab === 'mydecks' && (
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
      )}

      <RevealItem index={1}>
      <View className="mt-4">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search decks and cards" />
      </View>

      <SegmentedControl
        className="mt-4"
        appearance="fill"
        value={activeTab}
        onChange={(key) => setActiveTab(key as 'mydecks' | 'discover')}
        segments={[
          { key: 'mydecks', label: 'My Decks' },
          { key: 'discover', label: 'Discover', badge: 'Soon' },
        ]}
      />
      </RevealItem>

      {activeTab === 'mydecks' && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-4"
            style={{ marginHorizontal: -spacing.screen }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.screen }}
          >
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </ScrollView>

          <RevealItem index={2}>
          <SectionHeader className="mt-6" label="Your decks" hint={`${filteredDecks.length}`} />

          <View className="mt-3 gap-3">
            {!loaded && <DeckCardGridSkeleton count={3} />}
            {loaded && filteredDecks.length === 0 && (
              <GlassCard>
                <EmptyState
                  icon="search-off"
                  title="No decks found"
                  description="Try another search or category."
                />
              </GlassCard>
            )}
            {loaded &&
              filteredDecks.map((deck, index) => (
              <RevealItem key={deck.id} index={index}>
              <DeckCard
                name={deck.name}
                icon={deck.icon as IconName}
                color={deck.color}
                cardCount={cardsByDeck[deck.id]?.length ?? 0}
                description={deck.description}
                saved={deck.saved}
                rating={deck.rating}
                onPress={() => pushOnce(router, `/deck/${deck.id}`)}
                onSave={() => useDeckStore.getState().updateDeck(deck.id, { saved: !deck.saved })}
              />
              </RevealItem>
            ))}
          </View>
          </RevealItem>
        </>
      )}

      {activeTab === 'discover' && (
        <View className="mt-6">
          <GlassCard className="py-4">
            <EmptyState
              icon="explore"
              title="Discover is coming soon"
              description="Browsing curated decks and importing them is still being built. Everything you have already saved lives in My Decks."
            />
          </GlassCard>
        </View>
      )}
    </Screen>
  );
}
