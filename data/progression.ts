/**
 * Learning progression — the single source of truth for XP and levels.
 *
 * XP is a presentation of review history, never stored state. Keeping the rate
 * and the level curve here means Profile, Study and any future surface cannot
 * drift apart. The values are unchanged from the existing implementation:
 * 10 XP per review and 1,000 XP per level, with level 1 at zero XP.
 */

export const XP_PER_REVIEW = 10;
export const XP_PER_LEVEL = 1000;

export type Progression = {
  xp: number;
  level: number;
  /** XP earned inside the current level, 0–999. */
  xpIntoLevel: number;
  /** Fraction of the current level completed, 0–1. */
  xpProgress: number;
};

/**
 * Derive progress from a review count.
 *
 * Review counts come from storage and can be malformed in a corrupt fixture;
 * negative or non-finite values are treated as zero. A review count is a whole
 * number, so fractional input is floored rather than producing partial XP.
 */
export function computeProgression(reviewCount: number): Progression {
  const reviews = Number.isFinite(reviewCount)
    ? Math.max(0, Math.floor(reviewCount))
    : 0;
  const xp = reviews * XP_PER_REVIEW;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;

  return {
    xp,
    level,
    xpIntoLevel,
    xpProgress: xpIntoLevel / XP_PER_LEVEL,
  };
}
