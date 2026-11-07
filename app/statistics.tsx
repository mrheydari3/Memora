import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import {
  AppText,
  DistributionList,
  DonutChart,
  EmptyState,
  GlassCard,
  HeroPane,
  InsightCard,
  MiniBarChart,
  Pill,
  RecommendationCard,
  RevealItem,
  Screen,
  SegmentedControl,
  StatPill,
  StatisticsSkeleton,
  TopAppBar,
  TrendChart,
} from '../components';
import type { DistributionItem } from '../components';
import { MetricGrid, SectionHeading } from '../components/v3';
import { colors, fills, iconSize, stateColors } from '../theme/tokens';
import { v2 } from '../theme/v2';
import {
  buildIntelligence,
  MIN_RECALL_SAMPLE,
  MIN_TREND_POINTS,
  RANGE_OPTIONS,
} from '../data/intelligence';
import type { DataQualityIssueKind, DeckIntelligence } from '../data/intelligence';

const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const ISSUE_LABEL: Record<DataQualityIssueKind, string> = {
  duplicate: 'duplicate',
  invalid_rating: 'invalid rating',
  invalid_timestamp: 'invalid timestamp',
  future_timestamp: 'future timestamp',
  invalid_duration: 'invalid duration',
  outlier_duration: 'extreme duration',
  orphan_deck: 'deleted deck',
};

const VS_LIBRARY: Record<DeckIntelligence['vsLibrary'], string> = {
  above: 'Above library',
  below: 'Below library',
  typical: 'In line',
  insufficient_data: 'Not comparable',
};

const formatCount = (value: number) => value.toLocaleString('en-US');

const pct = (value: number | null) =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

const num = (value: number | null, digits = 1) =>
  value === null ? '—' : value.toFixed(digits);

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '0m';
  if (ms < 60_000) return '<1m';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = ms / 3_600_000;
  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;
}

const weekdayShortOf = (dayStart: number) => WEEKDAY_SHORT[new Date(dayStart).getDay()];

const algorithmLabel = (algorithm: DeckIntelligence['algorithm']) =>
  algorithm === 'fsrs' ? 'FSRS' : algorithm === 'fast' ? 'Fast' : 'SM-2';

export default function StatisticsScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  const [rangeDays, setRangeDays] = useState<number>(30);
  // Due dates are wall-clock facts; one tick a minute keeps the workload and the
  // forecast window from freezing while the screen stays open.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLog.length) useReviewStore.getState().load();
  }, [loaded, reviewLog.length]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { report, error } = useMemo(() => {
    try {
      return {
        report: buildIntelligence({
          decks,
          cardsByDeck,
          reviewLog,
          now,
          rangeDays,
        }),
        error: null as string | null,
      };
    } catch {
      return {
        report: null,
        error:
          'The analysis could not be computed from the stored review log. Your reviews are unchanged.',
      };
    }
  }, [decks, cardsByDeck, reviewLog, now, rangeDays]);

  const reviewedDecks = report?.decks.decks.filter((deck) => deck.reviews > 0).slice(0, 6) ?? [];
  const medianSessionReviews = report?.behavior.sessions.medianReviews ?? null;

  const rangeControl = (
    <View className="mb-4">
      <AppText variant="caption" tone="muted" className="mb-2 uppercase">
        Range
      </AppText>
      <SegmentedControl
        segments={RANGE_OPTIONS.map((days) => ({
          key: String(days),
          label: `${days} days`,
          active: rangeDays === days,
          onPress: () => setRangeDays(days),
        }))}
      />
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Statistics" back backFallback="/settings" />}
    >
      {!loaded ? (
        <StatisticsSkeleton />
      ) : error || !report ? (
        <GlassCard className="mt-4">
          <EmptyState
            icon="error-outline"
            title="Analysis unavailable"
            description={error ?? 'The analysis could not be computed.'}
            titleVariant="headline"
          />
        </GlassCard>
      ) : report.performance.status === 'empty' ? (
        <>
          {rangeControl}
          <RevealItem index={0}>
            <HeroPane
              tone="accent"
              eyebrow={`${report.range.label} · no reviews`}
              value={0}
              unit="reviews"
              valueLabel="No reviews in this range"
              context="Nothing has been reviewed in the selected window."
              trailing={
                <Pill label={`${report.overview.deckCount} decks`} tone="accent" />
              }
              rail={
                <TrendChart
                  points={report.trends.series.points.map((point) => ({
                    value: point.value,
                    label: point.label,
                  }))}
                  height={64}
                  emptyLabel="No review days in this range."
                />
              }
            />
          </RevealItem>
          <RevealItem index={1}>
            <GlassCard className="mt-4">
              <EmptyState
                icon="insights"
                title="No reviews in this range"
                description="Study a few cards and this page will report recall, memory, workload and trends from your own review log. A longer range may already contain history."
                titleVariant="headline"
              />
            </GlassCard>
          </RevealItem>
          {report.coverage.archivedDecks > 0 ? (
            <AppText variant="caption" tone="tertiary" className="mt-3">
              {report.coverage.archivedDecks} archived deck
              {report.coverage.archivedDecks === 1 ? ' is' : 's are'} excluded from this
              analysis.
            </AppText>
          ) : null}
        </>
      ) : (
        <>
          {rangeControl}

          {/* Overview */}
          <RevealItem index={0}>
            <HeroPane
              tone="accent"
              eyebrow={`${report.range.label} · intelligence`}
              value={formatCount(report.overview.totalReviews)}
              unit="reviews"
              valueLabel={`${report.overview.totalReviews} reviews`}
              context={`${report.overview.activeDays} active days · ${formatDuration(
                report.overview.studyTimeMs
              )} · ${
                report.performance.recall.successRate === null
                  ? `${report.performance.recall.sampleSize} rated so far`
                  : `${pct(report.performance.recall.successRate)} successful recall`
              }`}
              trailing={
                <Pill label={`${report.overview.deckCount} decks`} tone="accent" />
              }
              rail={
                <TrendChart
                  points={report.trends.series.points.map((point) => ({
                    value: point.value,
                    label: point.label,
                  }))}
                  height={64}
                  emptyLabel="No reviews in this range."
                />
              }
            />
          </RevealItem>

          {/* Recall */}
          <RevealItem index={1}>
            <SectionHeading
              className="mt-7"
              label="Recall"
              hint={`${formatCount(report.performance.recall.sampleSize)} rated`}
            />
            <GlassCard className="mt-3">
              <View className="flex-row flex-wrap items-end" style={{ columnGap: 10 }}>
                <AppText variant="display" style={v2.type.stat}>
                  {pct(report.performance.recall.successRate)}
                </AppText>
                <AppText variant="bodySm" tone="muted" style={{ paddingBottom: 6 }}>
                  successful
                </AppText>
              </View>
              <AppText variant="caption" tone="muted" className="mt-1">
                Again is a failed recall. Hard, Good and Easy are successes; Hard is a
                success with effort, not a failure.
              </AppText>

              {report.performance.recall.successInterval ? (
                <View className="mt-3">
                  <View
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ backgroundColor: fills.track }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        marginLeft: `${report.performance.recall.successInterval.low * 100}%`,
                        width: `${
                          (report.performance.recall.successInterval.high -
                            report.performance.recall.successInterval.low) *
                          100
                        }%`,
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                  <AppText variant="caption" tone="tertiary" className="mt-1.5">
                    95% interval {pct(report.performance.recall.successInterval.low)}–
                    {pct(report.performance.recall.successInterval.high)} ·{' '}
                    {report.performance.recall.sampleSize} reviews
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" tone="tertiary" className="mt-2">
                  A percentage appears after {MIN_RECALL_SAMPLE} rated reviews. This range
                  has {report.performance.recall.sampleSize}.
                </AppText>
              )}

              <DistributionList
                className="mt-4"
                items={[
                  {
                    key: 'again',
                    label: 'Again — failed',
                    count: report.performance.recall.counts.again,
                    share: report.performance.recall.shares.again,
                    color: colors.error,
                  },
                  {
                    key: 'hard',
                    label: 'Hard — with effort',
                    count: report.performance.recall.counts.hard,
                    share: report.performance.recall.shares.hard,
                    color: colors.warning,
                  },
                  {
                    key: 'good',
                    label: 'Good',
                    count: report.performance.recall.counts.good,
                    share: report.performance.recall.shares.good,
                    color: colors.primary,
                  },
                  {
                    key: 'easy',
                    label: 'Easy',
                    count: report.performance.recall.counts.easy,
                    share: report.performance.recall.shares.easy,
                    color: colors.success,
                  },
                ]}
              />
            </GlassCard>

            <MetricGrid
              className="mt-3"
              columns={2}
              items={[
                {
                  label: 'Median review',
                  value: formatDuration(report.performance.duration.medianMs),
                  note:
                    report.performance.duration.sampleSize > 0
                      ? `p90 ${formatDuration(report.performance.duration.p90Ms)} · ${
                          report.performance.duration.sampleSize
                        } timed`
                      : 'No timed reviews yet',
                },
                {
                  label: narrow ? 'Active day' : 'Per active day',
                  value: num(report.performance.volume.perActiveDay),
                  note: `${num(report.performance.volume.perCalendarDay, 2)} per calendar day`,
                },
              ]}
            />
          </RevealItem>

          {/* Memory */}
          {report.memory.coverage.fsrsCards > 0 ? (
            <RevealItem index={2}>
              <SectionHeading
                className="mt-7"
                label="Memory"
                hint={`${report.memory.coverage.fsrsCards} FSRS cards`}
              />
              <GlassCard className="mt-3">
                <View className={narrow ? 'items-center' : 'flex-row items-center'}>
                  <DonutChart
                    size={narrow ? 104 : undefined}
                    strokeWidth={10}
                    centerLabel={formatCount(report.memory.coverage.fsrsCards)}
                    centerSubtitle="cards"
                    segments={[
                      {
                        value: report.memory.states.Review,
                        color: stateColors.Review,
                        label: 'In review schedule',
                      },
                      {
                        value: report.memory.states.Learning,
                        color: stateColors.Learning,
                        label: 'Learning',
                      },
                      {
                        value: report.memory.states.Relearning,
                        color: stateColors.Relearning,
                        label: 'Relearning',
                      },
                      {
                        value: report.memory.states.New,
                        color: stateColors.New,
                        label: 'New',
                      },
                    ]}
                  />
                  <View
                    className={narrow ? 'mt-4 w-full gap-3' : 'flex-1 gap-3'}
                    style={narrow ? undefined : { marginLeft: 20 }}
                  >
                    {[
                      { label: 'In review schedule', value: report.memory.states.Review, color: stateColors.Review },
                      { label: 'Learning', value: report.memory.states.Learning, color: stateColors.Learning },
                      { label: 'Relearning', value: report.memory.states.Relearning, color: stateColors.Relearning },
                      { label: 'New', value: report.memory.states.New, color: stateColors.New },
                    ].map((row) => (
                      <View key={row.label} className="flex-row items-center">
                        <View
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <AppText
                          variant="caption"
                          weight="medium"
                          tone="muted"
                          className="mx-2 flex-1"
                          numberOfLines={1}
                        >
                          {row.label}
                        </AppText>
                        <AppText variant="bodySm" weight="semibold">
                          {formatCount(row.value)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>

                <MetricGrid
                  className="mt-4"
                  columns={2}
                  items={[
                    {
                      label: narrow ? 'At risk' : 'Below target',
                      value: formatCount(report.memory.retention.atRisk),
                      note: `target ${pct(report.memory.retention.threshold)}`,
                      color:
                        report.memory.retention.atRisk > 0 ? colors.warning : undefined,
                    },
                    {
                      label: width < 420 ? 'Predicted' : 'Predicted recall',
                      value: pct(report.memory.retention.meanRetrievability),
                      note: 'FSRS estimate, now',
                    },
                  ]}
                />

                <AppText variant="caption" tone="tertiary" className="mt-3">
                  “In review schedule” means a card has graduated to long intervals, not
                  that it is mastered. Retrievability is an FSRS probability estimate, not
                  a measured retention test.
                </AppText>
              </GlassCard>

              {report.memory.stability.sampleSize > 0 ? (
                <GlassCard className="mt-3" padding="sm">
                  <AppText variant="label" tone="muted" className="mb-3 uppercase">
                    Stability
                  </AppText>
                  <DistributionList
                    hideEmptyBars
                    items={report.memory.stability.buckets.map((bucket) => ({
                      key: bucket.key,
                      label: bucket.label,
                      count: bucket.count,
                      share: bucket.share,
                      color: colors.primary,
                    }))}
                  />
                  <AppText variant="caption" tone="tertiary" className="mt-2">
                    Median stability {num(report.memory.stability.median)} days across{' '}
                    {report.memory.stability.sampleSize} reviewed cards.
                  </AppText>
                </GlassCard>
              ) : null}

              {report.memory.attention.length > 0 ? (
                <GlassCard className="mt-3" padding="sm">
                  <AppText variant="label" tone="muted" className="uppercase">
                    Needs attention
                  </AppText>
                  {report.memory.attention.slice(0, 3).map((card) => (
                    <View key={card.cardId} className="mt-3">
                      <View className="flex-row items-start">
                        <AppText
                          variant="bodySm"
                          weight="semibold"
                          className="flex-1"
                          numberOfLines={1}
                        >
                          {card.front || 'Untitled card'}
                        </AppText>
                        <AppText variant="caption" tone="warning" className="ml-2">
                          {card.lapses} lapses
                        </AppText>
                      </View>
                      <AppText variant="caption" tone="muted" className="mt-0.5">
                        {card.deckName} · R {pct(card.retrievability)} ·{' '}
                        {card.overdueDays > 0
                          ? `${card.overdueDays}d overdue`
                          : 'due now'}
                      </AppText>
                    </View>
                  ))}
                </GlassCard>
              ) : null}

              {report.memory.coverage.nonFsrsDecks > 0 ? (
                <AppText variant="caption" tone="tertiary" className="mt-2">
                  {report.memory.coverage.note}
                </AppText>
              ) : null}
            </RevealItem>
          ) : null}

          {/* Study behaviour */}
          <RevealItem index={3}>
            <SectionHeading
              className="mt-7"
              label="Study habits"
              hint={`${report.behavior.sessions.count} sessions`}
            />
            <MetricGrid
              className="mt-3"
              columns={2}
              items={[
                {
                  label: 'Consistency',
                  value: pct(report.behavior.consistency.activeDayRatio),
                  note: `${report.performance.volume.activeDays} of ${report.range.days} days`,
                },
                {
                  label: narrow ? 'Streak' : 'Current streak',
                  value: `${report.overview.streak}d`,
                  note: `longest ${report.overview.longestStreak}d`,
                },
              ]}
            />

            <GlassCard className="mt-3">
              <AppText variant="label" tone="muted" className="uppercase">
                When you study
              </AppText>
              <View className="mt-3">
                <MiniBarChart
                  data={report.performance.weekday.map((point) => ({
                    value: point.reviews,
                    label: point.label.slice(0, 2),
                    highlight: point.weekday === new Date(now).getDay(),
                  }))}
                  height={56}
                  showValues
                  emptyLabel="No reviews in this range."
                />
              </View>
              <AppText variant="caption" tone="muted" className="mt-2">
                {report.behavior.bestWeekday
                  ? `${report.behavior.bestWeekday.label} is your most active day (${report.behavior.bestWeekday.reviews} reviews).`
                  : 'No dominant study day yet.'}
                {report.behavior.bestHour
                  ? ` Most reviews happen ${report.behavior.bestHour.label}.`
                  : ''}{' '}
                Today is highlighted.
              </AppText>
            </GlassCard>

            <GlassCard className="mt-3" padding="sm">
              <View className="flex-row items-center">
                <MaterialIcons name="schedule" size={iconSize.sm} color={colors.outline} />
                <AppText variant="bodySm" weight="semibold" className="ml-2 flex-1">
                  Sessions
                </AppText>
                <AppText variant="bodySm" tone="muted">
                  {report.behavior.sessions.count}
                </AppText>
              </View>
              <AppText variant="caption" tone="muted" className="mt-1">
                {medianSessionReviews === null
                  ? 'No sessions in this range.'
                  : `Median ${num(medianSessionReviews, 0)} ${
                      Math.round(medianSessionReviews) === 1 ? 'review' : 'reviews'
                    } over ${formatDuration(
                      report.behavior.sessions.medianDurationMs
                    )}.`}
                {report.performance.efficiency.successfulReviewsPerMinute !== null
                  ? ` ${num(
                      report.performance.efficiency.successfulReviewsPerMinute,
                      2
                    )} successful reviews per minute.`
                  : ''}
              </AppText>
              {report.behavior.intraSession.status === 'ok' &&
              report.behavior.intraSession.direction !== 'stable' ? (
                <AppText variant="caption" tone="tertiary" className="mt-1.5">
                  In long sessions, the last third recalled{' '}
                  {pct(report.behavior.intraSession.lastRate)} against{' '}
                  {pct(report.behavior.intraSession.firstRate)} in the first. This is an
                  association in your data, not proof of fatigue.
                </AppText>
              ) : null}
            </GlassCard>
          </RevealItem>

          {/* Decks */}
          {reviewedDecks.length > 0 ? (
            <RevealItem index={4}>
              <SectionHeading
                className="mt-7"
                label="Decks"
                hint={`${report.decks.comparableCount} comparable`}
              />
              <GlassCard className="mt-3" padding="none">
                {reviewedDecks.map((deck, index) => (
                  <View
                    key={deck.deckId}
                    className={index === 0 ? 'px-5 py-4' : 'px-5 pb-4'}
                  >
                    <View className="flex-row items-center">
                      <AppText
                        variant="bodySm"
                        weight="semibold"
                        className="flex-1"
                        numberOfLines={1}
                      >
                        {deck.name}
                      </AppText>
                      <Pill label={algorithmLabel(deck.algorithm)} />
                      <AppText
                        variant="bodySm"
                        weight="semibold"
                        className="ml-3"
                        style={{
                          color:
                            deck.vsLibrary === 'above'
                              ? colors.success
                              : deck.vsLibrary === 'below'
                                ? colors.warning
                                : colors.onSurfaceVariant,
                        }}
                      >
                        {pct(deck.recall.successRate)}
                      </AppText>
                    </View>
                    <AppText variant="caption" tone="muted" className="mt-1">
                      {deck.reviews} reviews · {VS_LIBRARY[deck.vsLibrary]} ·{' '}
                      {deck.due.overdue} overdue
                      {deck.lapse.rate !== null
                        ? ` · ${pct(deck.lapse.rate)} lapsed`
                        : ''}
                    </AppText>
                  </View>
                ))}
              </GlassCard>
            </RevealItem>
          ) : null}

          {/* Predictions */}
          <RevealItem index={5}>
            <SectionHeading className="mt-7" label="Next 7 days" hint="prediction" />
            <GlassCard className="mt-3">
              <MiniBarChart
                data={report.forecast.workload.daily.map((day) => ({
                  value: day.count,
                  label: weekdayShortOf(day.dayStart),
                  highlight: day.dayStart === report.range.end,
                }))}
                height={56}
                showValues
                emptyLabel="Nothing scheduled in the next 7 days."
              />
              <View className="mt-4 flex-row gap-2">
                <StatPill
                  value={formatCount(report.forecast.workload.overdue)}
                  label="Overdue"
                  color={colors.warning}
                />
                <StatPill
                  value={formatCount(report.forecast.workload.dueToday)}
                  label="Due today"
                />
                <StatPill
                  value={formatCount(
                    Math.max(0, report.forecast.workload.next7 - report.forecast.workload.dueToday)
                  )}
                  label={narrow ? 'Next 6d' : 'Next 6 days'}
                />
              </View>
              <AppText variant="caption" tone="tertiary" className="mt-2">
                Scheduled cards only; the first bar is today. New cards are introduced by
                your daily cap, not by a due date.
              </AppText>
            </GlassCard>

            <GlassCard className="mt-3" padding="sm">
              <AppText variant="label" tone="muted" className="uppercase">
                Expected work
              </AppText>
              {report.forecast.volume.seven.status === 'ok' ? (
                <AppText variant="bodySm" tone="muted" className="mt-1.5">
                  About{' '}
                  <AppText variant="bodySm" weight="semibold">
                    {Math.round(report.forecast.volume.seven.expectedReviews ?? 0)}
                  </AppText>{' '}
                  reviews ({num(report.forecast.volume.seven.expectedPerDay)}/day), with an
                  80% range of{' '}
                  {Math.round(report.forecast.volume.seven.interval?.low ?? 0)}–
                  {Math.round(report.forecast.volume.seven.interval?.high ?? 0)}. This
                  assumes your last four weeks continue.
                </AppText>
              ) : (
                <AppText variant="bodySm" tone="muted" className="mt-1.5">
                  {report.forecast.volume.seven.confidence.rationale}
                </AppText>
              )}

              <View className="mt-3">
                <AppText variant="caption" tone="muted">
                  New cards:{' '}
                  {report.forecast.backlog.status === 'ok'
                    ? `${num(report.forecast.backlog.newPerWeek)}/week; ${
                        report.forecast.backlog.remainingNewCards
                      } remaining, about ${Math.ceil(
                        report.forecast.backlog.weeks ?? 0
                      )} weeks at that pace.`
                    : report.forecast.backlog.confidence.rationale}
                </AppText>
                <AppText variant="caption" tone="muted" className="mt-1">
                  Recall at next due:{' '}
                  {report.forecast.retention.status === 'ok'
                    ? `${pct(
                        report.forecast.retention.meanPredictedRetrievability
                      )} by FSRS — a model estimate, not measured retention.`
                    : report.forecast.retention.note}
                </AppText>
              </View>
            </GlassCard>
          </RevealItem>

          {/* Insights */}
          <RevealItem index={6}>
            <SectionHeading
              className="mt-7"
              label="What stands out"
              hint={report.insights.status === 'ok' ? 'evidence-gated' : 'limited data'}
            />
            {report.insights.status === 'ok' ? (
              <>
                {report.insights.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                  />
                ))}
                {report.insights.insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </>
            ) : (
              <GlassCard className="mt-3">
                <EmptyState
                  icon="insights"
                  title="Not enough evidence yet"
                  description={`Insights appear once the data can separate a real change from noise: at least ${MIN_RECALL_SAMPLE} rated reviews, and ${MIN_TREND_POINTS} days of history for a trend. This range has ${report.performance.recall.sampleSize} rated reviews over ${report.range.days} days.`}
                />
              </GlassCard>
            )}
          </RevealItem>

          {/* Fixed reports */}
          <RevealItem index={7}>
            <SectionHeading className="mt-7" label="Reports" hint="fixed windows" />
            <GlassCard className="mt-3" padding="none">
              {[report.reports.daily, report.reports.weekly, report.reports.monthly].map(
                (period) => (
                  <View key={period.period} className="px-5 py-4">
                    <View className="flex-row items-center justify-between">
                      <AppText variant="bodySm" weight="semibold">
                        {period.label}
                      </AppText>
                      <AppText variant="bodySm" tone="muted">
                        {formatCount(period.reviews)} reviews
                      </AppText>
                    </View>
                    <AppText variant="caption" tone="muted" className="mt-1">
                      {period.activeDays} active day
                      {period.activeDays === 1 ? '' : 's'} ·{' '}
                      {formatDuration(period.studyTimeMs)} ·{' '}
                      {period.successRate === null
                        ? 'recall needs 10 reviews'
                        : `${pct(period.successRate)} recall`}
                    </AppText>
                    {period.topDeck ? (
                      <AppText variant="caption" tone="tertiary" className="mt-0.5">
                        Top deck: {period.topDeck.name} ({period.topDeck.reviews})
                      </AppText>
                    ) : null}
                  </View>
                )
              )}
            </GlassCard>
          </RevealItem>

          {/* Method and data quality */}
          <RevealItem index={8}>
            <GlassCard tone="inset" className="mt-3" padding="sm">
              <AppText variant="label" tone="muted" className="uppercase">
                How to read this
              </AppText>
              <AppText variant="caption" tone="muted" className="mt-2">
                Again counts as a failed recall; Hard, Good and Easy count as successful.
                Percentages appear after {MIN_RECALL_SAMPLE} rated reviews, with a 95%
                Wilson interval. Trends need 20 reviews in each window and 8 days of
                history.
              </AppText>
              <AppText variant="caption" tone="muted" className="mt-1.5">
                Memory numbers come from FSRS state on FSRS decks only. Retrievability is
                the model’s probability estimate — actual retention cannot be measured
                from a review log.
              </AppText>
              <AppText variant="caption" tone="tertiary" className="mt-1.5">
                Computed on this device from {formatCount(report.dataQuality.usableCount)}{' '}
                usable reviews
                {report.coverage.archivedDecks > 0
                  ? `; ${report.coverage.archivedDecks} archived deck${
                      report.coverage.archivedDecks === 1 ? '' : 's'
                    } excluded`
                  : ''}
                .
              </AppText>
            </GlassCard>

            {report.dataQuality.excludedCount > 0 ||
            report.dataQuality.issues.length > 0 ? (
              <GlassCard tone="inset" className="mt-3" padding="sm">
                <AppText variant="label" tone="muted" className="uppercase">
                  Data check
                </AppText>
                <AppText variant="caption" tone="muted" className="mt-1">
                  {formatCount(report.dataQuality.usableCount)} of{' '}
                  {formatCount(report.dataQuality.rawCount)} stored reviews were usable;{' '}
                  {formatCount(report.dataQuality.excludedCount)} excluded.
                </AppText>
                {report.dataQuality.issues.map((issue) => (
                  <AppText
                    key={issue.kind}
                    variant="caption"
                    tone="tertiary"
                    className="mt-1"
                  >
                    · {issue.count} {ISSUE_LABEL[issue.kind]}: {issue.detail}
                  </AppText>
                ))}
              </GlassCard>
            ) : null}
          </RevealItem>
        </>
      )}
    </Screen>
  );
}
