import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildLibraryIndex } from '../../data/library';
import { computeStreak } from '../../data/streak';
import { estimateSessionMinutes } from '../../data/session';
import { FOLDER_DEFAULT_ICON } from '../../data/appearance';
import type { Deck } from '../../data/types';
import { Menu } from '../../components/menu/Menu';
import type { AnchorRect } from '../../components/menu/types';
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
  TodayPlanSheet,
} from '../../components/v3';
import type { FieldInputRef } from '../../components/Field';
import { colors, heights, radii, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { useToday } from '../../hooks/useToday';
import { useFolderTransitions } from '../../hooks/useFolderTransitions';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** The two bodies the Folders sheet can show. */
type FolderSheetMode = 'list' | 'edit';

/**
 * Home — "Today first", with a folder-first library.
 *
 * The page answers "what do I study now?" before "what do I own?": the day
 * label ("Today") is the h1 and the due number is the canvas's one display-sized
 * element, one primary action opens the session, and the day's new/learning/
 * review split sits underneath. The library is one flat shelf: every folder is
 * a peer, and a folder opens only onto the decks filed in it.
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
  const compactHeader = width < 360;
  const contentMaxWidth = desktop ? v3.layout.homeDesktopMaxWidth : v3.layout.contentMaxWidth;
  const folderSheetBodyMaxHeight = desktop
    ? Math.max(320, Math.min(620, height - 240))
    : heights.sheetTall;

  // Derive the day from a clock that refreshes on midnight, foreground and
  // focus. A render-only Date.now() froze due counts until an unrelated store
  // update re-rendered Home.
  const now = useToday();
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
  // unfiles its decks, so neither can touch a card or a review.
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
  const [editError, setEditError] = useState<string | null>(null);
  const {
    collapsed: collapsedFolders,
    opening: openingFolders,
    closing: closingFolders,
    toggle: toggleFolder,
  } = useFolderTransitions();
  const [editingLayout, setEditingLayout] = useState(false);
  // The deck menu lives at screen level, not in the row: Pin/Move reorder the
  // shelf, and a menu owned by a row that changes position would unmount with
  // it, closing between two repeatable operations.
  const [deckMenu, setDeckMenu] = useState<{ deckId: string; anchor: AnchorRect } | null>(null);
  const [planSheet, setPlanSheet] = useState(false);
  const [createMenu, setCreateMenu] = useState(false);
  // The selected plan deck is local UI state. It never changes a queue, a card
  // or the review log; the hero simply opens the deck the learner chose.
  const [plannedDeckId, setPlannedDeckId] = useState<string | null>(null);
  const folderDraftRef = useRef<FieldInputRef>(null);
  const createMenuAnchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const createMenuTriggerRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const pendingCreateRef = useRef<'deck' | 'folder' | null>(null);

  // One index per data change: review buckets, queue summaries, folder
  // aggregates, paths and children. The board and the sheet read the same maps,
  // so a count cannot disagree with the row it describes.
  const library = useMemo(
    () => buildLibraryIndex(decks, folders, cardsByDeck, reviewLog, { now }),
    [decks, folders, cardsByDeck, reviewLog, now]
  );
  const deckQueues = library.entries;
  const activeDeckIds = useMemo(
    () => new Set(deckQueues.map((entry) => entry.deck.id)),
    [deckQueues]
  );

  const streak = useMemo(
    () =>
      computeStreak(
        reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)).map((e) => e.reviewedAt),
        now
      ),
    [reviewLog, activeDeckIds, now]
  );

  const totalDue = library.totals.due;
  const dueDecks = library.totals.dueDecks;
  const minutes = estimateSessionMinutes(totalDue);
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
  const dueEntries = deckQueues.filter((entry) => entry.total > 0);
  // Until the learner makes a choice, the existing last-studied preference is
  // the plan. A stale choice falls back to that same preference rather than
  // leaving the hero on a deck that no longer has work.
  const plannedEntry =
    dueEntries.find((entry) => entry.deck.id === plannedDeckId) ?? continueEntry;
  const resuming = Boolean(lastStudiedEntry && plannedEntry?.deck.id === lastStudiedEntry.deck.id);

  // A folder deleted from the sheet falls back to the flat list instead of
  // hiding the level it was on.
  const openFolder = useMemo(
    () => (openFolderId ? folders.find((folder) => folder.id === openFolderId) ?? null : null),
    [openFolderId, folders]
  );

  const editingFolder = editingFolderId
    ? folders.find((folder) => folder.id === editingFolderId) ?? null
    : null;

  const closeFolders = () => {
    setFolderSheet(false);
    setFolderSheetMode('list');
    setEditingFolderId(null);
    setFolderError(null);
    setEditError(null);
    // Closing discards the new-folder draft. Reopening the sheet must start
    // clean instead of resurrecting a name, icon and colour that were
    // abandoned — those fields were previously reset only after a successful
    // create, so a cancelled draft came back on the next open.
    setFolderDraft('');
    setFolderIcon(FOLDER_DEFAULT_ICON);
    setFolderColor(COLOR_CHOICES[0]);
  };

  const openFolderEditor = (id: string) => {
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) return;
    setFolderSheet(true);
    setEditingFolderId(id);
    setEditName(folder.name);
    setEditIcon(folder.icon ?? FOLDER_DEFAULT_ICON);
    setEditColor(folder.color ?? COLOR_CHOICES[0]);
    setEditError(null);
    setFolderSheetMode('edit');
  };

  const focusCreateTrigger = () => {
    (
      createMenuTriggerRef.current as unknown as { focus?: () => void } | null
    )?.focus?.();
  };

  const openNewFolder = () => {
    setFolderSheetMode('list');
    setFolderSheet(true);
  };

  const runPendingCreate = () => {
    const action = pendingCreateRef.current;
    if (!action) return;
    pendingCreateRef.current = null;
    focusCreateTrigger();
    if (action === 'deck') pushOnce(router, '/add-deck');
    else openNewFolder();
  };

  const saveFolderEditor = async () => {
    if (!editingFolder) return;
    const result = await updateFolder(editingFolder.id, {
      name: editName,
      icon: editIcon,
      color: editColor,
    });
    if (!result.ok) {
      setEditError(
        result.error === 'duplicate'
          ? 'A folder with that name already exists.'
          : 'Give the folder a name.'
      );
      return;
    }
    setFolderSheetMode('list');
  };

  const createActions: MenuAction[] = [
    {
      key: 'new-deck',
      label: 'New deck',
      description: 'Build a deck from scratch.',
      icon: 'library-books',
      onPress: () => {
        pendingCreateRef.current = 'deck';
        setCreateMenu(false);
      },
    },
    {
      key: 'new-folder',
      label: 'New folder',
      description: 'Group decks on your shelf.',
      icon: 'create-new-folder',
      onPress: () => {
        pendingCreateRef.current = 'folder';
        setCreateMenu(false);
      },
    },
  ];

  const header = (
    <PageHeader
      brand
      maxWidth={contentMaxWidth}
      meta={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: compactHeader ? 3 : 5,
            minHeight: 30,
            justifyContent: 'center',
            paddingHorizontal: compactHeader ? 3 : 10,
            borderRadius: 999,
            backgroundColor: colors.surfaceInset,
          }}
          accessible
          accessibilityLabel={`${streak}-day streak`}
        >
          <MaterialIcons
            name="local-fire-department"
            size={compactHeader ? 13 : 16}
            color={streak > 0 ? colors.warning : colors.outline}
          />
          <AppText variant="caption" weight="semibold" tone={streak > 0 ? 'warning' : 'muted'}>
            {streak}d
          </AppText>
        </View>
      }
      actions={
        <>
          <HeaderIcon
            icon="explore"
            label="Discover"
            raised
            onPress={() => pushOnce(router, '/discover')}
          />
          <View ref={createMenuAnchorRef} collapsable={false}>
            <HeaderIcon
              icon="add"
              label="Create new"
              controlRef={createMenuTriggerRef}
              emphasized
              ariaExpanded={createMenu}
              ariaHasPopup="menu"
              onPress={() => setCreateMenu(true)}
            />
          </View>
        </>
      }
    />
  );

  const deckMenuDeck = deckMenu
    ? decks.find((deck) => deck.id === deckMenu.deckId) ?? null
    : null;

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
            const count = library.aggregates.get(folder.id)?.decks ?? 0;
            const meta = `${count} ${count === 1 ? 'deck' : 'decks'}`;
            return (
              <View
                key={folder.id}
                style={{
                  minHeight: v3.heights.folderSheetRow,
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

  // Screen already offsets the body by the floating bar, so these scroll
  // views open one gutter below it rather than a whole bar below it.
  const scrollContentStyle = {
    paddingTop: spacing.screen,
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
      animateHeader
      contentMaxWidth={contentMaxWidth}
      header={header}
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
      ) : deckQueues.length === 0 && archivedDecks.length === 0 && folders.length === 0 ? (
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
        <>
          <LibraryBoard
          library={library}
          folders={folders}
          hero={
            plannedEntry ? (
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
                      nextDeck={plannedEntry.deck.name}
                      newCount={plannedEntry.newCount}
                      learningCount={plannedEntry.learningCount}
                      reviewCount={plannedEntry.reviewCount}
                      label={
                        totalDue === 0
                          ? 'Nothing due today'
                          : resuming
                            ? 'Continue'
                            : 'Start session'
                      }
                      disabled={totalDue === 0}
                      onStart={() => pushOnce(router, `/study/${plannedEntry.deck.id}`)}
                      onOpenPlan={() => setPlanSheet(true)}
                      planOpen={planSheet}
                      now={now}
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
          openingFolders={openingFolders}
          closingFolders={closingFolders}
          onToggleFolder={toggleFolder}
          editingLayout={editingLayout}
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
              expanded={deckMenu?.deckId === deck.id}
              onOpen={(anchor) => setDeckMenu({ deckId: deck.id, anchor })}
            />
          )}
          contentMaxWidth={contentMaxWidth}
        />
        <Menu
          open={deckMenuDeck != null}
          onClose={() => setDeckMenu(null)}
          anchorRect={deckMenu?.anchor ?? null}
          label={deckMenuDeck ? `Options for deck ${deckMenuDeck.name}` : 'Deck options'}
          title={deckMenuDeck?.name ?? 'Deck options'}
          subtitle="Pinned decks stay above the others in their folder."
          actions={deckMenuDeck ? deckActions(deckMenuDeck) : []}
        />
        <TodayPlanSheet
          visible={planSheet}
          onClose={() => setPlanSheet(false)}
          entries={dueEntries}
          selectedDeckId={plannedEntry?.deck.id ?? null}
          onSelectDeck={(deckId) => {
            setPlannedDeckId(deckId);
            setPlanSheet(false);
          }}
          desktop={desktop}
        />
        </>
      )}

      <Menu
        open={createMenu}
        onClose={() => setCreateMenu(false)}
        onAfterClose={runPendingCreate}
        anchorRef={createMenuAnchorRef}
        label="Create new"
        title="Create new"
        subtitle="Start a deck or group decks in a folder."
        actions={createActions}
      />

      <BottomSheetModal
        visible={folderSheet}
        onClose={closeFolders}
        desktopLayout={desktop}
        focusKey={`${folderSheetMode}-${editingFolderId ?? 'list'}`}
        title={
          folderSheetMode === 'edit' ? 'Edit folder' : 'Folders'
        }
        subtitle={
          folderSheetMode === 'edit'
            ? 'Rename it, or pick its icon and colour.'
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
                  Creates on the top level, next to your other folders.
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
                    subtitle="Its decks become unfiled; nothing is deleted"
                    icon="delete-outline"
                    tile="sm"
                    density="compact"
                    gutter={0}
                    showChevron={false}
                    destructive
                    onPress={() => {
                      if (openFolderId === editingFolder.id) {
                        setOpenFolderId(null);
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

        </SheetScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
