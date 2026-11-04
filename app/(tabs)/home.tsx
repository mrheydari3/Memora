import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import { folderDeckCount } from '../../data/folders';
import type { Deck } from '../../data/types';
import {
  AppText,
  BottomSheetModal,
  DeckShelfSkeleton,
  EmptyState,
  Field,
  GlassCard,
  HeroSkeleton,
  IconButton,
  ListRow,
  PrimaryButton,
  RevealItem,
  Screen,
  SectionHeader,
  TopAppBar,
} from '../../components';
import { MaterialIcons } from '../../components/Icon';
import { DeckRoots, DeckRow, FolderRow, TodayHero } from '../../components/v2';
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

/**
 * Home — design v2, "Today first".
 *
 * The page answers "what do I study now?" before "what do I own?": the due
 * number is the h1 on the canvas, one primary action opens the session, and the
 * day's new/learning/review split sits underneath. The library is a shelf of
 * deck covers, filtered by the same folders the tree used.
 *
 * Every number is real: `buildStudyQueue` is the same helper the study session
 * uses, so the due count on the button is the number of cards the session will
 * actually show, daily caps included. The old tree, folder sheet, streak and
 * add-deck action are all still here.
 */
export default function HomeScreen() {
  const router = useRouter();

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const folders = useDeckStore((s) => s.folders);
  const addFolder = useDeckStore((s) => s.addFolder);
  const deleteFolder = useDeckStore((s) => s.deleteFolder);
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
  const [folderDraft, setFolderDraft] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

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
  const newTotal = useMemo(
    () => deckQueues.reduce((sum, entry) => sum + entry.newCount, 0),
    [deckQueues]
  );
  const learningTotal = useMemo(
    () => deckQueues.reduce((sum, entry) => sum + entry.learningCount, 0),
    [deckQueues]
  );
  const reviewTotal = useMemo(
    () => deckQueues.reduce((sum, entry) => sum + entry.reviewCount, 0),
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

  // A folder deleted from the sheet falls back to the root shelf instead of
  // hiding every deck.
  const openFolder = useMemo(
    () => (openFolderId ? folders.find((folder) => folder.id === openFolderId) ?? null : null),
    [openFolderId, folders]
  );

  // Folder rows carry what the folder itself is worth knowing: how many decks
  // it holds and how many cards those decks want today.
  const folderSummaries = useMemo(
    () =>
      folders.map((folder) => {
        const entries = deckQueues.filter((entry) => entry.deck.folderId === folder.id);
        return {
          id: folder.id,
          name: folder.name,
          decks: entries.length,
          due: entries.reduce((sum, entry) => sum + entry.total, 0),
        };
      }),
    [folders, deckQueues]
  );
  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders]
  );
  // Work first: a library that grows past a screen is only usable if the decks
  // that want attention sit on top, and the rest read alphabetically.
  const visibleDecks = useMemo(() => {
    const list = openFolder
      ? deckQueues.filter((entry) => entry.deck.folderId === openFolder.id)
      : deckQueues;
    return [...list].sort((a, b) => b.total - a.total || a.deck.name.localeCompare(b.deck.name));
  }, [deckQueues, openFolder]);

  const visibleCards = useMemo(
    () => visibleDecks.reduce((sum, entry) => sum + entry.cardCount, 0),
    [visibleDecks]
  );
  const visibleDue = useMemo(
    () => visibleDecks.reduce((sum, entry) => sum + entry.total, 0),
    [visibleDecks]
  );

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
          icon: 'add',
          accessibilityLabel: 'Add deck',
          onPress: () => pushOnce(router, '/add-deck'),
        },
      ]}
    />
  );

  // Folders and decks share one shelf, folders first: the containers read as
  // the way into a smaller list, and the decks below are the whole library.
  const shelfRows = [
    ...(openFolder
      ? []
      : folderSummaries.map((folder) => ({
          key: `folder-${folder.id}`,
          node: (
            <FolderRow
              name={folder.name}
              decks={folder.decks}
              due={folder.due}
              onPress={() => setOpenFolderId(folder.id)}
            />
          ),
        }))),
    ...visibleDecks.map((entry) => ({
      key: entry.deck.id,
      node: (
        <DeckRow
          name={entry.deck.name}
          icon={entry.deck.icon as IconName}
          color={entry.deck.color}
          cardCount={entry.cardCount}
          due={entry.total}
          // Inside the folder the name is already the heading, so the row
          // drops the repeated context line.
          folder={
            !openFolder && entry.deck.folderId
              ? folderNameById.get(entry.deck.folderId)
              : undefined
          }
          progress={entry.progress}
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
  const folderCountLabel = `${folders.length} ${
    folders.length === 1 ? 'folder' : 'folders'
  }`;
  const shelfCaption = [
    openFolder ? null : folderCountLabel,
    deckCountLabel,
    cardCountLabel,
    dueLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  const decksSection = (
    <View>
      {openFolder && (
        <Pressable
          onPress={() => setOpenFolderId(null)}
          accessibilityRole="button"
          accessibilityLabel="All decks"
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
            All decks
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
        {!openFolder && (
          <Pressable
            onPress={() => setFolderSheet(true)}
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
        )}
      </View>

      <AppText variant="caption" tone="muted" className="mt-1">
        {shelfCaption}
      </AppText>

      <View style={{ marginTop: v2.spacing.block }}>
        {shelfRows.length === 0 ? (
          <AppText variant="body" tone="muted">
            {openFolder
              ? 'This folder is empty. Move a deck in from the deck’s options.'
              : 'No decks yet.'}
          </AppText>
        ) : (
          // A new view measures its own rows: the branch positions and the
          // root tail belong to this list, not to the one before it.
          <DeckRoots key={openFolder?.id ?? 'root'} rows={shelfRows} />
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
          <GlassCard className="mt-6">
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
            <View style={{ maxWidth: v2.layout.heroMeasure }}>
              <TodayHero
                due={totalDue}
                deckCount={dueDecks}
                minutes={minutes}
                nextDeck={continueEntry.deck.name}
                newCount={newTotal}
                learningCount={learningTotal}
                reviewCount={reviewTotal}
                label={totalDue === 0 ? 'Nothing due today' : resuming ? 'Continue' : 'Start session'}
                disabled={totalDue === 0}
                onStart={() => pushOnce(router, `/study/${continueEntry.deck.id}`)}
              />
            </View>
          </RevealItem>

          <View style={{ marginTop: v2.spacing.section }}>
            <RevealItem index={1}>{decksSection}</RevealItem>
          </View>
        </View>
      ) : null}

      <BottomSheetModal
        visible={folderSheet}
        onClose={() => {
          setFolderSheet(false);
          setFolderError(null);
        }}
        title="Folders"
        subtitle="Group decks for browsing. Nothing is moved or copied."
      >
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
        {folderError && (
          <AppText variant="bodySm" tone="danger" className="mt-2">
            {folderError}
          </AppText>
        )}
        <View className="mt-3">
          <PrimaryButton
            label="Create folder"
            icon="create-new-folder"
            disabled={folderDraft.trim().length === 0}
            onPress={async () => {
              const result = await addFolder(folderDraft);
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
                const count = folderDeckCount(decks, folder.id);
                return (
                  <ListRow
                    key={folder.id}
                    title={folder.name}
                    subtitle={`${count} ${count === 1 ? 'deck' : 'decks'}`}
                    icon="folder"
                    tile="sm"
                    density="compact"
                    gutter={0}
                    showChevron={false}
                    trailing={
                      <IconButton
                        icon="delete-outline"
                        size="sm"
                        tone="danger"
                        accessibilityLabel={`Delete folder ${folder.name}`}
                        onPress={() => void deleteFolder(folder.id)}
                      />
                    }
                  />
                );
              })}
            </View>
          </View>
        )}
      </BottomSheetModal>
    </Screen>
  );
}
