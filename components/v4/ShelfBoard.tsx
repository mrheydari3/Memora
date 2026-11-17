import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { HintPressable } from '../HintPressable';
import { ShelfReorder } from '../v3/ShelfReorder';
import type { ShelfReorderGroup } from '../v3/ShelfReorder';
import { Masthead } from './Masthead';
import { SectionHead } from './SectionHead';
import { ShelfSearch } from './ShelfSearch';
import type { ShelfFilter } from './ShelfSearch';
import { FolderGroup } from './FolderGroup';
import { SubfolderRow } from './SubfolderRow';
import { DeckRow } from './DeckRow';
import { Breadcrumbs } from './Breadcrumbs';
import { Archive } from './Archive';
import { VaultNote } from './VaultNote';
import type { MenuAction } from '../menu/types';
import { colors, iconSize, spacing } from '../../theme/tokens';
import { v4 } from '../../theme/v4';
import type { FolderAggregate, LibraryIndex, DeckSummary } from '../../data/library';
import { childFoldersOf, foldSearch, matchesSearch } from '../../data/library';
import { schedulerLabel } from '../../data/schedulers';
import { sortPinned } from '../../data/folders';
import type { Deck, DeckFolder } from '../../data/types';

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
  | { key: string; kind: 'masthead' }
  | { key: string; kind: 'tools' }
  | { key: string; kind: 'section'; label: string; count: number }
  | { key: string; kind: 'folderGroup'; id: string }
  | { key: string; kind: 'subfolder'; id: string; testID?: string }
  | { key: string; kind: 'deck'; id: string; path: boolean; last: boolean }
  | { key: string; kind: 'emptyLevel' }
  | { key: string; kind: 'noResults' }
  | { key: string; kind: 'archive' }
  | { key: string; kind: 'vault' }
  | { key: string; kind: 'reorder' };

export type ShelfBoardProps = {
  library: LibraryIndex;
  folders: DeckFolder[];
  /** The Today pane, built by Home; rendered above the shelf in the same list. */
  hero?: React.ReactNode;
  openFolder: DeckFolder | null;
  onOpenFolder: (id: string | null) => void;
  collapsedFolders: ReadonlySet<string>;
  onToggleFolder: (id: string) => void;
  editingLayout: boolean;
  onDoneEditingLayout: () => void;
  onReorderFolder: (id: string, to: number) => void;
  onReorderDeck: (id: string, to: number) => void;
  onOpenDeck: (id: string) => void;
  /** Opens the deck composer with this folder preselected. */
  onAddDeckInFolder: (folderId: string) => void;
  /** The menu actions for a deck; the row owns the quiet trigger. */
  deckActions: (deck: Deck) => MenuAction[];
  /** Measured header height, so the first row clears the floating bar. */
  headerHeight: number;
  contentMaxWidth: number;
  tabClearance?: boolean;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * How many of a folder's decks render inline inside its accordion.
 *
 * An accordion body is one list row, so everything it renders is mounted at
 * once. A folder holding a hundred decks would defeat the window the board
 * exists to keep; past this many, the group states the total and offers the
 * folder's own level, where the decks are virtualized rows like any others.
 */
const FOLDER_INLINE_LIMIT = 24;

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
 * ShelfBoard — the V4 printed index, virtualized.
 *
 * One list owns the whole page body: the Today pane, breadcrumbs, masthead,
 * search, section rules, folder accordions, deck rows, the archive and the
 * vault note. Rows are never nested in a ScrollView, so a 300-deck library
 * mounts a window of them.
 *
 * At the root, every folder is an inline accordion that shows its direct decks
 * and child-folder doors without leaving the page. At a nested level, child
 * folders are plain doors: opening one goes deeper, and the breadcrumbs remain
 * the way back. Search always runs over the whole library, never the open level.
 */
export function ShelfBoard({
  library,
  folders,
  hero,
  openFolder,
  onOpenFolder,
  collapsedFolders,
  onToggleFolder,
  editingLayout,
  onDoneEditingLayout,
  onReorderFolder,
  onReorderDeck,
  onOpenDeck,
  onAddDeckInFolder,
  deckActions,
  headerHeight,
  contentMaxWidth,
  tabClearance = true,
}: ShelfBoardProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ShelfFilter>('all');
  const deferredQuery = useDeferredValue(query);

  // Arrange is a mode, not a filter: entering it leaves the search level so the
  // reorder surface is never hidden under a stale empty result. Leaving it
  // returns to the unfiltered shelf rather than resurrecting the query.
  useEffect(() => {
    if (!editingLayout) return;
    setQuery('');
    setFilter('all');
  }, [editingLayout]);
  const foldedQuery = foldSearch(deferredQuery);
  const searchActive = query.trim().length > 0 || filter === 'due';

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const folderRow = (folder: DeckFolder): FolderRow | null => {
    const aggregate = library.aggregates.get(folder.id);
    if (!aggregate) return null;
    return {
      id: folder.id,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      pinnedAt: folder.pinnedAt,
      ...aggregate,
    };
  };

  const visibleFolders = useMemo<FolderRow[]>(() => {
    const children = sortPinned(childFoldersOf(library, openFolder?.id ?? null));
    return children.flatMap((folder) => {
      const row = folderRow(folder);
      return row ? [row] : [];
    });
    // `folderRow` closes over the index maps, which the dependency covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, openFolder]);

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
      const row = folderRow(folder);
      if (row) folderHits.push(row);
    }
    const deckHits = library.entries.filter(
      (entry) =>
        matchesSearch(entry.deck.name, foldedQuery) && (filter === 'all' || entry.total > 0)
    );
    return { folderHits, deckHits };
    // `folderRow` is a pure read of the same index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchActive, folders, library, foldedQuery, filter]);

  const trail = openFolder ? library.pathById.get(openFolder.id) ?? [] : [];
  const aggregate = openFolder ? library.aggregates.get(openFolder.id) : undefined;

  const masthead = openFolder
    ? {
        title: openFolder.name,
        due: aggregate?.due ?? 0,
        deckCount: aggregate?.decks ?? 0,
        folderCount: visibleFolders.length,
      }
    : {
        title: 'Your decks',
        due: library.totals.due,
        deckCount: library.totals.decks,
        // The masthead and the Folders band must count the same level: a nested
        // folder belongs to its parent's subtree, not to the root's total.
        folderCount: visibleFolders.length,
      };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    if (editingLayout) {
      if (hero) out.push({ key: 'hero', kind: 'hero' });
      if (openFolder) out.push({ key: 'breadcrumbs', kind: 'breadcrumbs' });
      out.push({ key: 'masthead', kind: 'masthead' });
      out.push({ key: 'reorder', kind: 'reorder' });
      return out;
    }

    if (searchActive) {
      out.push({ key: 'masthead', kind: 'masthead' });
      out.push({ key: 'tools', kind: 'tools' });
      const total = search.folderHits.length + search.deckHits.length;
      out.push({ key: 'search-head', kind: 'section', label: 'Search results', count: total });
      for (const folder of search.folderHits) {
        out.push({ key: `sf-${folder.id}`, kind: 'subfolder', id: folder.id, testID: 'folder-result' });
      }
      search.deckHits.forEach((entry, index) => {
        out.push({
          key: `sd-${entry.deck.id}`,
          kind: 'deck',
          id: entry.deck.id,
          path: true,
          last: index === search.deckHits.length - 1,
        });
      });
      if (total === 0) out.push({ key: 'no-results', kind: 'noResults' });
      return out;
    }

    if (hero) out.push({ key: 'hero', kind: 'hero' });
    if (openFolder) out.push({ key: 'breadcrumbs', kind: 'breadcrumbs' });
    out.push({ key: 'masthead', kind: 'masthead' });
    out.push({ key: 'tools', kind: 'tools' });

    if (visibleFolders.length > 0) {
      out.push({
        key: 'folders-head',
        kind: 'section',
        label: openFolder ? 'Folders here' : 'Folders',
        count: visibleFolders.length,
      });
      for (const folder of visibleFolders) {
        if (openFolder) {
          out.push({ key: `sf-${folder.id}`, kind: 'subfolder', id: folder.id });
        } else {
          out.push({ key: `fg-${folder.id}`, kind: 'folderGroup', id: folder.id });
        }
      }
    }

    if (visibleDecks.length > 0) {
      out.push({
        key: 'decks-head',
        kind: 'section',
        label: openFolder ? 'Decks here' : 'Unfiled decks',
        count: visibleDecks.length,
      });
      visibleDecks.forEach((entry, index) => {
        out.push({
          key: `d-${entry.deck.id}`,
          kind: 'deck',
          id: entry.deck.id,
          path: false,
          last: index === visibleDecks.length - 1,
        });
      });
    }

    if (visibleFolders.length === 0 && visibleDecks.length === 0) {
      out.push({ key: 'empty-level', kind: 'emptyLevel' });
    }

    if (!openFolder && library.archived.length > 0) {
      out.push({ key: 'archive', kind: 'archive' });
    }
    if (!openFolder) out.push({ key: 'vault', kind: 'vault' });

    return out;
  }, [
    searchActive,
    search,
    hero,
    openFolder,
    editingLayout,
    visibleFolders,
    visibleDecks,
    library.archived.length,
  ]);

  const reorderGroups = useMemo<ShelfReorderGroup[]>(
    () =>
      [
        {
          key: 'folders',
          label: openFolder ? 'Folders here' : 'Folders',
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

  const listRef = useRef<FlatList<Row>>(null);
  const scrollOffsetRef = useRef(0);

  const openFolderAndReset = (id: string | null) => {
    if (searchActive) {
      setQuery('');
      setFilter('all');
    }
    onOpenFolder(id);
  };

  const deckContext = (entry: DeckSummary) => {
    const folderId = entry.deck.folderId;
    if (!folderId) return undefined;
    const path = library.pathById.get(folderId);
    return path?.map((folder) => folder.name).join(' / ');
  };

  const renderDeck = (id: string, showPath: boolean, last: boolean) => {
    const entry = library.byDeckId.get(id);
    if (!entry) return null;
    return (
      <DeckRow
        key={entry.deck.id}
        name={entry.deck.name}
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
        context={showPath ? deckContext(entry) : undefined}
        actions={deckActions(entry.deck)}
        last={last}
        onPress={() => onOpenDeck(entry.deck.id)}
      />
    );
  };

  const renderFolderGroup = (id: string) => {
    const folder = visibleFolders.find((entry) => entry.id === id);
    if (!folder) return null;
    const decks = pinnedFirstEntries(library.byFolderId.get(id) ?? []);
    const shown = decks.slice(0, FOLDER_INLINE_LIMIT);
    const hidden = decks.length - shown.length;
    const subfolders = sortPinned(childFoldersOf(library, id)).flatMap((child) => {
      const childAggregate = library.aggregates.get(child.id);
      if (!childAggregate) return [];
      return [
        {
          id: child.id,
          name: child.name,
          icon: child.icon,
          color: child.color,
          decks: childAggregate.decks,
          due: childAggregate.due,
        },
      ];
    });

    return (
      <FolderGroup
        name={folder.name}
        icon={folder.icon}
        color={folder.color}
        deckCount={folder.decks}
        directDecks={folder.directDecks}
        due={folder.due}
        pinned={folder.pinnedAt != null}
        nestedFolders={folder.nestedFolders}
        expanded={!collapsedFolders.has(folder.id)}
        onToggle={() => onToggleFolder(folder.id)}
        subfolders={subfolders}
        onOpenSubfolder={openFolderAndReset}
        onAddDeck={() => onAddDeckInFolder(folder.id)}
      >
        {shown.map((entry, index) => (
          <View key={entry.deck.id}>
            {renderDeck(
              entry.deck.id,
              false,
              index === shown.length - 1 && subfolders.length === 0 && hidden === 0
            )}
          </View>
        ))}
        {hidden > 0 ? (
          <HintPressable
            hint="Open the folder to browse every deck"
            onPress={() => openFolderAndReset(folder.id)}
            accessibilityRole="button"
            accessibilityLabel={`Show all ${decks.length} decks in ${folder.name}`}
            testID="folder-show-all"
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingRight: 2,
            }}
          >
            <AppText style={[v4.type.control, { color: colors.v4Saffron, fontWeight: '600' }]}>
              {`Show all ${decks.length} decks`}
            </AppText>
            <MaterialIcons name="chevron-right" size={14} color={colors.v4Saffron} />
          </HintPressable>
        ) : null}
      </FolderGroup>
    );
  };

  const renderSubfolder = (id: string, testID?: string) => {
    const folder = folderById.get(id);
    const agg = library.aggregates.get(id);
    if (!folder || !agg) return null;
    return (
      <SubfolderRow
        name={folder.name}
        icon={folder.icon}
        color={folder.color}
        decks={agg.decks}
        due={agg.due}
        testID={testID}
        onPress={() => openFolderAndReset(id)}
      />
    );
  };

  const renderSection = (label: string, count: number) => (
    <SectionHead label={label} count={count} />
  );

  const renderItem = ({ item }: ListRenderItemInfo<Row>) => {
    switch (item.kind) {
      case 'hero':
        return <View style={{ marginTop: 12, marginBottom: 28 }}>{hero}</View>;
      case 'breadcrumbs':
        return <Breadcrumbs trail={trail} onNavigate={openFolderAndReset} />;
      case 'masthead':
        return (
          <Masthead
            title={masthead.title}
            due={masthead.due}
            deckCount={masthead.deckCount}
            folderCount={masthead.folderCount}
          />
        );
      case 'tools':
        return (
          <ShelfSearch
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
        );
      case 'section':
        return renderSection(item.label, item.count);
      case 'folderGroup':
        return renderFolderGroup(item.id);
      case 'subfolder':
        return renderSubfolder(item.id, item.testID);
      case 'deck':
        return renderDeck(item.id, item.path, item.last);
      case 'emptyLevel':
        return openFolder ? (
          <View
            style={{
              paddingVertical: 22,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <AppText style={[v4.type.meta, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>
              No decks inside yet.
            </AppText>
            <HintPressable
              hint="Create a deck in this folder"
              onPress={() => onAddDeckInFolder(openFolder.id)}
              accessibilityRole="button"
              accessibilityLabel="Add a deck"
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <AppText
                style={[v4.type.control, { color: colors.v4Saffron, fontWeight: '600' }]}
              >
                Add a deck
              </AppText>
            </HintPressable>
          </View>
        ) : (
          <AppText
            style={[v4.type.meta, { color: colors.onSurfaceVariant, paddingVertical: 18 }]}
          >
            No decks yet.
          </AppText>
        );
      case 'noResults':
        return (
          <View testID="library-no-results" style={{ paddingTop: 34, paddingBottom: 22, gap: 6 }}>
            <AppText style={[v4.type.meta, { color: colors.onSurface }]}>
              {query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : 'No decks are due right now.'}
            </AppText>
            <AppText style={[v4.type.folderMeta, { color: colors.outline }]}>
              {filter === 'due'
                ? 'Switch to All, or clear the search to see the whole library.'
                : 'Try another word, or clear the search.'}
            </AppText>
            {/* The empty state offers the way out instead of only describing it. */}
            <HintPressable
              hint="Show every deck again"
              onPress={() => {
                setQuery('');
                setFilter('all');
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              testID="library-clear-search"
              style={{ minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' }}
            >
              <AppText style={[v4.type.control, { color: colors.v4Saffron, fontWeight: '600' }]}>
                Clear search
              </AppText>
            </HintPressable>
          </View>
        );
      case 'archive':
        return (
          <Archive
            entries={library.archived}
            actions={deckActions}
            onOpenDeck={onOpenDeck}
          />
        );
      case 'vault':
        return <VaultNote />;
      case 'reorder':
        return (
          <View style={{ marginTop: v4.layout.sectionGap }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingBottom: v4.control.sectionHeadPad,
                borderBottomWidth: 1,
                borderBottomColor: colors.v4LineStrong,
              }}
            >
              <AppText
                headingLevel={2}
                weight="semibold"
                style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.2 }}
              >
                Edit layout
              </AppText>
              <HintPressable
                hint="Finish arranging the shelf"
                onPress={onDoneEditingLayout}
                accessibilityRole="button"
                accessibilityLabel="Done editing layout"
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: colors.v4SaffronWash,
                }}
              >
                <MaterialIcons name="check" size={iconSize.sm} color={colors.v4Saffron} />
                <AppText
                  style={[v4.type.control, { color: colors.v4Saffron, fontWeight: '600' }]}
                >
                  Done
                </AppText>
              </HintPressable>
            </View>
            <View style={{ marginTop: 20 }}>
              <ShelfReorder
                groups={reorderGroups}
                scrollTo={(y) => listRef.current?.scrollToOffset({ offset: y, animated: false })}
                scrollOffsetRef={scrollOffsetRef}
              />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <FlatList
      testID="shelf-panel"
      ref={listRef}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderItem}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: headerHeight + spacing.screen,
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
      onScroll={(event) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    />
  );
}
