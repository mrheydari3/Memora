/**
 * Local-calendar helpers for analytics.
 *
 * Day boundaries are computed with calendar arithmetic (`setDate`, `setHours`),
 * never by adding 86,400,000ms. Across a daylight-saving transition a day is 23
 * or 25 hours long, so millisecond arithmetic moves reviews into the wrong day
 * (and a "daily" chart silently double-counts or drops one).
 *
 * `data/streak.ts` already owns the day helpers used by the streak feature; this
 * module re-exports its two primitives and adds the labelling/iteration helpers
 * the analytics engine needs, so there is still one definition of "local day".
 */

import { addLocalDays, startOfLocalDay } from '../../streak';

export const DAY_MS = 86_400_000;

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Two-letter labels: one letter repeats (T/T, S/S), so it names no weekday. */
export const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Local midnight of `value`. */
export function startOfDay(value: number | Date = Date.now()): number {
  return startOfLocalDay(value);
}

/** Add whole calendar days to a local midnight (DST-safe). */
export function addDays(dayStart: number, days: number): number {
  return addLocalDays(dayStart, days);
}

/** `YYYY-MM-DD` in the device's local calendar. Stable as an object key. */
export function dayKey(value: number): string {
  const d = new Date(value);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "Nov 5" — deterministic, not locale-dependent, so tests can assert it. */
export function dayLabel(value: number): string {
  const d = new Date(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 5 – Dec 4" for a range heading. */
export function rangeLabel(start: number, end: number): string {
  return `${dayLabel(start)} – ${dayLabel(end)}`;
}

export function weekdayOf(value: number): number {
  return new Date(value).getDay();
}

export function hourOf(value: number): number {
  return new Date(value).getHours();
}

/**
 * Whole calendar days between two instants, by their local midnights.
 *
 * `Math.round` absorbs the ±1 hour DST shift, so a 23-hour day still counts as
 * one day and an elapsed-time difference can never disagree with the calendar.
 */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Inclusive list of local midnights from `start` to `end`. */
export function eachDay(start: number, end: number): number[] {
  const days: number[] = [];
  const last = startOfDay(end);
  let cursor = startOfDay(start);
  // A bounded loop: a corrupt timestamp must not spin forever.
  let guard = 0;
  while (cursor <= last && guard < 4000) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

/** Inclusive 1 for "same day", 0 otherwise. */
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Days in a range that contains `now`, inclusive. */
export function rangeDays(count: number): number {
  return Math.max(1, Math.min(365, Math.floor(count)));
}
