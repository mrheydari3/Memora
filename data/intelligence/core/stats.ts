/**
 * Statistical primitives — pure, deterministic, and deliberately conservative.
 *
 * Nothing here infers more than the data supports:
 *   - proportions carry Wilson score intervals (valid at small n and near 0/1),
 *   - trends use Sen's slope + Mann–Kendall and refuse to report a p-value with
 *     fewer than `MIN_TREND_POINTS` observations,
 *   - anomalies use median/MAD and return nothing when the series is degenerate
 *     (MAD = 0, which is common when more than half the days have no reviews).
 */

import type { Confidence, Interval } from './types';
import {
  ANOMALY_Z_THRESHOLD,
  MIN_ANOMALY_POINTS,
  MIN_RECALL_SAMPLE,
  MIN_TREND_POINTS,
  Z_95,
} from './constants';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

/** Quantile with linear interpolation. Accepts unsorted input. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(q, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function median(values: readonly number[]): number | null {
  return quantile(values, 0.5);
}

/** Population SD: these are the complete observed windows, not a sample. */
export function standardDeviation(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const average = sum(values) / values.length;
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** SD / mean. Null when the mean is 0, because the ratio is undefined. */
export function coefficientOfVariation(values: readonly number[]): number | null {
  const average = mean(values);
  const sd = standardDeviation(values);
  if (average === null || sd === null || average === 0) return null;
  return sd / Math.abs(average);
}

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the normal approximation because the engine reports small samples:
 * 8 successes out of 30 is 27%, but the honest statement is "somewhere between
 * 12% and 46%" (NIST Dataplot). Wilson keeps coverage there.
 */
export function wilsonInterval(
  successes: number,
  total: number,
  z: number = Z_95
): Interval | null {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0) return null;
  const p = clamp(successes / total, 0, 1);
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return {
    low: clamp(centre - margin, 0, 1),
    high: clamp(centre + margin, 0, 1),
    level: 0.95,
  };
}

export function rateOf(successes: number, total: number): number | null {
  if (total <= 0) return null;
  return clamp(successes / total, 0, 1);
}

/**
 * Evidence grade for a reported number.
 *
 * The score is an ordering aid for insights, not a probability. The rationale is
 * surfaced verbatim in the UI so a user can see why a claim is "low confidence".
 */
export function confidenceFor(
  sampleSize: number,
  interval: Interval | null = null,
  what = 'reviews'
): Confidence {
  if (sampleSize < MIN_RECALL_SAMPLE) {
    return {
      level: 'insufficient',
      score: 0.1,
      sampleSize,
      rationale: `${sampleSize} ${what} — too few to report reliably (needs ${MIN_RECALL_SAMPLE}).`,
    };
  }

  const width = interval ? interval.high - interval.low : 1;

  if (sampleSize >= 200 && width <= 0.12) {
    return {
      level: 'high',
      score: 0.9,
      sampleSize,
      rationale: `${sampleSize} ${what}; the 95% interval spans ${(width * 100).toFixed(0)} points.`,
    };
  }
  if (sampleSize >= 50) {
    return {
      level: 'medium',
      score: 0.65,
      sampleSize,
      rationale: `${sampleSize} ${what}; the estimate is still uncertain but usable.`,
    };
  }
  return {
    level: 'low',
    score: 0.4,
    sampleSize,
    rationale: `${sampleSize} ${what}; treat this as a signal, not a settled result.`,
  };
}

// ---- Trend tests ------------------------------------------------------------

export type MannKendallResult = {
  n: number;
  s: number;
  tau: number;
  pValue: number | null;
  /** 'normal' when the approximation was used, 'insufficient' otherwise. */
  method: 'normal' | 'insufficient';
  trend: 'increasing' | 'decreasing' | 'none' | 'insufficient';
};

/** Two-sided standard normal CDF, via the Abramowitz–Stegun erf approximation. */
function normalCdf(z: number): number {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * Mann–Kendall monotonic trend test with tie-corrected variance and a continuity
 * correction.
 *
 * The normal approximation is not trustworthy below ~8 observations, and
 * autocorrelated daily counts make it anti-conservative even above that — hence
 * the `method` flag and the caller's "descriptive" wording.
 */
export function mannKendall(values: readonly number[]): MannKendallResult {
  const n = values.length;
  let s = 0;
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      s += Math.sign(values[j] - values[i]);
    }
  }

  const pairs = (n * (n - 1)) / 2;
  const tau = pairs > 0 ? s / pairs : 0;

  if (n < MIN_TREND_POINTS) {
    return { n, s, tau, pValue: null, method: 'insufficient', trend: 'insufficient' };
  }

  // Tie correction: each group of identical values contributes zero to S but
  // reduces the variance. A sparse series has many tied zero days.
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let tieTerm = 0;
  for (const count of counts.values()) {
    if (count > 1) tieTerm += count * (count - 1) * (2 * count + 5);
  }

  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  if (!(variance > 0)) {
    return { n, s, tau, pValue: 1, method: 'normal', trend: 'none' };
  }

  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const pValue = clamp(2 * (1 - normalCdf(Math.abs(z))), 0, 1);
  const trend = pValue < 0.1 && s !== 0 ? (s > 0 ? 'increasing' : 'decreasing') : 'none';

  return { n, s, tau, pValue, method: 'normal', trend };
}

/**
 * Sen's slope — the median of all pairwise slopes.
 *
 * `points` must carry real calendar x values (day indices), not observation
 * numbers: reviews only exist on days the user studied, and a slope over
 * observation numbers estimates reviews per active day, not per day.
 */
export function senSlope(points: readonly { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const slopes: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      if (dx === 0) continue;
      slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  return median(slopes);
}

// ---- Robust deviation -------------------------------------------------------

export type RobustScore = {
  median: number | null;
  /** 1.4826 × MAD, comparable to SD under normality. */
  scale: number | null;
  scores: number[];
  /** False when the MAD is 0 (the series is too degenerate to flag outliers). */
  reliable: boolean;
};

export function robustZScores(values: readonly number[]): RobustScore {
  const centre = median(values);
  if (centre === null) return { median: null, scale: null, scores: [], reliable: false };

  const mad = median(values.map((value) => Math.abs(value - centre)));
  const scale = mad === null ? null : 1.4826 * mad;
  const reliable =
    values.length >= MIN_ANOMALY_POINTS && scale !== null && Number.isFinite(scale) && scale > 1e-9;

  if (!reliable || scale === null) {
    return { median: centre, scale, scores: values.map(() => 0), reliable: false };
  }

  return {
    median: centre,
    scale,
    scores: values.map((value) => (value - centre) / scale),
    reliable,
  };
}

export function isAnomaly(score: number): boolean {
  return Math.abs(score) >= ANOMALY_Z_THRESHOLD;
}

/**
 * Relative difference from `from` to `to`, or null when the baseline is 0.
 * Used for efficiency, where a ratio is more meaningful than raw minutes.
 */
export function relativeChange(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return (to - from) / Math.abs(from);
}
