import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../components/Icon';
import {
  AppText,
  BottomSheetModal,
  Button,
  HeroSkeleton,
  RevealItem,
  Screen,
  SettingsGroupSkeleton,
} from '../components';
import {
  ActionButton,
  MetricGrid,
  PageHeader,
  SectionHeading,
  StreakCalendar,
  Surface,
  type Metric,
} from '../components/v3';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { useStreakStore } from '../store/useStreakStore';
import {
  addLocalMonths,
  computeStreakStats,
  localDateKey,
  parseLocalDateKey,
  skipCandidates,
  skipDateKeys,
  startOfLocalMonth,
} from '../data/streak';
import { goBackOr } from '../services/navigation';
import { HapticsEngine } from '../services/haptics';
import { alpha, colors, fills, iconSize, radii, spacing } from '../theme/tokens';
import { v3 } from '../theme/v3';
import { useToday } from '../hooks/useToday';
import { useResponsive } from '../hooks/useResponsive';

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long' });

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

const ERROR_COPY: Record<string, string> = {
  invalid: 'That date cannot be protected.',
  future: 'A rest day cannot protect a future date.',
  'too-old': 'Rest days can only protect today or yesterday.',
  studied: 'You studied on that day, so it cannot be a rest day.',
  used: 'This week’s rest day is already used.',
  busy: 'A rest day is already being saved. Give it a moment.',
  storage: 'The rest day could not be saved. Your streak is unchanged.',
};

/**
 * Your Streak — the calendar behind Home's flame.
 *
 * The screen reads the same non-archived review log as Home and Profile and
 * passes the saved skip dates into the shared streak engine. A rest day is one
 * explicit record per ISO week; it can bridge a run but never becomes a review,
 * an XP event or a study day.
 */
export default function StreakScreen() {
  const router = useRouter();
  const { tablet, width } = useResponsive();
  const calendarEdge = width < 360;
  const now = useToday();
  const currentMonthStart = startOfLocalMonth(now);

  const decks = useDeckStore((state) => state.decks);
  const deckLoaded = useDeckStore((state) => state.loaded);
  const reviewLog = useReviewStore((state) => state.reviewLog);
  const reviewLoaded = useReviewStore((state) => state.loaded);
  const skips = useStreakStore((state) => state.skips);
  const skipsLoaded = useStreakStore((state) => state.loaded);
  const skipError = useStreakStore((state) => state.loadError);
  const saving = useStreakStore((state) => state.saving);
  const addSkip = useStreakStore((state) => state.addSkip);
  const loadSkips = useStreakStore((state) => state.load);

  const ready = deckLoaded && reviewLoaded && skipsLoaded;

  useEffect(() => {
    if (!deckLoaded) useDeckStore.getState().load();
    if (!reviewLoaded) useReviewStore.getState().load();
    if (!skipsLoaded) useStreakStore.getState().load();
  }, [deckLoaded, reviewLoaded, skipsLoaded]);

  const reviewTimes = useMemo(() => {
    // Match Profile and Statistics: archived decks are out, valid orphan
    // reviews stay in, so every screen derives the same streak.
    const archivedDeckIds = new Set(
      decks.filter((deck) => deck.archivedAt).map((deck) => deck.id)
    );
    return reviewLog
      .filter((entry) => !archivedDeckIds.has(entry.deckId))
      .map((entry) => entry.reviewedAt);
  }, [decks, reviewLog]);

  const skipDates = useMemo(() => skipDateKeys(skips), [skips]);
  const stats = useMemo(
    () => computeStreakStats(reviewTimes, now, skipDates),
    [reviewTimes, now, skipDates]
  );
  const allowance = useMemo(
    () => skipCandidates(reviewTimes, skips, now),
    [reviewTimes, skips, now]
  );

  const studyDates = useMemo(
    () => new Set(reviewTimes.map((time) => localDateKey(time))),
    [reviewTimes]
  );
  const currentMonthPrefix = useMemo(
    () => localDateKey(currentMonthStart).slice(0, 7),
    [currentMonthStart]
  );
  const monthStudyDays = useMemo(
    () => [...studyDates].filter((key) => key.startsWith(currentMonthPrefix)).length,
    [studyDates, currentMonthPrefix]
  );
  const savedSkipDates = useMemo(() => new Set(skipDates), [skipDates]);

  const todayKey = localDateKey(now);
  const todayStudied = studyDates.has(todayKey);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDateKey = selectedDate ?? allowance.candidates[0]?.date ?? todayKey;
  const selectedCandidate =
    allowance.candidates.find((candidate) => candidate.date === selectedDateKey) ?? null;
  // Availability is a property of the current ISO week. Selecting a protected
  // day from history must not hide the allowance that is still available now.
  const currentWeekSkip = allowance.used;
  const isPriorWeekAction =
    selectedCandidate !== null && selectedCandidate.weekKey !== allowance.weekKey;

  const [monthStart, setMonthStart] = useState(currentMonthStart);
  const lastCurrentMonth = useRef(currentMonthStart);
  useEffect(() => {
    if (lastCurrentMonth.current === currentMonthStart) return;
    // If the user was looking at the month that just ended, follow the calendar
    // into the new month. A deliberately earlier month stays where it is.
    setMonthStart((month) => (month === lastCurrentMonth.current ? currentMonthStart : month));
    lastCurrentMonth.current = currentMonthStart;
  }, [currentMonthStart]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canGoNext = monthStart < currentMonthStart;

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setNotice(null);
    setSaveError(null);
  };

  const closeConfirm = () => {
    if (saving) return;
    setConfirmOpen(false);
    setSaveError(null);
  };

  const handleUseRestDay = async () => {
    const candidate = selectedCandidate;
    if (!candidate || saving) return;
    setSaveError(null);
    const result = await addSkip(candidate.date, reviewTimes, now);
    if (!result.ok) {
      setSaveError(ERROR_COPY[result.reason] ?? 'The rest day could not be saved.');
      HapticsEngine.error();
      return;
    }
    setSelectedDate(result.skip.date);
    setConfirmOpen(false);
    setNotice(
      `Rest day saved for ${LONG_DATE.format(new Date(candidate.dayStart))}. Your streak is protected.`
    );
    HapticsEngine.success();
  };

  const header = (
    <PageHeader
      title="Your Streak"
      back
      onBack={() => goBackOr(router, '/home')}
    />
  );

  if (!ready) {
    return (
      <Screen scroll header={header}>
        <View style={{ paddingHorizontal: spacing.screen, paddingTop: 4 }}>
          <HeroSkeleton height={190} />
          <View style={{ marginTop: 24 }}>
            <SettingsGroupSkeleton rows={5} />
          </View>
        </View>
      </Screen>
    );
  }

  const selectedDateLabel = selectedCandidate
    ? LONG_DATE.format(new Date(selectedCandidate.dayStart))
    : null;
  const hasAnyReview = stats.studyDays > 0;
  const monthName = MONTH.format(new Date(currentMonthStart));
  const heroState =
    stats.current > 0
      ? todayStudied
        ? {
            label: 'Active · studied today',
            icon: 'check-circle' as const,
            color: colors.success,
          }
        : {
            label: 'On track · study today',
            icon: 'schedule' as const,
            color: colors.primary,
          }
      : hasAnyReview
        ? {
            label: 'Restart · study today',
            icon: 'schedule' as const,
            color: colors.warning,
          }
        : { label: 'Start today', icon: 'schedule' as const, color: colors.warning };
  const heroCopy =
    stats.current > 0
      ? 'Keep your momentum going.'
      : hasAnyReview
        ? 'One review starts the next run.'
        : 'Your first review starts the streak.';
  const dayUnit = (count: number) => (count === 1 ? 'day' : 'days');
  const metrics: Metric[] = [
    {
      label: 'Study days',
      value: stats.studyDays.toLocaleString('en-US'),
      unit: dayUnit(stats.studyDays),
      note: 'days with a review',
      icon: 'calendar-today',
      color: colors.onSurface,
    },
    {
      label: 'Best run',
      value: stats.longest.toLocaleString('en-US'),
      unit: dayUnit(stats.longest),
      note: 'longest streak so far',
      icon: 'emoji-events',
      color: stats.longest > 0 ? colors.warning : colors.outline,
    },
    {
      label: 'Rest days',
      value: skips.length.toLocaleString('en-US'),
      unit: dayUnit(skips.length),
      note: skips.length > 0 ? 'days protected' : 'no rest days used',
      icon: 'shield',
      color: skips.length > 0 ? colors.success : colors.onSurface,
    },
    {
      label: 'This month',
      value: monthStudyDays.toLocaleString('en-US'),
      unit: dayUnit(monthStudyDays),
      note: monthName + ' study days',
      icon: 'date-range',
      color: colors.primary,
    },
  ];

  // Screen gutter is intentionally omitted: the streak sections use a
  // full-bleed hero and re-apply the 20px column inside it.
  return (
    <Screen scroll header={header} backgroundInert={confirmOpen} contentMaxWidth={760}>
      <View style={{ paddingBottom: 28 }}>
        <View style={{ paddingHorizontal: spacing.screen }}>
          <RevealItem index={0}>
            <Surface
              tone="scene"
              testID="streak-summary"
              style={{ alignItems: 'center', overflow: 'hidden' }}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(colors.warning, stats.current > 0 ? 0.14 : 0.08),
                }}
              >
                <MaterialIcons
                  name="local-fire-department"
                  size={iconSize.display}
                  color={stats.current > 0 ? colors.warning : colors.outline}
                />
              </View>

              <AppText
                variant="caption"
                weight="semibold"
                className="mt-3 uppercase"
                style={{
                  color: stats.current > 0 ? colors.warning : colors.outline,
                  letterSpacing: 0.6,
                }}
              >
                Current streak
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  columnGap: 7,
                  marginTop: 2,
                }}
              >
                <AppText
                  variant="display"
                  weight="bold"
                  accessibilityLabel={plural(stats.current, 'day', 'days') + ' streak'}
                  style={[
                    tablet ? v3.type.heroWide : v3.type.hero,
                    { fontVariant: ['tabular-nums'], color: colors.onSurface },
                  ]}
                >
                  {stats.current}
                </AppText>
                <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 5 }}>
                  {stats.current === 1 ? 'day' : 'days'}
                </AppText>
              </View>

              <AppText
                variant="body"
                tone="muted"
                align="center"
                className="mt-2"
                style={{ maxWidth: 300 }}
              >
                {heroCopy}
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 16,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceInset,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  maxWidth: '100%',
                }}
              >
                <MaterialIcons name={heroState.icon} size={iconSize.sm} color={heroState.color} />
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: heroState.color, flexShrink: 1 }}
                >
                  {heroState.label}
                </AppText>
              </View>
            </Surface>

            <MetricGrid items={metrics} style={{ marginTop: v3.spacing.section }} />
          </RevealItem>
        </View>

        <RevealItem index={1}>
          <View
            style={{
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
              paddingHorizontal: calendarEdge ? 0 : 20,
              marginTop: v3.spacing.page,
            }}
          >
            <View style={{ paddingHorizontal: calendarEdge ? 20 : 0 }}>
              <SectionHeading label="Study calendar" hint="Tap a day" />
            </View>
            <Surface
              tone="pane"
              radius="card"
              padding="none"
              style={{
                marginTop: 10,
                paddingBottom: 8,
                overflow: 'hidden',
                borderRadius: calendarEdge ? 0 : v3.radii.card,
              }}
            >
              <StreakCalendar
                monthStart={monthStart}
                today={now}
                selectedDate={selectedDateKey}
                studyDates={studyDates}
                skipDates={savedSkipDates}
                canGoNext={canGoNext}
                onPrevMonth={() => setMonthStart((month) => addLocalMonths(month, -1))}
                onNextMonth={() => {
                  if (canGoNext) setMonthStart((month) => addLocalMonths(month, 1));
                }}
                onSelectDate={chooseDate}
              />
            </Surface>
          </View>
        </RevealItem>

        <RevealItem index={2}>
          <View
            style={{
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
              paddingHorizontal: spacing.screen,
              marginTop: v3.spacing.page,
            }}
          >
            <Surface tone="pane" radius="card" testID="weekly-rest-day">
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <AppText
                  variant="label"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  Weekly rest day
                </AppText>
                <View
                  testID="weekly-rest-day-count"
                  style={{
                    flexShrink: 0,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: radii.pill,
                    backgroundColor: currentWeekSkip
                      ? colors.surfaceControl
                      : alpha(colors.primary, 0.13),
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    tone={currentWeekSkip || skipError ? 'muted' : 'accent'}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {skipError
                      ? '—'
                      : currentWeekSkip
                        ? '0 of 1 available'
                        : '1 of 1 available'}
                  </AppText>
                </View>
              </View>

              <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
                Take one day off each week without losing your streak.
              </AppText>

              <View
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: radii.control,
                  backgroundColor: fills.inset,
                  gap: 10,
                }}
              >
                {skipError ? (
                  <AppText variant="bodySm" tone="muted">
                    Rest days are unavailable until the saved records can be read.
                  </AppText>
                ) : selectedCandidate && selectedDateLabel ? (
                  <>
                    <AppText variant="bodySm" tone="muted">
                      {`Available for ${selectedCandidate.label}, ${selectedDateLabel}.`}
                    </AppText>
                    {isPriorWeekAction ? (
                      <AppText variant="caption" tone="tertiary">
                        {`This uses last week’s allowance. This week’s allowance is ${
                          currentWeekSkip ? 'already used' : 'still available'
                        }.`}
                      </AppText>
                    ) : null}
                    <ActionButton
                      label="Use Rest Day"
                      icon="shield"
                      onPress={() => {
                        setSaveError(null);
                        setConfirmOpen(true);
                      }}
                      disabled={saving}
                    />
                  </>
                ) : currentWeekSkip ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(colors.warning, 0.13),
                      }}
                    >
                      <MaterialIcons
                        name="shield"
                        size={iconSize.sm}
                        color={colors.warning}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="bodySm" weight="semibold">
                        Rest day used this week
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {`Protected ${LONG_DATE.format(new Date(parseLocalDateKey(currentWeekSkip.date) ?? now))}.`}
                      </AppText>
                    </View>
                  </View>
                ) : allowance.candidates.length > 0 ? (
                  <AppText variant="bodySm" tone="muted">
                    This date is not eligible. Select today or yesterday to use an available rest
                    day.
                  </AppText>
                ) : (
                  <AppText variant="bodySm" tone="muted">
                    Rest days protect today before you study, or yesterday when it was missed. Both
                    days already have reviews.
                  </AppText>
                )}
              </View>

              {notice ? (
                <View
                  accessibilityLiveRegion="polite"
                  role="status"
                  testID="streak-notice"
                  style={{ marginTop: 10 }}
                >
                  <AppText variant="caption" tone="success">
                    {notice}
                  </AppText>
                </View>
              ) : null}

              {skipError ? (
                <View
                  accessibilityLiveRegion="assertive"
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: radii.control,
                    backgroundColor: alpha(colors.error, 0.1),
                    gap: 8,
                  }}
                >
                  <AppText variant="caption" tone="danger">
                    {skipError} Your reviews are unchanged.
                  </AppText>
                  <Button
                    label="Try again"
                    size="md"
                    variant="secondary"
                    onPress={() => void loadSkips()}
                  />
                </View>
              ) : null}
            </Surface>

            <AppText
              variant="caption"
              tone="tertiary"
              style={{ marginTop: 12, paddingHorizontal: 2 }}
            >
              A rest day bridges the calendar but never adds a review, XP, active day or study
              day. One allowance resets each Monday.
            </AppText>
          </View>
        </RevealItem>
      </View>

      <BottomSheetModal
        visible={confirmOpen}
        onClose={closeConfirm}
        title="Use a rest day?"
        subtitle={
          selectedDateLabel
            ? `Protect ${selectedDateLabel} and keep the run alive.`
            : 'Protect this week’s run.'
        }
        compact
        tabletLayout
      >
        <View style={{ gap: 12 }}>
          <AppText variant="bodySm" tone="muted">
            No review, XP or study day is added. The rest-day allowance for that week is spent
            even if you study on that date later.
          </AppText>
          {saveError ? (
            <View accessibilityLiveRegion="assertive">
              <AppText variant="bodySm" tone="danger">
                {saveError}
              </AppText>
            </View>
          ) : null}
          <Button
            label="Use rest day"
            icon="shield"
            loading={saving}
            disabled={!selectedCandidate}
            onPress={() => void handleUseRestDay()}
          />
          <Button
            label="Keep it available"
            variant="text"
            onPress={closeConfirm}
            disabled={saving}
          />
        </View>
      </BottomSheetModal>
    </Screen>
  );
}
