import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_NAME_MAX,
  canNestFolder,
  childFolders,
  createFolder,
  detachChildFolders,
  detachDecksFromFolder,
  findFolderByName,
  folderDeckCount,
  folderDescendantIds,
  folderPath,
  folderSubtreeCounts,
  groupDecksByFolder,
  moveSibling,
  normalizeFolderName,
  removeFolder,
  renameFolder,
  sortPinned,
} from './folders';
import type { Deck, DeckFolder } from './types';

const folder = (id: string, name: string, createdAt = 1): DeckFolder => ({ id, name, createdAt });

const deck = (id: string, overrides: Partial<Deck> = {}): Deck =>
  ({
    id,
    name: id,
    icon: 'style',
    color: '#fff',
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    learningSteps: [],
    masteredIntervalMultiplier: 2.5,
    createdAt: 1,
    ...overrides,
  }) as Deck;

test('names are trimmed, collapsed and capped', () => {
  assert.equal(normalizeFolderName('  German   A2  '), 'German A2');
  assert.equal(normalizeFolderName('x'.repeat(FOLDER_NAME_MAX + 10)).length, FOLDER_NAME_MAX);
  assert.equal(normalizeFolderName('   '), '');
});

test('a folder needs a name', () => {
  const result = createFolder([], '   ');
  assert.deepEqual(result, { ok: false, error: 'empty' });
});

test('duplicate names are rejected case-insensitively', () => {
  const existing = [folder('f1', 'German')];
  assert.deepEqual(createFolder(existing, ' german '), { ok: false, error: 'duplicate' });
  assert.equal(findFolderByName(existing, 'GERMAN')?.id, 'f1');
});

test('creating a folder appends one entry with a stable id', () => {
  const result = createFolder([], ' Languages ', { id: 'f9', now: 42 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.folder, { id: 'f9', name: 'Languages', createdAt: 42 });
  assert.equal(result.folders.length, 1);
});

test('a folder can be created with its own icon and colour', () => {
  const result = createFolder([], 'German', {
    id: 'f1',
    now: 7,
    icon: 'translate',
    color: '#7CBBFF',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.folder.icon, 'translate');
  assert.equal(result.folder.color, '#7CBBFF');

  // Folders saved before appearance existed keep exactly their old shape.
  const plain = createFolder([], 'Law', { id: 'f2', now: 8 });
  assert.equal(plain.ok, true);
  if (!plain.ok) return;
  assert.deepEqual(plain.folder, { id: 'f2', name: 'Law', createdAt: 8 });
});

test('renaming keeps the id and refuses a clash with another folder', () => {
  const folders = [folder('f1', 'German'), folder('f2', 'Law')];
  const renamed = renameFolder(folders, 'f2', 'Legal');
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.folder.id, 'f2');
  assert.deepEqual(
    renamed.folders.map((f) => f.name),
    ['German', 'Legal']
  );

  assert.deepEqual(renameFolder(folders, 'f2', 'german'), { ok: false, error: 'duplicate' });
  // Renaming to its own current name is a no-op, not a clash.
  assert.equal(renameFolder(folders, 'f1', 'german').ok, true);
});

test('deleting a folder unfiles its decks and keeps everything else', () => {
  const decks = [
    deck('a', { folderId: 'f1' }),
    deck('b', { folderId: 'f2' }),
    deck('c', { folderId: null }),
  ];
  const detached = detachDecksFromFolder(decks, 'f1');

  assert.equal(detached[0].folderId, null);
  assert.equal(detached[1].folderId, 'f2');
  assert.equal(detached.length, 3);
  // Unrelated decks keep their identity, so React lists do not remount.
  assert.equal(detached[1], decks[1]);

  assert.deepEqual(removeFolder([folder('f1', 'A'), folder('f2', 'B')], 'f1'), [
    folder('f2', 'B'),
  ]);
});

test('a folder can be nested, and the tree reports its paths', () => {
  const root = folder('f1', 'French');
  const child = { ...folder('f2', 'Grammar'), parentId: 'f1' } as DeckFolder;
  const grandchild = { ...folder('f3', 'Verbs'), parentId: 'f2' } as DeckFolder;
  const folders = [root, child, grandchild];

  assert.deepEqual(childFolders(folders, 'f1').map((f) => f.id), ['f2']);
  assert.deepEqual(childFolders(folders, null).map((f) => f.id), ['f1']);
  assert.deepEqual(folderPath(folders, 'f3').map((f) => f.name), [
    'French',
    'Grammar',
    'Verbs',
  ]);
  assert.deepEqual([...folderDescendantIds(folders, 'f1')].sort(), ['f2', 'f3']);
});

test('a folder cannot be nested inside itself or its descendants', () => {
  const folders = [
    folder('f1', 'French'),
    { ...folder('f2', 'Grammar'), parentId: 'f1' } as DeckFolder,
  ];
  assert.equal(canNestFolder(folders, 'f1', 'f2'), false);
  assert.equal(canNestFolder(folders, 'f1', 'f1'), false);
  assert.equal(canNestFolder(folders, 'f1', 'missing'), false);
  assert.equal(canNestFolder(folders, 'f2', null), true);
  assert.equal(canNestFolder(folders, 'f1', null), true);
});

test('a new folder can be created inside another folder', () => {
  const result = createFolder([], 'Grammar', { id: 'f2', now: 9, parentId: 'f1' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.folder.parentId, 'f1');
});

test('pinned items sort first and moving swaps neighbours', () => {
  const items = [
    { id: 'a', pinnedAt: null },
    { id: 'b', pinnedAt: 4 },
    { id: 'c', pinnedAt: null },
    { id: 'd', pinnedAt: 8 },
  ];
  assert.deepEqual(sortPinned(items).map((item) => item.id), ['b', 'd', 'a', 'c']);

  // The shelf shows pinned first, so moving 'c' up swaps it with 'a' — the
  // group's displayed order — not with the raw array neighbour.
  const moved = moveSibling(items, 'c', () => true, -1);
  assert.deepEqual(moved.map((item) => item.id), ['b', 'd', 'c', 'a']);
  assert.deepEqual(sortPinned(moved).map((item) => item.id), ['b', 'd', 'c', 'a']);
  // A move past the edge is a no-op, not a wrap-around.
  assert.equal(moveSibling(items, 'b', () => true, -1), items);
  assert.equal(moveSibling(items, 'a', () => true, 2), items);
});

test('deleting a folder re-parents its children instead of hiding them', () => {
  const folders = [
    folder('f1', 'French'),
    { ...folder('f2', 'Grammar'), parentId: 'f1' } as DeckFolder,
    { ...folder('f3', 'Verbs'), parentId: 'f2' } as DeckFolder,
  ];
  const without = detachChildFolders(removeFolder(folders, 'f2'), 'f2', 'f1');
  assert.deepEqual(
    without.map((f) => [f.id, f.parentId ?? null]),
    [
      ['f1', null],
      ['f3', 'f1'],
    ]
  );

  const decks = [deck('a', { folderId: 'f2' }), deck('b', { folderId: 'f1' })];
  const moved = detachDecksFromFolder(decks, 'f2', 'f1');
  assert.equal(moved[0].folderId, 'f1');
  assert.equal(moved[1].folderId, 'f1');
});

test('counts ignore archived decks', () => {
  const decks = [
    deck('a', { folderId: 'f1' }),
    deck('b', { folderId: 'f1', archivedAt: 5 }),
  ];
  assert.equal(folderDeckCount(decks, 'f1'), 1);
  assert.equal(folderDeckCount(decks, 'nope'), 0);
});

test('subtree counts roll decks and due up through child folders', () => {
  const folders = [
    folder('f1', 'Languages'),
    { ...folder('f2', 'German'), parentId: 'f1' } as DeckFolder,
    { ...folder('f3', 'Verbs'), parentId: 'f2' } as DeckFolder,
  ];
  const decks = [
    deck('a', { folderId: 'f2' }),
    deck('b', { folderId: 'f3' }),
    deck('archived', { folderId: 'f3', archivedAt: 5 }),
  ];

  const counts = folderSubtreeCounts(folders, decks, { a: 2, b: 3, archived: 99 });
  assert.deepEqual(counts.get('f1'), { decks: 2, due: 5, nestedFolders: 1 });
  assert.deepEqual(counts.get('f2'), { decks: 2, due: 5, nestedFolders: 1 });
  assert.deepEqual(counts.get('f3'), { decks: 1, due: 3, nestedFolders: 0 });
});

test('a folder with no direct decks still reports its nested decks', () => {
  const folders = [
    folder('f1', 'Languages'),
    { ...folder('f2', 'German'), parentId: 'f1' } as DeckFolder,
  ];
  const decks = [
    deck('a', { folderId: 'f2' }),
    deck('b', { folderId: 'f2' }),
  ];

  const counts = folderSubtreeCounts(folders, decks, { a: 4, b: 6 });
  assert.deepEqual(counts.get('f1'), { decks: 2, due: 10, nestedFolders: 1 });
});

test('subtree counting stops at a parent cycle', () => {
  const folders = [
    { ...folder('f1', 'One'), parentId: 'f2' } as DeckFolder,
    { ...folder('f2', 'Two'), parentId: 'f1' } as DeckFolder,
  ];
  const decks = [
    deck('a', { folderId: 'f1' }),
    deck('b', { folderId: 'f2' }),
  ];

  const counts = folderSubtreeCounts(folders, decks, { a: 1, b: 2 });
  assert.deepEqual(counts.get('f1'), { decks: 2, due: 3, nestedFolders: 1 });
  assert.deepEqual(counts.get('f2'), { decks: 2, due: 3, nestedFolders: 1 });
});

test('grouping keeps folder order and puts unfiled decks last', () => {
  const folders = [folder('f1', 'German'), folder('f2', 'Law')];
  const decks = [
    deck('a', { folderId: 'f2' }),
    deck('b', { folderId: 'f1' }),
    deck('c', { folderId: null }),
    deck('d', { folderId: 'gone' }),
    deck('e', { folderId: 'f1', archivedAt: 3 }),
  ];

  const groups = groupDecksByFolder(decks, folders);
  assert.deepEqual(
    groups.map((g) => [g.folder?.id ?? 'unfiled', g.decks.map((d) => d.id)]),
    [
      ['f1', ['b']],
      ['f2', ['a']],
      ['unfiled', ['c', 'd']],
    ]
  );
});

test('an empty folder still appears', () => {
  const groups = groupDecksByFolder([], [folder('f1', 'Empty')]);
  assert.deepEqual(
    groups.map((g) => [g.folder?.id, g.decks.length]),
    [['f1', 0]]
  );
});
