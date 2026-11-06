/**
 * Time series construction.
 *
 * Every series is built on a **complete local-calendar grid**. A day inside the
 * analysed range with no review is a true zero (the app was available), and
 * dropping it would turn "reviews per day" into "reviews per active day" — a
 * different quantity whose trend can even point the other way.
 */

import { addDays, dayKey, dayLabel, eachDay, startOfDay, WEEKDAY_SHORT } from '../core/dates';
import type { DayPoint, NormalizedReview, Series } from '../core/types';

export function buildDailyValues(
  reviews: readonly NormalizedReview[],
  start: number,
  end: number
): { values: number[]; points: DayPoint[]; activeDays: number; total: number } {
  const counts = new Map<number, number>();
  for (const review of reviews) {
    counts.set(review.dayStart, (counts.get(review.dayStart) ?? 0) + 1);
  }

  const today = startOfDay();
  const days = eachDay(start, end);
  const values = days.map((day) => counts.get(day) ?? 0);
  const points: DayPoint[] = days.map((day, index) => ({
    dayStart: day,
    dayKey: dayKey(day),
    label: dayLabel(day),
    value: values[index],
    today: day === today,
  }));

  return {
    values,
    points,
    activeDays: values.filter((value) => value > 0).length,
    total: values.reduce((total, value) => total + value, 0),
  };
}

export function buildSeries(
  reviews: readonly NormalizedReview[],
  start: number,
  end: number
): Series {
  const { points, activeDays, total } = buildDailyValues(reviews, start, end);
  return {
    points,
    start: startOfDay(start),
    end: startOfDay(end),
    days: points.length,
    total,
    activeDays,
  };
}

/** Monday-first week start, so a week is a calendar week rather than a rolling 7. */
export function weekStartOf(dayStart: number): number {
  const weekday = new Date(dayStart).getDay();
  const offset = (weekday + 6) % 7;
  return addDays(dayStart, -offset);
}

/**
 * Aggregate a daily series into ISO-style weeks. Used for the 90-day view and
 * for weekly trend reporting, where daily zeros otherwise dominate the ranks.
 */
export function weeklySeries(series: Series): Series {
  const buckets = new Map<number, number>();
  for (const point of series.points) {
    const week = weekStartOf(point.dayStart);
    buckets.set(week, (buckets.get(week) ?? 0) + point.value);
  }

  const weeks = [...buckets.keys()].sort((a, b) => a - b);
  const points: DayPoint[] = weeks.map((week) => ({
    dayStart: week,
    dayKey: dayKey(week),
    label: dayLabel(week),
    value: buckets.get(week) ?? 0,
    today: week === weekStartOf(startOfDay()),
  }));

  return {
    points,
    start: weeks.length > 0 ? weeks[0] : series.start,
    end: weeks.length > 0 ? weeks[weeks.length - 1] : series.end,
    days: weeks.length,
    total: points.reduce((total, point) => total + point.value, 0),
    activeDays: points.filter((point) => point.value > 0).length,
  };
}

/** Reviews whose local day falls inside [start, end], both inclusive. */
export function reviewsInRange(
  reviews: readonly NormalizedReview[],
  start: number,
  end: number
): NormalizedReview[] {
  const from = startOfDay(start);
  const to = startOfDay(end);
  return reviews.filter((review) => review.dayStart >= from && review.dayStart <= to);
}

export const weekdayLabel = (weekday: number): string => WEEKDAY_SHORT[weekday] ?? '';
