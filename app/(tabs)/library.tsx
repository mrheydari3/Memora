import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { pushOnce } from '../../services/navigation';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable } from '../../data/quiz';
import {
  AppText,
  EmptyState,
  Pill,
  RevealItem,
  Screen,
  TopAppBar,
} from '../../components';
import { StartButton } from '../../components/v2';
import {
  alpha,
  colors,
  fills,
  glassFill,
  heights,
  iconSize,
  rims,
} from '../../theme/tokens';
import { v2 } from '../../theme/v2';
import { usePressFeedback } from '../../motion';
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
  record?: GameRecord;
  selected: boolean;
  onPress: () => void;
};

/**
 * One playable deck in the picker. It is a 64px target, carries its best score
 * as context, and acknowledges the press with the same spring as the rating
 * keys — the lobby should feel as tactile as the round itself.
 */
function GameDeckRow({ deck, cards, due, record, selected, onPress }: GameDeckRowProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const bestLabel = record?.bestScore ? `Best ${formatCount(record.bestScore)}` : 'No best';

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        aria-pressed={selected}
        style={{
          minHeight: 64,
          borderRadius: 16,
          backgroundColor: selected ? alpha(colors.primary, 0.1) : fills.inset,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(deck.color, 0.16),
          }}
        >
          <MaterialIcons name={deck.icon as IconName} size={iconSize.md} color={deck.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
            {deck.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {formatCount(cards)} cards · {due} due
          </AppText>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {record?.bestScore ? (
            <Pill label={bestLabel} tone={selected ? 'accent' : 'neutral'} />
          ) : (
            <AppText variant="caption" tone="muted">
              {bestLabel}
            </AppText>
          )}
          {selected && (
            <MaterialIcons name="check-circle" size={iconSize.sm} color={colors.primary} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function RuleRow({
  icon,
  title,
  detail,
}: {
  icon: IconName;
  title: string;
  detail: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.primary, 0.1),
        }}
      >
        <MaterialIcons name={icon} size={iconSize.sm} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodySm" weight="semibold">
          {title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Game — the 60-second quiz lobby.
 *
 * One place to start a round: the clock's hero, the playable-deck picker, the
 * records the game already keeps, and the three rules. The round itself lives
 * in /quiz/[deckId]; nothing is written from this screen.
 */
export default function GameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const deckLoaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const records = useGameStore((s) => s.records);
  const gamesLoaded = useGameStore((s) => s.loaded);
  const [quizDeckId, setQuizDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (!deckLoaded) useDeckStore.getState().load();
    if (!reviewLoaded) useReviewStore.getState().load();
    if (!gamesLoaded) useGameStore.getState().load();
  }, [deckLoaded, reviewLoaded, gamesLoaded]);

  const playableDecks = useMemo(
    () =>
      decks
        .filter((deck) => !deck.archivedAt && isDeckPlayable(cardsByDeck[deck.id] ?? []))
        .map((deck) => {
          const cards = cardsByDeck[deck.id] ?? [];
          return {
            deck,
            cards: cards.length,
            due: buildStudyQueue(deck, cards, reviewLog).total,
            record: records[deck.id],
          };
        })
        .sort((a, b) => b.due - a.due || a.deck.name.localeCompare(b.deck.name)),
    [decks, cardsByDeck, reviewLog, records]
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
    pushOnce(router, `/quiz/${quizDeckId}`);
  };

  const header = (
    <TopAppBar
      title="Game"
      actions={[
        {
          icon: 'add',
          accessibilityLabel: 'Add Deck',
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
        <View style={{ marginTop: v2.spacing.section }}>
          <EmptyState
            icon="sports-esports"
            title="Not enough cards"
            titleVariant="headline"
            description="The quiz needs four cards with distinct answers. Add a few more cards to a deck to unlock the arena."
            action={
              <StartButton
                label="Add a deck"
                onPress={() => pushOnce(router, '/add-deck')}
              />
            }
          />
        </View>
      </Screen>
    );
  }

  const hero = (
    <View
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={{ padding: v2.spacing.panel }}>
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                columnGap: 10,
                marginTop: 2,
              }}
            >
              <AppText
                variant="display"
                className="text-[3.5rem] leading-[3.625rem] tracking-[-0.125rem]"
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
              borderRadius: v2.radii.card,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(colors.primary, 0.12),
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
              borderRadius: 16,
              backgroundColor: fills.inset,
              padding: 10,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
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
              <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                {selected.deck.name}
              </AppText>
              <AppText variant="caption" tone="muted">
                {selected.due} due today · {formatCount(selected.cards)} cards
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
          <StartButton label="Play 60 seconds" disabled={!selected} onPress={play} />
        </View>
      </View>
    </View>
  );

  const deckPicker = (
    <View
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={{ padding: v2.spacing.panel }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Choose a deck
          </AppText>
          <AppText variant="caption" tone="muted">
            {playableDecks.length} playable
          </AppText>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {playableDecks.map((entry) => (
            <GameDeckRow
              key={entry.deck.id}
              deck={entry.deck}
              cards={entry.cards}
              due={entry.due}
              record={entry.record}
              selected={entry.deck.id === quizDeckId}
              onPress={() => setQuizDeckId(entry.deck.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );

  const recordsPane = (
    <View
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={{ padding: v2.spacing.panel }}>
        <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
          Your records
        </AppText>

        {recordRows.length > 0 ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            {recordRows.map(({ record, deck }) => (
              <View
                key={deck.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: deck.color,
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                    {deck.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {record.plays} {record.plays === 1 ? 'round' : 'rounds'} · ×
                    {record.bestCombo} best combo
                  </AppText>
                </View>
                <AppText
                  variant="bodySm"
                  weight="semibold"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatCount(record.bestScore)}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 8 }}>
            No rounds yet. Your best score will land here.
          </AppText>
        )}
      </View>
    </View>
  );

  const howToPlay = (
    <View
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={{ padding: v2.spacing.panel }}>
        <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
          How to play
        </AppText>
        <View style={{ marginTop: 10, gap: 10 }}>
          <RuleRow icon="quiz" title="Pick the answer" detail="Four choices per card" />
          <RuleRow icon="bolt" title="Right buys time" detail="+3 seconds, and the combo climbs" />
          <RuleRow
            icon="local-fire-department"
            title="Streak multiplies"
            detail="Up to ×5 per answer"
          />
        </View>
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
      <View style={{ marginTop: v2.spacing.section, paddingBottom: 48 }}>
        {wide ? (
          <>
            <RevealItem index={0}>{hero}</RevealItem>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 20, marginTop: 20 }}>
              <View style={{ flex: 1.35, minWidth: 0 }}>
                <RevealItem index={1}>{deckPicker}</RevealItem>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
                <RevealItem index={2}>{recordsPane}</RevealItem>
                <RevealItem index={3}>{howToPlay}</RevealItem>
              </View>
            </View>
          </>
        ) : (
          <>
            <RevealItem index={0}>{hero}</RevealItem>
            <View style={{ marginTop: 20, gap: 20 }}>
              <RevealItem index={1}>{deckPicker}</RevealItem>
              <RevealItem index={2}>{recordsPane}</RevealItem>
              <RevealItem index={3}>{howToPlay}</RevealItem>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
