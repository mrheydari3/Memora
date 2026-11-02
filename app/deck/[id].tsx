import { useCallback, useEffect, useState } from 'react';
import { View, Animated } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { exportJson } from '../../services/export';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  motion,
  spacing,
  stateColors,
} from '../../theme/tokens';
import { useReveal } from '../../motion';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  SectionHeader,
  SearchBar,
  PrimaryButton,
  CardStack,
  BottomSheetModal,
  SheetScrollView,
  SegmentedProgressBar,
  SegmentedControl,
  EmptyState,
  ListRow,
  Field,
  Pill,
  Button,
  HeroSkeleton,
  DeckCardGridSkeleton,
} from '../../components';
import type { Flashcard } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type SortMode = 'created' | 'alpha' | 'due';
type FilterMode = 'all' | 'new' | 'learning' | 'mastered';

const SORT_LABELS: Record<SortMode, string> = {
  created: 'Newest',
  alpha: 'A–Z',
  due: 'Due',
};

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All',
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
};

const FILTER_CYCLE: FilterMode[] = ['all', 'new', 'learning', 'mastered'];
const SORT_CYCLE: SortMode[] = ['created', 'alpha', 'due'];

/** 1811 → "1,811" without depending on Intl being present on the runtime. */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The gap between the controls strip and the top of the gallery. */
const HEADER_SPACER: ViewStyle = { paddingBottom: 12 };
const EMPTY_WRAPPER: ViewStyle = { paddingHorizontal: spacing.screen };

export default function DeckDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const deck = useDeckStore((s) => s.decks.find((d) => d.id === id));
  const decks = useDeckStore((s) => s.decks);
  const loaded = useDeckStore((s) => s.loaded);
  const deleteCard = useDeckStore((s) => s.deleteCard);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const duplicateDeck = useDeckStore((s) => s.duplicateDeck);
  const resetDeckProgress = useDeckStore((s) => s.resetDeckProgress);
  const folders = useDeckStore((s) => s.folders);
  const setDeckFolder = useDeckStore((s) => s.setDeckFolder);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [moveVisible, setMoveVisible] = useState(false);
  const [folderVisible, setFolderVisible] = useState(false);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  /** Index into the filtered cards — the gallery's current page. */
  const [cardIndex, setCardIndex] = useState(0);

  // Subscribe to the card map and review log so the list and counts stay live
  // after adding, deleting, resetting or reviewing a card.
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  const deckCards: Flashcard[] = deck
    ? [...(cardsByDeck[deck.id] ?? [])].sort((a, b) => {
        if (sortMode === 'alpha') return a.front.text.localeCompare(b.front.text);
        if (sortMode === 'due') return a.fsrs.due.localeCompare(b.fsrs.due);
        return b.createdAt - a.createdAt;
      })
    : [];

  const visibleCards = deckCards.filter((card) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q.length === 0 ||
      card.front.text.toLowerCase().includes(q) ||
      card.back.text.toLowerCase().includes(q);
    const matchesFilter =
      filterMode === 'all' ||
      (filterMode === 'new' && card.fsrs.state === 'New') ||
      (filterMode === 'learning' &&
        (card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning')) ||
      (filterMode === 'mastered' && card.fsrs.state === 'Review');
    return matchesQuery && matchesFilter;
  });

  // A new order, filter or search starts the gallery at its first card.
  useEffect(() => {
    setCardIndex(0);
  }, [sortMode, filterMode, query]);

  const newCards = deckCards.filter((c) => c.fsrs.state === 'New').length;
  const learningCards = deckCards.filter(
    (c) => c.fsrs.state === 'Learning' || c.fsrs.state === 'Relearning'
  ).length;
  const masteredCards = deckCards.filter((c) => c.fsrs.state === 'Review').length;

  // Same calculation as the study session, so "Today's queue" is exactly the
  // number of cards the session will contain (respecting the daily caps).
  const totalDue = deck ? buildStudyQueue(deck, deckCards, reviewLog).total : 0;

  // The card menu is addressed by id, which keeps the gallery callback stable.
  const cardMenuCard = cardMenuId ? (deckCards.find((c) => c.id === cardMenuId) ?? null) : null;
  const openCardMenu = useCallback((card: Flashcard) => setCardMenuId(card.id), []);
  const closeCardMenu = useCallback(() => setCardMenuId(null), []);

  // The displayed page, clamped when a card is deleted or filtered away.
  const galleryIndex = visibleCards.length === 0 ? 0 : Math.min(cardIndex, visibleCards.length - 1);
  const galleryCard = visibleCards[galleryIndex];
  const showPreviousCard = useCallback(
    () => setCardIndex(Math.max(0, galleryIndex - 1)),
    [galleryIndex]
  );
  const showNextCard = useCallback(
    () => setCardIndex(Math.min(visibleCards.length - 1, galleryIndex + 1)),
    [galleryIndex, visibleCards.length]
  );

  // Motion: the page settles in on open, and the gallery re-reveals whenever its
  // order or filter changes — it never snaps from one arrangement to another.
  const identityReveal = useReveal('identity', { distance: 10 });
  const heroReveal = useReveal('hero', { delay: 60, distance: 14 });
  const controlsReveal = useReveal('controls', { delay: 120, distance: 10 });
  const searchReveal = useReveal(searchOpen, { duration: motion.base, distance: 0 });
  const galleryReveal = useReveal(`${sortMode}:${filterMode}`, {
    duration: motion.base,
    distance: 0,
  });

  // The store hydrates asynchronously: until it has, "Deck not found" would be a
  // lie for a deck that is about to load. Show the page's shape instead.
  if (!deck && !loaded) {
    return (
      <Screen header={<TopAppBar title="Deck" back />}>
        <View className="flex-1" style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.screen }}>
          <HeroSkeleton height={150} />
          <View className="mt-6">
            <DeckCardGridSkeleton count={1} />
          </View>
        </View>
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen header={<TopAppBar title="Deck" back />}>
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="layers-clear"
            title="Deck not found"
            titleVariant="bodyLg"
            description="It may have been deleted. Go back to return to your library."
          />
        </View>
      </Screen>
    );
  }

  const openRename = () => {
    setNameDraft(deck.name);
    setOptionsVisible(false);
    setRenameVisible(true);
  };

  const handleDuplicate = async () => {
    setOptionsVisible(false);
    await duplicateDeck(deck.id);
  };

  const handleArchive = async () => {
    setOptionsVisible(false);
    await updateDeck(deck.id, { archivedAt: deck.archivedAt ? null : Date.now() });
    router.back();
  };

  const handleExport = async () => {
    setOptionsVisible(false);
    try {
      await exportJson(`${deck.name} — Memora export`, { deck, cards: deckCards });
    } catch {
      // User cancelled the share sheet / download
    }
  };

  const handleReset = async () => {
    setOptionsVisible(false);
    await resetDeckProgress(deck.id);
  };

  const handleDelete = async () => {
    setOptionsVisible(false);
    await useDeckStore.getState().deleteDeck(deck.id);
    router.replace('/(tabs)/home');
  };

  const sortedDecks = decks.filter((d) => d.id !== deck.id);
  const cardsEmpty = deckCards.length === 0;
  const filtered = visibleCards.length !== deckCards.length;

  // Everything above the gallery: identity, queue instrument, card controls.
  // The page owns the scroll, so the gallery sits in normal flow below this.
  const listHeader = (
    <View style={HEADER_SPACER}>
      {/* Deck identity — the tile, title and meta row of the deck's own card in
          the library, so the pane you tapped and the page you land on match. */}
      <View className="px-5">
        <Animated.View style={identityReveal.style}>
        <View className="flex-row items-center">
          <View
            className="mr-3 items-center justify-center rounded-md"
            style={{
              width: heights.tileLg,
              height: heights.tileLg,
              backgroundColor: alpha(deck.color, 0.16),
            }}
          >
            <MaterialIcons name={deck.icon as IconName} size={iconSize.lg} color={deck.color} />
          </View>
          <AppText variant="title" className="flex-1" numberOfLines={2}>
            {deck.name}
          </AppText>
        </View>

        <View className="mt-2 flex-row items-center gap-1.5">
          <MaterialIcons name="style" size={iconSize.sm} color={colors.outline} />
          <AppText variant="bodySm" weight="medium" tone="muted">
            {formatCount(deckCards.length)} cards
          </AppText>
          {deck.archivedAt ? <Pill label="Archived" tone="warning" className="ml-1" /> : null}
        </View>
        </Animated.View>
      </View>

      {/* Today's session — the same accent instrument as the home hero: one
          number, the deck's mastery rail and the one action that follows. */}
      <View className="mt-6 px-5">
        <Animated.View style={heroReveal.style}>
        <GlassCard tone="accent">
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Today&apos;s queue
          </AppText>
          <AppText variant="display" className="mt-1">
            {totalDue}
          </AppText>
          <AppText variant="bodySm" tone="muted" className="mt-1">
            {totalDue > 0
              ? 'cards due in this deck'
              : 'Nothing due — you are all caught up'}
          </AppText>

          <SegmentedProgressBar
            className="mt-4"
            height={8}
            gap={3}
            segments={[
              { value: newCards, color: stateColors.New },
              { value: learningCards, color: stateColors.Learning },
              { value: masteredCards, color: stateColors.Review },
            ]}
          />

          {/* Three equal columns, so a 360px phone never squeezes the legend. */}
          <View className="mt-3 flex-row items-start">
            <LegendItem color={stateColors.New} value={newCards} label="New" />
            <LegendItem color={stateColors.Learning} value={learningCards} label="Learning" />
            <LegendItem color={stateColors.Review} value={masteredCards} label="Mastered" />
          </View>

          <PrimaryButton
            className="mt-5"
            label="Start session"
            icon={totalDue > 0 ? 'play-arrow' : undefined}
            disabled={totalDue === 0}
            onPress={() => pushOnce(router, `/study/${deck.id}`)}
          />
        </GlassCard>
        </Animated.View>
      </View>

      {/* Cards */}
      <View className="mt-8 px-5">
        <Animated.View style={controlsReveal.style}>
        <SectionHeader
          label="Cards"
          hint={
            filtered
              ? `${formatCount(visibleCards.length)} of ${formatCount(deckCards.length)}`
              : undefined
          }
        />

        {searchOpen && (
          <View className="mt-3">
            <Animated.View style={searchReveal.style}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search cards" />
            </Animated.View>
          </View>
        )}

        {/* Order and filter read as one control, not two unrelated pills. */}
        <SegmentedControl
          className="mt-3"
          appearance="plain"
          divider
          segments={[
            {
              key: 'sort',
              label: SORT_LABELS[sortMode],
              icon: 'sort',
              trailingIcon: 'unfold-more',
              onPress: () =>
                setSortMode(
                  SORT_CYCLE[(SORT_CYCLE.indexOf(sortMode) + 1) % SORT_CYCLE.length]
                ),
            },
            {
              key: 'filter',
              label: FILTER_LABELS[filterMode],
              icon: 'tune',
              trailingIcon: 'unfold-more',
              active: filterMode !== 'all',
              onPress: () =>
                setFilterMode(
                  FILTER_CYCLE[(FILTER_CYCLE.indexOf(filterMode) + 1) % FILTER_CYCLE.length]
                ),
            },
          ]}
        />
        </Animated.View>
      </View>
    </View>
  );

  const listEmpty = (
    <Animated.View style={galleryReveal.style}>
    <View style={EMPTY_WRAPPER}>
      <GlassCard>
        <EmptyState
          icon={cardsEmpty ? 'note-add' : 'search-off'}
          title={cardsEmpty ? 'No cards yet' : 'Nothing matches'}
          description={
            cardsEmpty
              ? 'Add your first card to start studying this deck.'
              : 'Try a different search or filter.'
          }
          action={
            cardsEmpty ? (
              <Button
                variant="outline"
                size="md"
                label="Add cards"
                icon="add"
                onPress={() => pushOnce(router, `/deck/${deck.id}/add-card`)}
              />
            ) : undefined
          }
        />
      </GlassCard>
    </View>
    </Animated.View>
  );

  return (
    <Screen
      header={
        <TopAppBar
          title="Deck"
          back
          actions={[
            {
              icon: searchOpen ? 'search-off' : 'search',
              accessibilityLabel: searchOpen ? 'Close search' : 'Search cards',
              onPress: () => {
                setSearchOpen((open) => !open);
                if (searchOpen) setQuery('');
              },
            },
            {
              icon: 'add',
              accessibilityLabel: 'Add cards',
              onPress: () => pushOnce(router, `/deck/${deck.id}/add-card`),
            },
            {
              icon: 'more-horiz',
              accessibilityLabel: 'More options',
              onPress: () => setOptionsVisible(true),
            },
          ]}
        />
      }
      scroll
    >
      {listHeader}

      {galleryCard ? (
        <Animated.View style={[galleryReveal.style, { paddingHorizontal: spacing.screen }]}>
          <CardStack
            card={galleryCard}
            previous={visibleCards[galleryIndex - 1]}
            next={visibleCards[galleryIndex + 1]}
            position={galleryIndex + 1}
            total={visibleCards.length}
            onPrevious={showPreviousCard}
            onNext={showNextCard}
            onMenu={openCardMenu}
          />
        </Animated.View>
      ) : (
        listEmpty
      )}

      {/* Deck options sheet */}
      <BottomSheetModal
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        title={deck.name}
        subtitle={`${formatCount(deckCards.length)} cards`}
      >
        <SheetRow icon="edit" label="Rename Deck" onPress={openRename} />
        <SheetRow
          icon="shortcut"
          label="Move Deck"
          onPress={() => {
            setOptionsVisible(false);
            setMoveVisible(true);
          }}
        />
        <SheetRow
          icon="folder-shared"
          label="Move to folder"
          onPress={() => {
            setOptionsVisible(false);
            setFolderVisible(true);
          }}
        />
        <SheetRow icon="content-copy" label="Duplicate Deck" onPress={handleDuplicate} />
        <SheetRow
          icon="archive"
          label={deck.archivedAt ? 'Unarchive Deck' : 'Archive Deck'}
          onPress={handleArchive}
        />
        <SheetRow icon="upload" label="Export Deck" onPress={handleExport} />
        <SheetRow icon="refresh" label="Reset Progress" onPress={handleReset} />
        <View className="h-2" />
        <SheetRow icon="delete-outline" label="Delete Deck" onPress={handleDelete} destructive />
      </BottomSheetModal>

      {/* Rename sheet */}
      <BottomSheetModal
        visible={renameVisible}
        onClose={() => setRenameVisible(false)}
        title="Rename Deck"
      >
        <Field label="Deck name" value={nameDraft} onChangeText={setNameDraft} placeholder="Deck name" />
        <View className="mt-4">
          <PrimaryButton
            label="Save"
            onPress={async () => {
              if (nameDraft.trim()) await updateDeck(deck.id, { name: nameDraft.trim() });
              setRenameVisible(false);
            }}
          />
        </View>
      </BottomSheetModal>

      {/* Move sheet */}
      <BottomSheetModal visible={moveVisible} onClose={() => setMoveVisible(false)} title="Move Deck under…">
        {sortedDecks.length === 0 && (
          <View className="px-1 pb-2">
            <AppText variant="bodySm" tone="muted">
              No other decks available.
            </AppText>
          </View>
        )}
        <SheetScrollView style={{ maxHeight: heights.sheetCompact }}>
          <SheetRow
            icon="folder-open"
            label="Top level (no parent)"
            onPress={async () => {
              await updateDeck(deck.id, { parentId: null });
              setMoveVisible(false);
            }}
          />
          {sortedDecks.map((d) => (
            <SheetRow
              key={d.id}
              icon="folder"
              label={d.name}
              accessibilityLabel={`Move under ${d.name}`}
              onPress={async () => {
                await updateDeck(deck.id, { parentId: d.id });
                setMoveVisible(false);
              }}
            />
          ))}
        </SheetScrollView>
      </BottomSheetModal>

      {/* Folder sheet — a browsing label only: the deck keeps its cards,
          schedule and history wherever it is filed. */}
      <BottomSheetModal
        visible={folderVisible}
        onClose={() => setFolderVisible(false)}
        title="Move to folder"
      >
        {folders.length === 0 ? (
          <View className="px-1 pb-2">
            <AppText variant="bodySm" tone="muted">
              No folders yet. Create one from the Folders sheet on the home screen.
            </AppText>
          </View>
        ) : (
          <SheetScrollView style={{ maxHeight: heights.sheetCompact }}>
            <SheetRow
              icon="folder-open"
              label="No folder"
              onPress={async () => {
                await setDeckFolder(deck.id, null);
                setFolderVisible(false);
              }}
            />
            {folders.map((folder) => (
              <SheetRow
                key={folder.id}
                icon="folder"
                label={folder.name}
                onPress={async () => {
                  await setDeckFolder(deck.id, folder.id);
                  setFolderVisible(false);
                }}
              />
            ))}
          </SheetScrollView>
        )}
      </BottomSheetModal>

      {/* Per-card Edit/Delete sheet */}
      <BottomSheetModal
        visible={!!cardMenuCard}
        onClose={closeCardMenu}
        title={cardMenuCard?.front.text}
        subtitle={cardMenuCard?.back.text}
      >
        <SheetRow
          icon="edit"
          label="Edit"
          onPress={() => {
            const cardId = cardMenuCard?.id;
            closeCardMenu();
            if (cardId)
              pushOnce(router, { pathname: '/deck/[id]/add-card', params: { id: deck.id, editCardId: cardId } });
          }}
        />
        <SheetRow
          icon="delete-outline"
          label="Delete"
          destructive
          onPress={async () => {
            const cardId = cardMenuCard?.id;
            closeCardMenu();
            if (cardId) await deleteCard(cardId);
          }}
        />
      </BottomSheetModal>
    </Screen>
  );
}

/**
 * The statistics legend at deck scale: a 10px state dot, the count and the
 * state's name, in a column so three of them share the pane at any width.
 */
function LegendItem({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center">
        <View
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color, opacity: value > 0 ? 1 : 0.3 }}
        />
        <AppText variant="bodySm" weight="semibold" className="ml-2">
          {formatCount(value)}
        </AppText>
      </View>
      <AppText
        variant="caption"
        weight="medium"
        tone="muted"
        className="mt-0.5 uppercase"
        style={{ marginLeft: spacing.legendIndent }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** One row of every sheet on this screen: bare icon, label, 52px minimum. */
/**
 * One option inside a sheet: a soft tile with its glyph, its label and — for a
 * destructive action — a warmer weight.
 *
 * Each option sits on its own inset fill instead of a flat line of text, so a
 * menu reads as a stack of choices rather than a paragraph, and the tint stays
 * exactly one step above the sheet's own surface.
 */
function SheetRow({
  icon,
  label,
  onPress,
  destructive = false,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <ListRow
      title={label}
      icon={icon}
      tile="sm"
      density="compact"
      titleWeight={destructive ? 'semibold' : 'medium'}
      iconTone={destructive ? 'destructive' : 'neutral'}
      destructive={destructive}
      showChevron={false}
      gutter={12}
      className="mb-1.5 rounded-md"
      style={{ backgroundColor: fills.inset }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    />
  );
}
