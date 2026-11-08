import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr, pushOnce } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { folderPath } from '../../data/folders';
import { exportJson } from '../../services/export';
import { alpha, colors, heights, iconSize, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { HintPressable } from '../../components/HintPressable';
import {
  AppText,
  Button,
  CARD_COLOR_CHOICES,
  BottomSheetModal,
  DeckCardGridSkeleton,
  EmptyState,
  Field,
  HeroSkeleton,
  IconButton,
  PrimaryButton,
  RevealItem,
  Screen,
  SearchBar,
  Select,
  ActionMenu,
  ContextMenu,
  Menu,
} from '../../components';
import type { MenuAction } from '../../components';
import { ActionButton, HeaderIcon, PageHeader, Surface } from '../../components/v3';
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

const SORT_OPTIONS: { mode: SortMode; title: string }[] = [
  { mode: 'created', title: 'Newest first' },
  { mode: 'alpha', title: 'A to Z' },
  { mode: 'due', title: 'Due first' },
];

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'learning', label: 'Learning' },
  { key: 'review', label: 'Review' },
];

const CARD_LIMIT = 8;

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/** 1811 → "1,811" without depending on Intl being present on the runtime. */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The hero's live status chip: due, caught up, or filed away. */
function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'accent' | 'success' | 'muted';
}) {
  const ink = tone === 'accent' ? colors.primary : tone === 'success' ? colors.success : colors.outline;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: tone === 'muted' ? colors.surfaceControl : alpha(ink, 0.12),
        borderWidth: 1,
        borderColor: tone === 'muted' ? alpha(colors.outlineSoft, 0.4) : alpha(ink, 0.25),
        flexShrink: 0,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} />
      <AppText variant="caption" tone={tone === 'muted' ? 'muted' : tone}>
        {label}
      </AppText>
    </View>
  );
}

/** One filter choice: selection is the tint behind the label, never an outline. */
function FilterPill({
  label,
  active,
  dot,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  active: boolean;
  dot?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      accessibilityLabel={accessibilityLabel}
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: active ? alpha(colors.primary, 0.14) : colors.surfaceControl,
      }}
    >
      {dot && (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }}
        />
      )}
      <AppText variant="caption" weight="semibold" tone={active ? 'accent' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Deck details — design v3, "Nocturne Focus".
 *
 * The shelf row opens onto one raised pane that states the deck's today: its
 * glyph and card count, the due figure, the new/learning/review split as an
 * inset ledger, and the session pill. Below it the card browser is a single
 * chapter — search, sort and filters in the pane's header, then 64px rows
 * separated by a hairline that starts at the text, the same rhythm the settings
 * panes use.
 *
 * Everything the page could do before is still here and still addressed the
 * same way: the browsers, the eight-card fold, the four sheets (options, sort,
 * card menu, confirmations) and their focus handling.
 */
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const optionsAnchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
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

  // Only the tints this deck actually wears: a filter for a colour no card has
  // would be a control that can only empty the list.
  const presentColors = new Set(deckCards.map((card) => card.color).filter(Boolean));
  const deckColors = CARD_COLOR_CHOICES.filter((choice) => presentColors.has(choice.value));

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
    // Colour narrows the state filter rather than replacing it: both must hold.
    const matchesColor = colorFilter === null || card.color === colorFilter;
    return matchesQuery && matchesFilter && matchesColor;
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
  }, [sortMode, filterMode, colorFilter, query]);

  // Escape drops the colour filter: once a list is narrowed to one tint, the
  // way out should not be another trip to the chip. Text fields keep their own
  // Escape, and nothing happens when no colour is filtered.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || colorFilter === null) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setColorFilter(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [colorFilter]);

  const backHome = () => goBackOr(router, '/(tabs)/home');

  // The store hydrates asynchronously: until it has, "Deck not found" would be a
  // lie for a deck that is about to load. Show the page's shape instead.
  if (!deck && !loaded) {
    return (
      <Screen header={<PageHeader title="Deck" back onBack={backHome} />}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
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
      <Screen header={<PageHeader title="Deck" back onBack={backHome} />}>
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
  const filtered = query.trim().length > 0 || filterMode !== 'all' || colorFilter !== null;
  const shown = showAll ? visibleCards : visibleCards.slice(0, CARD_LIMIT);
  const sortLabel = SORT_LABELS[sortMode];
  const archived = Boolean(deck.archivedAt);
  const countLabel = `${formatCount(deckCards.length)} ${
    deckCards.length === 1 ? 'card' : 'cards'
  }`;

  const clearFilters = () => {
    setQuery('');
    setFilterMode('all');
    setColorFilter(null);
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
    goBackOr(router, '/(tabs)/library');
  };

  // The archived page cannot start a session, but it can put the deck back in
  // service. Keep that promise in one action: clear `archivedAt`, then open the
  // queue the learner was trying to reach.
  const handleRestoreForStudy = async () => {
    await updateDeck(deck.id, { archivedAt: null });
    pushOnce(router, `/study/${deck.id}`);
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

  // Every menu action is declarative, so the same list can drive the anchored
  // menu, the compact sheet and the right-click context menu without three
  // drifting copies of the deck's options.
  const folderActions: MenuAction[] = [
    {
      key: 'no-folder',
      label: 'No folder',
      icon: 'folder-open',
      selected: deck.folderId == null,
      onPress: () => void setDeckFolder(deck.id, null),
    },
    ...folders.map((folder) => ({
      key: folder.id,
      label: folderPath(folders, folder.id)
        .map((entry) => entry.name)
        .join(' / '),
      icon: 'folder' as const,
      selected: deck.folderId === folder.id,
      onPress: () => void setDeckFolder(deck.id, folder.id),
    })),
  ];

  const deckActions: MenuAction[] = [
    { key: 'rename', label: 'Rename Deck', icon: 'edit', onPress: openRename },
    {
      key: 'folder',
      label: 'Move to folder',
      icon: 'folder-shared',
      submenuTitle: 'Move to folder',
      submenu: folderActions,
    },
    {
      key: 'duplicate',
      label: 'Duplicate Deck',
      icon: 'content-copy',
      onPress: handleDuplicate,
    },
    {
      key: 'archive',
      label: deck.archivedAt ? 'Unarchive Deck' : 'Archive Deck',
      icon: 'archive',
      onPress: handleArchive,
    },
    { key: 'export', label: 'Export Deck', icon: 'upload', onPress: handleExport },
    { key: 'destructive-separator', kind: 'separator', label: '' },
    { key: 'reset', label: 'Reset Progress', icon: 'refresh', onPress: handleReset },
    {
      key: 'delete',
      label: 'Delete Deck',
      icon: 'delete-outline',
      destructive: true,
      onPress: handleDelete,
    },
  ];

  const sortOptions = SORT_OPTIONS.map((option) => ({
    value: option.mode,
    label: option.title,
    accessibilityLabel: `Sort by ${option.title}`,
  }));

  const cardActions = (card: Flashcard): MenuAction[] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: 'edit',
      onPress: () =>
        pushOnce(router, {
          pathname: '/deck/[id]/add-card',
          params: { id: deck.id, editCardId: card.id },
        }),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'delete-outline',
      destructive: true,
      onPress: () =>
        setConfirmAction({ kind: 'delete-card', cardId: card.id, front: card.front.text }),
    },
  ];

  const ledger = [
    { key: 'new', label: 'New', value: newDue, color: stateColors.New },
    { key: 'learning', label: 'Learning', value: learningDue, color: stateColors.Learning },
    { key: 'review', label: 'Review', value: reviewDue, color: stateColors.Review },
  ];

  const hero = (
    <Surface tone="scene" testID="deck-hero" style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 40,
              height: 40,
              borderRadius: v3.radii.tile,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(deck.color, 0.15),
              flexShrink: 0,
            }}
          >
            <MaterialIcons name={deck.icon as IconName} size={iconSize.lg} color={deck.color} />
          </View>
          <View style={{ minWidth: 0 }}>
            <AppText
              variant="label"
              weight="semibold"
              tone="accent"
              className="uppercase"
              numberOfLines={1}
              style={{ letterSpacing: 0.6 }}
            >
              Today’s queue
            </AppText>
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              {countLabel}
            </AppText>
          </View>
        </View>

        <StatusChip
          label={archived ? 'Archived' : totalDue > 0 ? 'Due today' : 'Caught up'}
          tone={archived ? 'muted' : totalDue > 0 ? 'accent' : 'success'}
        />
      </View>

      {!archived && (
        <>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <AppText
                variant="display"
                style={[wide ? v3.type.heroWide : v3.type.hero, NUMERIC]}
                accessibilityLabel={`${totalDue} cards due in this deck`}
              >
                {totalDue}
              </AppText>
              <AppText variant="headline" weight="semibold" tone="tertiary" numberOfLines={1}>
                cards due
              </AppText>
            </View>
            <AppText variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
              {totalDue > 0 ? 'in this deck today' : 'Nothing due — you are all caught up'}
            </AppText>
          </View>

          {/* The queue's composition, in the same inset ledger the settings hero
              uses: three cells, one rule between neighbours, tabular figures. */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surfaceInset,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: alpha(colors.outlineSoft, 0.2),
              paddingVertical: 12,
              paddingHorizontal: 12,
            }}
          >
            {ledger.map((cell, index) => (
              <View
                key={cell.key}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingStart: index === 0 ? 0 : 10,
                  borderStartWidth: index === 0 ? 0 : 1,
                  borderStartColor: colors.outlineVariant,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View
                    aria-hidden
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cell.color }}
                  />
                  <AppText variant="caption" tone="tertiary">
                    {cell.label}
                  </AppText>
                </View>
                <AppText
                  variant="title"
                  weight="semibold"
                  numberOfLines={1}
                  style={[NUMERIC, { marginTop: 2 }]}
                >
                  {cell.value}
                </AppText>
              </View>
            ))}
          </View>
        </>
      )}

      <ActionButton
        label={
          archived
            ? 'Archived — restore to study'
            : totalDue > 0
              ? 'Start session'
              : 'Nothing due today'
        }
        icon={archived ? 'unarchive' : 'arrow-forward'}
        onPress={
          archived
            ? () => void handleRestoreForStudy()
            : () => pushOnce(router, `/study/${deck.id}`)
        }
        disabled={!archived && totalDue === 0}
      />
    </Surface>
  );

  const cardsSection = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 4,
          paddingBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <AppText
            variant="label"
            weight="semibold"
            tone="tertiary"
            headingLevel={2}
            className="uppercase"
            numberOfLines={1}
            style={{ letterSpacing: 0.6 }}
          >
            Cards
          </AppText>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <AppText variant="caption" weight="medium" tone="muted" numberOfLines={1}>
              {filtered
                ? `${formatCount(visibleCards.length)} of ${formatCount(deckCards.length)}`
                : countLabel}
            </AppText>
          </View>
        </View>

        <AppText variant="caption" tone="tertiary" numberOfLines={1} style={NUMERIC}>
          {archived ? 'Archived' : totalDue > 0 ? `${formatCount(totalDue)} due` : 'All caught up'}
        </AppText>
      </View>

      <View
        style={{
          backgroundColor: colors.surfacePane,
          borderRadius: v3.radii.card,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* The app's one search field: its height, radius and clear
                affordance stay the same as every other search in the app. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search cards"
                accessibilityLabel="Search cards"
              />
            </View>

            <Select
              label="Sort"
              value={sortMode}
              valueLabel={sortLabel}
              options={sortOptions}
              onChange={(value) => setSortMode(value as SortMode)}
              icon="sort"
              sheetTitle="Sort cards"
              sheetSubtitle="Choose how the card list is ordered."
              width={260}
            />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FILTERS.map((entry) => (
              <FilterPill
                key={entry.key}
                label={entry.label}
                active={filterMode === entry.key}
                accessibilityLabel={`Filter cards: ${entry.label}`}
                onPress={() => setFilterMode(entry.key)}
              />
            ))}
          </View>

          {/* The tints this deck uses, each with its own swatch. Pressing the
              active one clears it, so a colour filter never needs a second
              control to undo. */}
          {deckColors.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {deckColors.map((choice) => (
                <FilterPill
                  key={choice.value}
                  label={choice.label}
                  dot={choice.value}
                  active={colorFilter === choice.value}
                  accessibilityLabel={`Filter cards: ${choice.label}`}
                  onPress={() =>
                    setColorFilter(colorFilter === choice.value ? null : choice.value)
                  }
                />
              ))}

              {/* A named way out while a colour is on, next to the shortcut a
                  desktop user can press without leaving the list. */}
              {colorFilter !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <IconButton
                    icon="close"
                    size="sm"
                    accessibilityLabel="Clear colour filter"
                    onPress={() => setColorFilter(null)}
                  />
                  {Platform.OS === 'web' && (
                    <AppText variant="caption" tone="tertiary">
                      Esc
                    </AppText>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 1, backgroundColor: colors.outlineVariant }}
        />

        {visibleCards.length === 0 ? (
          <View style={{ paddingHorizontal: 24, paddingVertical: 28 }}>
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
          </View>
        ) : (
          shown.map((card, index) => {
            const expanded = expandedId === card.id;
            return (
              <ContextMenu
                key={card.id}
                label={`Actions for ${card.front.text}`}
                actions={cardActions(card)}
              >
                <View
                  // A deck can hold thousands of rows; this class lets the
                  // browser skip layout and paint for the ones off screen.
                  className="defer-render"
                  style={{ position: 'relative' }}
                >
                {/* A tinted card reads in its own colour in the ledger too, so
                    a deck can be scanned without opening a card. */}
                {card.color ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: alpha(card.color, 0.1),
                    }}
                  />
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64 }}>
                  <HintPressable
                    hint={expanded ? 'Hide the full card' : 'Show the full card'}
                    testID="deck-card-row"
                    onPress={() => setExpandedId(expanded ? null : card.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    aria-expanded={expanded}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 64,
                      paddingStart: 16,
                      paddingEnd: 4,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      aria-hidden
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: stateColors[card.fsrs.state],
                        flexShrink: 0,
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
                        variant="bodySm"
                        tone="muted"
                        align="left"
                        style={{ marginTop: 2, writingDirection: card.back.direction }}
                        numberOfLines={expanded ? undefined : 1}
                      >
                        {card.back.text}
                      </AppText>
                    </View>
                    <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                      {card.fsrs.state}
                    </AppText>
                    <View
                      aria-hidden
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={iconSize.md}
                        color={colors.outline}
                      />
                    </View>
                  </HintPressable>

                  <View style={{ marginEnd: 4 }}>
                    <ActionMenu
                      label={`More options for ${card.front.text}`}
                      icon="more-vert"
                      sheetTitle={card.front.text}
                      sheetSubtitle={card.back.text}
                      actions={cardActions(card)}
                    />
                  </View>
                </View>

                {index < shown.length - 1 && (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      height: 1,
                      backgroundColor: colors.outlineVariant,
                      marginStart: 34,
                    }}
                  />
                )}
                </View>
              </ContextMenu>
            );
          })
        )}

        {visibleCards.length > CARD_LIMIT && (
          <Pressable
            onPress={() => setShowAll((value) => !value)}
            accessibilityRole="button"
            style={{
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: 16,
              borderTopWidth: 1,
              borderTopColor: colors.outlineVariant,
            }}
          >
            <AppText variant="bodySm" weight="semibold" tone="accent">
              {showAll ? 'Show fewer' : `Show all ${formatCount(visibleCards.length)} cards`}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title={deck.name}
          back
          onBack={backHome}
          actions={
            <>
              <HeaderIcon
                icon="add"
                label="Add cards"
                onPress={() => pushOnce(router, `/deck/${deck.id}/add-card`)}
              />
              <View ref={optionsAnchorRef} collapsable={false}>
                <HeaderIcon
                  icon="more-horiz"
                  label="More options"
                  ariaExpanded={optionsVisible}
                  ariaHasPopup="menu"
                  onPress={() => setOptionsVisible(true)}
                />
              </View>
            </>
          }
        />
      }
    >
      <View style={{ paddingBottom: 48, gap: 28 }}>
        <RevealItem index={0}>{hero}</RevealItem>
        <RevealItem index={1}>{cardsSection}</RevealItem>
      </View>

      {/* Deck options — anchored on a wide canvas, a compact sheet on a phone. */}
      <Menu
        open={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        anchorRef={optionsAnchorRef}
        label="Deck options"
        title={deck.name}
        subtitle={countLabel}
        actions={deckActions}
        width={300}
      />



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
