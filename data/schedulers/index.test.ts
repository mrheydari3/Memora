import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulerLabel } from './index';

test('schedulerLabel names every persisted scheduler', () => {
  assert.equal(schedulerLabel('fsrs'), 'FSRS-6');
  assert.equal(schedulerLabel('general'), 'SM-2');
  assert.equal(schedulerLabel('fast'), 'Fast');
});

test('schedulerLabel stays neutral without a persisted choice', () => {
  assert.equal(schedulerLabel(null), 'Scheduler');
  assert.equal(schedulerLabel(undefined), 'Scheduler');
});
