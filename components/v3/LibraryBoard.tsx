import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, useWindowDimensions, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { AppText } from '../AppText';
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
import { FolderGroup } from './FolderGroup';
import { ArchivedRow } from './ArchivedRow';
import { colors, iconSize, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import type { FolderAggregate, LibraryIndex, DeckSummary } from '../../data/library';
import { childFoldersOf, foldSearch, matchesSearch } from '../../data/library';
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
  onToggleFolder: (id: string) => void;
  editingLayout: boolean;
  onNewFolder: () => void;
  onToggleLayout: () => void;
  onReorderFolder: (id: string, to: number) => void;
  onReorderDeck: (id: string, to: number) => void;
  onOpenDeck: (id: string) => void;
  /** The ActionMenu node for a deck; Home owns the menu actions. */
  deckOptions: (deck: Deck) => React.ReactNode;
  /** Measured header height, so the first row clears the floating bar. */
  headerHeight: number;
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
  onToggleFolder,
  editingLayout,
  onNewFolder,
  onToggleLayout,
  onReorderFolder,
  onReorderDeck,
  onOpenDeck,
  deckOptions,
  headerHeight,
  contentMaxWidth,
  tabClearance = true,
}: LibraryBoardProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const columns = width >= 1200 ? 3 : desktop ? 2 : 1;
  const usableWidth = Math.max(0, Math.min(width, contentMaxWidth) - spacing.screen * 2);
  const cellWidth = columns > 1 ? Math.max(0, (usableWidth - GRID_GAP * (columns - 1)) / columns) : usableWidth;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const foldedQuery = foldSearch(deferredQuery);
  const searchActive = query.trim().length > 0 || filter === 'due';

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const visibleFolders = useMemo<FolderRow[]>(() => {
    const children = sortPinned(childFoldersOf(library, openFolder?.id ?? null));
    const rows: FolderRow[] = [];
    for (const folder of children) {
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

  const trail = openFolder ? library.pathById.get(openFolder.id) ?? [] : [];

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const chunk = <T,>(items: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
      return chunks;
    };

    if (searchActive) {
      out.push({ key: 'header', kind: 'header' });
      out.push({ key: 'toolbar', kind: 'toolbar' });
      const total = search.folderHits.length + search.deckHits.length;
      out.push({
        key: 'results',
        kind: 'band',
        label: 'Search results',
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

    if (editingLayout) {
      out.push({ key: 'reorder', kind: 'reorder' });
      return out;
    }

    if (visibleFolders.length > 0) {
      out.push({
        key: 'folders-band',
        kind: 'band',
        label: openFolder ? 'Folders here' : 'Folders',
        count: visibleFolders.length,
      });
      if (columns === 1) {
        for (const folder of visibleFolders) {
          out.push({ key: `fg-${folder.id}`, kind: 'folderGroup', id: folder.id });
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

    if (visibleFolders.length === 0 && visibleDecks.length === 0) {
      out.push({ key: 'empty-level', kind: 'emptyLevel' });
    }

    if (!openFolder && library.archived.length > 0) {
      out.push({ key: 'archive', kind: 'archive' });
    }

    return out;
  }, [
    searchActive,
    search,
    columns,
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

  const scopeFolderCount = openFolder ? visibleFolders.length : folders.length;
  const aggregate = openFolder ? library.aggregates.get(openFolder.id) : undefined;
  const shelfDeckCount = openFolder ? aggregate?.decks ?? 0 : library.totals.decks;
  const shelfDue = openFolder ? aggregate?.due ?? 0 : library.totals.due;
  const meta = [
    plural(shelfDeckCount, 'deck', 'decks'),
    plural(scopeFolderCount, 'folder', 'folders'),
    shelfDue > 0 ? `${shelfDue} due` : 'all caught up',
  ].join(' · ');
  const caughtUpFolders = visibleFolders.filter(
    (folder) => folder.decks > 0 && folder.due === 0
  ).length;
  const statusLabel = !openFolder && caughtUpFolders > 0 ? `${caughtUpFolders} caught up` : undefined;

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

  const renderDeck = (id: string, showPath: boolean) => {
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
              directDecks: 0,
              nestedFolders: 0,
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
        nestedFolders={folder.nestedFolders}
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
        <View style={{ transform: [{ rotate: archiveOpen ? '180deg' : '0deg' }] }}>
          <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
        </View>
      </HintPressable>

      {archiveOpen ? (
        <View style={{ padding: 8, gap: 8 }}>
          {library.archived.map(({ deck, cards }) => (
            <ArchivedRow
              key={deck.id}
              name={deck.name}
              cardCount={cards}
              onPress={() => onOpenDeck(deck.id)}
              optionsMenu={deckOptions(deck)}
            />
          ))}
        </View>
      ) : null}
    </Surface>
  );

  const renderItem = ({ item }: ListRenderItemInfo<Row>) => {
    switch (item.kind) {
      case 'hero':
        return <View style={{ marginTop: 12, marginBottom: v3.spacing.section }}>{hero}</View>;
      case 'breadcrumbs':
        return <ShelfBreadcrumbs trail={trail} onNavigate={openFolderAndReset} />;
      case 'header':
        return (
          <ShelfHeader
            title={openFolder ? openFolder.name : 'Your decks'}
            meta={meta}
            statusLabel={statusLabel}
            onNewFolder={onNewFolder}
            onToggleLayout={onToggleLayout}
            editingLayout={editingLayout}
          />
        );
      case 'toolbar':
        return (
          <View style={{ marginTop: 14, marginBottom: 2 }}>
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
          <View style={{ marginTop: 18, marginBottom: 10 }}>
            <ShelfBand label={item.label} count={item.count} hint={item.hint} />
          </View>
        );
      case 'folderGroup': {
        const folder = visibleFolders.find((entry) => entry.id === item.id);
        if (!folder) return null;
        const decks = pinnedFirstEntries(library.byFolderId.get(item.id) ?? []);
        const subfolders = sortPinned(childFoldersOf(library, item.id))
          .flatMap((child) => {
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
          <View style={{ marginBottom: 10 }}>
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
            >
              {decks.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {decks.map((entry) => (
                    <View key={entry.deck.id}>{renderDeck(entry.deck.id, false)}</View>
                  ))}
                </View>
              ) : subfolders.length === 0 ? (
                <AppText variant="caption" tone="muted">
                  No decks directly inside yet.
                </AppText>
              ) : null}
            </FolderGroup>
          </View>
        );
      }
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
              ? 'This folder is empty. Move a deck in from the deck’s options, or add a folder.'
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
