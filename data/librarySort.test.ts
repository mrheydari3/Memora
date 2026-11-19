import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBRARY_SORT_OPTIONS,
  librarySortLabel,
  sortShelf,
  type ShelfSortKeys,
} from './librarySort';
import type { LibrarySort } from './types';

type Row = ShelfSortKeys & { id: string };

const row = (
  id: string,
  name: string,
  options: Partial<Omit<Row, 'id' | 'name'>> = {}
): Row => ({
  id,
  name,
  pinned: false,
  due: 0,
  lastStudiedAt: null,
  ...options,
});

const order = (rows: readonly Row[], sort: LibrarySort): string[] =>
  sortShelf(rows, sort, (entry) => entry).map((entry) => entry.id);

const shelf = [
  row('alpha', 'Alpha', { due: 2, lastStudiedAt: 200 }),
  row('pinned-low', 'Pinned low', { pinned: true, due: 0, lastStudiedAt: 50 }),
  row('bravo', 'bravo', { due: 9, lastStudiedAt: 300 }),
  row('charlie', 'Charlie', { due: 9 }),
  row('pinned-high', 'Pinned high', { pinned: true, due: 7, lastStudiedAt: 100 }),
];

test('manual keeps the stored order and lifts pins, at every level', () => {
  assert.deepEqual(order(shelf, 'manual'), [
    'pinned-low',
    'pinned-high',
    'alpha',
    'bravo',
    'charlie',
  ]);
});

test('due orders by cards waiting, pinned first, ties in stored order', () => {
  assert.deepEqual(order(shelf, 'due'), [
    'pinned-high',
    'pinned-low',
    'bravo',
    'charlie',
    'alpha',
  ]);
});

test('name is alphabetical and case-insensitive, pinned first', () => {
  assert.deepEqual(order(shelf, 'name'), [
    'pinned-high',
    'pinned-low',
    'alpha',
    'bravo',
    'charlie',
  ]);
});

test('recently studied puts the latest session first and never-studied last', () => {
  assert.deepEqual(order(shelf, 'recent'), [
    'pinned-high',
    'pinned-low',
    'bravo',
    'alpha',
    'charlie',
  ]);
});

test('a tie keeps the stored order under every mode', () => {
  const tied = [
    row('first', 'Same name', { due: 4, lastStudiedAt: 10 }),
    row('second', 'Same name', { due: 4, lastStudiedAt: 10 }),
  ];
  for (const sort of ['due', 'name', 'recent'] as const) {
    assert.deepEqual(order(tied, sort), ['first', 'second'], sort);
  }
});

test('sorting returns a new array and leaves its input alone', () => {
  const input = shelf.map((entry) => ({ ...entry }));
  const before = input.map((entry) => entry.id);
  const sorted = sortShelf(input, 'due', (entry) => entry);
  assert.notEqual(sorted, input);
  assert.deepEqual(input.map((entry) => entry.id), before);
});

test('the option list names every mode once', () => {
  assert.deepEqual(
    LIBRARY_SORT_OPTIONS.map((option) => option.value),
    ['manual', 'due', 'name', 'recent']
  );
  assert.equal(librarySortLabel('recent'), 'Recently studied');
  assert.equal(librarySortLabel('manual'), 'Manual');
});
