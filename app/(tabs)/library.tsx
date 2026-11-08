import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { pushOnce } from '../../services/navigation';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable, type QuizMode } from '../../data/quiz';
import { folderPath } from '../../data/folders';
import { AppText, EmptyState, RevealItem, Screen } from '../../components';
import {
  ActionButton,
  HeaderIcon,
  HeaderProfileButton,
  PageHeader,
  Surface,
} from '../../components/v3';
import { usePressFeedback } from '../../motion';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import type { Deck, GameRecord } from '../../data/types';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** 1420 → "1,420" without depending on Intl. */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

type ModeSwitchProps = {
  mode: QuizMode;
  onChange: (mode: QuizMode) => void;
};

/**
 * The mockup's direction control: a surface-control well with a
 * selection-surface pill that slides 250ms under two 15/600 labels. The pill is
 * drawn from the measured width, so the two halves stay equal at any gutter.
 */
function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(mode === 'reverse' ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: mode === 'reverse' ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [mode, slide]);

  // The pill is calc(50% - 4px): the well's inner width halved.
  const travel = Math.max(0, (width - 8) / 2);
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  return (
    <View
      role="tablist"
      aria-label="Quiz direction"
      style={{
        backgroundColor: colors.surfaceControl,
        borderRadius: 12,
        padding: 4,
        flexDirection: 'row',
        position: 'relative',
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: travel,
            borderRadius: 8,
            backgroundColor: colors.selectionSurface,
            borderWidth: 1,
            borderColor: alpha(colors.primary, 0.25),
            transform: [{ translateX }],
          }}
        />
      )}

      {(
        [
          { key: 'forward', label: 'Word → Meaning' },
          { key: 'reverse', label: 'Meaning → Word' },
        ] as const
      ).map((option) => {
        const active = mode === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="body" weight="semibold" tone={active ? 'accent' : 'muted'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type GameDeckRowProps = {
  deck: Deck;
  cards: number;
  due: number;
  folder?: string;
  bestScore?: number;
  selected: boolean;
  onPress: () => void;
};

/**
 * One deck in the picker, exactly as the mockup draws it: a 64px-minimum
 * radius-22 pane with a 40px tile, 15/600 name, 12px context, the best score in
 * tabular figures and a 24px radio that fills accent when chosen.
 *
 * The whole row is the radio. The tile is washed with the accent only while the
 * row is selected, so the list has one highlighted line, not four coloured ones.
 */
function GameDeckRow({
  deck,
  cards,
  due,
  folder,
  bestScore,
  selected,
  onPress,
}: GameDeckRowProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const meta = `${due} due · ${formatCount(cards)} cards${folder ? ` · ${folder}` : ''}`;

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        accessibilityLabel={`${deck.name}, ${meta}${bestScore ? `, best ${formatCount(bestScore)}` : ''}`}
        style={{
          minHeight: 64,
          padding: 16,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: selected ? alpha(colors.primary, 0.2) : alpha(colors.outlineSoft, 0.2),
          backgroundColor: selected ? colors.selectionSurface : colors.surfacePane,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.accentFaint : colors.surfaceControl,
              flexShrink: 0,
            }}
          >
            <MaterialIcons
              name={deck.icon as IconName}
              size={iconSize.lg}
              color={selected ? colors.primary : colors.onSurfaceVariant}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="body" weight="semibold" numberOfLines={1}>
              {deck.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {meta}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <AppText variant="caption" tone="muted" style={NUMERIC}>
            {bestScore ? `Best ${formatCount(bestScore)}` : 'No best'}
          </AppText>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.primary : colors.surfaceControl,
              borderWidth: selected ? 0 : 1,
              borderColor: alpha(colors.outlineSoft, 0.4),
            }}
          >
            {selected && <MaterialIcons name="check" size={16} color={colors.onPrimary} />}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

type RecordCardProps = {
  rank: number;
  deck: Deck;
  record: GameRecord;
  /** The three cards share a row on a wide canvas. */
  flex: boolean;
};

/** One all-time record: name, rounds/combo, rank badge and the score. */
function RecordCard({ rank, deck, record, flex }: RecordCardProps) {
  const first = rank === 1;

  return (
    <View
      style={{
        flex: flex ? 1 : undefined,
        minWidth: 0,
        backgroundColor: colors.surfacePane,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: alpha(colors.outlineSoft, 0.2),
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {deck.name}
          </AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
            {record.plays} {record.plays === 1 ? 'round' : 'rounds'} · Best combo ×
            {record.bestCombo}
          </AppText>
        </View>

        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: first ? colors.selectionSurface : colors.surfaceControl,
          }}
        >
          <AppText variant="caption" weight="bold" tone={first ? 'accent' : 'muted'}>
            {rank}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <AppText
          variant="title"
          weight="bold"
          tone={first ? 'accent' : undefined}
          style={[v3.type.stat, NUMERIC]}
        >
          {formatCount(record.bestScore)}
        </AppText>
        <AppText variant="caption" tone="muted">
          pts
        </AppText>
      </View>
    </View>
  );
}

type RuleProps = {
  icon: IconName;
  tone: string;
  title: string;
  description: string;
};

/** One "How to play" line: a 36px glyph tile and two lines of copy. */
function Rule({ icon, tone, title, description }: RuleProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceControl,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.lg} color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <AppText variant="body" weight="semibold">
          {title}
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
          {description}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Game — the 60-second quiz lobby, v3 "Nocturne Focus".
 *
 * The mockup's order is kept: the hero states the clock, the selected deck and
 * the direction in one pane; the deck picker is a radio list; records rank the
 * best runs; and three rules explain the loop. Nothing is written here — the
 * round lives in /quiz/[deckId].
 *
 * The data is the same as before: `isDeckPlayable` decides what can be dealt,
 * `buildStudyQueue` gives each deck's due count, and the game store supplies
 * the best score and the record's rounds. The mode is the quiz's real direction,
 * so choosing "Meaning → Word" starts a reverse round.
 */
export default function GameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // The mockup's `sm:` breakpoint: the hero gains padding and the records
  // become three columns from 640px, not only on the 900px wide canvas.
  const roomy = width >= 640;

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
            record: records[deck.id],
          };
        })
        .sort(
          (a, b) =>
            Number(b.deck.pinnedAt != null) - Number(a.deck.pinnedAt != null) ||
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
    <PageHeader
      title="Game"
      actions={
        <>
          <HeaderIcon
            icon="add"
            label="Add deck"
            onPress={() => pushOnce(router, '/add-deck')}
          />
          <HeaderIcon
            icon="settings"
            label="Settings"
            onPress={() => pushOnce(router, '/settings')}
          />
          <HeaderProfileButton onPress={() => pushOnce(router, '/profile')} />
        </>
      }
    />
  );

  if (playableDecks.length === 0) {
    return (
      <Screen
        scroll
        gutter
        tabClearance
        contentMaxWidth={v3.layout.contentMaxWidth}
        header={header}
      >
        <Surface tone="scene">
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
              <View style={{ width: 208 }}>
                <ActionButton
                  label="Add a deck"
                  icon="add"
                  onPress={() => pushOnce(router, '/add-deck')}
                />
              </View>
            }
          />
        </Surface>
      </Screen>
    );
  }

  const hero = (
    <Surface
      tone="scene"
      testID="game-hero"
      style={{ padding: roomy ? 24 : 20, gap: 20, overflow: 'hidden' }}
    >
      <Svg
        pointerEvents="none"
        width={224}
        height={224}
        style={{ position: 'absolute', right: -8, top: -64 }}
      >
        <Defs>
          <RadialGradient id="game-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={112} cy={112} r={112} fill="url(#game-glow)" />
      </Svg>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.selectionSurface,
              borderWidth: 1,
              borderColor: alpha(colors.primary, 0.2),
            }}
          >
            <MaterialIcons name="bolt" size={15} color={colors.primary} />
            <AppText variant="caption" weight="medium" tone="accent">
              Quiz · 60 seconds
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <AppText
            variant="display"
            style={[v3.type.hero, NUMERIC]}
            accessibilityLabel="60 seconds"
          >
            60
          </AppText>
          <AppText variant="headline" weight="medium" tone="muted">
            seconds
          </AppText>
        </View>

        <AppText weight="bold" style={v3.type.headlineMd}>
          Beat the clock.
        </AppText>
        <AppText variant="body" tone="muted" style={{ maxWidth: 500 }}>
          Four choices per card. Right answers buy time; a streak multiplies the score.
        </AppText>
      </View>

      {selected && (
        <View
          style={{
            backgroundColor: colors.surfaceInset,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderWidth: 1,
            borderColor: alpha(colors.outlineSoft, 0.2),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accentFaint,
                flexShrink: 0,
              }}
            >
              <MaterialIcons
                name={selected.deck.icon as IconName}
                size={iconSize.xl}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="body" weight="semibold" numberOfLines={1}>
                {selected.deck.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                {selected.due} due today · {formatCount(selected.cards)} cards
                {selected.folder ? ` · ${selected.folder}` : ''}
              </AppText>
            </View>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.surfaceControl,
              flexShrink: 0,
            }}
          >
            <AppText variant="caption" tone="accent" style={NUMERIC}>
              {selectedRecord
                ? `Best ${formatCount(selectedRecord.bestScore)} pts`
                : 'No best yet'}
            </AppText>
          </View>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <ModeSwitch mode={mode} onChange={setMode} />
        <AppText variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>
          {mode === 'forward'
            ? 'See the word, pick the meaning.'
            : 'See the meaning, pick the original word.'}
        </AppText>
      </View>

      <ActionButton
        label="Play 60 seconds"
        icon="arrow-forward"
        onPress={play}
        disabled={!selected}
      />
    </Surface>
  );

  const deckPicker = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 4,
        }}
      >
        <AppText variant="headline" weight="semibold" headingLevel={2} style={{ letterSpacing: -0.4 }}>
          Choose a deck
        </AppText>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: colors.surfaceControl,
          }}
        >
          <AppText variant="caption" tone="muted">
            {playableDecks.length} playable
          </AppText>
        </View>
      </View>

      <View style={{ gap: 10, marginTop: 12 }}>
        {playableDecks.map((entry) => (
          <GameDeckRow
            key={entry.deck.id}
            deck={entry.deck}
            cards={entry.cards}
            due={entry.due}
            folder={entry.folder}
            bestScore={entry.record?.bestScore}
            selected={entry.deck.id === quizDeckId}
            onPress={() => setQuizDeckId(entry.deck.id)}
          />
        ))}
      </View>
    </View>
  );

  const recordsPane = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 4,
        }}
      >
        <AppText variant="headline" weight="semibold" headingLevel={2} style={{ letterSpacing: -0.4 }}>
          Your records
        </AppText>
        <AppText variant="caption" tone="muted">
          All-time top
        </AppText>
      </View>

      {recordRows.length > 0 ? (
        <View
          style={{
            marginTop: 12,
            flexDirection: roomy ? 'row' : 'column',
            gap: 10,
          }}
        >
          {recordRows.map(({ record, deck }, index) => (
            <RecordCard
              key={deck.id}
              rank={index + 1}
              deck={deck}
              record={record}
              flex={roomy}
            />
          ))}
        </View>
      ) : (
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 12, paddingHorizontal: 4 }}>
          No rounds yet. Your best score will land here.
        </AppText>
      )}
    </View>
  );

  const howToPlay = (
    <View>
      <AppText
        variant="headline"
        weight="semibold"
        headingLevel={2}
        style={{ letterSpacing: -0.4, paddingHorizontal: 4 }}
      >
        How to play
      </AppText>

      <View
        style={{
          marginTop: 12,
          backgroundColor: colors.surfacePane,
          borderRadius: 22,
          padding: 16,
          gap: 12,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
        }}
      >
        <Rule
          icon="touch-app"
          tone={colors.primary}
          title="Pick the answer"
          description="Four choices per card. Quick elimination keeps the tempo smooth."
        />
        <Rule
          icon="more-time"
          tone={colors.success}
          title="Right buys time"
          description="+3 seconds on correct response, preventing the clock from bleeding out."
        />
        <Rule
          icon="local-fire-department"
          tone={colors.warning}
          title="Streak multiplies"
          description="Up to ×5 per answer. Miss once and the multiplier resets to base."
        />
      </View>
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={header}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>{hero}</RevealItem>
          <RevealItem index={1}>{deckPicker}</RevealItem>
          <RevealItem index={2}>{recordsPane}</RevealItem>
          <RevealItem index={3}>{howToPlay}</RevealItem>
        </View>
      </View>
    </Screen>
  );
}
