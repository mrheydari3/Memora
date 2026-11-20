/**
 * Streak + calendar helpers.
 *
 * A streak is built from two different calendar facts:
 *   - a study day has at least one real review;
 *   - a protected day was explicitly covered by that week's rest-day skip.
 *
 * Protected days bridge a streak without adding to the displayed study-day
 * count. Day boundaries use local calendar arithmetic rather than fixed
 * 86,400,000ms intervals, so daylight-saving transitions never move a date.
 */

import type { StreakSkip } from './types';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CalendarCell = {
  dayStart: number;
  dateKey: string;
  dayOfMonth: number;
  /** Monday-first index: 0 = Monday … 6 = Sunday. */
  weekday: number;
  inMonth: boolean;
};

export type SkipCandidate = {
  date: string;
  dayStart: number;
  weekKey: string;
  label: 'today' | 'yesterday';
};

export type SkipAllowance = {
  weekKey: string;
  used: StreakSkip | null;
  /** Today and/or yesterday, when each is genuinely eligible. */
  candidates: SkipCandidate[];
};

export type SkipValidation =
  | { ok: true; skip: StreakSkip }
  | {
      ok: false;
      reason: 'invalid' | 'future' | 'too-old' | 'studied' | 'used';
    };

export type StreakStats = {
  /** Study days in the active run. A protected day never increments it. */
  current: number;
  /** The longest study-day run, with protected days allowed to bridge. */
  longest: number;
  /** Distinct days with a real review. Always genuine activity. */
  studyDays: number;
};

export function startOfLocalDay(value: Date | number = new Date()): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addLocalDays(dayStart: number, days: number): number {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfLocalMonth(value: Date | number = new Date()): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export function addLocalMonths(monthStart: number, months: number): number {
  const d = new Date(monthStart);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** A stable local key: YYYY-MM-DD. Never derived through UTC. */
export function localDateKey(value: Date | number = new Date()): string {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD key to local midnight, or null when it is not a date. */
export function parseLocalDateKey(key: string): number | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return startOfLocalDay(parsed);
}

/** ISO-8601 week key, e.g. 2026-W47. Weeks run Monday through Sunday. */
export function isoWeekKey(value: Date | number = new Date()): string {
  const day = startOfLocalDay(value);
  const weekday = (new Date(day).getDay() + 6) % 7;
  // The Thursday of this week determines both the ISO week-year and the week
  // number. This is what makes 1 January correctly belong to the prior year.
  const thursday = addLocalDays(day, 3 - weekday);
  const isoYear = new Date(thursday).getFullYear();
  const jan4 = startOfLocalDay(new Date(isoYear, 0, 4));
  const jan4Weekday = (new Date(jan4).getDay() + 6) % 7;
  const week1Monday = addLocalDays(jan4, -jan4Weekday);
  const week = 1 + Math.round((thursday - week1Monday) / 604_800_000);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Monday-first weekday index. */
export function weekdayIndex(value: Date | number): number {
  return (new Date(value).getDay() + 6) % 7;
}

/**
 * Six fixed rows, Monday first. Days outside the month are kept in the grid and
 * marked so the screen can reserve one stable height while the month changes.
 */
export function buildMonthGrid(monthStart: number): CalendarCell[] {
  const first = startOfLocalMonth(monthStart);
  const firstDate = new Date(first);
  const offset = weekdayIndex(first);
  const gridStart = addLocalDays(first, -offset);

  return Array.from({ length: 42 }, (_, index) => {
    const dayStart = addLocalDays(gridStart, index);
    const date = new Date(dayStart);
    return {
      dayStart,
      dateKey: localDateKey(dayStart),
      dayOfMonth: date.getDate(),
      weekday: weekdayIndex(dayStart),
      inMonth: date.getMonth() === firstDate.getMonth() && date.getFullYear() === firstDate.getFullYear(),
    };
  });
}

/**
 * Drop invalid and duplicate records before they can affect a streak. Only one
 * skip per ISO week survives; the earliest assignment wins, so rotating a
 * stored record cannot repair a second historical gap. Future records are
 * discarded because the UI never allows them.
 */
export function normalizeStreakSkips(
  raw: unknown,
  now: number = Date.now()
): StreakSkip[] {
  if (!Array.isArray(raw)) return [];
  const today = startOfLocalDay(now);
  const byWeek = new Map<string, StreakSkip>();

  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.date !== 'string') continue;
    const dayStart = parseLocalDateKey(entry.date);
    if (dayStart === null || dayStart > today) continue;

    const createdAt =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) && entry.createdAt >= 0
        ? entry.createdAt
        : 0;
    const skip: StreakSkip = {
      date: localDateKey(dayStart),
      weekKey: isoWeekKey(dayStart),
      createdAt,
    };
    const existing = byWeek.get(skip.weekKey);
    if (
      !existing ||
      skip.createdAt < existing.createdAt ||
      (skip.createdAt === existing.createdAt && skip.date < existing.date)
    ) {
      byWeek.set(skip.weekKey, skip);
    }
  }

  return [...byWeek.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The canonical date keys used by the shared streak calculation. */
export function skipDateKeys(skips: readonly StreakSkip[]): string[] {
  return skips.map((skip) => skip.date);
}

/** The one stored skip for a week, if any. */
export function skipForWeek(
  skips: readonly StreakSkip[],
  weekKey: string
): StreakSkip | null {
  return skips.find((skip) => skip.weekKey === weekKey) ?? null;
}

/**
 * Which dates may consume a rest day right now.
 *
 * Today qualifies while it has no review. Yesterday qualifies while it was
 * missed. Each candidate is checked against its own ISO week, which matters on
 * a Monday: today's new allowance and last week's final day are independent.
 */
export function skipCandidates(
  reviewTimes: readonly number[],
  rawSkips: readonly StreakSkip[],
  now: number = Date.now()
): SkipAllowance {
  const today = startOfLocalDay(now);
  const weekKey = isoWeekKey(today);
  const skips = normalizeStreakSkips(rawSkips, now);
  const studied = new Set(reviewTimes.map(startOfLocalDay));
  const candidates: SkipCandidate[] = [];

  for (const [offset, label] of [
    [0, 'today'],
    [-1, 'yesterday'],
  ] as const) {
    const dayStart = addLocalDays(today, offset);
    const date = localDateKey(dayStart);
    const candidateWeek = isoWeekKey(dayStart);
    if (studied.has(dayStart)) continue;
    if (skipForWeek(skips, candidateWeek)) continue;
    candidates.push({ date, dayStart, weekKey: candidateWeek, label });
  }

  const used = skipForWeek(skips, weekKey);
  return { weekKey, used, candidates };
}

/**
 * Validate one requested skip against the log and the stored allowances.
 * `now` is the timestamp the record is created with; tests can pin it.
 */
export function validateStreakSkip(
  dateKey: string,
  rawSkips: readonly StreakSkip[],
  reviewTimes: readonly number[],
  now: number = Date.now()
): SkipValidation {
  const dayStart = parseLocalDateKey(dateKey);
  if (dayStart === null) return { ok: false, reason: 'invalid' };
  const today = startOfLocalDay(now);
  const yesterday = addLocalDays(today, -1);
  if (dayStart > today) return { ok: false, reason: 'future' };
  if (dayStart < yesterday) return { ok: false, reason: 'too-old' };

  const studied = new Set(reviewTimes.map(startOfLocalDay));
  if (studied.has(dayStart)) return { ok: false, reason: 'studied' };

  const skips = normalizeStreakSkips(rawSkips, now);
  const weekKey = isoWeekKey(dayStart);
  if (skipForWeek(skips, weekKey)) return { ok: false, reason: 'used' };

  return {
    ok: true,
    skip: { date: localDateKey(dayStart), weekKey, createdAt: now },
  };
}

/**
 * Protected streak statistics.
 *
 * `current` and `longest` count study days only. Protected days join the
 * calendar run (so a gap is bridged) but are skipped when incrementing. This
 * keeps a rest day from claiming progress the learner did not make while still
 * preserving momentum.
 */
export function computeStreakStats(
  reviewTimes: readonly number[],
  now: number = Date.now(),
  rawSkipDates: readonly string[] = []
): StreakStats {
  const today = startOfLocalDay(now);
  const study = new Set(reviewTimes.map(startOfLocalDay));
  const protectedDays = new Set<number>();
  for (const key of rawSkipDates) {
    const day = parseLocalDateKey(key);
    if (day !== null && day <= today) protectedDays.add(day);
  }

  const active = new Set<number>([...study, ...protectedDays]);
  let current = 0;
  if (study.size > 0 || protectedDays.size > 0) {
    let cursor = active.has(today) ? today : addLocalDays(today, -1);
    while (active.has(cursor)) {
      if (study.has(cursor)) current += 1;
      cursor = addLocalDays(cursor, -1);
    }
  }

  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of [...active].sort((a, b) => a - b)) {
    if (previous !== null && day !== addLocalDays(previous, 1)) run = 0;
    if (study.has(day)) run += 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, studyDays: study.size };
}

/**
 * Consecutive study days, counting back from today. Reviewing yesterday (but
 * not yet today) keeps the streak alive. Protected days bridge a gap without
 * incrementing the visible count.
 */
export function computeStreak(
  reviewTimes: number[],
  now: number = Date.now(),
  skipDates: readonly string[] = []
): number {
  return computeStreakStats(reviewTimes, now, skipDates).current;
}
