import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Animated,
  Platform,
  Share,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../components/Icon';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import {
  AppText,
  DonutChart,
  EmptyState,
  MiniBarChart,
  Screen,
  SegmentedControl,
  StatisticsSkeleton,
} from '../components';
import {
  ActionButton,
  HeaderIcon,
  PageHeader,
  SectionHeading,
  Surface,
} from '../components/v3';
import { prefersReducedMotion } from '../motion';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  motion,
  radii,
  rims,
  stateColors,
} from '../theme/tokens';
import { v3 } from '../theme/v3';
import {
  buildIntelligence,
  MIN_RECALL_SAMPLE,
  MIN_TREND_POINTS,
  RANGE_OPTIONS,
} from '../data/intelligence';
import type {
  DataQualityIssueKind,
  DeckIntelligence,
  RecommendationPriority,
} from '../data/intelligence';
import type {
  InsightTone,
  IntelligenceReport,
} from '../data/intelligence/core/types';
import { schedulerLabel } from '../data/schedulers';
import { goBackOr, pushOnce } from '../services/navigation';

const CONTENT_MAX = 760;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

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

const RECALL_RATING_COLORS = {
  good: colors.success,
  easy: colors.primaryContainer,
  hard: colors.warning,
  again: colors.error,
};

const formatCount = (value: number) => value.toLocaleString('en-US');

const pct = (value: number | null) =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

const pct1 = (value: number | null) => {
  if (value === null) return '—';
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded}%`;
};

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

function formatReviewTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  if (ms < 60_000) {
    const seconds = ms / 1000;
    return seconds < 10
      ? `${seconds.toFixed(1).replace(/\.0$/, '')}s`
      : `${Math.round(seconds)}s`;
  }
  return formatDuration(ms);
}

async function copyOrShare(text: string): Promise<'copied' | 'shared'> {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Clipboard permission can be denied; fall through to the share sheet.
    }
  }
  await Share.share({ message: text });
  return 'shared';
}

type StatsSectionProps = {
  title: string;
  count?: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

function StatsSection({ title, count, hint, children, style }: StatsSectionProps) {
  return (
    <View style={[{ marginTop: v3.spacing.page }, style]}>
      <SectionHeading label={title} count={count} hint={hint} />
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function TinyPill({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: accent ? alpha(colors.primary, 0.13) : colors.surfaceControl,
        borderWidth: 1,
        borderColor: accent ? alpha(colors.primary, 0.3) : rims.soft,
      }}
    >
      <AppText
        variant="caption"
        weight="medium"
        tone={accent ? 'accent' : 'muted'}
        style={{ fontSize: 11, letterSpacing: 0.2 }}
      >
        {label}
      </AppText>
    </View>
  );
}

type StatsCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: 'pane' | 'inset';
  padding?: 'none' | 'sm' | 'md';
};

function StatsCard({ children, style, tone = 'pane', padding = 'md' }: StatsCardProps) {
  return (
    <Surface
      tone={tone}
      radius="card"
      padding={padding}
      style={[{ borderWidth: 1, borderColor: rims.soft }, style ?? {}]}
    >
      {children}
    </Surface>
  );
}

type ShareNotice = {
  id: number;
  message: string;
};

function ShareToast({ message }: { message: string }) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      reveal.setValue(1);
      return;
    }
    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.fast,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [reveal]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: heights.pageHeader + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: rims.soft,
          backgroundColor: colors.surfaceCardFace,
          shadowColor: colors.background,
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          opacity: reveal,
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        }}
      >
        <MaterialIcons name="check-circle" size={18} color={colors.success} />
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={2}
          style={{ textAlign: 'center' }}
        >
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

type VolumeBar = {
  label: string;
  value: number;
  highlight: boolean;
};

function buildVolumeBars(
  points: readonly { dayStart: number; value: number }[],
  rangeDays: number
): VolumeBar[] {
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const start = Math.floor((index * points.length) / 7);
    const end = Math.max(start + 1, Math.floor(((index + 1) * points.length) / 7));
    const slice = points.slice(start, end);
    const first = points[start] ?? points[0];
    return {
      value: slice.reduce((sum, point) => sum + point.value, 0),
      label:
        rangeDays <= 7
          ? first
            ? WEEKDAY_LETTER[new Date(first.dayStart).getDay()]
            : '·'
          : rangeDays <= 30
            ? `W${index + 1}`
            : `M${index + 1}`,
    };
  });

  const peak = Math.max(0, ...buckets.map((bucket) => bucket.value));
  const peakIndex = peak > 0 ? buckets.findIndex((bucket) => bucket.value === peak) : -1;
  return buckets.map((bucket, index) => ({
    ...bucket,
    highlight: index === peakIndex,
  }));
}

function VolumeBars({ bars, total }: { bars: VolumeBar[]; total: number }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <View
      accessible
      accessibilityRole="img"
      accessibilityLabel={`${formatCount(total)} reviews across ${bars.length} intervals`}
    >
      <View
        style={{
          height: v3.rail.activityPlot,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {bars.map((bar, index) => (
          <View
            key={`${bar.label}-${index}`}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
          >
            {bar.highlight && bar.value > 0 ? (
              <AppText
                variant="caption"
                weight="semibold"
                tone="accent"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCount(bar.value)}
              </AppText>
            ) : (
              <View style={{ height: 16 }} />
            )}
            <View
              style={{
                width: '100%',
                maxWidth: 40,
                height: Math.max(
                  v3.rail.activityMin,
                  Math.round((bar.value / max) * v3.rail.activity)
                ),
                borderRadius: 6,
                backgroundColor: bar.highlight
                  ? colors.primaryContainer
                  : alpha(colors.primaryContainer, 0.32),
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        {bars.map((bar, index) => (
          <View key={`${bar.label}-label-${index}`} style={{ flex: 1, alignItems: 'center' }}>
            <AppText
              variant="caption"
              weight={bar.highlight ? 'semibold' : 'regular'}
              tone={bar.highlight ? 'accent' : 'tertiary'}
            >
              {bar.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function HeroRangeControl({
  rangeDays,
  onChange,
}: {
  rangeDays: number;
  onChange: (days: number) => void;
}) {
  return (
    <SegmentedControl
      segments={RANGE_OPTIONS.map((days) => ({
        key: String(days),
        label: `${days} days`,
        active: rangeDays === days,
        onPress: () => onChange(days),
      }))}
    />
  );
}

function HeroLedger({ report }: { report: IntelligenceReport }) {
  const due = report.forecast.workload.overdue + report.forecast.workload.dueToday;
  const cells: { label: string; value: string; note: string; ariaLabel: string }[] = [
    {
      label: 'Reviews',
      value: formatCount(report.overview.totalReviews),
      note: report.range.label,
      ariaLabel: `${formatCount(
        report.overview.totalReviews
      )} reviews in ${report.range.label.toLowerCase()}`,
    },
    {
      label: 'Streak',
      value: `${formatCount(report.overview.streak)}d`,
      note: 'All time',
      ariaLabel: `${formatCount(report.overview.streak)} day streak, all time`,
    },
    {
      label: 'Due',
      value: formatCount(due),
      note: 'Now',
      ariaLabel: `${formatCount(due)} cards due now`,
    },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: radii.control,
        backgroundColor: fills.inset,
      }}
    >
      {cells.map((cell, index) => (
        <View
          key={cell.label}
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: 8,
            borderStartWidth: index === 0 ? 0 : 1,
            borderStartColor: rims.soft,
          }}
        >
          <AppText variant="caption" tone="muted" className="uppercase" numberOfLines={1}>
            {cell.label}
          </AppText>
          <AppText
            accessibilityLabel={cell.ariaLabel}
            variant="title"
            numberOfLines={1}
            style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
          >
            {cell.value}
          </AppText>
          <AppText variant="caption" tone="tertiary" numberOfLines={3} style={{ marginTop: 2 }}>
            {cell.note}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function OverviewHero({
  report,
  rangeDays,
  wide,
  onRangeChange,
}: {
  report: IntelligenceReport;
  rangeDays: number;
  wide: boolean;
  onRangeChange: (days: number) => void;
}) {
  const { overview, performance } = report;
  const bars = buildVolumeBars(performance.activity.points, rangeDays);
  const recall = performance.recall;
  const hasRecall = recall.successRate !== null;
  const schedulerScope =
    report.coverage.nonFsrsDecks === 0 && report.coverage.fsrsDecks > 0
      ? 'FSRS-6'
      : 'All decks';
  const heroType = wide ? v3.type.heroWide : v3.type.hero;

  return (
    <Surface tone="scene" radius="pane" padding="md">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <AppText
          variant="caption"
          weight="semibold"
          tone="accent"
          className="uppercase"
          style={{ flex: 1, letterSpacing: 1.4 }}
        >
          {`${report.range.label} · intelligence`}
        </AppText>
        <TinyPill
          label={hasRecall ? schedulerScope : 'Not enough data'}
          accent={hasRecall}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          columnGap: 8,
          rowGap: 2,
          marginTop: 8,
        }}
      >
        <AppText
          accessibilityLabel={
            hasRecall
              ? `${pct1(recall.successRate)} successful recall`
              : `${formatCount(overview.totalReviews)} reviews`
          }
          style={[heroType, { fontVariant: ['tabular-nums'] }]}
        >
          {hasRecall ? pct1(recall.successRate) : formatCount(overview.totalReviews)}
        </AppText>
        <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 8 }}>
          {hasRecall ? 'successful recall' : 'reviews'}
        </AppText>
      </View>

      <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
        {hasRecall
          ? `${formatCount(recall.sampleSize)} rated reviews · ${formatCount(
              overview.deckCount
            )} decks · ${formatCount(overview.activeDays)} active days · ${formatDuration(
              overview.studyTimeMs
            )} studied`
          : `Recall appears after ${MIN_RECALL_SAMPLE} rated reviews — this range has ${recall.sampleSize}.`}
      </AppText>

      <View style={{ marginTop: 16 }}>
        <HeroRangeControl rangeDays={rangeDays} onChange={onRangeChange} />
      </View>

      <HeroLedger report={report} />

      <View
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: radii.control,
          backgroundColor: fills.inset,
        }}
      >
        <VolumeBars bars={bars} total={overview.totalReviews} />
      </View>
    </Surface>
  );
}

function EmptyRangeScene({
  report,
  rangeDays,
  wide,
  onRangeChange,
  onStart,
}: {
  report: IntelligenceReport;
  rangeDays: number;
  wide: boolean;
  onRangeChange: (days: number) => void;
  onStart: () => void;
}) {
  const heroType = wide ? v3.type.heroWide : v3.type.hero;

  return (
    <Surface tone="scene" radius="pane" padding="md" style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <AppText
          variant="caption"
          weight="semibold"
          tone="accent"
          className="uppercase"
          style={{ flex: 1, letterSpacing: 1.4 }}
        >
          {`${report.range.label} · no reviews`}
        </AppText>
        <TinyPill label="Not enough data" />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginTop: 8,
        }}
      >
        <AppText
          accessibilityLabel="0 reviews"
          style={[heroType, { fontVariant: ['tabular-nums'] }]}
        >
          0
        </AppText>
        <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 8 }}>
          reviews
        </AppText>
      </View>

      <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
        {`No reviews in the last ${rangeDays} days. Recall needs ${MIN_RECALL_SAMPLE} rated reviews, and memory and workload need review history in this range; a longer range may already contain it.`}
      </AppText>

      <View style={{ marginTop: 16 }}>
        <HeroRangeControl rangeDays={rangeDays} onChange={onRangeChange} />
      </View>

      <View style={{ marginTop: 20 }}>
        <ActionButton label="Start a session" icon="play-arrow" onPress={onStart} />
      </View>

      {report.coverage.archivedDecks > 0 ? (
        <AppText variant="caption" tone="tertiary" style={{ marginTop: 12 }}>
          {`${report.coverage.archivedDecks} archived deck${
            report.coverage.archivedDecks === 1 ? ' is' : 's are'
          } excluded from this analysis.`}
        </AppText>
      ) : null}
    </Surface>
  );
}

function RecallTile({
  label,
  color,
  count,
  share,
}: {
  label: string;
  color: string;
  count: number;
  share: number | null;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        minWidth: 120,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radii.control,
        borderWidth: 1,
        borderColor: rims.soft,
        backgroundColor: fills.inset,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText
        variant="bodySm"
        weight="semibold"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {share === null ? '—' : `${Math.round(share * 100)}%`}
      </AppText>
      <AppText variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
        {`(${formatCount(count)})`}
      </AppText>
    </View>
  );
}

function RecallCard({ report }: { report: IntelligenceReport }) {
  const recall = report.performance.recall;
  const legend = [
    {
      key: 'good',
      label: 'Good',
      count: recall.counts.good,
      share: recall.shares.good,
      color: RECALL_RATING_COLORS.good,
    },
    {
      key: 'easy',
      label: 'Easy',
      count: recall.counts.easy,
      share: recall.shares.easy,
      color: RECALL_RATING_COLORS.easy,
    },
    {
      key: 'hard',
      label: 'Hard',
      count: recall.counts.hard,
      share: recall.shares.hard,
      color: RECALL_RATING_COLORS.hard,
    },
    {
      key: 'again',
      label: 'Again',
      count: recall.counts.again,
      share: recall.shares.again,
      color: RECALL_RATING_COLORS.again,
    },
  ];
  const segments = legend.filter((item) => item.count > 0);

  return (
    <StatsCard>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="display"
            weight="bold"
            style={[v3.type.stat, { letterSpacing: -0.8, fontVariant: ['tabular-nums'] }]}
          >
            {pct1(recall.successRate)}
          </AppText>
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
            {`Successful recall rate · ${report.range.label} · ${formatCount(
              recall.sampleSize
            )} rated`}
          </AppText>
        </View>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(
              recall.successRate === null ? colors.outline : colors.success,
              0.12
            ),
          }}
        >
          <MaterialIcons
            name={recall.successRate === null ? 'hourglass-empty' : 'check'}
            size={18}
            color={recall.successRate === null ? colors.outline : colors.success}
          />
        </View>
      </View>

      <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
        Again counts as a lapse; Hard, Good, and Easy count as retained.
      </AppText>

      {recall.successRate === null ? (
        <AppText variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
          {`Recall appears after ${MIN_RECALL_SAMPLE} rated reviews. This range has ${recall.sampleSize}.`}
        </AppText>
      ) : null}

      <View
        accessible
        accessibilityRole="img"
        accessibilityLabel={`${formatCount(recall.sampleSize)} rated reviews by rating`}
        style={{
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          flexDirection: 'row',
          backgroundColor: fills.track,
          marginTop: 16,
        }}
      >
        {segments.map((item) => (
          <View
            key={item.key}
            style={{ flex: item.count, backgroundColor: item.color }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {legend.map((item) => (
          <RecallTile
            key={item.key}
            label={item.label}
            color={item.color}
            count={item.count}
            share={item.share}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="timer" size={14} color={colors.outline} />
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              Median review time
            </AppText>
          </View>
          <AppText
            variant="body"
            weight="semibold"
            style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}
          >
            {formatReviewTime(report.performance.duration.medianMs)}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="analytics" size={14} color={colors.outline} />
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              Avg per active day
            </AppText>
          </View>
          <AppText
            variant="body"
            weight="semibold"
            style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}
          >
            {`${num(report.performance.volume.perActiveDay, 0)} reviews`}
          </AppText>
        </View>
      </View>
    </StatsCard>
  );
}

function MemoryLegendRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="caption" weight="medium" tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {formatCount(count)}
      </AppText>
      <AppText variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
        {total > 0 ? `(${Math.round((count / total) * 100)}%)` : '(—)'}
      </AppText>
    </View>
  );
}

function MemorySubMetric({
  label,
  value,
  note,
  color,
  divider = false,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        paddingHorizontal: 4,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: rims.soft,
      }}
    >
      <AppText variant="caption" tone="tertiary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText
        variant="bodySm"
        weight="semibold"
        numberOfLines={1}
        style={{ color, marginTop: 3, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
        {note}
      </AppText>
    </View>
  );
}

function MemoryCard({
  report,
  narrow,
}: {
  report: IntelligenceReport;
  narrow: boolean;
}) {
  const memory = report.memory;
  const total = memory.coverage.fsrsCards;
  if (total <= 0) return null;

  const rows = [
    {
      label: 'In review',
      value: memory.states.Review,
      color: stateColors.Review,
    },
    {
      label: 'Learning',
      value: memory.states.Learning,
      color: stateColors.Learning,
    },
    {
      label: 'Relearning',
      value: memory.states.Relearning,
      color: stateColors.Relearning,
    },
    {
      label: 'New',
      value: memory.states.New,
      color: stateColors.New,
    },
  ];

  return (
    <StatsCard>
      <View
        style={{
          flexDirection: narrow ? 'column' : 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <DonutChart
          size={narrow ? 104 : 112}
          strokeWidth={10}
          centerLabel={formatCount(total)}
          centerSubtitle="active"
          segments={[
            {
              value: memory.states.Review,
              color: stateColors.Review,
              label: 'In review',
            },
            {
              value: memory.states.Learning,
              color: stateColors.Learning,
              label: 'Learning',
            },
            {
              value: memory.states.Relearning,
              color: stateColors.Relearning,
              label: 'Relearning',
            },
            {
              value: memory.states.New,
              color: stateColors.New,
              label: 'New',
            },
          ]}
        />
        <View
          style={{
            flex: narrow ? undefined : 1,
            width: narrow ? '100%' : undefined,
            gap: 8,
          }}
        >
          {rows.map((row) => (
            <MemoryLegendRow
              key={row.label}
              label={row.label}
              count={row.value}
              total={total}
              color={row.color}
            />
          ))}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: 16,
          padding: 12,
          borderRadius: radii.control,
          borderWidth: 1,
          borderColor: rims.soft,
          backgroundColor: fills.inset,
        }}
      >
        <MemorySubMetric
          label="Predicted"
          value={pct1(memory.retention.meanRetrievability)}
          note="Now"
          color={colors.success}
        />
        <MemorySubMetric
          divider
          label={narrow ? 'At risk' : 'Below target'}
          value={formatCount(memory.retention.atRisk)}
          note={
            narrow
              ? pct1(memory.retention.threshold)
              : `target ${pct1(memory.retention.threshold)}`
          }
          color={memory.retention.atRisk > 0 ? colors.warning : colors.onSurface}
        />
        <MemorySubMetric
          divider
          label="Stability"
          value={
            memory.stability.median === null
              ? '—'
              : `${num(memory.stability.median)}d`
          }
          note={narrow ? 'Half-life' : 'Half-life span'}
          color={colors.primary}
        />
      </View>

      <AppText variant="caption" tone="tertiary" style={{ marginTop: 12 }}>
        Calculated entirely on-device via FSRS-6 memory model.
      </AppText>
    </StatsCard>
  );
}

function StudyHabitsCard({
  report,
  now,
  narrow,
}: {
  report: IntelligenceReport;
  now: number;
  narrow: boolean;
}) {
  const streak = report.overview.streak;
  const bestHour = report.behavior.bestHour?.label ?? '—';
  const today = new Date(now).getDay();
  const weekdayByDay = new Map(
    report.performance.weekday.map((point) => [point.weekday, point])
  );

  return (
    <StatsCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(colors.warning, 0.14),
          }}
        >
          <MaterialIcons name="local-fire-department" size={18} color={colors.warning} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
            {streak > 0
              ? `${streak}-day ${narrow ? 'streak' : 'active streak'}`
              : narrow
                ? 'No streak'
                : 'No active streak'}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {narrow ? 'Cadence' : 'Current cadence'}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: narrow ? 92 : 130 }}>
          <AppText
            variant="bodySm"
            weight="semibold"
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {bestHour}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {narrow ? 'Peak hour' : 'Peak study hour'}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
        {WEEKDAY_ORDER.map((day) => {
          const point = weekdayByDay.get(day);
          const active = (point?.reviews ?? 0) > 0;
          const isToday = day === today;
          return (
            <View key={day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View
                accessible
                accessibilityRole="img"
                accessibilityLabel={`${WEEKDAY_LONG[day]}${isToday ? ', today' : ''}: ${
                  point?.reviews ?? 0
                } reviews`}
                style={{
                  width: '100%',
                  height: v3.rail.habit,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday
                    ? colors.primaryContainer
                    : active
                      ? alpha(colors.success, 0.18)
                      : fills.inset,
                  borderWidth: 1,
                  borderColor: isToday ? colors.primaryContainer : rims.soft,
                }}
              >
                {active || isToday ? (
                  <MaterialIcons
                    name={isToday ? 'star' : 'check'}
                    size={16}
                    color={isToday ? colors.onPrimary : colors.success}
                  />
                ) : null}
              </View>
              <AppText
                variant="caption"
                weight={isToday ? 'semibold' : 'regular'}
                tone={isToday ? 'accent' : 'muted'}
              >
                {WEEKDAY_LETTER[day]}
              </AppText>
            </View>
          );
        })}
      </View>

      <AppText
        variant="caption"
        tone="muted"
        style={{ marginTop: 12, fontVariant: ['tabular-nums'] }}
      >
        {`${report.performance.volume.activeDays} of ${report.range.days} days active · today starred.`}
      </AppText>
    </StatsCard>
  );
}

function DeckCard({ deck }: { deck: DeckIntelligence }) {
  const rate = deck.recall.successRate;
  const recallColor =
    rate === null
      ? colors.outline
      : rate >= 0.85
        ? colors.success
        : rate >= 0.7
          ? colors.warning
          : colors.error;
  const status =
    deck.due.overdue > 0 ? `${formatCount(deck.due.overdue)} overdue` : VS_LIBRARY[deck.vsLibrary];
  const statusColor =
    deck.due.overdue > 0
      ? colors.warning
      : deck.vsLibrary === 'above'
        ? colors.success
        : deck.vsLibrary === 'below'
          ? colors.warning
          : colors.onSurfaceVariant;

  return (
    <Surface
      tone="pane"
      radius="card"
      padding="sm"
      style={{ borderWidth: 1, borderColor: rims.soft }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText
              variant="bodySm"
              weight="semibold"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {deck.name}
            </AppText>
            <TinyPill label={schedulerLabel(deck.algorithm)} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              marginTop: 4,
            }}
          >
            <AppText
              variant="caption"
              tone="muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${formatCount(deck.reviews)} reviews · `}
            </AppText>
            <AppText
              variant="caption"
              weight="medium"
              style={{ color: statusColor, fontVariant: ['tabular-nums'] }}
            >
              {status}
            </AppText>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText
            variant="bodySm"
            weight="semibold"
            style={{ color: recallColor, fontVariant: ['tabular-nums'] }}
          >
            {pct(rate)}
          </AppText>
          <AppText variant="caption" tone="muted">
            Recall
          </AppText>
        </View>
      </View>
    </Surface>
  );
}

function ForecastCard({
  report,
  narrow,
}: {
  report: IntelligenceReport;
  narrow: boolean;
}) {
  const workload = report.forecast.workload;
  const target =
    report.forecast.retention.desiredRetention ?? report.memory.retention.threshold;
  const daily = workload.daily.map((day, index) => ({
    value: day.count,
    label: index === 0 ? 'Today' : index === 1 ? 'Tom' : `+${index}d`,
    highlight: index === 0,
  }));

  return (
    <StatsCard>
      <MiniBarChart
        data={daily}
        height={narrow ? v3.rail.forecast : v3.rail.forecastWide}
        showValues
        emptyLabel="Nothing scheduled in the next 7 days."
      />
      <AppText variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
        {target === null
          ? 'Scheduled cards only; no retention target is set.'
          : `Forecast calculated using your optimal ${pct1(
              target
            )} retention target.`}
      </AppText>
    </StatsCard>
  );
}

type StandoutItem = {
  key: string;
  title: string;
  body: string;
  tag: string;
  color: string;
  icon: IconName;
};

const PRIORITY_TAG: Record<RecommendationPriority, string> = {
  high: 'High impact',
  medium: 'Suggested',
  low: 'Low priority',
};

const PRIORITY_COLOR: Record<RecommendationPriority, string> = {
  high: colors.success,
  medium: colors.primary,
  low: colors.outline,
};

const INSIGHT_TAG: Record<InsightTone, string> = {
  positive: 'Positive',
  neutral: 'Observation',
  attention: 'Actionable',
};

const INSIGHT_COLOR: Record<InsightTone, string> = {
  positive: colors.success,
  neutral: colors.primary,
  attention: colors.warning,
};

function InsightTile({ item }: { item: StandoutItem }) {
  return (
    <Surface
      tone="pane"
      radius="card"
      padding="sm"
      style={{ borderWidth: 1, borderColor: rims.soft }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(item.color, 0.12),
          }}
        >
          <MaterialIcons name={item.icon} size={18} color={item.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <AppText variant="bodySm" weight="semibold" style={{ flex: 1 }}>
              {item.title}
            </AppText>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: alpha(item.color, 0.12),
                borderWidth: 1,
                borderColor: alpha(item.color, 0.3),
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: item.color,
                  fontSize: 10,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                {item.tag}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {item.body}
          </AppText>
        </View>
      </View>
    </Surface>
  );
}

function ReportsCard({ report }: { report: IntelligenceReport }) {
  const periods = [report.reports.daily, report.reports.weekly, report.reports.monthly];
  return (
    <StatsCard padding="none" style={{ overflow: 'hidden' }}>
      {periods.map((period, index) => (
        <View
          key={period.period}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: index === periods.length - 1 ? 0 : 1,
            borderBottomColor: rims.soft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodySm" weight="semibold">
              {period.label}
            </AppText>
            <AppText
              variant="bodySm"
              tone="muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${formatCount(period.reviews)} reviews`}
            </AppText>
          </View>
          <AppText
            variant="caption"
            tone="muted"
            style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
          >
            {`${period.activeDays} active day${period.activeDays === 1 ? '' : 's'} · ${formatDuration(
              period.studyTimeMs
            )} · ${
              period.successRate === null
                ? 'recall needs 10 reviews'
                : `${pct(period.successRate)} recall`
            }`}
          </AppText>
          {period.topDeck ? (
            <AppText
              variant="caption"
              tone="tertiary"
              style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
            >
              {`Top deck: ${period.topDeck.name} (${period.topDeck.reviews})`}
            </AppText>
          ) : null}
        </View>
      ))}
    </StatsCard>
  );
}

export default function StatisticsScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const wide = width >= 900;
  const router = useRouter();
  const decks = useDeckStore((state) => state.decks);
  const cardsByDeck = useDeckStore((state) => state.cardsByDeck);
  const loaded = useDeckStore((state) => state.loaded);
  const reviewLog = useReviewStore((state) => state.reviewLog);

  const [rangeDays, setRangeDays] = useState<number>(30);
  const [now, setNow] = useState(() => Date.now());
  const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);

  useEffect(() => {
    if (!loaded) useDeckStore.getState().load();
    if (!reviewLog.length) useReviewStore.getState().load();
  }, [loaded, reviewLog.length]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!shareNotice) return;
    const id = setTimeout(() => setShareNotice(null), 2800);
    return () => clearTimeout(id);
  }, [shareNotice]);

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

  const standoutItems: StandoutItem[] = report
    ? [
        ...report.insights.recommendations.map((recommendation) => ({
          key: `recommendation-${recommendation.id}`,
          title: recommendation.action,
          body: recommendation.reason,
          tag: PRIORITY_TAG[recommendation.priority],
          color: PRIORITY_COLOR[recommendation.priority],
          icon: 'arrow-forward' as IconName,
        })),
        ...report.insights.insights.map((insight) => ({
          key: `insight-${insight.id}`,
          title: insight.title,
          body: insight.detail,
          tag: INSIGHT_TAG[insight.tone],
          color: INSIGHT_COLOR[insight.tone],
          icon:
            insight.tone === 'attention'
              ? ('warning' as IconName)
              : insight.tone === 'positive'
                ? ('trending-up' as IconName)
                : ('lightbulb' as IconName),
        })),
      ].slice(0, 2)
    : [];

  const forecastMinutes =
    report && report.forecast.workload.next7 > 0 && report.performance.duration.medianMs
      ? Math.max(
          1,
          Math.round(
            (report.performance.duration.medianMs * report.forecast.workload.next7) / 60_000
          )
        )
      : null;

  const handleShare = () => {
    if (!report) return;
    const recall = report.performance.recall.successRate;
    const text = [
      `Memora — ${report.range.label}`,
      `${formatCount(report.overview.totalReviews)} reviews · ${report.overview.deckCount} decks`,
      recall === null ? 'Recall needs more rated reviews.' : `${pct1(recall)} successful recall`,
    ].join('\n');
    void copyOrShare(text)
      .then((mode) => {
        setShareNotice({
          id: Date.now(),
          message:
            mode === 'copied'
              ? 'Statistics snapshot copied to clipboard'
              : 'Statistics snapshot ready to share',
        });
      })
      .catch(() => {});
  };

  const header = (
    <View style={{ zIndex: 20 }}>
      <PageHeader
        title="Statistics"
        back
        onBack={() => goBackOr(router, '/profile')}
        maxWidth={CONTENT_MAX}
        actions={<HeaderIcon icon="share" label="Share statistics" onPress={handleShare} />}
      />
      {shareNotice ? <ShareToast key={shareNotice.id} message={shareNotice.message} /> : null}
    </View>
  );

  return (
    <Screen scroll gutter contentMaxWidth={CONTENT_MAX} header={header}>
      {!loaded ? (
        <StatisticsSkeleton />
      ) : error || !report ? (
        <StatsCard style={{ marginTop: 16 }}>
          <EmptyState
            icon="error-outline"
            title="Analysis unavailable"
            description={error ?? 'The analysis could not be computed.'}
            titleVariant="headline"
          />
        </StatsCard>
      ) : report.performance.status === 'empty' ? (
        <EmptyRangeScene
          report={report}
          rangeDays={rangeDays}
          wide={wide}
          onRangeChange={setRangeDays}
          onStart={() => pushOnce(router, '/home')}
        />
      ) : (
        <>
          <OverviewHero
            report={report}
            rangeDays={rangeDays}
            wide={wide}
            onRangeChange={setRangeDays}
          />

          <StatsSection title="Recall rate">
            <RecallCard report={report} />
          </StatsSection>

          {report.memory.coverage.fsrsCards > 0 ? (
            <StatsSection title="Memory" count="FSRS-6">
              <MemoryCard report={report} narrow={narrow} />
            </StatsSection>
          ) : null}

          <StatsSection title="Study habits">
            <StudyHabitsCard report={report} now={now} narrow={narrow} />
          </StatsSection>

          {reviewedDecks.length > 0 ? (
            <StatsSection
              title="Deck breakdown"
              hint={`${reviewedDecks.length} studied`}
            >
              <View style={{ gap: 10 }}>
                {reviewedDecks.map((deck) => (
                  <DeckCard key={deck.deckId} deck={deck} />
                ))}
              </View>
            </StatsSection>
          ) : null}

          <StatsSection
            title="Next 7 days"
            hint={`Total: ${formatCount(report.forecast.workload.next7)}${
              forecastMinutes === null ? '' : ` (~${forecastMinutes}m)`
            }`}
          >
            <ForecastCard report={report} narrow={narrow} />
          </StatsSection>

          <StatsSection title="What stands out">
            {report.insights.status === 'ok' && standoutItems.length > 0 ? (
              <View style={{ gap: 10 }}>
                {standoutItems.map((item) => (
                  <InsightTile key={item.key} item={item} />
                ))}
              </View>
            ) : (
              <StatsCard>
                <EmptyState
                  icon="insights"
                  title="Not enough evidence yet"
                  description={`Insights appear once the data can separate a real change from noise: at least ${MIN_RECALL_SAMPLE} rated reviews, and ${MIN_TREND_POINTS} days of history for a trend. This range has ${report.performance.recall.sampleSize} rated reviews over ${report.range.days} days.`}
                />
              </StatsCard>
            )}
          </StatsSection>

          <StatsSection title="Reports" hint="fixed windows">
            <ReportsCard report={report} />
          </StatsSection>

          <Surface
            tone="inset"
            radius="card"
            padding="sm"
            style={{ marginTop: 12, borderWidth: 1, borderColor: rims.soft }}
          >
            <AppText variant="label" tone="muted" style={{ textTransform: 'uppercase' }}>
              How to read this
            </AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
              Again counts as a failed recall; Hard, Good and Easy count as successful.
              Percentages appear after {MIN_RECALL_SAMPLE} rated reviews, with a 95% Wilson
              interval. Trends need 20 reviews in each window and 8 days of history.
            </AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
              Memory numbers come from FSRS state on FSRS decks only. Retrievability is the
              model’s probability estimate — actual retention cannot be measured from a
              review log.
            </AppText>
            <AppText variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
              {`Computed on this device from ${formatCount(
                report.dataQuality.usableCount
              )} usable reviews${
                report.coverage.archivedDecks > 0
                  ? `; ${report.coverage.archivedDecks} archived deck${
                      report.coverage.archivedDecks === 1 ? '' : 's'
                    } excluded`
                  : ''
              }.`}
            </AppText>
          </Surface>

          {report.dataQuality.excludedCount > 0 || report.dataQuality.issues.length > 0 ? (
            <Surface
              tone="inset"
              radius="card"
              padding="sm"
              style={{ marginTop: 10, borderWidth: 1, borderColor: rims.soft }}
            >
              <AppText variant="label" tone="muted" style={{ textTransform: 'uppercase' }}>
                Data check
              </AppText>
              <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {`${formatCount(report.dataQuality.usableCount)} of ${formatCount(
                  report.dataQuality.rawCount
                )} stored reviews were usable; ${formatCount(
                  report.dataQuality.excludedCount
                )} excluded.`}
              </AppText>
              {report.dataQuality.issues.map((issue) => (
                <AppText
                  key={issue.kind}
                  variant="caption"
                  tone="tertiary"
                  style={{ marginTop: 4 }}
                >
                  {`· ${issue.count} ${ISSUE_LABEL[issue.kind]}: ${issue.detail}`}
                </AppText>
              ))}
            </Surface>
          ) : null}
        </>
      )}
    </Screen>
  );
}
