/**
 * Statistical primitives: intervals, trend tests, robust scores.
 * Expected values are hand-computed or taken from the cited references.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coefficientOfVariation,
  confidenceFor,
  mannKendall,
  median,
  quantile,
  robustZScores,
  senSlope,
  wilsonInterval,
} from '../core/stats';

const close = (actual: number | null, expected: number, epsilon = 1e-6) => {
  assert.ok(actual !== null, 'value should not be null');
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${expected} ± ${epsilon}, got ${actual}`
  );
};

test('Wilson interval stays inside [0,1] and matches the NIST example', () => {
  // 8 successes in 30 trials: Wilson gives roughly 14.2% to 44.4%.
  const interval = wilsonInterval(8, 30);
  assert.ok(interval);
  close(interval.low, 0.142, 0.01);
  close(interval.high, 0.444, 0.01);
  assert.equal(interval.level, 0.95);
});

test('Wilson interval handles 0 and n without inventing a negative bound', () => {
  const none = wilsonInterval(0, 30);
  assert.ok(none);
  assert.equal(none.low, 0);
  assert.ok(none.high > 0 && none.high < 0.15, `upper bound was ${none.high}`);

  const all = wilsonInterval(30, 30);
  assert.ok(all);
  assert.equal(all.high, 1);
  assert.ok(all.low > 0.85);
});

test('Wilson interval is null for an empty sample', () => {
  assert.equal(wilsonInterval(0, 0), null);
  assert.equal(wilsonInterval(3, -1), null);
});

test('Mann–Kendall detects a monotonic increase and ignores short series', () => {
  const increasing = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(increasing.method, 'normal');
  assert.equal(increasing.trend, 'increasing');
  assert.ok(increasing.pValue !== null && increasing.pValue < 0.05);

  const short = mannKendall([1, 2, 3, 4, 5]);
  assert.equal(short.method, 'insufficient');
  assert.equal(short.trend, 'insufficient');
  assert.equal(short.pValue, null);
});

test('Mann–Kendall reports no trend when every value is tied', () => {
  const tied = mannKendall([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  assert.equal(tied.s, 0);
  assert.equal(tied.trend, 'none');
  assert.equal(tied.pValue, 1);
});

test("Sen's slope is the median pairwise slope", () => {
  close(senSlope([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]), 2);
  close(senSlope([{ x: 0, y: 10 }, { x: 2, y: 10 }, { x: 4, y: 10 }]), 0);
  assert.equal(senSlope([{ x: 0, y: 1 }]), null);
});

test('median and quantile interpolate predictably', () => {
  close(median([3, 1, 2]), 2);
  close(quantile([0, 10], 0.9), 9);
  close(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(median([]), null);
});

test('robust z refuses to flag outliers on a degenerate series', () => {
  const zeros = robustZScores(Array(20).fill(0));
  assert.equal(zeros.reliable, false);
  assert.ok(zeros.scores.every((score) => score === 0));

  const varied = [5, 6, 4, 5, 6, 4, 5, 6, 4, 5, 6, 4, 5, 6, 4, 5, 6, 4, 5, 40];
  const robust = robustZScores(varied);
  assert.equal(robust.reliable, true);
  const last = robust.scores[robust.scores.length - 1];
  assert.ok(last > 10, `outlier z was ${last}`);
});

test('confidence grades follow the documented sample floors', () => {
  assert.equal(confidenceFor(5).level, 'insufficient');
  assert.equal(confidenceFor(20).level, 'low');
  assert.equal(confidenceFor(60).level, 'medium');
  assert.equal(
    confidenceFor(250, { low: 0.86, high: 0.94, level: 0.95 }).level,
    'high'
  );
});

test('coefficient of variation is zero for a perfectly even series', () => {
  close(coefficientOfVariation([5, 5, 5]), 0);
  assert.equal(coefficientOfVariation([0, 0]), null);
});
