import { useEffect, useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { pushOnce } from '../../services/navigation';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable, type QuizMode } from '../../data/quiz';
import { folderPath } from '../../data/folders';
import {
  AppText,
  EmptyState,
  GlassCard,
  ListRow,
  Pill,
  RevealItem,
  Screen,
  SectionHeader,
  SegmentedControl,
  TopAppBar,
} from '../../components';
import { StartButton } from '../../components/v2';
import { alpha, colors, fills, heights, iconSize, radii } from '../../theme/tokens';
import { v2 } from '../../theme/v2';
import type { Deck, GameRecord } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** 1811 → "1,811" without depending on Intl. */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

type GameDeckRowProps = {
  deck: Deck;
  cards: number;
  due: number;
  folder?: string;
  pinned: boolean;
  bestScore?: number;
  selected: boolean;
  onPress: () => void;
};

/**
 * One playable deck in the picker. It uses the app's one row shape, keeps the
 * deck's own colour on its tile, and shows the two things a player chooses
 * between: what is waiting (due) and how they did before (best).
 *
 * The selected row is a filled inset, not an outlined one, and carries
 * `aria-pressed` so a screen reader hears the choice.
 */
function GameDeckRow({
  deck,
  cards,
  due,
  folder,
  pinned,
  bestScore,
  selected,
  onPress,
}: GameDeckRowProps) {
  const context = [
    pinned ? 'Pinned' : null,
    `${formatCount(cards)} cards`,
    `${due} due`,
    folder,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListRow
      title={deck.name}
      titleLines={2}
      subtitle={context}
      icon={deck.icon as IconName}
      iconTone="deck"
      deckColor={deck.color}
      density="tall"
      gutter={8}
      highlighted={selected}
      selected={selected}
      showChevron={false}
      style={{ borderRadius: radii.control }}
      onPress={onPress}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {bestScore ? (
            <Pill label={`Best ${formatCount(bestScore)}`} tone={selected ? 'accent' : 'neutral'} />
          ) : (
            <AppText variant="caption" tone="muted">
              No best
            </AppText>
          )}
          {selected && (
            <MaterialIcons name="check-circle" size={iconSize.sm} color={colors.primary} />
          )}
        </View>
      }
    />
  );
}

/**
 * Game — the 60-second quiz lobby.
 *
 * One place to start a round: the clock's hero, the playable-deck picker, the
 * records the game already keeps, and the three rules. The round itself lives
 * in /quiz/[deckId]; nothing is written from this screen.
 *
 * The picker now reads the library the way Home does: pinned decks first, then
 * the ones with the most waiting, each row naming the folder it lives in.
 */
export default function GameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const decks = useDeckStore((s) => s.decks);
  const folders = useDeckStore((s) => s.folders);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const deckLoaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const records = useGameStore((s) => s.records);
  const gamesLoaded = useGameStore((s) => s.loaded);
  const [quizDeckId, setQuizDeckId] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode>('forward');

  useEffect(() => {
    if (!deckLoaded) useDeckStore.getState().load();
    if (!reviewLoaded) useReviewStore.getState().load();
    if (!gamesLoaded) useGameStore.getState().load();
  }, [deckLoaded, reviewLoaded, gamesLoaded]);

  const folderLabel = (deck: Deck): string | undefined => {
    if (!deck.folderId) return undefined;
    const trail = folderPath(folders, deck.folderId);
    return trail.length ? trail.map((folder) => folder.name).join(' / ') : undefined;
  };

  const playableDecks = useMemo(
    () =>
      decks
        .filter((deck) => !deck.archivedAt && isDeckPlayable(cardsByDeck[deck.id] ?? [], mode))
        .map((deck) => {
          const cards = cardsByDeck[deck.id] ?? [];
          return {
            deck,
            cards: cards.length,
            due: buildStudyQueue(deck, cards, reviewLog).total,
            folder: folderLabel(deck),
            pinned: deck.pinnedAt != null,
            record: records[deck.id],
          };
        })
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.due - a.due ||
            a.deck.name.localeCompare(b.deck.name)
        ),
    // folderLabel reads folders; keep it in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decks, cardsByDeck, reviewLog, records, folders, mode]
  );

  useEffect(() => {
    if (playableDecks.length === 0) {
      if (quizDeckId !== null) setQuizDeckId(null);
      return;
    }
    if (!quizDeckId || !playableDecks.some((entry) => entry.deck.id === quizDeckId)) {
      setQuizDeckId(playableDecks[0].deck.id);
    }
  }, [playableDecks, quizDeckId]);

  const selected = playableDecks.find((entry) => entry.deck.id === quizDeckId) ?? null;
  const selectedRecord = selected ? records[selected.deck.id] : undefined;

  const recordRows = useMemo(
    () =>
      Object.values(records)
        .map((record) => ({
          record,
          deck: decks.find((entry) => entry.id === record.deckId),
        }))
        .filter((entry): entry is { record: GameRecord; deck: Deck } => Boolean(entry.deck))
        .sort((a, b) => b.record.bestScore - a.record.bestScore)
        .slice(0, 3),
    [records, decks]
  );

  const play = () => {
    if (!quizDeckId) return;
    pushOnce(router, mode === 'reverse' ? `/quiz/${quizDeckId}?mode=reverse` : `/quiz/${quizDeckId}`);
  };

  const header = (
    <TopAppBar
      title="Game"
      actions={[
        {
          icon: 'add',
          accessibilityLabel: 'Add deck',
          onPress: () => pushOnce(router, '/add-deck'),
        },
        {
          icon: 'settings',
          accessibilityLabel: 'Settings',
          onPress: () => pushOnce(router, '/settings'),
        },
      ]}
    />
  );

  if (playableDecks.length === 0) {
    return (
      <Screen
        scroll
        gutter
        tabClearance
        contentMaxWidth={v2.layout.contentMaxWidth}
        header={header}
      >
        <View>
          <GlassCard>
            <EmptyState
              icon="sports-esports"
              title="Not enough cards"
              titleVariant="headline"
              description={
                mode === 'reverse'
                  ? 'Reverse needs four cards with distinct words to choose from. Add a few more cards to a deck to unlock the arena.'
                  : 'The quiz needs four cards with distinct meanings to choose from. Add a few more cards to a deck to unlock the arena.'
              }
              action={
                <StartButton label="Add a deck" onPress={() => pushOnce(router, '/add-deck')} />
              }
            />
          </GlassCard>
        </View>
      </Screen>
    );
  }

  const hero = (
    <GlassCard tone="accent">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Quiz · 60 seconds
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 10, marginTop: 2 }}>
            <AppText
              variant="display"
              headingLevel={1}
              style={v2.type.display}
              accessibilityLabel="60 seconds"
            >
              60
            </AppText>
            <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 9 }}>
              seconds
            </AppText>
          </View>
          <AppText variant="headline" style={{ marginTop: 2 }}>
            Beat the clock.
          </AppText>
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 6 }}>
            Four choices per card. Right answers buy time; a streak multiplies the score.
          </AppText>
        </View>

        <View
          style={{
            width: heights.tileLg,
            height: heights.tileLg,
            borderRadius: radii.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accentFaint,
          }}
        >
          <MaterialIcons name="sports-esports" size={iconSize.lg} color={colors.primary} />
        </View>
      </View>

      {selected && (
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: radii.control,
            backgroundColor: fills.inset,
            padding: 10,
          }}
        >
          <View
            style={{
              width: heights.tile,
              height: heights.tile,
              borderRadius: radii.micro,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(selected.deck.color, 0.16),
            }}
          >
            <MaterialIcons
              name={selected.deck.icon as IconName}
              size={iconSize.md}
              color={selected.deck.color}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="bodySm" weight="semibold" numberOfLines={2}>
              {selected.deck.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {selected.due} due today · {formatCount(selected.cards)} cards
              {selected.folder ? ` · ${selected.folder}` : ''}
            </AppText>
          </View>
          {selectedRecord?.bestScore ? (
            <Pill label={`Best ${formatCount(selectedRecord.bestScore)}`} tone="accent" />
          ) : (
            <AppText variant="caption" tone="muted">
              No best yet
            </AppText>
          )}
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <SegmentedControl
          segments={[
            {
              key: 'forward',
              label: 'Word → Meaning',
              active: mode === 'forward',
              onPress: () => setMode('forward'),
            },
            {
              key: 'reverse',
              label: 'Meaning → Word',
              active: mode === 'reverse',
              onPress: () => setMode('reverse'),
            },
          ]}
        />
        <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
          {mode === 'forward'
            ? 'See the word, pick the meaning.'
            : 'See the meaning, pick the original word.'}
        </AppText>
      </View>

      <View style={{ marginTop: 16 }}>
        <StartButton label="Play 60 seconds" disabled={!selected} onPress={play} />
      </View>
    </GlassCard>
  );

  const deckPicker = (
    <View>
      <SectionHeader label="Choose a deck" hint={`${playableDecks.length} playable`} />
      <GlassCard padding="sm" style={{ marginTop: v2.spacing.block }}>
        <View style={{ gap: 2 }}>
          {playableDecks.map((entry) => (
            <GameDeckRow
              key={entry.deck.id}
              deck={entry.deck}
              cards={entry.cards}
              due={entry.due}
              folder={entry.folder}
              pinned={entry.pinned}
              bestScore={entry.record?.bestScore}
              selected={entry.deck.id === quizDeckId}
              onPress={() => setQuizDeckId(entry.deck.id)}
            />
          ))}
        </View>
      </GlassCard>
    </View>
  );

  const recordsPane = (
    <View>
      <SectionHeader label="Your records" />
      <GlassCard padding="sm" style={{ marginTop: v2.spacing.block }}>
        {recordRows.length > 0 ? (
          <View style={{ gap: 2 }}>
            {recordRows.map(({ record, deck }) => (
              <ListRow
                key={deck.id}
                title={deck.name}
                subtitle={`${record.plays} ${record.plays === 1 ? 'round' : 'rounds'} · ×${
                  record.bestCombo
                } best combo`}
                icon="sports-esports"
                iconTone="deck"
                deckColor={deck.color}
                density="compact"
                gutter={8}
                showChevron={false}
                trailing={
                  <AppText
                    variant="bodySm"
                    weight="semibold"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatCount(record.bestScore)}
                  </AppText>
                }
              />
            ))}
          </View>
        ) : (
          <AppText variant="bodySm" tone="muted" style={{ padding: 8 }}>
            No rounds yet. Your best score will land here.
          </AppText>
        )}
      </GlassCard>
    </View>
  );

  const howToPlay = (
    <View>
      <SectionHeader label="How to play" />
      <GlassCard padding="sm" style={{ marginTop: v2.spacing.block }}>
        <ListRow
          title="Pick the answer"
          subtitle="Four choices per card"
          icon="quiz"
          density="compact"
          gutter={8}
          showChevron={false}
        />
        <ListRow
          title="Right buys time"
          subtitle="+3 seconds, and the combo climbs"
          icon="bolt"
          density="compact"
          gutter={8}
          showChevron={false}
        />
        <ListRow
          title="Streak multiplies"
          subtitle="Up to ×5 per answer"
          icon="local-fire-department"
          density="compact"
          gutter={8}
          showChevron={false}
        />
      </GlassCard>
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
      {/* The screen shell already opens the page with spacing.screen; an extra
          section gap here pushed the game tab's first pane 32px lower than every
          other screen's. */}
      <View style={{ paddingBottom: 48 }}>
        {wide ? (
          // Wide: the hero is the one primary action, so it spans the page as a
          // banner. Under it the picker and the records are both short panes and
          // pair up naturally, and the rules close the page full width. Pairing
          // the tall hero with the picker is what left a whole column ending a
          // third of the way down the page.
          <View style={{ gap: v2.spacing.section }}>
            <RevealItem index={0}>{hero}</RevealItem>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <RevealItem index={1}>{deckPicker}</RevealItem>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <RevealItem index={2}>{recordsPane}</RevealItem>
              </View>
            </View>
            <RevealItem index={3}>{howToPlay}</RevealItem>
          </View>
        ) : (
          <View style={{ gap: v2.spacing.section }}>
            <RevealItem index={0}>{hero}</RevealItem>
            <RevealItem index={1}>{deckPicker}</RevealItem>
            <RevealItem index={2}>{recordsPane}</RevealItem>
            <RevealItem index={3}>{howToPlay}</RevealItem>
          </View>
        )}
      </View>
    </Screen>
  );
}
