/**
 * Streak domain tests — fixed local dates, no reliance on the machine clock.
 *
 * The suite covers the distinction the feature depends on: a skip protects a
 * calendar gap but is never a study day, never adds XP and never survives as a
 * second allowance in the same ISO week.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLocalDays,
  addLocalMonths,
  buildMonthGrid,
  computeStreak,
  computeStreakStats,
  isoWeekKey,
  localDateKey,
  normalizeStreakSkips,
  parseLocalDateKey,
  skipCandidates,
  skipDateKeys,
  startOfLocalDay,
  startOfLocalMonth,
  validateStreakSkip,
} from './streak';
import type { StreakSkip } from './types';

const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour, 0, 0, 0).getTime();

const skip = (year: number, month: number, day: number, createdAt = 1): StreakSkip => {
  const value = at(year, month, day);
  return { date: localDateKey(value), weekKey: isoWeekKey(value), createdAt };
};

test('a user who has never studied has an empty zero streak', () => {
  assert.deepEqual(computeStreakStats([], at(2026, 11, 18)), {
    current: 0,
    longest: 0,
    studyDays: 0,
  });
  assert.equal(computeStreak([], at(2026, 11, 18)), 0);
});

test('an uninterrupted run counts every study day', () => {
  const now = at(2026, 11, 18);
  const reviews = [at(2026, 11, 16), at(2026, 11, 17), at(2026, 11, 18)].map((time) => time + 1000);
  assert.deepEqual(computeStreakStats(reviews, now), {
    current: 3,
    longest: 3,
    studyDays: 3,
  });
});

test('studying yesterday but not yet today keeps the run alive', () => {
  const now = at(2026, 11, 18);
  assert.equal(computeStreak([at(2026, 11, 16), at(2026, 11, 17)], now), 2);
});

test('a protected today bridges the gap without becoming a study day', () => {
  const now = at(2026, 11, 18);
  const reviews = [at(2026, 11, 16), at(2026, 11, 17)];
  const stats = computeStreakStats(reviews, now, ['2026-11-18']);
  assert.equal(stats.current, 2);
  assert.equal(stats.studyDays, 2);
  assert.equal(stats.longest, 2);
});

test('the worked example counts four studied days around one protected Wednesday', () => {
  const now = at(2026, 11, 20);
  const reviews = [
    at(2026, 11, 16),
    at(2026, 11, 17),
    at(2026, 11, 19),
    at(2026, 11, 20),
  ];
  const stats = computeStreakStats(reviews, now, ['2026-11-18']);
  assert.equal(stats.current, 4);
  assert.equal(stats.longest, 4);
  assert.equal(stats.studyDays, 4);
});

test('protecting a missed yesterday restores continuity', () => {
  const now = at(2026, 11, 19);
  const reviews = [at(2026, 11, 16), at(2026, 11, 17)];
  assert.equal(computeStreak(reviews, now, ['2026-11-18']), 2);
  assert.equal(computeStreak(reviews, now), 0);
});

test('a skip alone never invents a streak or a study day', () => {
  const stats = computeStreakStats([], at(2026, 11, 18), ['2026-11-18']);
  assert.deepEqual(stats, { current: 0, longest: 0, studyDays: 0 });
});

test('longest streak also bridges a protected day', () => {
  const now = at(2026, 11, 18);
  const reviews = [
    at(2026, 10, 1),
    at(2026, 10, 2),
    at(2026, 10, 3),
    at(2026, 10, 5),
    at(2026, 10, 6),
  ];
  const stats = computeStreakStats(reviews, now, ['2026-10-04']);
  assert.equal(stats.longest, 5);
  assert.equal(stats.current, 0);
});

test('ISO weeks run Monday to Sunday and roll over at midnight', () => {
  assert.equal(isoWeekKey(at(2026, 11, 16)), '2026-W47');
  assert.equal(isoWeekKey(at(2026, 11, 22, 23)), '2026-W47');
  assert.equal(isoWeekKey(at(2026, 11, 23, 0)), '2026-W48');
});

test('ISO week numbering crosses the year boundary correctly', () => {
  assert.equal(isoWeekKey(at(2020, 12, 31)), '2020-W53');
  assert.equal(isoWeekKey(at(2021, 1, 1)), '2020-W53');
  assert.equal(isoWeekKey(at(2021, 1, 4)), '2021-W01');
  assert.equal(isoWeekKey(at(2026, 1, 1)), '2026-W01');
});

test('today and yesterday are the only candidates; each checks its own week', () => {
  const monday = at(2026, 11, 23, 10);
  const sundaySkip = skip(2026, 11, 22);
  const allowance = skipCandidates([], [sundaySkip], monday);

  assert.equal(allowance.weekKey, '2026-W48');
  assert.equal(allowance.used, null);
  assert.deepEqual(
    allowance.candidates.map((candidate) => [candidate.date, candidate.label]),
    [['2026-11-23', 'today']]
  );
});

test('a studied candidate is not offered, but the other eligible day is', () => {
  const now = at(2026, 11, 18);
  const studyToday = [at(2026, 11, 18, 9)];
  assert.deepEqual(
    skipCandidates(studyToday, [], now).candidates.map((candidate) => candidate.date),
    ['2026-11-17']
  );
  assert.deepEqual(
    skipCandidates([at(2026, 11, 17, 9), at(2026, 11, 18, 9)], [], now).candidates,
    []
  );
});

test('one stored skip per week is enough to close both candidates', () => {
  const now = at(2026, 11, 18);
  const used = skip(2026, 11, 16, 5);
  const allowance = skipCandidates([], [used], now);
  assert.equal(allowance.used?.date, '2026-11-16');
  assert.deepEqual(allowance.candidates, []);
});

test('a current-week rest day does not hide yesterday from the prior week on Monday', () => {
  const monday = at(2026, 11, 23, 10);
  const current = skip(2026, 11, 23, 5);
  const allowance = skipCandidates([], [current], monday);

  assert.equal(allowance.used?.date, '2026-11-23');
  assert.deepEqual(
    allowance.candidates.map((candidate) => [candidate.date, candidate.weekKey]),
    [['2026-11-22', '2026-W47']]
  );
  assert.equal(validateStreakSkip('2026-11-22', [current], [], monday).ok, true);
});

test('a second skip in the same week is rejected', () => {
  const now = at(2026, 11, 18);
  const used = skip(2026, 11, 17);
  const result = validateStreakSkip('2026-11-18', [used], [], now);
  assert.deepEqual(result, { ok: false, reason: 'used' });
});

test('future, older and studied dates are rejected', () => {
  const now = at(2026, 11, 18);
  assert.deepEqual(validateStreakSkip('2026-11-19', [], [], now), {
    ok: false,
    reason: 'future',
  });
  assert.deepEqual(validateStreakSkip('2026-11-16', [], [], now), {
    ok: false,
    reason: 'too-old',
  });
  assert.deepEqual(validateStreakSkip('2026-11-17', [], [at(2026, 11, 17, 9)], now), {
    ok: false,
    reason: 'studied',
  });
  assert.deepEqual(validateStreakSkip('2026-11-18', [], [], now), {
    ok: true,
    skip: { date: '2026-11-18', weekKey: '2026-W47', createdAt: now },
  });
});

test('invalid calendar keys never become skips', () => {
  const now = at(2026, 11, 18);
  assert.equal(parseLocalDateKey('2026-02-30'), null);
  assert.equal(parseLocalDateKey('18-11-2026'), null);
  assert.deepEqual(validateStreakSkip('2026-02-30', [], [], now), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(
    normalizeStreakSkips(
      [
        { date: '2026-02-30', weekKey: '2026-W09', createdAt: 1 },
        { date: 'not-a-date', weekKey: '2026-W47', createdAt: 1 },
        null,
        '2026-11-17',
      ],
      now
    ),
    []
  );
});

test('normalization canonicalizes the week, drops the future and keeps one per week', () => {
  const now = at(2026, 11, 18);
  const normalized = normalizeStreakSkips(
    [
      { date: '2026-11-17', weekKey: 'bogus', createdAt: 9 },
      { date: '2026-11-16', weekKey: '2026-W47', createdAt: 2 },
      { date: '2026-11-17', weekKey: '2026-W47', createdAt: 1 },
      { date: '2026-11-19', weekKey: '2026-W47', createdAt: 0 },
      { date: '2026-10-01', weekKey: '2026-W40', createdAt: 3 },
    ],
    now
  );

  assert.deepEqual(normalized, [
    { date: '2026-10-01', weekKey: '2026-W40', createdAt: 3 },
    { date: '2026-11-17', weekKey: '2026-W47', createdAt: 1 },
  ]);
  assert.deepEqual(skipDateKeys(normalized), ['2026-10-01', '2026-11-17']);
});

test('missing or corrupt skip storage reads as no skips', () => {
  assert.deepEqual(normalizeStreakSkips(null), []);
  assert.deepEqual(normalizeStreakSkips('[]'), []);
  assert.deepEqual(normalizeStreakSkips([], at(2026, 11, 18)), []);
});

test('a protected day that later gets a review displays as studied and stays allocated', () => {
  const now = at(2026, 11, 18);
  const allocated = skip(2026, 11, 18);
  const stats = computeStreakStats([at(2026, 11, 17), at(2026, 11, 18)], now, ['2026-11-18']);
  assert.equal(stats.current, 2);
  assert.equal(stats.studyDays, 2);
  assert.equal(skipCandidates([], [allocated], now).used?.date, '2026-11-18');
});

test('calendar arithmetic keeps the local date and handles month boundaries', () => {
  const dstStart = startOfLocalDay(at(2026, 3, 8, 1));
  const dstEnd = startOfLocalDay(at(2026, 11, 1, 1));
  assert.equal(localDateKey(addLocalDays(dstStart, 1)), '2026-03-09');
  assert.equal(localDateKey(addLocalDays(dstEnd, 1)), '2026-11-02');
  assert.equal(localDateKey(addLocalDays(startOfLocalDay(at(2026, 11, 30)), 1)), '2026-12-01');
  assert.equal(localDateKey(addLocalMonths(startOfLocalMonth(at(2026, 1, 31)), 1)), '2026-02-01');
  assert.equal(localDateKey(addLocalMonths(startOfLocalMonth(at(2026, 1, 15)), -1)), '2025-12-01');
});

test('the month grid is six Monday-first rows and keeps every date in its month', () => {
  const cells = buildMonthGrid(startOfLocalMonth(at(2026, 11, 18)));
  assert.equal(cells.length, 42);
  assert.equal(cells[0].weekday, 0);
  assert.equal(cells[0].dateKey, '2026-10-26');
  assert.equal(cells.filter((cell) => cell.inMonth).length, 30);
  assert.equal(cells.find((cell) => cell.dateKey === '2026-11-01')?.weekday, 6);
  assert.equal(cells.find((cell) => cell.dateKey === '2026-11-30')?.inMonth, true);
});

test('without a skip the existing streak behaviour is unchanged', () => {
  const now = at(2026, 11, 18);
  const reviews = [at(2026, 11, 16), at(2026, 11, 17)];
  assert.equal(computeStreak(reviews, now), computeStreak(reviews, now, []));
});
