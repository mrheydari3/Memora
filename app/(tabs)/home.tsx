import { useEffect, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  SectionHeader,
  DeckListItem,
  PrimaryButton,
  EmptyState,
  IconButton,
  RevealItem,
  SkeletonRow,
} from '../../components';
import {
  alpha,
  colors,
  glassFill,
  heights,
  iconSize,
} from '../../theme/tokens';

const EXPLORE = [
  { key: 'discover', icon: 'explore', title: 'Discover', subtitle: 'Curated decks', href: '/library?tab=discover' },
  { key: 'insights', icon: 'insights', title: 'Insights', subtitle: 'Streak & progress', href: '/statistics' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  // Subscribing to the card map keeps the due counts live after a session or
  // when cards are added/deleted; reading it via getState() made them stale.
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLoaded) useReviewStore.getState().load();
  }, [loaded, reviewLoaded]);

  const streak = useMemo(() => computeStreak(reviewLog.map((e) => e.reviewedAt)), [reviewLog]);

  // One queue per deck, using the same helper as the study session so the
  // numbers agree with what the session will actually show.
  const deckQueues = useMemo(
    () =>
      decks.map((deck) => {
        const cards = cardsByDeck[deck.id] ?? [];
        return { deck, cardCount: cards.length, total: buildStudyQueue(deck, cards, reviewLog).total };
      }),
    [decks, cardsByDeck, reviewLog]
  );

  const dueCount = deckQueues.reduce((sum, entry) => sum + entry.total, 0);
  const nextDeck = deckQueues.find((entry) => entry.total > 0);
  const activeDecks = deckQueues.filter((entry) => entry.total > 0).length;

  return (
    <Screen
      scroll
      gutter
      tabClearance
      header={
        <TopAppBar
          leftContent={
            <View className="flex-1 flex-row items-center gap-2 pl-1">
              <View
                className="items-center justify-center rounded-md border border-accent-line"
                style={{
                  width: heights.icon,
                  height: heights.icon,
                  backgroundColor: colors.accentSoft,
                }}
              >
                <MaterialIcons name="blur-on" size={iconSize.md} color={colors.primary} />
              </View>
              <AppText variant="bodyLg" weight="semibold">
                Memora
              </AppText>
            </View>
          }
          actions={[
            { icon: 'create-new-folder', accessibilityLabel: 'Add Deck', onPress: () => pushOnce(router, '/add-deck') },
            {
              icon: editMode ? 'check' : 'edit',
              accessibilityLabel: editMode ? 'Exit edit mode' : 'Edit mode',
              onPress: () => setEditMode((v) => !v),
            },
          ]}
        />
      }
    >

      <RevealItem index={0}>
      {/* Greeting + streak */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <AppText variant="caption" weight="semibold" tone="muted" className="uppercase">
            Your library
          </AppText>
          <AppText variant="title" className="mt-1">
            Good to see you.
          </AppText>
        </View>
        <View
          className="flex-row items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5"
          style={{ backgroundColor: alpha(colors.warning, 0.08) }}
        >
          <MaterialIcons
            name="local-fire-department"
            size={iconSize.sm}
            color={streak > 0 ? colors.warning : colors.outline}
          />
          <AppText variant="bodySm" weight="semibold">
            {streak}
          </AppText>
          <AppText variant="caption" weight="medium" tone="muted">
            {streak === 1 ? 'day' : 'days'}
          </AppText>
        </View>
      </View>
      </RevealItem>

      <RevealItem index={1}>
      {/* Today's session */}
      <GlassCard tone="accent" className="mt-6">
        <View className="flex-row items-start justify-between">
          <View>
            <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
              Today
            </AppText>
            <AppText variant="display" className="mt-1">
              {dueCount}
            </AppText>
            <AppText variant="bodySm" tone="muted" className="mt-1">
              {dueCount > 0
                ? `cards due across ${activeDecks} ${activeDecks === 1 ? 'deck' : 'decks'}`
                : 'Nothing due — you are all caught up'}
            </AppText>
          </View>
          <View
            className="items-center justify-center rounded-full border border-accent-line"
            style={{
              width: heights.iconLg,
              height: heights.iconLg,
              backgroundColor: colors.accentFaint,
            }}
          >
            <MaterialIcons
              name={dueCount > 0 ? 'bolt' : 'check'}
              size={iconSize.lg}
              color={colors.primary}
            />
          </View>
        </View>

        <PrimaryButton
          className="mt-5"
          label="Start session"
          icon={dueCount > 0 ? 'play-arrow' : undefined}
          disabled={!nextDeck}
          onPress={() => nextDeck && pushOnce(router, `/study/${nextDeck.deck.id}`)}
        />
        {nextDeck && (
          <AppText
            variant="caption"
            weight="medium"
            tone="muted"
            align="center"
            className="mt-2.5"
            numberOfLines={1}
          >
            Next up · {nextDeck.deck.name}
          </AppText>
        )}
      </GlassCard>
      </RevealItem>

      {/* Decks */}
      <RevealItem index={2}>
      <SectionHeader
        className="mt-8"
        label="Decks"
        hint={String(decks.length)}
        action={{ label: 'New deck', icon: 'add', onPress: () => pushOnce(router, '/add-deck') }}
      />

      <GlassCard padding="none" className="mt-3">
        {!loaded ? (
          <View>
            {[0, 1, 2].map((i) => (
              <View key={i}>
                <SkeletonRow tall />
                {i < 2 && <View className="mx-4 h-px bg-hairline" />}
              </View>
            ))}
          </View>
        ) : deckQueues.length === 0 ? (
          <EmptyState
            icon="library-books"
            title="No decks yet"
            description="Create your first deck to start building a memory."
            className="px-6 py-8"
          />
        ) : (
          deckQueues.map(({ deck, cardCount, total }, i) => (
            <DeckListItem
              key={deck.id}
              name={deck.name}
              icon={deck.icon as React.ComponentProps<typeof MaterialIcons>['name']}
              color={deck.color}
              meta={`${cardCount} cards · ${total > 0 ? `${total} due` : 'nothing due'}`}
              divider={i < deckQueues.length - 1}
              onPress={() => pushOnce(router, `/deck/${deck.id}`)}
              trailing={
                editMode ? (
                  <IconButton
                    icon="delete-outline"
                    size="sm"
                    tone="danger"
                    onPress={(event) => {
                      // The row itself opens the deck; without this the delete
                      // tap also navigates on web, where clicks bubble.
                      event.stopPropagation();
                      useDeckStore.getState().deleteDeck(deck.id);
                    }}
                    accessibilityLabel={`Delete ${deck.name}`}
                  />
                ) : undefined
              }
            />
          ))
        )}
      </GlassCard>
      </RevealItem>

      {/* Secondary destinations */}
      <RevealItem index={3}>
      <SectionHeader className="mt-8" label="Explore" />
      <View className="mt-3 flex-row gap-3">
        {EXPLORE.map((item) => (
          <Pressable
            key={item.key}
            className="flex-1 rounded-xl border border-hairline p-4 active:opacity-80"
            style={glassFill}
            onPress={() => pushOnce(router, item.href)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View
              className="items-center justify-center rounded-md border border-hairline"
              style={{
                width: heights.tile,
                height: heights.tile,
                backgroundColor: colors.accentFaint,
              }}
            >
              <MaterialIcons name={item.icon} size={iconSize.md} color={colors.primary} />
            </View>
            <AppText variant="body" weight="semibold" className="mt-3">
              {item.title}
            </AppText>
            <AppText variant="bodySm" tone="muted" className="mt-0.5">
              {item.subtitle}
            </AppText>
          </Pressable>
        ))}
      </View>
      </RevealItem>
    </Screen>
  );
}
