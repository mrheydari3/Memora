import { useEffect, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import {
  buildProfileBundle,
  type AchievementFact,
  type LearningSummary,
} from '../../data/profileSummary';
import { XP_PER_LEVEL } from '../../data/progression';
import { MIN_RECALL_SAMPLE } from '../../data/intelligence/core/constants';
import {
  AppText,
  EmptyState,
  HeroSkeleton,
  RevealItem,
  Screen,
  SettingsGroupSkeleton,
} from '../../components';
import {
  ActionButton,
  PageHeader,
  SectionHeading,
  Surface,
} from '../../components/v3';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  radii,
} from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { pushOnce } from '../../services/navigation';

const CONTENT_MAX = 760;
const RANGE_DAYS = 30;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type AchievementVisual = {
  label: string;
  icon: IconName;
  color: string;
};

/**
 * Presentation only. The earned flag, progress and evidence all come from
 * `buildAchievementFacts`; this map supplies the badge's name and glyph so the
 * data module stays free of icons and theme colours.
 */
const ACHIEVEMENTS: Record<AchievementFact['id'], AchievementVisual> = {
  'first-review': {
    label: 'First Review',
    icon: 'auto-awesome',
    color: colors.success,
  },
  'seven-day-streak': {
    label: '7-Day Streak',
    icon: 'local-fire-department',
    color: colors.warning,
  },
  'hundred-reviews': {
    label: '100 Reviews',
    icon: 'psychology',
    color: colors.primary,
  },
  'night-owl': {
    label: 'Night Owl',
    icon: 'dark-mode',
    color: colors.info,
  },
  'speed-demon': {
    label: 'Speed Demon',
    icon: 'bolt',
    color: colors.outline,
  },
};

const formatCount = (value: number) => value.toLocaleString('en-US');

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

function IdentityCard({
  summary,
  compact,
  wide,
}: {
  summary: LearningSummary;
  compact: boolean;
  wide: boolean;
}) {
  const { allTime } = summary;
  const stats = [
    { label: 'Reviews', value: formatCount(allTime.reviews) },
    { label: 'Total XP', value: formatCount(allTime.xp) },
    { label: 'Streak', value: `${formatCount(allTime.currentStreak)}d` },
  ];

  return (
    <Surface tone="scene" radius="pane" padding="md">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <AppText
          variant="label"
          weight="semibold"
          tone="tertiary"
          style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
          Identity
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceInset,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
          <AppText variant="caption" weight="medium" tone="muted">
            On this device
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <View
          style={{
            width: heights.avatar,
            height: heights.avatar,
            borderRadius: heights.avatar / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceTile,
          }}
        >
          <MaterialIcons name="psychology" size={28} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="headline" weight="semibold" numberOfLines={1}>
            Learner
          </AppText>
          <AppText variant="bodySm" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>
            Active local study desk
          </AppText>
        </View>
      </View>

      <View
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: radii.control,
          backgroundColor: colors.surfaceInset,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, minWidth: 0 }}>
            <AppText
              variant="caption"
              weight="semibold"
              tone="tertiary"
              style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingBottom: 5 }}
            >
              Level
            </AppText>
            <AppText
              variant="display"
              weight="bold"
              accessibilityLabel={`Level ${allTime.level}`}
              style={[
                wide ? v3.type.heroWide : v3.type.hero,
                { fontVariant: ['tabular-nums'] },
              ]}
            >
              {allTime.level}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radii.pill,
              backgroundColor: alpha(colors.warning, 0.13),
            }}
          >
            <MaterialIcons
              name="local-fire-department"
              size={iconSize.sm}
              color={colors.warning}
            />
            <AppText variant="caption" weight="semibold" style={{ color: colors.warning }}>
              {allTime.currentStreak > 0
                ? `${allTime.currentStreak}-day streak`
                : 'No streak yet'}
            </AppText>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <View
            style={{
              height: 6,
              overflow: 'hidden',
              borderRadius: 3,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, allTime.xpProgress * 100))}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: colors.primaryContainer,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 6,
            }}
          >
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={2}
              style={[{ flexShrink: 1 }, compact ? { fontSize: 11.5 } : null]}
            >
              {`${allTime.xpIntoLevel} of ${XP_PER_LEVEL} XP into this level`}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              tone="muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${Math.round(allTime.xpProgress * 100)}%`}
            </AppText>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: radii.control,
              backgroundColor: fills.inset,
            }}
          >
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              {stat.label}
            </AppText>
            <AppText
              variant="headline"
              weight="semibold"
              numberOfLines={1}
              style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
            >
              {stat.value}
            </AppText>
          </View>
        ))}
      </View>
      <AppText
        variant="caption"
        tone="tertiary"
        style={{ marginTop: 10, fontVariant: ['tabular-nums'] }}
      >
        {`${plural(allTime.activeDays, 'active day', 'active days')} all time`}
      </AppText>
    </Surface>
  );
}

function MiniStat({
  label,
  value,
  note,
  testID,
}: {
  label: string;
  value: string;
  note: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: radii.control,
        backgroundColor: fills.inset,
      }}
    >
      <AppText variant="caption" tone="tertiary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText
        testID={`${testID}-value`}
        variant="headline"
        weight="semibold"
        numberOfLines={1}
        style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
        {note}
      </AppText>
    </View>
  );
}

/**
 * The 30-day preview, not a second Statistics dashboard: one bar per local day
 * with the same normalized review counts the report uses.
 */
function ActivityStrip({ activity }: { activity: LearningSummary['range']['activity'] }) {
  const max = Math.max(1, ...activity.points.map((point) => point.value));
  const label = `${plural(activity.total, 'review', 'reviews')} across ${plural(
    activity.activeDays,
    'active day',
    'active days'
  )} in the last ${activity.days} days`;

  return (
    <View
      testID="profile-activity-strip"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ marginTop: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 52 }}>
        {activity.points.map((point) => {
          const height =
            point.value === 0 ? 3 : Math.max(5, Math.round((point.value / max) * 52));
          return (
            <View
              key={point.dayKey}
              style={{
                flex: 1,
                height,
                borderRadius: 2,
                backgroundColor:
                  point.value === 0
                    ? colors.surfaceControl
                    : point.today
                      ? colors.primary
                      : alpha(colors.primary, 0.55),
              }}
            />
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <AppText variant="caption" tone="tertiary">
          {activity.days === 1 ? 'Earlier today' : `${activity.days} days ago`}
        </AppText>
        <AppText variant="caption" tone="tertiary">
          Today
        </AppText>
      </View>
    </View>
  );
}

function MiniStatistics({
  summary,
  onOpen,
}: {
  summary: LearningSummary;
  onOpen: () => void;
}) {
  const { range } = summary;
  const recall = range.recall;
  const recallValue =
    recall.successRate === null ? '—' : `${Math.round(recall.successRate * 100)}%`;
  const recallNote =
    recall.status === 'ok'
      ? plural(recall.sampleSize, 'rated review', 'rated reviews')
      : recall.status === 'empty'
        ? 'No rated reviews yet'
        : `${formatCount(recall.sampleSize)} of ${MIN_RECALL_SAMPLE} rated reviews`;

  return (
    <Surface tone="pane" radius="card" padding="md">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MiniStat
          testID="profile-mini-reviews"
          label="Reviews"
          value={formatCount(range.reviews)}
          note="recorded in this window"
        />
        <MiniStat
          testID="profile-mini-recall"
          label="Recall"
          value={recallValue}
          note={recallNote}
        />
        <MiniStat
          testID="profile-mini-active-days"
          label="Active days"
          value={formatCount(range.activeDays)}
          note={`of ${range.range.days} days`}
        />
      </View>

      <ActivityStrip activity={range.activity} />

      <View style={{ marginTop: v3.spacing.group }}>
        <ActionButton
          testID="profile-statistics-cta"
          label="View detailed statistics"
          icon="bar-chart"
          tone="quiet"
          onPress={onOpen}
        />
      </View>
    </Surface>
  );
}

function AchievementCard({
  fact,
  basis,
  compact,
}: {
  fact: AchievementFact;
  basis: string;
  compact: boolean;
}) {
  const visual = ACHIEVEMENTS[fact.id];
  const statusColor = fact.earned ? visual.color : colors.outline;
  const status = fact.earned
    ? 'Earned'
    : fact.available
      ? 'Locked'
      : 'Not tracked yet';
  const statusIcon: IconName = fact.earned
    ? 'check-circle'
    : fact.available
      ? 'lock'
      : 'info-outline';

  return (
    <Surface
      testID={`achievement-${fact.id}`}
      tone="inset"
      radius="card"
      padding="sm"
      style={{
        flexBasis: basis,
        minHeight: 140,
        justifyContent: 'space-between',
        paddingHorizontal: compact ? v3.spacing.row : 16,
      }}
    >
      <View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: fact.earned
              ? alpha(visual.color, 0.14)
              : colors.surfaceControl,
          }}
        >
          <MaterialIcons
            name={visual.icon}
            size={iconSize.lg}
            color={fact.earned ? visual.color : colors.outline}
          />
        </View>
        <AppText
          variant="bodySm"
          weight="semibold"
          numberOfLines={2}
          style={{ marginTop: 10 }}
        >
          {visual.label}
        </AppText>
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={3}
          style={{ marginTop: 2 }}
        >
          {fact.evidence}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
        <MaterialIcons name={statusIcon} size={11} color={statusColor} />
        <AppText
          variant="caption"
          weight="semibold"
          numberOfLines={2}
          style={{ color: statusColor }}
        >
          {status}
        </AppText>
      </View>
    </Surface>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const wide = width >= 900;
  const achievementColumns = wide ? 4 : compact ? 2 : 3;
  const achievementBasis = wide ? '23%' : compact ? '47%' : '30.5%';

  const decks = useDeckStore((s) => s.decks);
  const deckLoaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const loaded = deckLoaded && reviewLoaded;

  useEffect(() => {
    useDeckStore.getState().load();
    useReviewStore.getState().load();
  }, []);

  // One normalization feeds both the summary and the badge facts, so XP, the
  // streak and earned badges cannot disagree with each other.
  const bundle = useMemo(
    () => buildProfileBundle({ decks, reviewLog, rangeDays: RANGE_DAYS }),
    [decks, reviewLog]
  );
  const earned = bundle.achievements.filter((fact) => fact.earned).length;

  // A tab root has no back stack and no Settings shortcut: Settings is its own
  // tab, and this screen owns identity and progress only.
  const header = <PageHeader title="Profile" maxWidth={CONTENT_MAX} />;

  return (
    <Screen scroll gutter tabClearance contentMaxWidth={CONTENT_MAX} header={header}>
      {!loaded ? (
        <>
          <HeroSkeleton height={310} />
          <View style={{ marginTop: v3.spacing.page }}>
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : (
        <>
          <RevealItem index={0}>
            <IdentityCard summary={bundle.summary} compact={compact} wide={wide} />
          </RevealItem>

          {bundle.summary.allTime.reviews === 0 ? (
            <RevealItem index={1}>
              <View style={{ marginTop: v3.spacing.page }}>
                <Surface tone="pane" radius="card" padding="md">
                  <EmptyState
                    icon="auto-awesome"
                    title="Your record starts with one card"
                    description="Study from Home to start earning XP, a streak and achievements."
                    action={
                      <ActionButton
                        label="Start on Home"
                        icon="home"
                        fullWidth={false}
                        onPress={() => pushOnce(router, '/home')}
                      />
                    }
                  />
                </Surface>
              </View>
            </RevealItem>
          ) : null}

          <RevealItem index={2}>
            <View style={{ marginTop: v3.spacing.page }}>
              <SectionHeading label="Mini Statistics" hint="Last 30 days" />
              <View style={{ marginTop: 10 }}>
                <MiniStatistics
                  summary={bundle.summary}
                  onOpen={() => pushOnce(router, '/statistics')}
                />
              </View>
            </View>
          </RevealItem>

          <RevealItem index={3}>
            <View style={{ marginTop: v3.spacing.page }}>
              <SectionHeading
                label="Achievements"
                hint={`${earned} of ${bundle.achievements.length}`}
              />
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {bundle.achievements.map((fact) => (
                  <AchievementCard
                    key={fact.id}
                    fact={fact}
                    basis={achievementBasis}
                    compact={compact}
                  />
                ))}
              </View>
            </View>
          </RevealItem>
        </>
      )}
    </Screen>
  );
}
