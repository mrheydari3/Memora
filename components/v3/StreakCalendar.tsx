import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import {
  buildMonthGrid,
  type CalendarCell,
  parseLocalDateKey,
  startOfLocalDay,
} from '../../data/streak';
import { prefersReducedMotion, usePressFeedback } from '../../motion';
import { alpha, colors, iconSize, motion, radii } from '../../theme/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { IconButton } from '../IconButton';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

type StreakCalendarProps = {
  monthStart: number;
  today: number;
  selectedDate: string;
  studyDates: ReadonlySet<string>;
  skipDates: ReadonlySet<string>;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
};

type DayCellProps = {
  cell: CalendarCell;
  today: number;
  selected: boolean;
  studied: boolean;
  skipped: boolean;
  tileSize: number;
  rowHeight: number;
  onSelect: () => void;
};

function dayLabel(
  cell: CalendarCell,
  studied: boolean,
  skipped: boolean,
  today: boolean,
  future: boolean
) {
  const parts = [LONG_DATE.format(new Date(cell.dayStart))];
  if (today) parts.push('Today');
  if (studied) parts.push('Studied');
  if (skipped) parts.push(studied ? 'Rest day also recorded' : 'Protected rest day');
  if (!studied && !skipped) {
    if (future) parts.push('Future day');
    else if (!today) parts.push('Missed day');
    else parts.push('Not studied yet');
  }
  return parts.join('. ') + '.';
}

function DayCell({
  cell,
  today,
  selected,
  studied,
  skipped,
  tileSize,
  rowHeight,
  onSelect,
}: DayCellProps) {
  const [focused, setFocused] = useState(false);
  const press = usePressFeedback({ scale: 0.92 });
  const isToday = cell.dayStart === today;
  const isFuture = cell.dayStart > today;
  const label = dayLabel(cell, studied, skipped, isToday, isFuture);

  const fill = studied
    ? alpha(colors.primary, 0.18)
    : skipped
      ? alpha(colors.warning, 0.1)
      : 'transparent';
  const border = isToday && !studied ? colors.primary : 'transparent';
  const ink = studied
    ? colors.onSurface
    : skipped
      ? colors.warning
      : isFuture
        ? alpha(colors.outline, 0.6)
        : isToday
          ? colors.primary
          : colors.onSurfaceVariant;

  return (
    <Animated.View style={[{ width: '14.2857%', height: rowHeight }, press.style]}>
      <Pressable
        testID={`streak-day-${cell.dateKey}`}
        onPress={onSelect}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: radii.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: fill,
            borderWidth: isToday || selected || focused ? 1.5 : 0,
            borderColor: focused || selected ? colors.primary : border,
            opacity: isFuture ? 0.7 : 1,
          }}
        >
          <AppText
            variant={tileSize >= 48 ? 'bodySm' : 'caption'}
            weight={studied || isToday ? 'semibold' : 'medium'}
            numberOfLines={1}
            style={{ color: ink, fontVariant: ['tabular-nums'] }}
          >
            {cell.dayOfMonth}
          </AppText>
          {skipped ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: -1,
                bottom: -1,
                width: 14,
                height: 14,
                borderRadius: 7,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background,
              }}
            >
              <MaterialIcons
                name="shield"
                size={10}
                color={studied ? colors.onSurfaceVariant : colors.warning}
              />
            </View>
          ) : null}
        </View>
        {isToday && studied ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 2,
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: colors.primary,
            }}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function LegendItem({ children, shield = false }: { children: React.ReactNode; shield?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {shield ? (
        <MaterialIcons name="shield" size={12} color={colors.warning} />
      ) : (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 3,
            backgroundColor: alpha(colors.primary, 0.45),
          }}
        />
      )}
      <AppText variant="caption" tone="tertiary">
        {children}
      </AppText>
    </View>
  );
}

/**
 * StreakCalendar — one fixed six-row month grid.
 *
 * The six rows never unmount, so browsing months cannot shift the rest-day
 * control. Every in-month date is focusable and exposes its state in the
 * accessible name; only the weekly control decides whether it can be protected.
 */
export function StreakCalendar({
  monthStart,
  today,
  selectedDate,
  studyDates,
  skipDates,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: StreakCalendarProps) {
  const { tablet } = useResponsive();
  const tileSize = tablet ? 48 : 40;
  const rowHeight = tablet ? 58 : 50;
  const cells = buildMonthGrid(monthStart);
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      reveal.setValue(1);
      return;
    }
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: motion.fast,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [monthStart, reveal]);

  const opacity = reveal;
  const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const monthLabel = MONTH.format(new Date(monthStart));
  const todayStart = startOfLocalDay(today);
  const selectedWeekSkip = skipDates.has(selectedDate);

  return (
    <View testID="streak-calendar">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 8,
          minHeight: 48,
        }}
      >
        <IconButton
          icon="chevron-left"
          size="sm"
          glyphSize={iconSize.md}
          accessibilityLabel="Previous month"
          onPress={onPrevMonth}
        />
        <AppText
          testID="streak-month-label"
          variant={tablet ? 'bodyLg' : 'body'}
          weight="semibold"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {monthLabel}
        </AppText>
        <IconButton
          icon="chevron-right"
          size="sm"
          glyphSize={iconSize.md}
          accessibilityLabel="Next month"
          onPress={onNextMonth}
          disabled={!canGoNext}
        />
      </View>

      <View style={{ flexDirection: 'row', marginTop: 6, paddingHorizontal: 2 }}>
        {WEEKDAYS.map((label, index) => (
          <View key={`${label}-${index}`} style={{ width: '14.2857%', alignItems: 'center' }}>
            <AppText variant={tablet ? 'bodySm' : 'caption'} tone="tertiary" weight="medium">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }],
          paddingHorizontal: 2,
          marginTop: 2,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((cell) => {
            if (!cell.inMonth) {
              return (
                <View
                  key={cell.dateKey}
                  style={{ width: '14.2857%', height: rowHeight }}
                  aria-hidden
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              );
            }
            return (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                today={todayStart}
                selected={cell.dateKey === selectedDate}
                studied={studyDates.has(cell.dateKey)}
                skipped={skipDates.has(cell.dateKey)}
                tileSize={tileSize}
                rowHeight={rowHeight}
                onSelect={() => onSelectDate(cell.dateKey)}
              />
            );
          })}
        </View>
      </Animated.View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 14,
          paddingHorizontal: 18,
          marginTop: 10,
          minHeight: 20,
        }}
      >
        <LegendItem>Studied</LegendItem>
        <LegendItem shield>Rest day</LegendItem>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
          />
          <AppText variant="caption" tone="tertiary">
            Today
          </AppText>
        </View>
      </View>

      {selectedWeekSkip ? (
        <AppText
          variant="caption"
          tone="tertiary"
          style={{ paddingHorizontal: 18, marginTop: 6 }}
        >
          {`Selected ${LONG_DATE.format(new Date(parseLocalDateKey(selectedDate) ?? today))} · rest day recorded`}
        </AppText>
      ) : null}
    </View>
  );
}
