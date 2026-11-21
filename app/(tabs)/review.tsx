import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useGameStore } from '../../store/useGameStore';
import { pushOnce } from '../../services/navigation';
import { buildStudyQueue } from '../../data/session';
import { isDeckPlayable, type QuizMode } from '../../data/quiz';
import { AppText, EmptyState, RevealItem, Screen } from '../../components';
import {
  ActionButton,
  HeroAura,
  PageHeader,
  SectionHeading,
  Surface,
} from '../../components/v3';
import { prefersReducedMotion, usePressFeedback } from '../../motion';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';
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
    // The pill still moves to the new half; it just arrives immediately when
    // the OS asks for less motion.
    if (prefersReducedMotion()) {
      slide.setValue(mode === 'reverse' ? 1 : 0);
      return;
    }
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
      style={{ position: 'relative' }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Surface
        tone="control"
        radius="control"
        padding="none"
        style={{ padding: 4, flexDirection: 'row' }}
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
            borderRadius: radii.micro,
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
            aria-selected={active}
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
      </Surface>
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
 * One deck in the picker: a shared card with a 64px minimum, 36px tile, 15/600
 * deck name, 12px context, the best score in tabular figures and a 24px radio
 * that fills accent when chosen.
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
        style={{ width: '100%' }}
      >
        <Surface
          tone="pane"
          radius="card"
          padding="sm"
          style={[
            {
              minHeight: 64,
              borderWidth: 1,
              borderColor: selected
                ? alpha(colors.primary, 0.2)
                : alpha(colors.outlineSoft, 0.2),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            },
            selected ? { backgroundColor: colors.selectionSurface } : {},
          ]}
        >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: v3.radii.tile,
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
            <AppText weight="semibold" numberOfLines={2} style={v3.type.deckTitle}>
              {deck.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
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
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.primary : colors.surfaceControl,
              borderWidth: selected ? 0 : 1,
              borderColor: alpha(colors.outlineSoft, 0.4),
            }}
          >
            {selected && <MaterialIcons name="check" size={iconSize.sm} color={colors.onPrimary} />}
          </View>
        </View>
        </Surface>
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
    <Surface
      tone="pane"
      radius="card"
      padding="sm"
      style={{ flex: flex ? 1 : undefined, minWidth: 0, gap: 12 }}
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
            borderRadius: radii.pill,
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
    </Surface>
  );
}

type RuleProps = {
  icon: IconName;
  tone: string;
  title: string;
  description: string;
};

/** One "How it works" line: a 36px glyph tile and two lines of copy. */
function Rule({ icon, tone, title, description }: RuleProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: v3.radii.tile,
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
 * Review — the 60-second review lobby, v3 "Nocturne Focus".
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
  // The tablet layout gets the roomier hero and a three-column record row.
  const { tablet } = useResponsive();
  const roomy = tablet;

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
    return folders.find((folder) => folder.id === deck.folderId)?.name;
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

  const header = <PageHeader title="Review" />;

  if (playableDecks.length === 0) {
    return (
      <Screen
        scroll
        gutter
        tabClearance
        header={header}
      >
        <Surface tone="scene">
          <EmptyState
            icon="quiz"
            title="Not enough cards"
            titleVariant="headline"
            description={
              mode === 'reverse'
                ? 'Reverse needs four cards with distinct words to choose from. Create a deck on Home and add cards to start a review.'
                : 'The review needs four cards with distinct meanings to choose from. Create a deck on Home and add cards to start a review.'
            }
            action={
              <View style={{ width: 208 }}>
                <ActionButton
                  label="Go to Home"
                  icon="home"
                  onPress={() => pushOnce(router, '/home')}
                />
              </View>
            }
          />
        </Surface>
      </Screen>
    );
  }

  const heroCard = (
    <Surface
      tone="scene"
      frosted
      testID="game-hero"
      style={{ padding: roomy ? 24 : 20, gap: 20 }}
    >
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.selectionSurface,
              borderWidth: 1,
              borderColor: alpha(colors.primary, 0.2),
            }}
          >
            <MaterialIcons name="timer" size={iconSize.sm} color={colors.primary} />
            <AppText variant="caption" weight="medium" tone="accent">
              60-second review
            </AppText>
          </View>
        </View>

        <AppText weight="bold" style={[v3.type.headlineMd, { marginTop: 4 }]}>
          Beat the clock.
        </AppText>
        <AppText variant="body" tone="muted" style={{ maxWidth: 500 }}>
          Four choices per card. Right answers buy time; a streak multiplies the score.
        </AppText>
      </View>

      {selected && (
        <Surface
          tone="inset"
          radius="card"
          padding="sm"
          style={{
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
                borderRadius: v3.radii.tile,
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
              <AppText variant="body" weight="semibold" numberOfLines={2}>
                {selected.deck.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
                {selected.due} due today · {formatCount(selected.cards)} cards
                {selected.folder ? ` · ${selected.folder}` : ''}
              </AppText>
            </View>
          </View>
        </Surface>
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
        label="Start review"
        icon="arrow-forward"
        onPress={play}
        disabled={!selected}
      />
    </Surface>
  );

  const hero = (
    <View style={{ position: 'relative' }}>
      <HeroAura id="game-aura" />
      <View style={{ position: 'relative', zIndex: 1 }}>{heroCard}</View>
    </View>
  );

  const deckPicker = (
    <View>
      <SectionHeading label="Choose a deck" count={`${playableDecks.length} ready`} />

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
      <SectionHeading label="Your records" hint="All-time top" />

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
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 12 }}>
          No rounds yet. Your best score will land here.
        </AppText>
      )}
    </View>
  );

  const howToPlay = (
    <View>
      <SectionHeading label="How it works" />

      <Surface tone="pane" radius="card" padding="sm" style={{ marginTop: 12, gap: 12 }}>
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
      </Surface>
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      tabClearance
      header={header}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: v3.spacing.page }}>
          <RevealItem index={0}>{hero}</RevealItem>
          <RevealItem index={1}>{deckPicker}</RevealItem>
          <RevealItem index={2}>{recordsPane}</RevealItem>
          <RevealItem index={3}>{howToPlay}</RevealItem>
        </View>
      </View>
    </Screen>
  );
}
