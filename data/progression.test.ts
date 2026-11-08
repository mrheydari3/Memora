/**
 * Progression tests — the XP/level curve is product state, so its edges need
 * to stay fixed while Profile and Study move onto the shared module.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  XP_PER_LEVEL,
  XP_PER_REVIEW,
  computeProgression,
} from './progression';

test('progression constants preserve the existing product values', () => {
  assert.equal(XP_PER_REVIEW, 10);
  assert.equal(XP_PER_LEVEL, 1000);
});

test('zero reviews is level 1 with no progress', () => {
  assert.deepEqual(computeProgression(0), {
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpProgress: 0,
  });
});

test('99 reviews remain in level 1; 100 reviews cross into level 2', () => {
  assert.deepEqual(computeProgression(99), {
    xp: 990,
    level: 1,
    xpIntoLevel: 990,
    xpProgress: 0.99,
  });

  assert.deepEqual(computeProgression(100), {
    xp: 1000,
    level: 2,
    xpIntoLevel: 0,
    xpProgress: 0,
  });
});

test('level progress wraps exactly at every 100 reviews', () => {
  assert.deepEqual(computeProgression(199), {
    xp: 1990,
    level: 2,
    xpIntoLevel: 990,
    xpProgress: 0.99,
  });

  assert.deepEqual(computeProgression(999), {
    xp: 9990,
    level: 10,
    xpIntoLevel: 990,
    xpProgress: 0.99,
  });

  assert.deepEqual(computeProgression(1000), {
    xp: 10000,
    level: 11,
    xpIntoLevel: 0,
    xpProgress: 0,
  });
});

test('negative, fractional and non-finite review counts are guarded', () => {
  assert.deepEqual(computeProgression(-10), {
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpProgress: 0,
  });

  assert.deepEqual(computeProgression(12.9), {
    xp: 120,
    level: 1,
    xpIntoLevel: 120,
    xpProgress: 0.12,
  });

  assert.deepEqual(computeProgression(Number.NaN), {
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpProgress: 0,
  });

  assert.deepEqual(computeProgression(Number.POSITIVE_INFINITY), {
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpProgress: 0,
  });
});
