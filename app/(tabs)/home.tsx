import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import {
  childFolders,
  folderDescendantIds,
  folderPath,
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
  GlassCard,
  HeroSkeleton,
  IconButton,
  ListRow,
  PrimaryButton,
  RevealItem,
  Screen,
  SectionHeader,
  SheetScrollView,
  TopAppBar,
} from '../../components';
import { MaterialIcons } from '../../components/Icon';
import { DeckRow, FolderRow, TodayHero } from '../../components/v2';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckQueue = {
  deck: Deck;
  cardCount: number;
  total: number;
  /** Studied share, 0–1. */
  progress: number;
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
  decks: number;
  due: number;
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

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const folders = useDeckStore((s) => s.folders);
  const addFolder = useDeckStore((s) => s.addFolder);
  const updateFolder = useDeckStore((s) => s.updateFolder);
  const deleteFolder = useDeckStore((s) => s.deleteFolder);
  const toggleFolderPinned = useDeckStore((s) => s.toggleFolderPinned);
  const moveFolder = useDeckStore((s) => s.moveFolder);
  const toggleDeckPinned = useDeckStore((s) => s.toggleDeckPinned);
  const moveDeck = useDeckStore((s) => s.moveDeck);
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
  const [deckMenuId, setDeckMenuId] = useState<string | null>(null);

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

  // Folder rows carry what the folder itself is worth knowing: how many decks
  // it holds directly and how many cards those decks want today.
  const summaryById = useMemo(() => {
    const map = new Map<string, FolderSummary>();
    for (const folder of folders) {
      const entries = deckQueues.filter((entry) => entry.deck.folderId === folder.id);
      map.set(folder.id, {
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        pinnedAt: folder.pinnedAt,
        decks: entries.length,
        due: entries.reduce((sum, entry) => sum + entry.total, 0),
      });
    }
    return map;
  }, [folders, deckQueues]);

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

  const visibleCards = useMemo(
    () => visibleDecks.reduce((sum, entry) => sum + entry.cardCount, 0),
    [visibleDecks]
  );
  const visibleDue = useMemo(
    () => visibleDecks.reduce((sum, entry) => sum + entry.total, 0),
    [visibleDecks]
  );

  const editingFolder = editingFolderId
    ? folders.find((folder) => folder.id === editingFolderId) ?? null
    : null;
  const menuDeck = deckMenuId ? decks.find((deck) => deck.id === deckMenuId) ?? null : null;

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
    <TopAppBar
      leftContent={
        <View className="flex-1 flex-row items-center" style={{ gap: 8, paddingStart: 8 }}>
          <MaterialIcons name="blur-on" size={iconSize.lg} color={colors.primary} />
          <AppText variant="bodyLg" weight="semibold">
            Memora
          </AppText>
        </View>
      }
      rightContent={
        <View className="flex-row items-center" style={{ gap: 6, marginEnd: 6 }}>
          <MaterialIcons
            name="local-fire-department"
            size={iconSize.sm}
            color={streak > 0 ? colors.warning : colors.outline}
          />
          <AppText variant="bodySm" weight="semibold">
            {streak}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {streak === 1 ? 'day' : 'days'}
          </AppText>
        </View>
      }
      actions={[
        {
          icon: 'explore',
          accessibilityLabel: 'Discover',
          onPress: () => pushOnce(router, '/discover'),
        },
        {
          icon: 'add',
          accessibilityLabel: 'Add deck',
          onPress: () => pushOnce(router, '/add-deck'),
        },
      ]}
    />
  );

  // Folders and decks share one shelf, folders first: the containers read as
  // the way into a smaller list, and the decks below are this level's own.
  const shelfRows = [
    ...visibleFolders.map((folder) => ({
      key: `folder-${folder.id}`,
      node: (
        <FolderRow
          name={folder.name}
          icon={folder.icon}
          color={folder.color}
          pinned={folder.pinnedAt != null}
          decks={folder.decks}
          due={folder.due}
          onOptions={() => openFolderEditor(folder.id)}
          onPress={() => setOpenFolderId(folder.id)}
        />
      ),
    })),
    ...visibleDecks.map((entry) => ({
      key: entry.deck.id,
      node: (
        <DeckRow
          name={entry.deck.name}
          icon={entry.deck.icon as IconName}
          color={entry.deck.color}
          cardCount={entry.cardCount}
          due={entry.total}
          progress={entry.progress}
          pinned={entry.deck.pinnedAt != null}
          onOptions={() => setDeckMenuId(entry.deck.id)}
          onPress={() => pushOnce(router, `/deck/${entry.deck.id}`)}
        />
      ),
    })),
  ];

  const deckCountLabel = `${visibleDecks.length} ${
    visibleDecks.length === 1 ? 'deck' : 'decks'
  }`;
  const cardCountLabel = `${visibleCards.toLocaleString('en-US')} ${
    visibleCards === 1 ? 'card' : 'cards'
  }`;
  const dueLabel = visibleDue > 0 ? `${visibleDue} due` : 'all caught up';
  const folderCountLabel = `${visibleFolders.length} ${
    visibleFolders.length === 1 ? 'folder' : 'folders'
  }`;
  const shelfCaption = [folderCountLabel, deckCountLabel, cardCountLabel, dueLabel].join(' · ');

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

      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <AppText
          variant="title"
          headingLevel={2}
          style={[v2.type.title, { flexShrink: 1 }]}
          numberOfLines={1}
        >
          {openFolder ? openFolder.name : 'Your decks'}
        </AppText>
        <Pressable
          onPress={() => {
            setFolderSheetMode('list');
            setFolderSheet(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Manage folders"
          style={{
            minHeight: heights.hit,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <MaterialIcons name="folder" size={iconSize.md} color={colors.primary} />
          <AppText variant="bodySm" weight="semibold" tone="accent">
            Folders
          </AppText>
        </Pressable>
      </View>

      <AppText variant="caption" tone="muted" className="mt-1">
        {shelfCaption}
      </AppText>

      {/* The shelf is one rule and a list. The hairline separates the section's
          numbers from the things they count; the rows below it are the library
          itself, with no drawing between them. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.hairlineStrong,
          marginTop: v2.spacing.block,
        }}
      />

      <View style={{ marginTop: v2.spacing.card, gap: v2.spacing.card }}>
        {shelfRows.length === 0 ? (
          <AppText variant="body" tone="muted">
            {openFolder
              ? 'This folder is empty. Move a deck in from the deck’s options, or add a folder.'
              : 'No decks yet.'}
          </AppText>
        ) : (
          shelfRows.map((row) => <View key={row.key}>{row.node}</View>)
        )}
      </View>
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={header}
    >
      {!ready ? (
        <>
          <RevealItem index={0}>
            <View style={{ marginTop: v2.spacing.section }}>
              <HeroSkeleton />
            </View>
          </RevealItem>
          <RevealItem index={1}>
            <View style={{ marginTop: v2.spacing.section }}>
              <DeckShelfSkeleton count={2} />
            </View>
          </RevealItem>
        </>
      ) : deckQueues.length === 0 ? (
        <RevealItem index={0}>
          <GlassCard>
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
          </GlassCard>
        </RevealItem>
      ) : continueEntry ? (
        <View>
          <RevealItem index={0}>
              <TodayHero
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
                label={totalDue === 0 ? 'Nothing due today' : resuming ? 'Continue' : 'Start session'}
                disabled={totalDue === 0}
                onStart={() => pushOnce(router, `/study/${continueEntry.deck.id}`)}
              />
          </RevealItem>

          <View style={{ marginTop: v2.spacing.section }}>
            <RevealItem index={1}>{decksSection}</RevealItem>
          </View>
        </View>
      ) : null}

      <BottomSheetModal
        visible={folderSheet}
        onClose={closeFolders}
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
          style={{ maxHeight: heights.sheetTall }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {folderSheetMode === 'list' && (
            <View>
              <Field
                label="New folder"
                value={folderDraft}
                onChangeText={(text) => {
                  setFolderDraft(text);
                  setFolderError(null);
                }}
                placeholder="e.g. German A2"
                maxLength={40}
              />
              <AppText variant="caption" tone="muted" className="mt-1.5">
                {openFolder ? `Creates inside ${openFolder.name}.` : 'Creates on the top level.'}
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

              {folders.length > 0 && (
                <View className="mt-6">
                  <SectionHeader
                    label="Your folders"
                    hint={`${folders.length}`}
                    className="px-0"
                  />
                  <View className="mt-2">
                    {folders.map((folder) => {
                      const summary = summaryById.get(folder.id);
                      const trail = folderPath(folders, folder.id)
                        .map((entry) => entry.name)
                        .join(' / ');
                      const count = summary?.decks ?? 0;
                      return (
                        <ListRow
                          key={folder.id}
                          title={folder.name}
                          subtitle={`${trail === folder.name ? '' : `${trail} · `}${count} ${
                            count === 1 ? 'deck' : 'decks'
                          }`}
                          icon={(folder.icon ?? FOLDER_DEFAULT_ICON) as IconName}
                          iconTone={folder.color ? 'deck' : 'neutral'}
                          deckColor={folder.color}
                          tile="sm"
                          density="compact"
                          gutter={0}
                          showChevron={false}
                          trailing={
                            <IconButton
                              icon="more-vert"
                              size="sm"
                              accessibilityLabel={`Options for folder ${folder.name}`}
                              onPress={() => openFolderEditor(folder.id)}
                            />
                          }
                        />
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {folderSheetMode === 'edit' && editingFolder && (
            <View>
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
          )}

          {folderSheetMode === 'location' && editingFolder && (
            <View>
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

      <BottomSheetModal
        visible={Boolean(menuDeck)}
        onClose={() => setDeckMenuId(null)}
        title={menuDeck?.name ?? 'Deck'}
        subtitle="Pinned decks stay above the others in their folder."
      >
        {menuDeck && (
          <View>
            <ListRow
              title={menuDeck.pinnedAt ? 'Unpin deck' : 'Pin deck'}
              subtitle={
                menuDeck.pinnedAt
                  ? 'Return it to the normal order'
                  : 'Keep it at the top of this folder'
              }
              icon="push-pin"
              iconTone={menuDeck.pinnedAt ? 'accent' : 'neutral'}
              tile="sm"
              density="compact"
              gutter={0}
              showChevron={false}
              onPress={() => void toggleDeckPinned(menuDeck.id)}
            />
            <ListRow
              title="Move up"
              icon="arrow-upward"
              tile="sm"
              density="compact"
              gutter={0}
              showChevron={false}
              onPress={() => void moveDeck(menuDeck.id, -1)}
            />
            <ListRow
              title="Move down"
              icon="arrow-downward"
              tile="sm"
              density="compact"
              gutter={0}
              showChevron={false}
              onPress={() => void moveDeck(menuDeck.id, 1)}
            />
          </View>
        )}
      </BottomSheetModal>
    </Screen>
  );
}
