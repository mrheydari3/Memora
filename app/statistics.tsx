import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
// actual weekday of its bar rather than to a fixed Mon-first position.
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function weekdayInitial(dayStart: number): string {
  return WEEKDAY_INITIALS[new Date(dayStart).getDay()];
}

export default function StatisticsScreen() {
  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLog.length) useReviewStore.getState().load();
  }, [loaded, reviewLog.length]);

  // Card state totals across all decks. Subscribing to cardsByDeck keeps these
  // numbers correct after reviews; the old getState() read was memoized on the
  // deck list, which reviewing never changes.
  const allCards = useMemo(() => decks.flatMap((deck) => cardsByDeck[deck.id] ?? []), [decks, cardsByDeck]);
  const now = Date.now();
  const newCount = allCards.filter((c) => c.fsrs.state === 'New').length;
  // Relearning belongs with Learning: a card that lapsed is in progress, not
  // New, and leaving it out made the three segments stop adding up to 100%.
  const inProgress = allCards.filter(
    (c) =>
      c.fsrs.state === 'Learning' ||
      c.fsrs.state === 'Relearning' ||
      (c.fsrs.state === 'Review' && new Date(c.fsrs.due).getTime() <= now)
  ).length;
  const mastered = allCards.filter(
    (c) => c.fsrs.state === 'Review' && new Date(c.fsrs.due).getTime() > now
  ).length;
  const total = allCards.length;

  const streak = useMemo(() => computeStreak(reviewLog.map((e) => e.reviewedAt)), [reviewLog]);

  // Reviews per day for the last 7 calendar days, ending today.
  const weekData = useMemo(() => {
    const today0 = startOfLocalDay();
    const indexByDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) indexByDay.set(addLocalDays(today0, i - 6), i);

    const counts = Array(7).fill(0);
    for (const e of reviewLog) {
      const idx = indexByDay.get(startOfLocalDay(e.reviewedAt));
      if (idx !== undefined) counts[idx] += 1;
    }
    return counts.map((value, i) => {
      const day = addLocalDays(today0, i - 6);
      return { value, label: weekdayInitial(day), highlight: day === today0 };
    });
  }, [reviewLog]);

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
    return counts.map((value, i) => ({ value, label: weekdayInitial(addLocalDays(today0, i)) }));
  }, [allCards]);

  // Time studied: sum of elapsedMs per entry (per-card time)
  const msToday = useMemo(() => {
    const today0 = startOfLocalDay();
    return reviewLog.filter((e) => e.reviewedAt >= today0).reduce((s, e) => s + e.elapsedMs, 0);
  }, [reviewLog]);
  const msTotal = useMemo(() => reviewLog.reduce((s, e) => s + e.elapsedMs, 0), [reviewLog]);

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
          <MiniBarChart data={weekData} height={64} showValues />
        </View>
      </GlassCard>
      </RevealItem>

      {/* Knowledge */}
      <RevealItem index={1}>
      <SectionHeader className="mt-7" label="Knowledge level" hint={`${total} cards`} />
      <GlassCard className="mt-3">
        <View className="flex-row items-center">
          <DonutChart
            size={124}
            strokeWidth={10}
            centerLabel={String(total)}
            centerSubtitle="cards"
            segments={knowledge.map((row) => ({
              value: row.value,
              color: row.color,
              label: row.label,
            }))}
          />
          <View className="ml-5 flex-1 gap-3.5">
            {knowledge.map((row) => (
              <View key={row.label} className="flex-row items-center">
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <AppText variant="bodySm" weight="medium" tone="muted" className="ml-2 flex-1">
                  {row.label}
                </AppText>
                <AppText variant="bodySm" weight="semibold">
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
            {Math.round(msToday / 60000)}m
          </AppText>
          <AppText variant="caption" tone="muted" className="uppercase">
            Today
          </AppText>
        </GlassCard>
        <GlassCard className="flex-1" padding="sm">
          <MaterialIcons name="update" size={iconSize.md} color={colors.outline} />
          <AppText variant="title" className="mt-2">
            {(msTotal / 3600000).toFixed(1)}h
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
        <MiniBarChart data={upcomingData} height={64} showValues />
      </GlassCard>
      </RevealItem>
      </>
      )}
    </Screen>
  );
}
