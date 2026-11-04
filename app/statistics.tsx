import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { addLocalDays, computeStreak, startOfLocalDay } from '../data/streak';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  SectionHeader,
  DonutChart,
  MiniBarChart,
  RevealItem,
  StatisticsSkeleton,
} from '../components';
import { colors, iconSize, stateColors } from '../theme/tokens';

// Indexed by Date.getDay() (Sunday first), so a label always belongs to the
// actual weekday of its bar rather than to a fixed Mon-first position. Two
// letters, because one repeats: T/T and S/S name no weekday on their own.
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatCount = (value: number) => value.toLocaleString('en-US');

/** One clock for both time cards: 30 minutes is "30m", never "0.5h". */
function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  if (ms < 60_000) return '<1m';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = ms / 3_600_000;
  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;
}

function weekdayLabel(dayStart: number): string {
  return WEEKDAY_LABELS[new Date(dayStart).getDay()];
}

export default function StatisticsScreen() {
  const { width } = useWindowDimensions();
  // The donut and its legend share 240px inside a 320px card. Shrinking the
  // ring keeps a gap between a one-word label and its percentage; at the
  // default size "Mastered" and "0%" ran together.
  const narrow = width < 360;
  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLog.length) useReviewStore.getState().load();
  }, [loaded, reviewLog.length]);

  // Archived decks are out of the way, not gone: their cards and history must
  // not keep inflating the library-wide numbers.
  const activeDecks = useMemo(() => decks.filter((deck) => !deck.archivedAt), [decks]);
  const activeDeckIds = useMemo(() => new Set(activeDecks.map((deck) => deck.id)), [activeDecks]);

  // Card state totals across all active decks. Subscribing to cardsByDeck keeps
  // these numbers correct after reviews; the old getState() read was memoized
  // on the deck list, which reviewing never changes.
  const allCards = useMemo(
    () => activeDecks.flatMap((deck) => cardsByDeck[deck.id] ?? []),
    [activeDecks, cardsByDeck]
  );
  const activeLog = useMemo(
    () => reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)),
    [reviewLog, activeDeckIds]
  );

  // Due dates are wall-clock facts. Without a tick the "upcoming" chart keeps
  // counting yesterday's schedule for as long as this screen stays open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const newCount = allCards.filter((c) => c.fsrs.state === 'New').length;
  // Relearning belongs with Learning: a card that lapsed is in progress, not
  // New, and leaving it out made the three segments stop adding up to 100%.
  const inProgress = allCards.filter(
    (c) => c.fsrs.state === 'Learning' || c.fsrs.state === 'Relearning'
  ).length;
  // "Mastered" means graduated to Review, the same definition deck details
  // uses. Filtering on `due > now` made a card silently stop being mastered
  // the moment it came due.
  const mastered = allCards.filter((c) => c.fsrs.state === 'Review').length;
  const total = allCards.length;

  const streak = useMemo(() => computeStreak(activeLog.map((e) => e.reviewedAt)), [activeLog]);

  // Reviews per day for the last 7 calendar days, ending today.
  const weekData = useMemo(() => {
    const today0 = startOfLocalDay();
    const indexByDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) indexByDay.set(addLocalDays(today0, i - 6), i);

    const counts = Array(7).fill(0);
    for (const e of activeLog) {
      const idx = indexByDay.get(startOfLocalDay(e.reviewedAt));
      if (idx !== undefined) counts[idx] += 1;
    }
    return counts.map((value, i) => {
      const day = addLocalDays(today0, i - 6);
      return { value, label: weekdayLabel(day), highlight: day === today0 };
    });
  }, [activeLog]);

  // Upcoming: cards due per day over the next 7 days
  const upcomingData = useMemo(() => {
    const today0 = startOfLocalDay();
    const indexByDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) indexByDay.set(addLocalDays(today0, i), i);

    const counts = Array(7).fill(0);
    for (const c of allCards) {
      if (c.fsrs.state === 'New') continue;
      const due = new Date(c.fsrs.due).getTime();
      if (due <= now) continue;
      const idx = indexByDay.get(startOfLocalDay(due));
      if (idx !== undefined) counts[idx] += 1;
    }
    return counts.map((value, i) => ({ value, label: weekdayLabel(addLocalDays(today0, i)) }));
  }, [allCards, now]);

  // Time studied: sum of elapsedMs per entry (per-card time)
  const msToday = useMemo(() => {
    const today0 = startOfLocalDay();
    return activeLog.filter((e) => e.reviewedAt >= today0).reduce((s, e) => s + e.elapsedMs, 0);
  }, [activeLog]);
  const msTotal = useMemo(() => activeLog.reduce((s, e) => s + e.elapsedMs, 0), [activeLog]);

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const knowledge = [
    { color: stateColors.Review, label: 'Mastered', value: mastered },
    { color: stateColors.Learning, label: 'In progress', value: inProgress },
    { color: stateColors.New, label: 'New', value: newCount },
  ];

  return (
    <Screen scroll gutter header={<TopAppBar title="Statistics" back />}>
      {!loaded ? (
        <StatisticsSkeleton />
      ) : (
      <>
      {/* Streak */}
      <RevealItem index={0}>
      <GlassCard tone="accent">
        <View className="flex-row items-center justify-between">
          <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
            Learning streak
          </AppText>
          <MaterialIcons name="local-fire-department" size={iconSize.lg} color={colors.warning} />
        </View>
        <AppText variant="display" className="mt-1">
          {streak} {streak === 1 ? 'day' : 'days'}
        </AppText>
        <AppText variant="bodySm" tone="muted" className="mt-1">
          Consecutive days with at least one review
        </AppText>
        <View className="mt-5">
          <MiniBarChart
            data={weekData}
            height={64}
            showValues
            emptyLabel="No reviews in the last 7 days."
          />
        </View>
      </GlassCard>
      </RevealItem>

      {/* Knowledge */}
      <RevealItem index={1}>
      <SectionHeader
        className="mt-7"
        label="Knowledge level"
        hint={`${formatCount(total)} cards`}
      />
      <GlassCard className="mt-3">
        <View className="flex-row items-center">
          <DonutChart
            size={narrow ? 112 : undefined}
            strokeWidth={10}
            centerLabel={formatCount(total)}
            centerSubtitle="cards"
            segments={knowledge.map((row) => ({
              value: row.value,
              color: row.color,
              label: row.label,
            }))}
          />
          <View className="flex-1 gap-3.5" style={{ marginLeft: narrow ? 12 : 20 }}>
            {knowledge.map((row) => (
              <View key={row.label} className="flex-row items-center">
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <AppText variant="bodySm" weight="medium" tone="muted" className="ml-2 flex-1">
                  {row.label}
                </AppText>
                <AppText variant="bodySm" weight="semibold" style={{ marginStart: 8 }}>
                  {pct(row.value)}%
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
      </RevealItem>

      {/* Time */}
      <RevealItem index={2}>
      <View className="mt-3 flex-row gap-3">
        <GlassCard className="flex-1" padding="sm">
          <MaterialIcons name="schedule" size={iconSize.md} color={colors.outline} />
          <AppText variant="title" className="mt-2">
            {formatDuration(msToday)}
          </AppText>
          <AppText variant="caption" tone="muted" className="uppercase">
            Today
          </AppText>
        </GlassCard>
        <GlassCard className="flex-1" padding="sm">
          <MaterialIcons name="update" size={iconSize.md} color={colors.outline} />
          <AppText variant="title" className="mt-2">
            {formatDuration(msTotal)}
          </AppText>
          <AppText variant="caption" tone="muted" className="uppercase">
            All time
          </AppText>
        </GlassCard>
      </View>
      </RevealItem>

      {/* Upcoming */}
      <RevealItem index={3}>
      <SectionHeader className="mt-7" label="Upcoming" hint="next 7 days" />
      <GlassCard className="mt-3">
        <MiniBarChart
          data={upcomingData}
          height={64}
          showValues
          emptyLabel="Nothing due in the next 7 days."
        />
      </GlassCard>
      </RevealItem>
      </>
      )}
    </Screen>
  );
}
