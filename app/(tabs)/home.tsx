import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { buildExplorePicks } from '../../data/explore';
import { schedulerLabel } from '../../data/schedulers';
import { computeStreak } from '../../data/streak';
import {
  childFolders,
  folderDescendantIds,
  folderPath,
  folderSubtreeCounts,
  sortPinned,
} from '../../data/folders';
import { FOLDER_DEFAULT_ICON } from '../../data/appearance';
import type { Deck } from '../../data/types';
import {
  AppearancePicker,
  AppText,
  BottomSheetModal,
  COLOR_CHOICES,
  DeckShelfSkeleton,
  EmptyState,
  Field,
  GhostButton,
  HeroSkeleton,
  IconButton,
  ListRow,
  PrimaryButton,
  RevealItem,
  Screen,
  SheetScrollView,
  ActionMenu,
} from '../../components';
import type { MenuAction } from '../../components';
import { MaterialIcons } from '../../components/Icon';
import {
  ArchivedRow,
  DeckShelfRow,
  FolderGroup,
  HeaderIcon,
  PageHeader,
  SectionHeading,
  ShelfHeader,
  ShelfPanel,
  ShelfReorder,
  Surface,
  TodayPane,
  HeroAura,
  LibraryPane,
  FolderCard,
  FolderGlyph,
  NewFolderButton,
  ExploreEntry,
  ExploreSheet,
} from '../../components/v3';
import type { ShelfReorderGroup } from '../../components/v3';
import type { FieldInputRef } from '../../components/Field';
import { colors, fills, heights, iconSize, radii, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];


type DeckQueue = {
  deck: Deck;
  cardCount: number;
  total: number;
  /** Studied share, 0–1. */
  progress: number;
  /** Cards that already carry at least one review. */
  studiedCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
};

type FolderSummary = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  pinnedAt?: number | null;
  /** Decks anywhere in this folder's subtree. */
  decks: number;
  /** Decks filed directly here, so the header can name the split. */
  directDecks: number;
  due: number;
  nestedFolders: number;
};

/** The three bodies the Folders sheet can show. */
type FolderSheetMode = 'list' | 'edit' | 'location';

/**
 * Home — design v2, "Today first".
 *
 * The page answers "what do I study now?" before "what do I own?": the day
 * label ("Today") is the h1 and the due number is the canvas's one display-sized
 * element, one primary action opens the session, and the day's new/learning/
 * review split sits underneath. The library is one rule and
 * a list of rows, browsed level by level: the top level holds root folders and
 * unfiled decks, and every folder opens into its own subfolders and decks.
 *
 * Every number is real: `buildStudyQueue` is the same helper the study session
 * uses, so the due count on the button is the number of cards the session will
 * actually show, daily caps included. Pinning and moving are stored on the
 * folder/deck itself, so they survive a reload without a separate index.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // A desktop canvas gets its own composition: the today grid with a library
  // rail, then a two-up shelf. Below 1024 the page keeps the single phone
  // column, so every existing mobile behaviour and measurement is untouched.
  const desktop = width >= 1024;
  const contentMaxWidth = desktop
    ? v3.layout.homeDesktopMaxWidth
    : v3.layout.contentMaxWidth;
  // The folder sheet has more vertical room on a desktop dialog, but still
  // needs a cap so the title and scrim stay visible on a short laptop screen.
  const folderSheetBodyMaxHeight = desktop
    ? Math.max(320, Math.min(620, height - 240))
    : heights.sheetTall;

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const folders = useDeckStore((s) => s.folders);
  const addFolder = useDeckStore((s) => s.addFolder);
  const updateFolder = useDeckStore((s) => s.updateFolder);
  const deleteFolder = useDeckStore((s) => s.deleteFolder);
  const toggleFolderPinned = useDeckStore((s) => s.toggleFolderPinned);
  const moveFolder = useDeckStore((s) => s.moveFolder);
  const moveFolderTo = useDeckStore((s) => s.moveFolderTo);
  const toggleDeckPinned = useDeckStore((s) => s.toggleDeckPinned);
  const moveDeck = useDeckStore((s) => s.moveDeck);
  const moveDeckTo = useDeckStore((s) => s.moveDeckTo);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLoaded) useReviewStore.getState().load();
  }, [loaded, reviewLoaded]);

  const ready = loaded && reviewLoaded;

  // Folders are a browsing layer: creating one is local, deleting one only
  // moves its decks and subfolders up, so neither can touch a card or a review.
  const [folderSheet, setFolderSheet] = useState(false);
  // Explore is a reading lens over the shelf. It never writes, moves or
  // reschedules anything; the sheet only routes to a deck the learner owns.
  const [exploreOpen, setExploreOpen] = useState(false);
  const [folderSheetMode, setFolderSheetMode] = useState<FolderSheetMode>('list');
  const [folderDraft, setFolderDraft] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  // Folder appearance and placement are user data like a deck's colour: the
  // folder wears the icon and tint it was given and sits wherever it was moved.
  const [folderIcon, setFolderIcon] = useState<string>(FOLDER_DEFAULT_ICON);
  const [folderColor, setFolderColor] = useState<string>(COLOR_CHOICES[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState<string>(FOLDER_DEFAULT_ICON);
  const [editColor, setEditColor] = useState<string>(COLOR_CHOICES[0]);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // v3 groups: a folder's decks sit under its header until it is collapsed.
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  // Edit layout replaces the shelf board with a fixed-row drag list; it never
  // changes the underlying folder navigation or opens a deck by accident.
  const [editingLayout, setEditingLayout] = useState(false);
  const homeScrollRef = useRef<ScrollViewInstance>(null);
  // The drag list needs the live scroll offset so holding at an edge can move
  // the page and the row together. Screen owns the only ScrollView.
  const homeScrollY = useRef(0);
  // The sheet's plus returns the user to the name field rather than opening a
  // second sheet; the draft is controlled, so focus is the only missing part.
  const folderDraftRef = useRef<FieldInputRef>(null);

  const activeDeckIds = useMemo(
    () => new Set(decks.filter((deck) => !deck.archivedAt).map((deck) => deck.id)),
    [decks]
  );

  const streak = useMemo(
    () =>
      computeStreak(
        reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)).map((e) => e.reviewedAt)
      ),
    [reviewLog, activeDeckIds]
  );

  // One queue per active deck, using the same helper as the study session so
  // the numbers agree with what the session will actually show. The new /
  // learning / review split is the queue's own composition, not an estimate.
  const deckQueues = useMemo<DeckQueue[]>(
    () =>
      decks
        .filter((deck) => !deck.archivedAt)
        .map((deck) => {
          const cards = cardsByDeck[deck.id] ?? [];
          const queue = buildStudyQueue(deck, cards, reviewLog);
          const learningCount = queue.dueCards.filter(
            (card) => card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning'
          ).length;
          const studied = cards.reduce(
            (count, card) => count + (card.fsrs.last_review != null ? 1 : 0),
            0
          );
          return {
            deck,
            cardCount: cards.length,
            total: queue.total,
            progress: cards.length > 0 ? studied / cards.length : 0,
            studiedCount: studied,
            newCount: queue.newCards.length,
            learningCount,
            reviewCount: queue.dueCards.length - learningCount,
          };
        }),
    [decks, cardsByDeck, reviewLog]
  );

  const totalDue = useMemo(
    () => deckQueues.reduce((sum, entry) => sum + entry.total, 0),
    [deckQueues]
  );
  const dueDecks = deckQueues.filter((entry) => entry.total > 0).length;
  const minutes = Math.max(1, Math.round(totalDue / 4));

  // The desktop rail summarizes the same queues the shelf renders, so the
  // library it describes and the rows below it can never disagree.
  const libraryCards = deckQueues.reduce((sum, entry) => sum + entry.cardCount, 0);
  const libraryStudied = deckQueues.reduce((sum, entry) => sum + entry.studiedCount, 0);
  const libraryProgress = libraryCards > 0 ? libraryStudied / libraryCards : 0;
  const caughtUpDecks = deckQueues.filter(
    (entry) => entry.cardCount > 0 && entry.total === 0
  ).length;

  // The desktop board needs an exact cell width, not a percentage: the last
  // row keeps the same three-column rhythm instead of stretching its remaining
  // tiles to half the page. `spacing.screen` is the Screen gutter on each side.
  const gridColumns = width >= 1200 ? 3 : 2;
  const gridGap = 12;
  const gridWidth = Math.min(width, contentMaxWidth) - spacing.screen * 2;
  const deckCellWidth = desktop
    ? Math.max(0, (gridWidth - gridGap * (gridColumns - 1)) / gridColumns)
    : undefined;
  // The shelf's partition adds its own inset and 1px rim around the board.
  const shelfInset = desktop ? v3.spacing.panel : v3.spacing.group;
  const shelfGridWidth = Math.max(0, gridWidth - shelfInset * 2 - 2);
  const shelfCellWidth = desktop
    ? Math.max(0, (shelfGridWidth - gridGap * (gridColumns - 1)) / gridColumns)
    : undefined;

  const lastStudiedDeckId = useMemo(() => {
    let latest: { deckId: string; reviewedAt: number } | null = null;
    for (const entry of reviewLog) {
      if (!activeDeckIds.has(entry.deckId)) continue;
      if (!latest || entry.reviewedAt > latest.reviewedAt) latest = entry;
    }
    return latest?.deckId ?? null;
  }, [reviewLog, activeDeckIds]);

  const lastStudiedEntry = deckQueues.find((entry) => entry.deck.id === lastStudiedDeckId);
  // Prefer the deck the learner left off in, but never point the hero at a
  // caught-up deck while another one still has cards waiting.
  const continueEntry =
    (lastStudiedEntry && lastStudiedEntry.total > 0 ? lastStudiedEntry : undefined) ??
    deckQueues.find((entry) => entry.total > 0) ??
    lastStudiedEntry ??
    deckQueues[0];
  const resuming = Boolean(lastStudiedEntry && continueEntry?.deck.id === lastStudiedEntry.deck.id);

  // Explore reads the same capped queues as the shelf, so its reasons can
  // never disagree with the due figures beside them. The engine is memoized:
  // Home does not rebuild the full intelligence report for one row.
  const decksById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);
  const explorePicks = useMemo(() => {
    if (!ready) return [];
    return buildExplorePicks({
      decks,
      cardsByDeck,
      statsByDeck: deckQueues.map((entry) => ({
        deckId: entry.deck.id,
        due: entry.total,
        newCount: entry.newCount,
        learningCount: entry.learningCount,
        reviewCount: entry.reviewCount,
      })),
      reviewLog,
      folders,
      scopeFolderId: openFolderId,
      excludeDeckIds: continueEntry ? [continueEntry.deck.id] : [],
      now: Date.now(),
    });
  }, [
    ready,
    decks,
    cardsByDeck,
    deckQueues,
    reviewLog,
    folders,
    openFolderId,
    continueEntry,
  ]);

  // A folder deleted from the sheet falls back to its parent instead of hiding
  // the level it was on.
  const openFolder = useMemo(
    () => (openFolderId ? folders.find((folder) => folder.id === openFolderId) ?? null : null),
    [openFolderId, folders]
  );
  const folderTrail = useMemo(
    () => (openFolder ? folderPath(folders, openFolder.id) : []),
    [folders, openFolder]
  );
  const parentFolder = folderTrail.length > 1 ? folderTrail[folderTrail.length - 2] : null;

  // The shelf shows one level: the folders inside the open folder (or the root
  // folders) and the decks that live exactly here. A deck filed away is reached
  // through its folder, not repeated at every level above it.
  const levelFolders = useMemo(
    () => sortPinned(childFolders(folders, openFolder?.id ?? null)),
    [folders, openFolder]
  );

  // Folder rows carry the whole subtree's truth: a parent whose decks live in
  // a child is not empty, and its due figure is the sum of what the learner
  // will actually be shown. Direct children stay separate for the row split.
  const dueByDeck = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of deckQueues) map[entry.deck.id] = entry.total;
    return map;
  }, [deckQueues]);
  const subtreeById = useMemo(
    () => folderSubtreeCounts(folders, decks, dueByDeck),
    [folders, decks, dueByDeck]
  );
  const summaryById = useMemo(() => {
    const map = new Map<string, FolderSummary>();
    for (const folder of folders) {
      const directEntries = deckQueues.filter((entry) => entry.deck.folderId === folder.id);
      const subtree = subtreeById.get(folder.id);
      map.set(folder.id, {
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        pinnedAt: folder.pinnedAt,
        decks: subtree?.decks ?? 0,
        directDecks: directEntries.length,
        due: subtree?.due ?? 0,
        nestedFolders: subtree?.nestedFolders ?? 0,
      });
    }
    return map;
  }, [folders, deckQueues, subtreeById]);

  const visibleFolders = useMemo(
    () =>
      levelFolders
        .map((folder) => summaryById.get(folder.id))
        .filter((folder): folder is FolderSummary => Boolean(folder)),
    [levelFolders, summaryById]
  );

  // Stored order, pinned first: moving a deck up or down is a promise the shelf
  // keeps. (It used to be sorted by due count, which silently undid every
  // manual move.) Pinning is the one rank above the manual order.
  const visibleDecks = useMemo(() => {
    const unfiled = (deck: Deck) =>
      !deck.folderId || !folders.some((folder) => folder.id === deck.folderId);
    const list = openFolder
      ? deckQueues.filter((entry) => entry.deck.folderId === openFolder.id)
      : deckQueues.filter((entry) => unfiled(entry.deck));
    return [
      ...list.filter((entry) => entry.deck.pinnedAt != null),
      ...list.filter((entry) => entry.deck.pinnedAt == null),
    ];
  }, [deckQueues, openFolder, folders]);

  // The shelf's quiet totals describe the whole level, not only the decks
  // printed directly under it. At the root that is every active deck, so its
  // due total is exactly the hero's; inside a folder it is that subtree.
  const shelfEntries = useMemo(() => {
    if (!openFolder) return deckQueues;
    const scope = new Set([
      openFolder.id,
      ...folderDescendantIds(folders, openFolder.id),
    ]);
    return deckQueues.filter(
      (entry) => entry.deck.folderId && scope.has(entry.deck.folderId)
    );
  }, [deckQueues, openFolder, folders]);
  const shelfCards = useMemo(
    () => shelfEntries.reduce((sum, entry) => sum + entry.cardCount, 0),
    [shelfEntries]
  );
  const shelfDue = useMemo(
    () => shelfEntries.reduce((sum, entry) => sum + entry.total, 0),
    [shelfEntries]
  );

  const editingFolder = editingFolderId
    ? folders.find((folder) => folder.id === editingFolderId) ?? null
    : null;

  // A folder may move anywhere except into itself or one of its own children.
  const eligibleParents = useMemo(() => {
    if (!editingFolder) return [];
    const descendants = folderDescendantIds(folders, editingFolder.id);
    return folders.filter(
      (folder) => folder.id !== editingFolder.id && !descendants.has(folder.id)
    );
  }, [folders, editingFolder]);

  const closeFolders = () => {
    setFolderSheet(false);
    setFolderSheetMode('list');
    setEditingFolderId(null);
    setFolderError(null);
    setEditError(null);
  };

  const openFolderEditor = (id: string) => {
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) return;
    // Opens from the shelf's options button as well as from the sheet's list;
    // the shelf path is the one that has to raise the sheet itself.
    setFolderSheet(true);
    setEditingFolderId(id);
    setEditName(folder.name);
    setEditIcon(folder.icon ?? FOLDER_DEFAULT_ICON);
    setEditColor(folder.color ?? COLOR_CHOICES[0]);
    setEditParentId(folder.parentId ?? null);
    setEditError(null);
    setFolderSheetMode('edit');
  };

  const saveFolderEditor = async () => {
    if (!editingFolder) return;
    const result = await updateFolder(editingFolder.id, {
      name: editName,
      icon: editIcon,
      color: editColor,
      parentId: editParentId,
    });
    if (!result.ok) {
      setEditError(
        result.error === 'duplicate'
          ? 'A folder with that name already exists.'
          : result.error === 'cycle'
            ? 'A folder cannot move inside itself.'
            : 'Give the folder a name.'
      );
      return;
    }
    setFolderSheetMode('list');
  };

  const header = (
    <PageHeader
      brand
      maxWidth={contentMaxWidth}
      meta={
        width >= 360 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              minHeight: 30,
              justifyContent: 'center',
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.surfaceInset,
            }}
            accessible
            accessibilityLabel={`${streak}-day streak`}
          >
            <MaterialIcons
              name="local-fire-department"
              size={16}
              color={streak > 0 ? colors.warning : colors.outline}
            />
            <AppText variant="caption" weight="semibold" tone={streak > 0 ? 'warning' : 'muted'}>
              {streak}d
            </AppText>
          </View>
        ) : undefined
      }
      actions={
        <>
          <HeaderIcon
            icon="explore"
            label="Discover"
            raised
            onPress={() => pushOnce(router, '/discover')}
          />
          <HeaderIcon
            icon="add"
            label="Add deck"
            emphasized
            onPress={() => pushOnce(router, '/add-deck')}
          />
        </>
      }
    />
  );

  const toggleFolder = (id: string) =>
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A group holds the decks filed directly in its folder; anything deeper stays
  // one tap away through `onOpen`, which keeps the existing drill-in view.
  const decksInFolder = (folderId: string) =>
    deckQueues.filter((entry) => entry.deck.folderId === folderId);

  // A folder's own children are listed inside it, so the group shows the tree
  // it opens onto instead of an "N folders inside" count.
  const subfoldersIn = (folderId: string) =>
    sortPinned(childFolders(folders, folderId))
      .map((folder) => summaryById.get(folder.id))
      .filter((folder): folder is FolderSummary => Boolean(folder))
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        decks: folder.decks,
        due: folder.due,
      }));

  const archivedDecks = useMemo(
    () =>
      decks
        .filter((deck) => deck.archivedAt)
        .map((deck) => ({ deck, cards: (cardsByDeck[deck.id] ?? []).length })),
    [decks, cardsByDeck]
  );

  const caughtUpFolders = visibleFolders.filter(
    (folder) => folder.decks > 0 && folder.due === 0
  ).length;

  const folderCountLabel = `${visibleFolders.length} ${
    visibleFolders.length === 1 ? 'folder' : 'folders'
  }`;
  const cardCountLabel = `${shelfCards.toLocaleString('en-US')} ${
    shelfCards === 1 ? 'card' : 'cards'
  }`;
  const dueLabel = shelfDue > 0 ? `${shelfDue} due` : 'all caught up';
  // The count chip already carries the deck count, so the meta line spends its
  // room on what the chip cannot say: cards and what is due.
  const shelfMeta = openFolder
    ? `${folderCountLabel} · ${cardCountLabel} · ${dueLabel}`
    : `${cardCountLabel} · ${dueLabel}`;

  // Pin and move stay open after acting: they are repeatable shelf operations,
  // and the same menu is used for the row's overflow and right-click actions.
  const deckActions = (deck: Deck): MenuAction[] => [
    {
      key: 'pin',
      label: deck.pinnedAt ? 'Unpin deck' : 'Pin deck',
      description: deck.pinnedAt
        ? 'Return it to the normal order'
        : 'Keep it at the top of this folder',
      icon: 'push-pin',
      keepOpen: true,
      onPress: () => void toggleDeckPinned(deck.id),
    },
    {
      key: 'move-up',
      label: 'Move up',
      icon: 'arrow-upward',
      keepOpen: true,
      onPress: () => void moveDeck(deck.id, -1),
    },
    {
      key: 'move-down',
      label: 'Move down',
      icon: 'arrow-downward',
      keepOpen: true,
      onPress: () => void moveDeck(deck.id, 1),
    },
  ];

  const renderDeck = (entry: DeckQueue) => (
    <DeckShelfRow
      key={entry.deck.id}
      name={entry.deck.name}
      icon={entry.deck.icon as IconName}
      color={entry.deck.color}
      cardCount={entry.cardCount}
      schedulerLabel={schedulerLabel(entry.deck.algorithmPreset)}
      due={entry.total}
      progress={entry.progress}
      pinned={entry.deck.pinnedAt != null}
      optionsMenu={
        <ActionMenu
          label={`Options for deck ${entry.deck.name}`}
          sheetTitle={entry.deck.name}
          sheetSubtitle="Pinned decks stay above the others in their folder."
          actions={deckActions(entry.deck)}
        />
      }
      onPress={() => pushOnce(router, `/deck/${entry.deck.id}`)}
    />
  );

  // Three cards share a desktop row once there is room for them; the
  // two-column board carries 1024–1199, and a phone keeps the one-column shelf.
  const deckGridStyle: ViewStyle = desktop
    ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: gridGap, rowGap: gridGap }
    : { gap: 8 };
  const deckCellStyle: ViewStyle = desktop
    ? { width: deckCellWidth, minWidth: 0 }
    : { width: '100%' };
  const shelfCellStyle: ViewStyle = desktop
    ? { width: shelfCellWidth, minWidth: 0 }
    : { width: '100%' };

  // The reorder list uses the same level and pinned-first order as the shelf.
  // The store writes the result directly into the stored slots, so the board
  // comes back in the new order without a separate local arrangement state.
  const deckReorderItems = visibleDecks.map((entry) => ({
    id: entry.deck.id,
    name: entry.deck.name,
    icon: entry.deck.icon,
    color: entry.deck.color,
    kind: 'deck' as const,
    meta: `${entry.cardCount.toLocaleString('en-US')} ${
      entry.cardCount === 1 ? 'card' : 'cards'
    } · ${entry.total} due`,
    pinned: entry.deck.pinnedAt != null,
  }));

  const folderReorderItems = visibleFolders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    color: folder.color,
    kind: 'folder' as const,
    meta: `${folder.decks} ${folder.decks === 1 ? 'deck' : 'decks'} · ${folder.due} due`,
    pinned: folder.pinnedAt != null,
  }));

  const shelfReorderGroups: ShelfReorderGroup[] = [
    {
      key: 'decks',
      label: openFolder ? 'Decks here' : 'Decks',
      items: deckReorderItems,
      onReorder: (from: number, to: number) => {
        const entry = visibleDecks[from];
        if (entry) void moveDeckTo(entry.deck.id, to);
      },
    },
    {
      key: 'folders',
      label: openFolder ? 'Folders here' : 'Folders',
      items: folderReorderItems,
      onReorder: (from: number, to: number) => {
        const folder = visibleFolders[from];
        if (folder) void moveFolderTo(folder.id, to);
      },
    },
  ].filter((group) => group.items.length > 0);

  const renderDeckList = (entries: DeckQueue[]) => (
    <View style={deckGridStyle}>
      {entries.map((entry) => (
        <View key={entry.deck.id} style={deckCellStyle}>
          {renderDeck(entry)}
        </View>
      ))}
    </View>
  );

  // Folders and decks share one board but not one row: a 168px place beside an
  // 88px item leaves a hole under the shorter card. The decks keep their own
  // band and the folders open a second one, so the rhythm stays intentional.

  const decksSection = (
    <View>
      {openFolder && (
        <Pressable
          onPress={() => setOpenFolderId(parentFolder?.id ?? null)}
          accessibilityRole="button"
          accessibilityLabel={`Back to ${parentFolder?.name ?? 'All decks'}`}
          style={{
            minHeight: heights.hit,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 2,
          }}
        >
          <MaterialIcons name="arrow-back" size={iconSize.md} color={colors.primary} />
          <AppText variant="bodySm" weight="semibold" tone="accent">
            {parentFolder?.name ?? 'All decks'}
          </AppText>
        </Pressable>
      )}

      <ShelfPanel style={{ padding: shelfInset }}>
        <ShelfHeader
          title={openFolder ? openFolder.name : 'Your decks'}
          meta={shelfMeta}
          statusLabel={
            !openFolder && caughtUpFolders > 0 ? `${caughtUpFolders} caught up` : undefined
          }
          onNewFolder={() => {
            setFolderSheetMode('list');
            setFolderSheet(true);
          }}
          onToggleLayout={() => setEditingLayout((next) => !next)}
          editingLayout={editingLayout}
        />

        {!editingLayout && explorePicks.length > 0 ? (
          <ExploreEntry
            picks={explorePicks}
            decksById={decksById}
            onPress={() => setExploreOpen(true)}
          />
        ) : null}

        {/* The shelf is one quiet glass partition. Its rule separates the
            section's numbers from the things they count; the rows below it are
            the library itself. */}

      {editingLayout ? (
        <ShelfReorder
          groups={shelfReorderGroups}
          scrollRef={homeScrollRef}
          scrollOffsetRef={homeScrollY}
        />
      ) : (
        <View style={{ gap: desktop ? 0 : 20 }}>
        {desktop ? (
          visibleDecks.length > 0 || visibleFolders.length > 0 ? (
            <View style={{ gap: 20 }}>
              {visibleDecks.length > 0 && (
                <View style={deckGridStyle}>
                  {visibleDecks.map((entry) => (
                    <View key={entry.deck.id} style={shelfCellStyle}>
                      {renderDeck(entry)}
                    </View>
                  ))}
                </View>
              )}
              {visibleFolders.length > 0 && (
                <View style={deckGridStyle}>
                  {visibleFolders.map((folder) => (
                    <View key={folder.id} style={shelfCellStyle}>
                      <FolderCard
                        name={folder.name}
                        icon={folder.icon}
                        color={folder.color}
                        deckCount={folder.decks}
                        due={folder.due}
                        nestedFolders={folder.nestedFolders}
                        pinned={folder.pinnedAt != null}
                        onPress={() => setOpenFolderId(folder.id)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null
        ) : (
          <>
            {visibleDecks.length > 0 && (
              <View style={{ gap: 8 }}>
                <AppText variant="label" tone="tertiary" className="uppercase">
                  {openFolder ? 'Decks here' : 'Top level · Standalone'}
                </AppText>
                {renderDeckList(visibleDecks)}
              </View>
            )}

            {visibleFolders.map((folder) => {
              const entries = decksInFolder(folder.id);
              const subfolders = subfoldersIn(folder.id);
              return (
                <FolderGroup
                  key={folder.id}
                  name={folder.name}
                  icon={folder.icon}
                  color={folder.color}
                  deckCount={folder.decks}
                  directDecks={folder.directDecks}
                  due={folder.due}
                  pinned={folder.pinnedAt != null}
                  nestedFolders={folder.nestedFolders}
                  expanded={!collapsedFolders.has(folder.id)}
                  onToggle={() => toggleFolder(folder.id)}
                  subfolders={subfolders}
                  onOpenSubfolder={setOpenFolderId}
                >
                  {entries.length > 0 ? (
                    renderDeckList(entries)
                  ) : subfolders.length === 0 ? (
                    <AppText variant="caption" tone="muted">
                      No decks directly inside yet.
                    </AppText>
                  ) : null}
                </FolderGroup>
              );
            })}
          </>
        )}

        {visibleDecks.length === 0 && visibleFolders.length === 0 && (
          <AppText variant="body" tone="muted">
            {openFolder
              ? 'This folder is empty. Move a deck in from the deck’s options, or add a folder.'
              : 'No decks yet.'}
          </AppText>
        )}
        </View>
      )}
      </ShelfPanel>

      {!openFolder && archivedDecks.length > 0 && (
        <View style={{ marginTop: 28, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="inventory-2" size={iconSize.sm} color={colors.outline} />
              <AppText variant="label" tone="tertiary" className="uppercase">
                Archived
              </AppText>
            </View>
            <AppText variant="caption" tone="tertiary">
              {archivedDecks.length} {archivedDecks.length === 1 ? 'deck' : 'decks'}
            </AppText>
          </View>
          <View style={deckGridStyle}>
            {archivedDecks.map(({ deck, cards }) => (
              <View key={deck.id} style={deckCellStyle}>
                <ArchivedRow
                  name={deck.name}
                  cardCount={cards}
                  onPress={() => pushOnce(router, `/deck/${deck.id}`)}
                  optionsMenu={
                    <ActionMenu
                      label={`Options for deck ${deck.name}`}
                      sheetTitle={deck.name}
                      sheetSubtitle="Pinned decks stay above the others in their folder."
                      actions={deckActions(deck)}
                    />
                  }
                />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const folderSheetList =
    folders.length > 0 ? (
      <View className={desktop ? '' : 'mt-6'}>
        <SectionHeading
          label="Your folders"
          rule={false}
          action={
            <NewFolderButton
              label="Add a folder"
              onPress={() => folderDraftRef.current?.focus()}
            />
          }
        />
        <View className="mt-2">
          {folders.map((folder) => {
            const summary = summaryById.get(folder.id);
            const trail = folderPath(folders, folder.id)
              .map((entry) => entry.name)
              .join(' / ');
            const count = summary?.decks ?? 0;
            const meta = `${trail === folder.name ? '' : `${trail} · `}${count} ${
              count === 1 ? 'deck' : 'decks'
            }`;
            return (
              <View
                key={folder.id}
                style={{
                  minHeight: v3.heights.subfolderRow,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <FolderGlyph
                  icon={folder.icon ?? FOLDER_DEFAULT_ICON}
                  color={folder.color}
                  size={34}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                    {folder.name}
                  </AppText>
                  <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                    {meta}
                  </AppText>
                </View>
                <IconButton
                  icon="more-vert"
                  size="sm"
                  accessibilityLabel={`Options for folder ${folder.name}`}
                  onPress={() => openFolderEditor(folder.id)}
                />
              </View>
            );
          })}
        </View>
      </View>
    ) : desktop ? (
      <View>
        <SectionHeading
          label="Your folders"
          rule={false}
          action={
            <NewFolderButton
              label="Add a folder"
              onPress={() => folderDraftRef.current?.focus()}
            />
          }
        />
        <View
          style={{
            gap: 6,
            marginTop: 8,
            padding: 18,
            borderRadius: radii.pane,
            backgroundColor: colors.surfaceInset,
          }}
        >
          <AppText variant="bodySm" weight="semibold">
            No folders yet
          </AppText>
          <AppText variant="caption" tone="muted">
            Create your first folder to group decks into a browsable shelf.
          </AppText>
        </View>
      </View>
    ) : null;

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={contentMaxWidth}
      scrollRef={homeScrollRef}
      onScroll={(event) => {
        homeScrollY.current = event.nativeEvent.contentOffset.y;
      }}
      header={header}
    >
      {!ready ? (
        <>
          <RevealItem index={0}>
            <View style={{ marginTop: v3.spacing.page }}>
              <HeroSkeleton />
            </View>
          </RevealItem>
          <RevealItem index={1}>
            <View style={{ marginTop: v3.spacing.page }}>
              <DeckShelfSkeleton count={2} />
            </View>
          </RevealItem>
        </>
      ) : deckQueues.length === 0 ? (
        <RevealItem index={0}>
          <View
            style={
              desktop
                ? { width: '100%', maxWidth: 620, alignSelf: 'center' }
                : undefined
            }
          >
          <Surface tone="pane">
            <EmptyState
              icon="library-books"
              title="No decks yet"
              description="Create your first deck to start building a memory."
              className="py-6"
              action={
                <View className="w-52">
                  <PrimaryButton
                    label="Create a deck"
                    icon="add"
                    onPress={() => pushOnce(router, '/add-deck')}
                  />
                </View>
              }
            />
          </Surface>
          </View>
        </RevealItem>
      ) : continueEntry ? (
        <View>
          <RevealItem index={0}>
            <View
              style={
                desktop
                  ? {
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'stretch',
                      gap: v3.layout.homeGap,
                    }
                  : { marginTop: 12 }
              }
            >
              <View
                style={
                  desktop
                    ? { flex: 1, minWidth: 0, position: 'relative' }
                    : { width: '100%', position: 'relative' }
                }
              >
                {/* The frosted card needs a light field behind it; the aura is
                    decorative and never enters the accessibility tree. */}
                <HeroAura id="today-aura" />
                <View
                  style={
                    desktop
                      ? { flex: 1, position: 'relative', zIndex: 1 }
                      : { position: 'relative', zIndex: 1 }
                  }
                >
                  <TodayPane
                    due={totalDue}
                    deckCount={dueDecks}
                    minutes={minutes}
                    nextDeck={continueEntry.deck.name}
                    // The rail describes the deck the button opens, not the whole
                    // library: the due count above it is the library total, so
                    // library-wide segments here read as if one deck held them all.
                    newCount={continueEntry.newCount}
                    learningCount={continueEntry.learningCount}
                    reviewCount={continueEntry.reviewCount}
                    label={
                      totalDue === 0 ? 'Nothing due today' : resuming ? 'Continue' : 'Start session'
                    }
                    disabled={totalDue === 0}
                    onStart={() => pushOnce(router, `/study/${continueEntry.deck.id}`)}
                  />
                </View>
              </View>

              {desktop ? (
                <View style={{ width: v3.layout.homeRail, flexShrink: 0 }}>
                  <LibraryPane
                    decks={deckQueues.length}
                    cards={libraryCards}
                    folders={folders.length}
                    studied={libraryStudied}
                    progress={libraryProgress}
                    caughtUpDecks={caughtUpDecks}
                    archived={archivedDecks.length}
                  />
                </View>
              ) : null}
            </View>
          </RevealItem>

          <View style={{ marginTop: desktop ? 32 : 28 }}>
            <RevealItem index={1}>{decksSection}</RevealItem>
          </View>
        </View>
      ) : null}

      <BottomSheetModal
        visible={folderSheet}
        onClose={closeFolders}
        desktopLayout={desktop}
        focusKey={`${folderSheetMode}-${editingFolderId ?? 'list'}`}
        title={
          folderSheetMode === 'edit'
            ? 'Edit folder'
            : folderSheetMode === 'location'
              ? 'Move folder'
              : 'Folders'
        }
        subtitle={
          folderSheetMode === 'edit'
            ? 'Rename it, pick its icon and colour, or move it in the tree.'
            : folderSheetMode === 'location'
              ? 'Choose the folder that should hold this one.'
              : 'Group decks for browsing. Nothing is moved or copied.'
        }
      >
        <SheetScrollView
          // Switching bodies remounts the scroll region, so each mode opens at
          // its own first row instead of inheriting the previous offset.
          key={`${folderSheetMode}-${editingFolderId ?? 'list'}`}
          style={{ maxHeight: folderSheetBodyMaxHeight }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {folderSheetMode === 'list' && (
            <View
              style={
                desktop
                  ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' }
                  : undefined
              }
            >
              <View style={desktop ? { flex: 1.35, minWidth: 0 } : undefined}>
                <Field
                  label="New folder"
                  value={folderDraft}
                  onChangeText={(text) => {
                    setFolderDraft(text);
                    setFolderError(null);
                  }}
                  placeholder="e.g. German A2"
                  maxLength={40}
                  inputRef={folderDraftRef}
                />
                <AppText variant="caption" tone="muted" className="mt-1.5">
                  {openFolder
                    ? `Creates inside ${openFolder.name}.`
                    : 'Creates on the top level.'}
                </AppText>
                {folderError && (
                  <AppText variant="bodySm" tone="danger" className="mt-2">
                    {folderError}
                  </AppText>
                )}

                <View className="mt-4">
                  <AppearancePicker
                    icon={folderIcon}
                    color={folderColor}
                    onIconChange={setFolderIcon}
                    onColorChange={setFolderColor}
                  />
                </View>

                <View className="mt-4">
                  <PrimaryButton
                    label="Create folder"
                    icon="create-new-folder"
                    disabled={folderDraft.trim().length === 0}
                    onPress={async () => {
                      const result = await addFolder(folderDraft, {
                        icon: folderIcon,
                        color: folderColor,
                        parentId: openFolder?.id ?? null,
                      });
                      if (!result.ok) {
                        setFolderError(
                          result.error === 'duplicate'
                            ? 'A folder with that name already exists.'
                            : 'Give the folder a name.'
                        );
                        return;
                      }
                      setFolderDraft('');
                      setFolderError(null);
                      setFolderIcon(FOLDER_DEFAULT_ICON);
                      setFolderColor(COLOR_CHOICES[0]);
                    }}
                  />
                </View>
              </View>

              <View style={desktop ? { flex: 1, minWidth: 0 } : undefined}>
                {folderSheetList}
              </View>
            </View>
          )}

          {folderSheetMode === 'edit' && editingFolder && (
            <View
              style={
                desktop
                  ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' }
                  : undefined
              }
            >
              <View style={desktop ? { flex: 1.35, minWidth: 0 } : undefined}>
                <Field
                  label="Name"
                value={editName}
                onChangeText={(text) => {
                  setEditName(text);
                  setEditError(null);
                }}
                placeholder="Folder name"
                maxLength={40}
              />
              {editError && (
                <AppText variant="bodySm" tone="danger" className="mt-2">
                  {editError}
                </AppText>
              )}

                <View className="mt-4">
                  <AppearancePicker
                    icon={editIcon}
                    color={editColor}
                    onIconChange={setEditIcon}
                    onColorChange={setEditColor}
                  />
                </View>
              </View>

              <View style={desktop ? { flex: 1, minWidth: 0 } : undefined}>
                <View className="mt-5">
                <ListRow
                  title="Location"
                  subtitle="Where this folder sits in the library"
                  value={
                    editParentId
                      ? folderPath(folders, editParentId)
                          .map((entry) => entry.name)
                          .join(' / ')
                      : 'Top level'
                  }
                  icon="drive-file-move"
                  tile="sm"
                  density="compact"
                  gutter={0}
                  onPress={() => setFolderSheetMode('location')}
                />
                <ListRow
                  title={editingFolder.pinnedAt ? 'Unpin folder' : 'Pin folder'}
                  subtitle={
                    editingFolder.pinnedAt
                      ? 'Return it to the normal order'
                      : 'Keep it above the other folders here'
                  }
                  icon="push-pin"
                  iconTone={editingFolder.pinnedAt ? 'accent' : 'neutral'}
                  tile="sm"
                  density="compact"
                  gutter={0}
                  showChevron={false}
                  onPress={() => void toggleFolderPinned(editingFolder.id)}
                />
                <ListRow
                  title="Move up"
                  icon="arrow-upward"
                  tile="sm"
                  density="compact"
                  gutter={0}
                  showChevron={false}
                  onPress={() => void moveFolder(editingFolder.id, -1)}
                />
                <ListRow
                  title="Move down"
                  icon="arrow-downward"
                  tile="sm"
                  density="compact"
                  gutter={0}
                  showChevron={false}
                  onPress={() => void moveFolder(editingFolder.id, 1)}
                />
                <ListRow
                  title="Delete folder"
                  subtitle="Its folders and decks move up one level"
                  icon="delete-outline"
                  tile="sm"
                  density="compact"
                  gutter={0}
                  showChevron={false}
                  destructive
                  onPress={() => {
                    if (openFolderId === editingFolder.id) {
                      setOpenFolderId(editingFolder.parentId ?? null);
                    }
                    void deleteFolder(editingFolder.id);
                    closeFolders();
                  }}
                />
              </View>

                <View className="mt-5">
                  <PrimaryButton label="Save folder" icon="check" onPress={saveFolderEditor} />
                </View>
                <GhostButton
                  className="mt-2"
                  label="Back to folders"
                  variant="text"
                  onPress={() => setFolderSheetMode('list')}
                />
              </View>
            </View>
          )}

          {folderSheetMode === 'location' && editingFolder && (
            <View
              style={
                desktop ? { width: '100%', maxWidth: 560, alignSelf: 'center' } : undefined
              }
            >
              <ListRow
                title="Top level"
                subtitle="Shows next to Your decks"
                icon="home"
                tile="sm"
                density="compact"
                gutter={0}
                showChevron={false}
                highlighted={editParentId === null}
                onPress={() => {
                  setEditParentId(null);
                  setFolderSheetMode('edit');
                }}
              />
              {eligibleParents.map((parent) => (
                <ListRow
                  key={parent.id}
                  title={folderPath(folders, parent.id)
                    .map((entry) => entry.name)
                    .join(' / ')}
                  subtitle="Nest this folder inside it"
                  icon={(parent.icon ?? FOLDER_DEFAULT_ICON) as IconName}
                  iconTone={parent.color ? 'deck' : 'neutral'}
                  deckColor={parent.color}
                  tile="sm"
                  density="compact"
                  gutter={0}
                  showChevron={false}
                  highlighted={editParentId === parent.id}
                  onPress={() => {
                    setEditParentId(parent.id);
                    setFolderSheetMode('edit');
                  }}
                />
              ))}
              <GhostButton
                className="mt-3"
                label="Back to folders"
                variant="text"
                onPress={() => setFolderSheetMode('edit')}
              />
            </View>
          )}
        </SheetScrollView>
      </BottomSheetModal>

      <ExploreSheet
        visible={exploreOpen}
        onClose={() => setExploreOpen(false)}
        picks={explorePicks}
        decksById={decksById}
        scopeName={openFolder?.name ?? null}
        desktopLayout={desktop}
        onOpenDeck={(deckId) => {
          setExploreOpen(false);
          pushOnce(router, `/deck/${deckId}`);
        }}
      />
    </Screen>
  );
}
