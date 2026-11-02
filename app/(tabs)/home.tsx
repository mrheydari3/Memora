import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import { folderDeckCount } from '../../data/folders';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  SectionHeader,
  PrimaryButton,
  EmptyState,
  RevealItem,
  HeroSkeleton,
  DeckShelfSkeleton,
  ProgressRail,
  DeckLibrary,
  BottomSheetModal,
  Field,
  ListRow,
  IconButton,
} from '../../components';
import { alpha, colors, heights, iconSize, spacing } from '../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  // Subscribing to the card map keeps the due counts live after a session or
  // when cards are added/deleted; reading it via getState() made them stale.
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const folders = useDeckStore((s) => s.folders);
  const addFolder = useDeckStore((s) => s.addFolder);
  const deleteFolder = useDeckStore((s) => s.deleteFolder);

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
  const streak = useMemo(() => computeStreak(reviewLog.map((e) => e.reviewedAt)), [reviewLog]);

  // One queue per active deck, using the same helper as the study session so
  // the numbers agree with what the session will actually show. Progress is
  // the share of cards that have been studied at least once.
  const deckQueues = useMemo(
    () =>
      decks
        .filter((deck) => !deck.archivedAt)
        .map((deck) => {
          const cards = cardsByDeck[deck.id] ?? [];
          const studied = cards.reduce(
            (count, card) => count + (card.fsrs.last_review != null ? 1 : 0),
            0
          );
          return {
            deck,
            cardCount: cards.length,
            total: buildStudyQueue(deck, cards, reviewLog).total,
            progress: cards.length > 0 ? studied / cards.length : 0,
          };
        }),
    [decks, cardsByDeck, reviewLog]
  );

  const lastStudiedDeckId = useMemo(() => {
    let latest: { deckId: string; reviewedAt: number } | null = null;
    for (const entry of reviewLog) {
      if (!latest || entry.reviewedAt > latest.reviewedAt) latest = entry;
    }
    return latest?.deckId ?? null;
  }, [reviewLog]);

  const lastStudiedEntry = deckQueues.find((entry) => entry.deck.id === lastStudiedDeckId);
  // Prefer the deck the learner left off in, but never point the hero at a
  // caught-up deck while another one still has cards waiting.
  const continueEntry =
    (lastStudiedEntry && lastStudiedEntry.total > 0 ? lastStudiedEntry : undefined) ??
    deckQueues.find((entry) => entry.total > 0) ??
    lastStudiedEntry ??
    deckQueues[0];
  const resuming = Boolean(lastStudiedEntry && continueEntry?.deck.id === lastStudiedEntry.deck.id);
  const continueDue = continueEntry?.total ?? 0;
  const continuePercent = continueEntry ? Math.round(continueEntry.progress * 100) : 0;
  const continuePercentLabel =
    continueEntry && continueEntry.progress > 0 && continuePercent === 0
      ? '<1%'
      : `${continuePercent}%`;

  return (
    <Screen
      scroll
      gutter
      tabClearance
      header={
        <TopAppBar
          leftContent={
            <View className="flex-1 flex-row items-center gap-2 pl-1">
              <View
                className="items-center justify-center rounded-md"
                style={{
                  width: heights.icon,
                  height: heights.icon,
                  backgroundColor: colors.accentSoft,
                }}
              >
                <MaterialIcons name="blur-on" size={iconSize.md} color={colors.primary} />
              </View>
              <AppText variant="bodyLg" weight="semibold">
                Memora
              </AppText>
            </View>
          }
          actions={[
            {
              icon: 'create-new-folder',
              accessibilityLabel: 'Add deck',
              onPress: () => pushOnce(router, '/add-deck'),
            },
          ]}
        />
      }
    >
      <RevealItem index={0}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <AppText variant="caption" weight="semibold" tone="muted" className="uppercase">
              Your library
            </AppText>
            <AppText variant="title" className="mt-1" headingLevel={1}>
              Good to see you.
            </AppText>
          </View>
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: alpha(colors.warning, 0.12) }}
          >
            <MaterialIcons
              name="local-fire-department"
              size={iconSize.sm}
              color={streak > 0 ? colors.warning : colors.outline}
            />
            <AppText variant="bodySm" weight="semibold">
              {streak}
            </AppText>
            <AppText variant="caption" weight="medium" tone="muted">
              {streak === 1 ? 'day' : 'days'}
            </AppText>
          </View>
        </View>
      </RevealItem>

      {!ready ? (
        <RevealItem index={1}>
          <View className="mt-6">
            <HeroSkeleton />
          </View>
        </RevealItem>
      ) : !continueEntry ? (
        <RevealItem index={1}>
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
      ) : (
        <RevealItem index={1}>
          <GlassCard tone="accent" className="mt-6">
            <View className="flex-row items-center">
              <View
                className="items-center justify-center rounded-md"
                style={{
                  width: heights.tileLg,
                  height: heights.tileLg,
                  backgroundColor: alpha(continueEntry.deck.color, 0.16),
                }}
              >
                <MaterialIcons
                  name={continueEntry.deck.icon as React.ComponentProps<typeof MaterialIcons>['name']}
                  size={iconSize.lg}
                  color={continueEntry.deck.color}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  variant="caption"
                  weight="semibold"
                  tone="accent"
                  className="uppercase"
                >
                  {continueDue === 0 ? 'All caught up' : resuming ? 'Continue' : 'Up next'}
                </AppText>
                <AppText
                  variant="title"
                  className="mt-0.5"
                  numberOfLines={2}
                  headingLevel={2}
                >
                  {continueEntry.deck.name}
                </AppText>
              </View>
            </View>

            <AppText variant="bodySm" tone="muted" className="mt-3">
              {continueDue > 0
                ? `${continueDue} ${continueDue === 1 ? 'card' : 'cards'} due today`
                : 'Nothing due — you are all caught up'}
            </AppText>

            <View className="mt-4">
              <View className="mb-2 flex-row items-center justify-between">
                <AppText variant="caption" weight="medium" tone="muted">
                  {continueEntry.cardCount}{' '}
                  {continueEntry.cardCount === 1 ? 'card' : 'cards'}
                </AppText>
                <AppText variant="caption" weight="semibold" tone="accent">
                  {continuePercentLabel} studied
                </AppText>
              </View>
              <ProgressRail value={continueEntry.progress} />
            </View>

            <PrimaryButton
              className="mt-5"
              label={
                continueDue > 0 ? (resuming ? 'Continue' : 'Start session') : 'Nothing due today'
              }
              icon={continueDue > 0 ? 'play-arrow' : undefined}
              disabled={continueDue === 0}
              onPress={() => pushOnce(router, `/study/${continueEntry.deck.id}`)}
            />
          </GlassCard>
        </RevealItem>
      )}

      {!ready ? (
        <RevealItem index={2}>
          <SectionHeader className="mt-8" label="My decks" />
          <View className="mt-3">
            <DeckShelfSkeleton count={2} />
          </View>
        </RevealItem>
      ) : deckQueues.length > 0 ? (
        <RevealItem index={2}>
          <SectionHeader
            className="mt-8"
            label="My decks"
            // A bare "1" next to the label read as a step number; the unit makes it
            // a count at a glance.
            hint={`${deckQueues.length} ${deckQueues.length === 1 ? 'deck' : 'decks'}`}
            action={{ label: 'Folders', icon: 'folder', onPress: () => setFolderSheet(true) }}
          />

          {/* One box, folders as headers, decks nested underneath. */}
          <View className="mt-3">
            <DeckLibrary
              folders={folders}
              entries={deckQueues.map(({ deck, cardCount, total, progress }) => ({
                deck,
                cardCount,
                due: total,
                progress,
              }))}
              onOpenDeck={(deckId) => pushOnce(router, `/deck/${deckId}`)}
            />
          </View>
        </RevealItem>
      ) : null}

      {/* Folders: create, see how many decks each holds, delete. */}
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
          <View className="mt-5">
            <AppText variant="label" tone="muted" className="uppercase">
              Your folders
            </AppText>
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
