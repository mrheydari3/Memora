import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
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
  glassFill,
  heights,
  iconSize,
  rims,
  stateColors,
} from '../../theme/tokens';
import { v2 } from '../../theme/v2';
import {
  AppText,
  Button,
  BottomSheetModal,
  EmptyState,
  Field,
  HeroSkeleton,
  DeckCardGridSkeleton,
  ListRow,
  Pill,
  PrimaryButton,
  RevealItem,
  Screen,
  SheetScrollView,
  TopAppBar,
} from '../../components';
import { StartButton, TodayRail } from '../../components/v2';
import type { Flashcard } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type SortMode = 'created' | 'alpha' | 'due';
type FilterMode = 'all' | 'new' | 'learning' | 'review';

/** Destructive actions run only after the user confirms them in a sheet. */
type ConfirmAction =
  | { kind: 'reset' }
  | { kind: 'delete-deck' }
  | { kind: 'delete-card'; cardId: string; front: string };

const SORT_LABELS: Record<SortMode, string> = {
  created: 'Newest',
  alpha: 'A–Z',
  due: 'Due',
};

const SORT_CYCLE: SortMode[] = ['created', 'alpha', 'due'];

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'learning', label: 'Learning' },
  { key: 'review', label: 'Review' },
];

const CARD_LIMIT = 8;

/** 1811 → "1,811" without depending on Intl being present on the runtime. */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function DeckDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const deck = useDeckStore((s) => s.decks.find((d) => d.id === id));
  const loaded = useDeckStore((s) => s.loaded);
  const deleteCard = useDeckStore((s) => s.deleteCard);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const duplicateDeck = useDeckStore((s) => s.duplicateDeck);
  const resetDeckProgress = useDeckStore((s) => s.resetDeckProgress);
  const folders = useDeckStore((s) => s.folders);
  const setDeckFolder = useDeckStore((s) => s.setDeckFolder);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [folderVisible, setFolderVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
      (filterMode === 'review' && card.fsrs.state === 'Review');
    return matchesQuery && matchesFilter;
  });

  // Same calculation as the study session, so "Today's queue" is exactly the
  // number of cards the session will contain (respecting the daily caps).
  const queue = useMemo(
    () => (deck ? buildStudyQueue(deck, deckCards, reviewLog) : null),
    [deck, deckCards, reviewLog]
  );

  // A new order, filter or search starts the browser at its first cards.
  useEffect(() => {
    setExpandedId(null);
    setShowAll(false);
  }, [sortMode, filterMode, query]);

  // The card menu is addressed by id, which keeps the row callback stable.
  const cardMenuCard = cardMenuId ? (deckCards.find((c) => c.id === cardMenuId) ?? null) : null;
  const openCardMenu = useCallback((card: Flashcard) => setCardMenuId(card.id), []);
  const closeCardMenu = useCallback(() => setCardMenuId(null), []);

  // The store hydrates asynchronously: until it has, "Deck not found" would be a
  // lie for a deck that is about to load. Show the page's shape instead.
  if (!deck && !loaded) {
    return (
      <Screen header={<TopAppBar title="Deck" back />}>
        <View className="flex-1" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
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

  const totalDue = queue?.total ?? 0;
  const newDue = queue?.newCards.length ?? 0;
  const learningDue =
    queue?.dueCards.filter(
      (card) => card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning'
    ).length ?? 0;
  const reviewDue = (queue?.dueCards.length ?? 0) - learningDue;

  const cardsEmpty = deckCards.length === 0;
  const filtered = query.trim().length > 0 || filterMode !== 'all';
  const shown = showAll ? visibleCards : visibleCards.slice(0, CARD_LIMIT);
  const sortLabel = SORT_LABELS[sortMode];

  const clearFilters = () => {
    setQuery('');
    setFilterMode('all');
  };

  const cycleSort = () => {
    const index = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(index + 1) % SORT_CYCLE.length]);
  };

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

  const handleReset = () => {
    setOptionsVisible(false);
    setConfirmAction({ kind: 'reset' });
  };

  const handleDelete = () => {
    setOptionsVisible(false);
    setConfirmAction({ kind: 'delete-deck' });
  };

  const runConfirmed = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;

    if (action.kind === 'reset') {
      await resetDeckProgress(deck.id);
      return;
    }

    if (action.kind === 'delete-card') {
      await deleteCard(action.cardId);
      return;
    }

    await useDeckStore.getState().deleteDeck(deck.id);
    router.replace('/(tabs)/home');
  };

  const identity = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: heights.tileLg,
          height: heights.tileLg,
          borderRadius: v2.radii.card,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(deck.color, 0.16),
        }}
      >
        <MaterialIcons name={deck.icon as IconName} size={iconSize.lg} color={deck.color} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="title" headingLevel={2} style={v2.type.title} numberOfLines={2}>
          {deck.name}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 4,
          }}
        >
          <AppText variant="caption" tone="muted">
            {formatCount(deckCards.length)} cards ·{' '}
            {totalDue > 0 ? `${totalDue} due` : 'caught up'}
          </AppText>
          {deck.archivedAt ? <Pill label="Archived" tone="warning" /> : null}
        </View>
      </View>
    </View>
  );

  const hero = (
    <View
      testID="deck-hero"
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha(colors.primary, 0.06),
        }}
      />

      <View style={{ padding: v2.spacing.panel }}>
        <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
          Today’s queue
        </AppText>

        <View
          className="flex-row flex-wrap items-end"
          style={{ columnGap: 12, rowGap: 2, marginTop: 2 }}
        >
          <AppText
            variant="display"
            style={v2.type.display}
            accessibilityLabel={`${totalDue} cards due in this deck`}
          >
            {totalDue}
          </AppText>
          <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 9 }}>
            cards due
          </AppText>
        </View>

        <AppText variant="body" tone="muted" className="mt-1">
          {totalDue > 0 ? 'in this deck today' : 'Nothing due — you are all caught up'}
        </AppText>

        <View style={{ marginTop: 20 }}>
          <StartButton
            label={totalDue > 0 ? 'Start session' : 'Nothing due today'}
            disabled={totalDue === 0}
            onPress={() => pushOnce(router, `/study/${deck.id}`)}
          />
        </View>

        {totalDue > 0 && (
          <View style={{ marginTop: 20 }}>
            <TodayRail
              segments={[
                { label: 'New', value: newDue, color: stateColors.New },
                { label: 'Learning', value: learningDue, color: stateColors.Learning },
                { label: 'Review', value: reviewDue, color: stateColors.Review },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );

  const cardsSection = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <AppText variant="headline" headingLevel={2} style={v2.type.headline}>
          Cards
        </AppText>
        <AppText variant="caption" tone="muted">
          {filtered
            ? `${formatCount(visibleCards.length)} of ${formatCount(deckCards.length)}`
            : `${formatCount(deckCards.length)} cards`}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <View
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 100,
            backgroundColor: fills.control,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            gap: 8,
          }}
        >
          <MaterialIcons name="search" size={iconSize.md} color={colors.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cards"
            placeholderTextColor={colors.onSurfaceVariant}
            selectionColor={colors.primary}
            accessibilityLabel="Search cards"
            autoCorrect={false}
            style={{
              flex: 1,
              // 44px touch target on the input itself, not just the pill around it.
              minHeight: heights.field,
              color: colors.onSurface,
              fontSize: 15,
              paddingVertical: 0,
            }}
          />
        </View>

        <Pressable
          onPress={cycleSort}
          accessibilityRole="button"
          accessibilityLabel={`Sort cards: ${sortLabel}`}
          style={{
            width: 48,
            height: 48,
            borderRadius: 100,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: fills.control,
          }}
        >
          <MaterialIcons name="sort" size={iconSize.md} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {FILTERS.map((entry) => {
          const active = filterMode === entry.key;
          return (
            <Pressable
              key={entry.key}
              onPress={() => setFilterMode(entry.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                minWidth: 44,
                minHeight: 44,
                borderRadius: 100,
                paddingHorizontal: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.primaryContainer : fills.control,
              }}
            >
              <AppText
                variant="bodySm"
                weight="semibold"
                style={{ color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }}
              >
                {entry.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 14, gap: 8 }}>
        {visibleCards.length === 0 ? (
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
              ) : (
                <Button variant="text" size="md" label="Clear filters" onPress={clearFilters} />
              )
            }
          />
        ) : (
          shown.map((card) => {
            const expanded = expandedId === card.id;
            return (
              <View
                key={card.id}
                style={{
                  minHeight: 64,
                  borderRadius: 18,
                  backgroundColor: fills.inset,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Pressable
                  testID="deck-card-row"
                  onPress={() => setExpandedId(expanded ? null : card.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  aria-expanded={expanded}
                  accessibilityHint={expanded ? 'Hide the back' : 'Show the back'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 64,
                    paddingLeft: 14,
                    paddingRight: 4,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: stateColors[card.fsrs.state],
                    }}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      variant="body"
                      weight="semibold"
                      numberOfLines={expanded ? undefined : 1}
                      style={{ writingDirection: card.front.direction }}
                    >
                      {card.front.text}
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="muted"
                      align="left"
                      style={{ marginTop: 2, writingDirection: card.back.direction }}
                      numberOfLines={expanded ? undefined : 1}
                    >
                      {card.back.text}
                    </AppText>
                  </View>
                  <AppText variant="caption" tone="muted">
                    {card.fsrs.state}
                  </AppText>
                  <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={iconSize.md}
                    color={colors.outline}
                  />
                </Pressable>

                <Pressable
                  onPress={() => openCardMenu(card)}
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${card.front.text}`}
                  style={{
                    width: 44,
                    height: 44,
                    marginRight: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="more-vert" size={iconSize.md} color={colors.outline} />
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {visibleCards.length > CARD_LIMIT && (
        <Pressable
          onPress={() => setShowAll((value) => !value)}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}
        >
          <AppText variant="caption" weight="semibold" tone="accent">
            {showAll ? 'Show fewer' : `Show all ${formatCount(visibleCards.length)} cards`}
          </AppText>
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={
        <TopAppBar
          title="Deck"
          back
          actions={[
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
    >
      <View style={{ marginTop: v2.spacing.section, paddingBottom: 48 }}>
        <View
          style={
            wide
              ? { flexDirection: 'row', alignItems: 'flex-start', gap: 32 }
              : undefined
          }
        >
          <View style={wide ? { width: v2.layout.heroMeasure } : undefined}>
            <RevealItem index={0}>{identity}</RevealItem>
            <RevealItem index={1}>
              <View style={{ marginTop: 20 }}>{hero}</View>
            </RevealItem>
          </View>

          <View
            style={wide ? { flex: 1, minWidth: 0 } : { marginTop: v2.spacing.section }}
          >
            <RevealItem index={2}>{cardsSection}</RevealItem>
          </View>
        </View>
      </View>

      {/* Deck options sheet */}
      <BottomSheetModal
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        title={deck.name}
        subtitle={`${formatCount(deckCards.length)} cards`}
      >
        <SheetRow icon="edit" label="Rename Deck" onPress={openRename} />
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
              pushOnce(router, {
                pathname: '/deck/[id]/add-card',
                params: { id: deck.id, editCardId: cardId },
              });
          }}
        />
        <SheetRow
          icon="delete-outline"
          label="Delete"
          destructive
          onPress={() => {
            const card = cardMenuCard;
            closeCardMenu();
            if (card) {
              setConfirmAction({ kind: 'delete-card', cardId: card.id, front: card.front.text });
            }
          }}
        />
      </BottomSheetModal>

      {/* Destructive actions are confirmed here, never from the options sheet. */}
      <BottomSheetModal
        visible={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.kind === 'reset'
            ? 'Reset progress?'
            : confirmAction?.kind === 'delete-card'
              ? 'Delete card?'
              : 'Delete deck?'
        }
        subtitle={
          confirmAction?.kind === 'reset'
            ? 'Every card returns to new and this deck’s review history is removed. The cards themselves stay.'
            : confirmAction?.kind === 'delete-card'
              ? `“${confirmAction.front}” will be removed along with its review history.`
              : `“${deck.name}” and all of its cards will be deleted. This cannot be undone.`
        }
      >
        <View className="gap-3">
          <Button
            variant="secondary"
            destructive
            label={
              confirmAction?.kind === 'reset'
                ? 'Reset progress'
                : confirmAction?.kind === 'delete-card'
                  ? 'Delete card'
                  : 'Delete deck'
            }
            onPress={runConfirmed}
          />
          <Button variant="text" label="Cancel" onPress={() => setConfirmAction(null)} />
        </View>
      </BottomSheetModal>
    </Screen>
  );
}

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
      gutter={0}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    />
  );
}
