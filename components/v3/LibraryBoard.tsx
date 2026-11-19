import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Platform, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { ListRenderItemInfo } from 'react-native';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { MaterialIcons } from '../Icon';
import { HintPressable } from '../HintPressable';
import { Surface } from './Surface';
import { ShelfBand } from './ShelfBand';
import { ShelfBreadcrumbs } from './ShelfBreadcrumbs';
import { ShelfHeader } from './ShelfHeader';
import { ShelfReorder } from './ShelfReorder';
import type { ShelfReorderGroup } from './ShelfReorder';
import { LibraryToolbar } from './LibraryToolbar';
import type { LibraryFilter } from './LibraryToolbar';
import { DeckShelfRow } from './DeckShelfRow';
import { FolderCard } from './FolderCard';
import { FolderBodySlice, FolderGroup } from './FolderGroup';
import { ArchivedRow } from './ArchivedRow';
import { colors, iconSize, motion, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { timingTo, useChangeReveal, usePresence } from '../../motion';
import type { FolderAggregate, LibraryIndex, DeckSummary } from '../../data/library';
import { foldSearch, matchesSearch } from '../../data/library';
import { schedulerLabel } from '../../data/schedulers';
import { sortPinned } from '../../data/folders';
import type { Deck, DeckFolder } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type FolderRow = FolderAggregate & {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  pinnedAt?: number | null;
};

type Row =
  | { key: string; kind: 'hero' }
  | { key: string; kind: 'breadcrumbs' }
  | { key: string; kind: 'header' }
  | { key: string; kind: 'toolbar' }
  | { key: string; kind: 'band'; label: string; count: number; hint?: string }
  | { key: string; kind: 'folderGroup'; id: string }
  | {
      key: string;
      kind: 'folderDeck';
      deckId: string;
      first: boolean;
      last: boolean;
      opening: boolean;
      closing: boolean;
      index: number;
    }
  | { key: string; kind: 'folderCards'; ids: string[] }
  | { key: string; kind: 'searchFolder'; id: string }
  | { key: string; kind: 'deckCards'; ids: string[]; paths: boolean }
  | { key: string; kind: 'emptyLevel' }
  | { key: string; kind: 'noResults' }
  | { key: string; kind: 'archive' }
  | { key: string; kind: 'reorder' };

export type LibraryBoardProps = {
  library: LibraryIndex;
  folders: DeckFolder[];
  /** The Today pane, built by Home; rendered above the shelf in the same list. */
  hero?: React.ReactNode;
  openFolder: DeckFolder | null;
  onOpenFolder: (id: string | null) => void;
  collapsedFolders: ReadonlySet<string>;
  /** Folders whose bodies are entering after a tap. */
  openingFolders: ReadonlySet<string>;
  /** Folders whose collapsed state is committed but whose rows are fading out. */
  closingFolders: ReadonlySet<string>;
  onToggleFolder: (id: string) => void;
  editingLayout: boolean;
  onManageFolders: () => void;
  onToggleLayout: () => void;
  onReorderFolder: (id: string, to: number) => void;
  onReorderDeck: (id: string, to: number) => void;
  onOpenDeck: (id: string) => void;
  /** The ActionMenu node for a deck; Home owns the menu actions. */
  deckOptions: (deck: Deck) => React.ReactNode;
  contentMaxWidth: number;
  tabClearance?: boolean;
};

const GRID_GAP = 12;
const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const pinnedFirst = <T extends { pinnedAt?: number | null }>(items: readonly T[]): T[] => {
  const pinned = items.filter((item) => item.pinnedAt != null);
  if (pinned.length === 0) return [...items];
  return [...pinned, ...items.filter((item) => item.pinnedAt == null)];
};

/** Deck summaries carry their pin on `deck`, not on the summary itself. */
const pinnedFirstEntries = (items: readonly DeckSummary[]): DeckSummary[] => {
  const pinned = items.filter((entry) => entry.deck.pinnedAt != null);
  if (pinned.length === 0) return [...items];
  return [...pinned, ...items.filter((entry) => entry.deck.pinnedAt == null)];
};

/**
 * LibraryBoard — the virtualized shelf.
 *
 * One list owns the whole page body: the Today pane, the breadcrumbs, the
 * masthead, the toolbar, the folder section, the unfiled decks and the archive.
 * Nothing is nested in a ScrollView and nothing is `.map()`-ed into a column of
 * every deck, so a 300-deck library mounts a window of rows instead of all of
 * them.
 *
 * The board also owns the reading of the shelf: search folds Persian/Arabic
 * letter variants, the All/Due filter only narrows what is printed, and both
 * run over the pre-built index (no queue is recomputed while typing). Folder
 * and deck rows are chunked by the responsive column count so the desktop board
 * keeps its three-column rhythm while the phone keeps one column.
 */
export function LibraryBoard({
  library,
  folders,
  hero,
  openFolder,
  onOpenFolder,
  collapsedFolders,
  openingFolders,
  closingFolders,
  onToggleFolder,
  editingLayout,
  onManageFolders,
  onToggleLayout,
  onReorderFolder,
  onReorderDeck,
  onOpenDeck,
  deckOptions,
  contentMaxWidth,
  tabClearance = true,
}: LibraryBoardProps) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const desktop = width >= 1024;
  // Matches ShelfHeader's breakpoint: below 640 the masthead drops its eyebrow
  // and the shelf drops its first band.
  const phone = width < 640;
  const columns = width >= 1200 ? 3 : desktop ? 2 : 1;
  const usableWidth = Math.max(
    0,
    Math.min(width, contentMaxWidth) - spacing.screen * 2
  );
  const cellWidth = columns > 1 ? Math.max(0, (usableWidth - GRID_GAP * (columns - 1)) / columns) : usableWidth;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archiveBody = usePresence(archiveOpen, { duration: motion.base });
  const archiveCollapse = useRef(new Animated.Value(0)).current;
  const [archiveContentHeight, setArchiveContentHeight] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const foldedQuery = foldSearch(deferredQuery);
  const searchActive = query.trim().length > 0 || filter === 'due';

  // An archive body must earn its space. The fade alone left the following
  // content jumping by the body's full height for a quarter second; measuring
  // the body and collapsing that height makes open and close one continuous
  // layout change instead of a paint followed by a snap.
  useEffect(() => {
    if (!archiveBody.mounted) {
      archiveCollapse.setValue(0);
      return;
    }
    if (archiveContentHeight <= 0) return;
    const duration = archiveOpen ? motion.base : motion.fast;
    void timingTo(archiveCollapse, archiveOpen ? archiveContentHeight : 0, {
      duration,
      nativeDriver: false,
    });
    return () => archiveCollapse.stopAnimation();
  }, [archiveBody.mounted, archiveCollapse, archiveContentHeight, archiveOpen]);

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const visibleFolders = useMemo<FolderRow[]>(() => {
    // Every folder is listed flat on Your decks, so a folder is never drawn
    // inside another one. An open folder only lists its own decks; every other
    // folder is a peer on the shelf, not a row inside it.
    if (openFolder) return [];
    const rows: FolderRow[] = [];
    for (const folder of sortPinned(folders)) {
      const aggregate = library.aggregates.get(folder.id);
      if (!aggregate) continue;
      rows.push({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        pinnedAt: folder.pinnedAt,
        ...aggregate,
      });
    }
    return rows;
  }, [library, folders, openFolder]);

  const visibleDecks = useMemo<DeckSummary[]>(() => {
    const scoped = openFolder
      ? library.byFolderId.get(openFolder.id) ?? []
      : library.unfiled;
    return pinnedFirstEntries(scoped);
  }, [library, openFolder]);

  const search = useMemo(() => {
    if (!searchActive) return { folderHits: [] as FolderRow[], deckHits: [] as DeckSummary[] };
    const folderHits: FolderRow[] = [];
    for (const folder of folders) {
      const aggregate = library.aggregates.get(folder.id);
      if (!aggregate) continue;
      if (!matchesSearch(folder.name, foldedQuery)) continue;
      if (filter === 'due' && aggregate.due === 0) continue;
      folderHits.push({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        pinnedAt: folder.pinnedAt,
        ...aggregate,
      });
    }
    const deckHits = library.entries.filter(
      (entry) =>
        matchesSearch(entry.deck.name, foldedQuery) && (filter === 'all' || entry.total > 0)
    );
    return { folderHits, deckHits };
  }, [searchActive, folders, library, foldedQuery, filter]);

  const trail = openFolder ? [openFolder] : [];

  // The masthead and the desktop FOLDERS band describe the same set: every
  // folder on the flat shelf. One count for both keeps the caption and the band
  // in step; phones keep the caption and drop the band.
  const scopeFolderCount = visibleFolders.length;
  const aggregate = openFolder ? library.aggregates.get(openFolder.id) : undefined;
  const shelfDeckCount = openFolder ? aggregate?.decks ?? 0 : library.totals.decks;
  const shelfDue = openFolder ? aggregate?.due ?? 0 : library.totals.due;
  // The hero already states the library-wide due figure. At the root, repeating
  // it here only competes with that number; inside a folder the scoped due count
  // is new information and stays.
  const meta = [
    plural(shelfDeckCount, 'deck', 'decks'),
    plural(scopeFolderCount, 'folder', 'folders'),
    ...(openFolder ? [shelfDue > 0 ? `${shelfDue} due` : 'all caught up'] : []),
  ].join(' · ');
  const caughtUpFolders = visibleFolders.filter(
    (folder) => folder.decks > 0 && folder.due === 0
  ).length;
  const statusLabel = !openFolder && caughtUpFolders > 0 ? `${caughtUpFolders} caught up` : undefined;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const chunk = <T,>(items: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
      return chunks;
    };

    if (editingLayout) {
      // Layout editing owns the level. The search line is hidden, because a
      // filter would otherwise hide the very rows being reordered, and the
      // reorder list is always shown — even if a search was active on entry.
      if (hero) out.push({ key: 'hero', kind: 'hero' });
      if (openFolder) out.push({ key: 'breadcrumbs', kind: 'breadcrumbs' });
      out.push({ key: 'header', kind: 'header' });
      out.push({ key: 'reorder', kind: 'reorder' });
      return out;
    }

    if (searchActive) {
      out.push({ key: 'header', kind: 'header' });
      out.push({ key: 'toolbar', kind: 'toolbar' });
      const total = search.folderHits.length + search.deckHits.length;
      out.push({
        key: 'results',
        kind: 'band',
        // The Due chip narrows without searching, so naming that state "Search
        // results" describes a query that was never typed.
        label: deferredQuery.trim() ? 'Search results' : 'Due today',
        count: total,
        hint: `${plural(search.folderHits.length, 'folder', 'folders')} · ${plural(
          search.deckHits.length,
          'deck',
          'decks'
        )}`,
      });
      const folderIds = search.folderHits.map((folder) => folder.id);
      if (columns === 1) {
        for (const id of folderIds) out.push({ key: `sf-${id}`, kind: 'searchFolder', id });
      } else {
        chunk(folderIds, columns).forEach((ids, index) =>
          out.push({ key: `sf-${index}`, kind: 'folderCards', ids })
        );
      }
      const deckIds = search.deckHits.map((entry) => entry.deck.id);
      chunk(deckIds, columns).forEach((ids, index) =>
        out.push({ key: `sd-${index}`, kind: 'deckCards', ids, paths: true })
      );
      if (total === 0) out.push({ key: 'no-results', kind: 'noResults' });
      return out;
    }

    if (hero) out.push({ key: 'hero', kind: 'hero' });
    if (openFolder) out.push({ key: 'breadcrumbs', kind: 'breadcrumbs' });
    out.push({ key: 'header', kind: 'header' });
    out.push({ key: 'toolbar', kind: 'toolbar' });

    if (visibleFolders.length > 0) {
      // A phone's masthead already says "Your decks" and carries the counts; a
      // second "Folders" label only pushes the first folder down. The desktop
      // board keeps the band so folders and loose decks read as two regions.
      if (!phone) {
        out.push({
          key: 'folders-band',
          kind: 'band',
          label: 'Folders',
          count: visibleFolders.length,
        });
      }
      if (columns === 1) {
        for (const folder of visibleFolders) {
          const decks = pinnedFirstEntries(library.byFolderId.get(folder.id) ?? []);
          const collapsed = collapsedFolders.has(folder.id);
          const closing = closingFolders.has(folder.id);
          // A close is committed immediately for the header's aria state and
          // chevron, but the rows remain one short beat so they can fade out
          // instead of vanishing under the finger.
          const bodyMounted = !collapsed || closing;
          out.push({
            key: `fg-${folder.id}`,
            kind: 'folderGroup',
            id: folder.id,
          });
          if (!bodyMounted) continue;
          // The decks are their own list rows, so the FlatList mounts a window
          // of a long folder instead of every deck inside one giant row.
          decks.forEach((entry, index) => {
            out.push({
              key: `fd-${folder.id}-${entry.deck.id}`,
              kind: 'folderDeck',
              deckId: entry.deck.id,
              first: index === 0,
              last: index === decks.length - 1,
              opening: openingFolders.has(folder.id),
              closing,
              index,
            });
          });
        }
      } else {
        chunk(
          visibleFolders.map((folder) => folder.id),
          columns
        ).forEach((ids, index) => out.push({ key: `fc-${index}`, kind: 'folderCards', ids }));
      }
    }

    if (visibleDecks.length > 0) {
      out.push({
        key: 'decks-band',
        kind: 'band',
        label: openFolder ? 'Decks here' : 'Unfiled decks',
        count: visibleDecks.length,
      });
      chunk(
        visibleDecks.map((entry) => entry.deck.id),
        columns
      ).forEach((ids, index) =>
        out.push({ key: `dc-${index}`, kind: 'deckCards', ids, paths: false })
      );
    }

    const archivedOnly = library.entries.length === 0 && library.archived.length > 0;
    if (!archivedOnly && visibleFolders.length === 0 && visibleDecks.length === 0) {
      out.push({ key: 'empty-level', kind: 'emptyLevel' });
    }
    if (!openFolder && archivedOnly) {
      // Keep the archived section reachable even when folders still exist.
      // Without this notice a library whose decks are all archived looks like
      // an empty shelf until the learner happens to scroll past every folder.
      out.push({ key: 'archived-only', kind: 'emptyLevel' });
    }

    if (!openFolder && library.archived.length > 0) {
      out.push({ key: 'archive', kind: 'archive' });
    }

    return out;
  }, [
    searchActive,
    deferredQuery,
    search,
    columns,
    openFolder,
    editingLayout,
    collapsedFolders,
    openingFolders,
    closingFolders,
    visibleFolders,
    visibleDecks,
    phone,
    library.archived.length,
    library.entries.length,
    library.entries.length === 0 && library.archived.length > 0,
  ]);

  const reorderGroups = useMemo<ShelfReorderGroup[]>(
    () =>
      [
        {
          key: 'folders',
          label: 'Folders',
          items: visibleFolders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
            color: folder.color,
            kind: 'folder' as const,
            meta: `${plural(folder.decks, 'deck', 'decks')} · ${folder.due} due`,
            pinned: folder.pinnedAt != null,
          })),
          onReorder: (from: number, to: number) => {
            const folder = visibleFolders[from];
            if (folder) onReorderFolder(folder.id, to);
          },
        },
        {
          key: 'decks',
          label: openFolder ? 'Decks here' : 'Unfiled decks',
          items: visibleDecks.map((entry) => ({
            id: entry.deck.id,
            name: entry.deck.name,
            icon: entry.deck.icon,
            color: entry.deck.color,
            kind: 'deck' as const,
            meta: `${entry.cardCount.toLocaleString('en-US')} ${plural(
              entry.cardCount,
              'card',
              'cards'
            )} · ${entry.total} due`,
            pinned: entry.deck.pinnedAt != null,
          })),
          onReorder: (from: number, to: number) => {
            const entry = visibleDecks[from];
            if (entry) onReorderDeck(entry.deck.id, to);
          },
        },
      ].filter((group) => group.items.length > 0),
    [visibleFolders, visibleDecks, openFolder, onReorderFolder, onReorderDeck]
  );

  // A structural key, not a data key: due counts changing every minute must not
  // make the shelf twitch. It names the deck/folder identities, their folder,
  // order and pins, so create, delete, move, archive/restore, pin and reorder
  // each get one whole-shelf settle while a queue refresh gets none. Search and
  // filter share the same transition, so the result set changes in one quiet beat.
  const shelfSignature = useMemo(
    () =>
      [
        openFolder?.id ?? 'root',
        editingLayout ? 'edit' : 'browse',
        library.entries
          .map(
            (entry) =>
              `${entry.deck.id}:${entry.deck.folderId ?? ''}:${entry.deck.pinnedAt != null ? 1 : 0}`
          )
          .join(','),
        library.archived.map(({ deck }) => deck.id).join(','),
        folders
          .map((folder) => `${folder.id}:${folder.pinnedAt != null ? 1 : 0}`)
          .join(','),
      ].join('|'),
    [editingLayout, folders, library, openFolder?.id]
  );
  // A deck can be created or deleted while Home is covered by another route.
  // Hold the last shelf we revealed while focused, so a change made behind a
  // route settles once when Home becomes visible, not invisibly underneath it
  // and again on focus. This also leaves an unchanged tab switch alone.
  const [revealedShelf, setRevealedShelf] = useState(shelfSignature);
  useEffect(() => {
    if (isFocused && revealedShelf !== shelfSignature) {
      setRevealedShelf(shelfSignature);
    }
  }, [isFocused, revealedShelf, shelfSignature]);

  const searchSignature = `${searchActive ? 1 : 0}:${foldedQuery}:${filter}`;
  const listReveal = useChangeReveal(
    `${revealedShelf}|${searchSignature}`,
    {
      duration: searchActive ? motion.fast : motion.base,
      distance: searchActive ? 4 : 6,
      opacityFloor: 0.985,
    }
  );

  const listRef = useRef<FlatList<Row>>(null);
  const scrollOffsetRef = useRef(0);
  const rootScrollOffsetRef = useRef(0);
  const previousFolderIdRef = useRef<string | null>(openFolder?.id ?? null);
  const previousSearchActiveRef = useRef(searchActive);
  const pendingScrollRef = useRef<number | null>(null);

  // A folder is a different level, not a scroll position. Entering one from
  // deep in the root list used to leave the new, shorter list at an offset it
  // could not contain, which read as an empty screen. Remember the root offset,
  // open folders at the top, and restore the root offset when the breadcrumb
  // takes the learner back.
  useEffect(() => {
    const nextId = openFolder?.id ?? null;
    const previousId = previousFolderIdRef.current;
    if (nextId === previousId) return;

    if (nextId && previousId == null) {
      rootScrollOffsetRef.current = scrollOffsetRef.current;
    }
    previousFolderIdRef.current = nextId;
    const target = nextId ? 0 : rootScrollOffsetRef.current;
    // The list's row set changes after this effect. Keep the target pending so
    // the content-size callback can apply it once the new rows have a height;
    // the frame is the fast path for lists whose measured size does not change.
    pendingScrollRef.current = target;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: target, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [openFolder?.id]);

  const applyPendingScroll = () => {
    const target = pendingScrollRef.current;
    if (target == null) return;
    pendingScrollRef.current = null;
    listRef.current?.scrollToOffset({ offset: target, animated: false });
  };

  // Search replaces the row set with a narrower one. Start results at their
  // first row; clearing a query leaves the reader where they are, since the
  // root offset may be intentionally restored by the folder effect above.
  useEffect(() => {
    if (previousSearchActiveRef.current === searchActive) return;
    previousSearchActiveRef.current = searchActive;
    if (!searchActive) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [searchActive]);

  const openFolderAndReset = (id: string | null) => {
    if (searchActive) {
      setQuery('');
      setFilter('all');
    }
    onOpenFolder(id);
  };

  // Entering layout editing leaves search and filter behind: reordering a
  // filtered list would move rows the user cannot see, and the search line is
  // hidden while editing, so the two states must not overlap.
  const handleToggleLayout = () => {
    if (!editingLayout && searchActive) {
      setQuery('');
      setFilter('all');
    }
    onToggleLayout();
  };

  const deckContext = (entry: DeckSummary) => {
    const folderId = entry.deck.folderId;
    if (!folderId) return undefined;
    return library.foldersById.get(folderId)?.name;
  };

  const renderDeck = (id: string, showPath: boolean, flat = false) => {
    const entry = library.byDeckId.get(id);
    if (!entry) return null;
    return (
      <DeckShelfRow
        key={entry.deck.id}
        name={entry.deck.name}
        icon={entry.deck.icon as IconName}
        color={entry.deck.color}
        cardCount={entry.cardCount}
        schedulerLabel={schedulerLabel(entry.deck.algorithmPreset)}
        due={entry.total}
        progress={entry.progress}
        composition={
          entry.total > 0
            ? {
                newCount: entry.newCount,
                learningCount: entry.learningCount,
                reviewCount: entry.reviewCount,
              }
            : undefined
        }
        pinned={entry.deck.pinnedAt != null}
        flat={flat}
        context={showPath ? deckContext(entry) : undefined}
        optionsMenu={deckOptions(entry.deck)}
        onPress={() => onOpenDeck(entry.deck.id)}
      />
    );
  };

  const renderFolderCard = (id: string) => {
    const folder = visibleFolders.find((entry) => entry.id === id) ??
      search.folderHits.find((entry) => entry.id === id) ??
      (folderById.get(id)
        ? {
            id,
            name: folderById.get(id)!.name,
            icon: folderById.get(id)!.icon,
            color: folderById.get(id)!.color,
            pinnedAt: folderById.get(id)!.pinnedAt,
            ...(library.aggregates.get(id) ?? {
              decks: 0,
              cards: 0,
              studied: 0,
              due: 0,
              progress: 0,
            }),
          }
        : null);
    if (!folder) return null;
    return (
      <FolderCard
        name={folder.name}
        icon={folder.icon}
        color={folder.color}
        deckCount={folder.decks}
        due={folder.due}
        progress={folder.progress}
        pinned={folder.pinnedAt != null}
        onPress={() => openFolderAndReset(folder.id)}
      />
    );
  };

  const renderArchive = () => (
    <Surface tone="pane" radius="pane" padding="none" style={{ overflow: 'hidden', marginTop: 24 }}>
      <HintPressable
        hint={archiveOpen ? 'Collapse archived decks' : 'Expand archived decks'}
        onPress={() => setArchiveOpen((next) => !next)}
        accessibilityRole="button"
        accessibilityLabel={`Archived decks, ${library.archived.length}`}
        accessibilityState={{ expanded: archiveOpen }}
        {...(Platform.OS === 'web' ? { 'aria-expanded': archiveOpen } : {})}
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <MaterialIcons name="inventory-2" size={iconSize.sm} color={colors.outline} />
        <AppText
          variant="label"
          weight="semibold"
          tone="muted"
          className="uppercase"
          style={{ letterSpacing: 0.9 }}
        >
          Archived
        </AppText>
        <AppText variant="caption" tone="tertiary">
          {plural(library.archived.length, 'deck', 'decks')}
        </AppText>
        <View style={{ flex: 1 }} />
        <Animated.View
          style={{
            transform: [
              {
                rotate: archiveBody.value.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
        </Animated.View>
      </HintPressable>

      {archiveBody.mounted ? (
        <Animated.View
          testID="archive-body"
          pointerEvents={archiveOpen ? 'auto' : 'none'}
          accessibilityElementsHidden={!archiveOpen || undefined}
          importantForAccessibility={!archiveOpen ? 'no-hide-descendants' : undefined}
          {...(Platform.OS === 'web' ? { 'aria-hidden': !archiveOpen || undefined } : {})}
          style={{ height: archiveCollapse, overflow: 'hidden' }}
        >
          <Animated.View
            onLayout={(event) => {
              if (!archiveOpen) return;
              const next = Math.round(event.nativeEvent.layout.height);
              if (next <= 0) return;
              setArchiveContentHeight((current) =>
                Math.abs(current - next) > 1 ? next : current
              );
            }}
            style={{
              padding: 8,
              gap: 8,
              opacity: archiveBody.value,
              transform: [
                {
                  translateY: archiveBody.value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            }}
          >
            {library.archived.map(({ deck, cards }) => (
              <ArchivedRow
                key={deck.id}
                name={deck.name}
                cardCount={cards}
                onPress={() => onOpenDeck(deck.id)}
                optionsMenu={deckOptions(deck)}
              />
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}
    </Surface>
  );

  const renderItemContent = (item: Row) => {
    switch (item.kind) {
      case 'hero':
        return (
          <View
            style={{
              marginTop: phone ? 4 : 12,
              marginBottom: phone ? 0 : v3.spacing.section,
            }}
          >
            {hero}
          </View>
        );
      case 'breadcrumbs':
        return (
          <ShelfBreadcrumbs
            folder={trail[0] ?? null}
            onBack={() => openFolderAndReset(null)}
          />
        );
      case 'header':
        return (
          <ShelfHeader
            title={openFolder ? openFolder.name : 'Your decks'}
            meta={meta}
            statusLabel={statusLabel}
            onManageFolders={onManageFolders}
            onToggleLayout={handleToggleLayout}
            editingLayout={editingLayout}
          />
        );
      case 'toolbar':
        // Without the phone's Folders band, the toolbar itself has to hold the
        // gap before the first folder; 2px read as a collision.
        return (
          <View style={{ marginTop: phone ? 6 : 14, marginBottom: phone ? 8 : 2 }}>
            <LibraryToolbar
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              active={searchActive}
              resultLabel={`${plural(search.deckHits.length, 'deck', 'decks')} · ${plural(
                search.folderHits.length,
                'folder',
                'folders'
              )}`}
            />
          </View>
        );
      case 'band':
        return (
          <View style={{ marginTop: phone ? 10 : 18, marginBottom: phone ? 6 : 10 }}>
            <ShelfBand label={item.label} count={item.count} hint={item.hint} />
          </View>
        );
      case 'folderGroup': {
        const folder = visibleFolders.find((entry) => entry.id === item.id);
        if (!folder) return null;
        const expanded = !collapsedFolders.has(folder.id);
        const joined =
          (expanded || closingFolders.has(folder.id)) && folder.decks > 0;
        return (
          <View style={{ marginBottom: joined ? 0 : 10 }}>
            <FolderGroup
              name={folder.name}
              icon={folder.icon}
              color={folder.color}
              deckCount={folder.decks}
              due={folder.due}
              pinned={folder.pinnedAt != null}
              expanded={expanded}
              expandable={folder.decks > 0}
              joined={joined}
              onToggle={() => onToggleFolder(folder.id)}
            />
          </View>
        );
      }
      case 'folderDeck':
        return (
          <FolderBodySlice
            first={item.first}
            last={item.last}
            entering={item.opening}
            closing={item.closing}
            index={item.index}
          >
            {renderDeck(item.deckId, false, true)}
          </FolderBodySlice>
        );
      case 'folderCards':
        return (
          <View style={{ flexDirection: 'row', gap: GRID_GAP, marginBottom: 10 }}>
            {item.ids.map((id) => (
              <View key={id} style={{ width: cellWidth, minWidth: 0 }}>
                {renderFolderCard(id)}
              </View>
            ))}
          </View>
        );
      case 'searchFolder':
        return (
          <View style={{ marginBottom: 10 }}>
            {renderFolderCard(item.id)}
          </View>
        );
      case 'deckCards':
        return (
          <View style={{ flexDirection: 'row', gap: GRID_GAP, marginBottom: 10 }}>
            {item.ids.map((id) => (
              <View key={id} style={{ width: cellWidth, minWidth: 0 }}>
                {renderDeck(id, item.paths)}
              </View>
            ))}
          </View>
        );
      case 'emptyLevel':
        return (
          <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
            {openFolder
              ? 'This folder is empty. Move a deck in from the deck’s options.'
              : library.entries.length === 0 && library.archived.length > 0
                ? 'No active decks. Your archived decks are below.'
                : 'No decks yet.'}
          </AppText>
        );
      case 'noResults':
        return (
          <View testID="library-no-results" style={{ gap: 6, paddingVertical: 20 }}>
            <AppText variant="bodySm" weight="semibold">
              {query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : 'No decks are due right now.'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {filter === 'due'
                ? 'Switch to All, or clear the search to see the whole library.'
                : 'Try another word, or clear the search.'}
            </AppText>
            {/* The empty state carries its own way out: an instruction with no
                reachable control is a dead end. Clearing restores the shelf,
                so the Due filter is reset with the query. */}
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Button
                label={query.trim() ? 'Clear search' : 'Show all decks'}
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setFilter('all');
                }}
              />
            </View>
          </View>
        );
      case 'archive':
        return renderArchive();
      case 'reorder':
        return (
          <ShelfReorder
            groups={reorderGroups}
            scrollTo={(y) => listRef.current?.scrollToOffset({ offset: y, animated: false })}
            scrollOffsetRef={scrollOffsetRef}
          />
        );
      default:
        return null;
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Row>) => renderItemContent(item);

  return (
    <Animated.View style={[{ flex: 1 }, listReveal.style]}>
      <FlatList
        testID="shelf-panel"
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{
          // Home's Screen already pads the body by the floating bar's height.
          paddingTop: phone ? 8 : spacing.screen,
          paddingBottom: tabClearance ? spacing.tabClearance : spacing.screenBottom,
          paddingHorizontal: spacing.screen,
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        maxToRenderPerBatch={10}
        windowSize={21}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={applyPendingScroll}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      />
    </Animated.View>
  );
}
