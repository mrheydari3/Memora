import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildLibraryIndex } from '../../data/library';
import { computeStreak } from '../../data/streak';
import { folderDescendantIds, folderPath } from '../../data/folders';
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
  Screen,
  SheetScrollView,
  ActionMenu,
} from '../../components';
import type { MenuAction } from '../../components';
import { MaterialIcons } from '../../components/Icon';
import {
  FolderGlyph,
  HeaderIcon,
  HeroAura,
  LibraryBoard,
  LibraryPane,
  NewFolderButton,
  PageHeader,
  SectionHeading,
  Surface,
  TodayPane,
} from '../../components/v3';
import type { FieldInputRef } from '../../components/Field';
import { colors, heights, radii, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** The three bodies the Folders sheet can show. */
type FolderSheetMode = 'list' | 'edit' | 'location';

/**
 * Home — design v4, "Today first" with a folder-first library.
 *
 * The page answers "what do I study now?" before "what do I own?": the day
 * label ("Today") is the h1 and the due number is the canvas's one display-sized
 * element, one primary action opens the session, and the day's new/learning/
 * review split sits underneath. The library is browsed level by level: the top
 * level holds root folders and unfiled decks, and every folder opens into its
 * own subfolders and decks.
 *
 * The body is one virtualized list (`LibraryBoard`): the hero, breadcrumbs,
 * masthead, search, folder groups and deck rows are all rows of the same
 * FlatList, so Home mounts a window of the library instead of every card, and
 * no `buildStudyQueue` runs per deck. Every number still comes from the same
 * session builder's rules — `data/library.ts` computes the queue summary and
 * the parity tests pin it to `buildStudyQueue`.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // A desktop canvas gets its own composition: the today grid with a library
  // rail, then a two-up shelf. Below 1024 the page keeps the single phone
  // column, so every existing mobile behaviour and measurement is untouched.
  const desktop = width >= 1024;
  const contentMaxWidth = desktop ? v3.layout.homeDesktopMaxWidth : v3.layout.contentMaxWidth;
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
  const [folderSheetMode, setFolderSheetMode] = useState<FolderSheetMode>('list');
  const [folderDraft, setFolderDraft] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderIcon, setFolderIcon] = useState<string>(FOLDER_DEFAULT_ICON);
  const [folderColor, setFolderColor] = useState<string>(COLOR_CHOICES[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState<string>(FOLDER_DEFAULT_ICON);
  const [editColor, setEditColor] = useState<string>(COLOR_CHOICES[0]);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [editingLayout, setEditingLayout] = useState(false);
  // The board pads its own content by the measured bar height; Screen reports it.
  const [headerHeight, setHeaderHeight] = useState(heights.pageHeader);
  const handleHeaderHeight = useCallback((next: number) => {
    setHeaderHeight((current) => (Math.abs(current - next) > 1 ? next : current));
  }, []);
  const folderDraftRef = useRef<FieldInputRef>(null);

  // One index per data change: review buckets, queue summaries, folder
  // aggregates, paths and children. The board and the sheet read the same maps,
  // so a count cannot disagree with the row it describes.
  const library = useMemo(
    () => buildLibraryIndex(decks, folders, cardsByDeck, reviewLog),
    [decks, folders, cardsByDeck, reviewLog]
  );
  const deckQueues = library.entries;
  const activeDeckIds = useMemo(
    () => new Set(deckQueues.map((entry) => entry.deck.id)),
    [deckQueues]
  );

  const streak = useMemo(
    () =>
      computeStreak(
        reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)).map((e) => e.reviewedAt)
      ),
    [reviewLog, activeDeckIds]
  );

  const totalDue = library.totals.due;
  const dueDecks = library.totals.dueDecks;
  const minutes = Math.max(1, Math.round(totalDue / 4));
  const libraryCards = library.totals.cards;
  const libraryStudied = library.totals.studied;
  const libraryProgress = library.totals.progress;
  const caughtUpDecks = library.totals.caughtUpDecks;
  const archivedDecks = library.archived;

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

  // A folder deleted from the sheet falls back to its parent instead of hiding
  // the level it was on.
  const openFolder = useMemo(
    () => (openFolderId ? folders.find((folder) => folder.id === openFolderId) ?? null : null),
    [openFolderId, folders]
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
            const trail = folderPath(folders, folder.id)
              .map((entry) => entry.name)
              .join(' / ');
            const count = library.aggregates.get(folder.id)?.decks ?? 0;
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

  const scrollContentStyle = {
    paddingTop: headerHeight + spacing.screen,
    paddingBottom: spacing.tabClearance,
    paddingHorizontal: spacing.screen,
    width: '100%' as const,
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
  };

  return (
    <Screen
      scroll={false}
      tabClearance
      contentMaxWidth={contentMaxWidth}
      header={header}
      onHeaderHeight={handleHeaderHeight}
    >
      {!ready ? (
        <ScrollView contentContainerStyle={scrollContentStyle} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: v3.spacing.page }}>
            <HeroSkeleton />
          </View>
          <View style={{ marginTop: v3.spacing.page }}>
            <DeckShelfSkeleton count={2} />
          </View>
        </ScrollView>
      ) : deckQueues.length === 0 ? (
        <ScrollView contentContainerStyle={scrollContentStyle} showsVerticalScrollIndicator={false}>
          <View
            style={desktop ? { width: '100%', maxWidth: 620, alignSelf: 'center' } : undefined}
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
        </ScrollView>
      ) : (
        <LibraryBoard
          library={library}
          folders={folders}
          hero={
            continueEntry ? (
              <View
                style={
                  desktop
                    ? {
                        flexDirection: 'row',
                        alignItems: 'stretch',
                        gap: v3.layout.homeGap,
                      }
                    : undefined
                }
              >
                <View
                  style={
                    desktop
                      ? { flex: 1, minWidth: 0, position: 'relative' }
                      : { width: '100%', position: 'relative' }
                  }
                >
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
                      newCount={continueEntry.newCount}
                      learningCount={continueEntry.learningCount}
                      reviewCount={continueEntry.reviewCount}
                      label={
                        totalDue === 0
                          ? 'Nothing due today'
                          : resuming
                            ? 'Continue'
                            : 'Start session'
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
            ) : undefined
          }
          openFolder={openFolder}
          onOpenFolder={setOpenFolderId}
          collapsedFolders={collapsedFolders}
          onToggleFolder={toggleFolder}
          editingLayout={editingLayout}
          onNewFolder={() => {
            setFolderSheetMode('list');
            setFolderSheet(true);
          }}
          onToggleLayout={() => setEditingLayout((next) => !next)}
          onReorderFolder={(id, to) => void moveFolderTo(id, to)}
          onReorderDeck={(id, to) => void moveDeckTo(id, to)}
          onOpenDeck={(id) => pushOnce(router, `/deck/${id}`)}
          deckOptions={(deck) => (
            <ActionMenu
              label={`Options for deck ${deck.name}`}
              sheetTitle={deck.name}
              sheetSubtitle="Pinned decks stay above the others in their folder."
              actions={deckActions(deck)}
            />
          )}
          headerHeight={headerHeight}
          contentMaxWidth={contentMaxWidth}
        />
      )}

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
    </Screen>
  );
}
