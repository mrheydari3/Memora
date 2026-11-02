/**
 * Streak + calendar helpers.
 *
 * Day boundaries are computed with local calendar arithmetic rather than by
 * subtracting 86,400,000ms, which drifts by a day across daylight-saving
 * transitions and in timezones with non-hour offsets.
 */

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

/**
 * Consecutive days with at least one review, counting back from today.
 * Reviewing yesterday (but not yet today) keeps the streak alive.
 */
export function computeStreak(reviewTimes: number[], now: number = Date.now()): number {
  if (reviewTimes.length === 0) return 0;

  const days = new Set(reviewTimes.map((t) => startOfLocalDay(t)));
  const today = startOfLocalDay(now);
  let cursor = days.has(today) ? today : addLocalDays(today, -1);

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}
