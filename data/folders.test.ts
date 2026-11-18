import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_NAME_MAX,
  createFolder,
  detachDecksFromFolder,
  findFolderByName,
  folderDeckCount,
  flattenLegacyFolders,
  groupDecksByFolder,
  moveSibling,
  moveSiblingTo,
  normalizeFolderName,
  removeFolder,
  renameFolder,
  siblingDecksIn,
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

test('legacy nested folders flatten to one level without losing any folder', () => {
  const legacy = [
    { ...folder('f1', 'Languages'), parentId: null },
    { ...folder('f2', 'German'), parentId: 'f1' },
    { ...folder('f3', 'Verbs'), parentId: 'f2' },
  ];
  const { folders, changed } = flattenLegacyFolders(legacy);

  assert.equal(changed, true);
  assert.deepEqual(
    folders.map((entry) => [entry.id, entry.name]),
    [
      ['f1', 'Languages'],
      ['f2', 'German'],
      ['f3', 'Verbs'],
    ]
  );
  // The parent link is gone from the stored shape, not just ignored on read.
  assert.ok(folders.every((entry) => !('parentId' in entry)));
  // Flattening again is a no-op, so load does not rewrite unchanged data.
  assert.equal(flattenLegacyFolders(folders).changed, false);
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

  // A drag target can be several slots away, but pinned items keep the top
  // segment and unpinned items cannot jump above them.
  const dragged = moveSiblingTo(items, 'a', () => true, 3);
  assert.deepEqual(dragged.map((item) => item.id), ['b', 'd', 'c', 'a']);
  const pinnedMove = moveSiblingTo(items, 'b', () => true, 1);
  assert.deepEqual(pinnedMove.map((item) => item.id), ['d', 'b', 'a', 'c']);
  const clampedMove = moveSiblingTo(items, 'c', () => true, 0);
  assert.deepEqual(clampedMove.map((item) => item.id), ['b', 'd', 'c', 'a']);
});

test('one-step and drag deck moves both skip archived siblings', () => {
  // Storage holds an archived deck between two active ones; the shelf renders
  // only the active pair for that folder.
  const decks = [
    deck('a', { folderId: 'f1' }),
    deck('archived', { folderId: 'f1', archivedAt: 5 }),
    deck('b', { folderId: 'f1' }),
  ];
  const shelfOrder = (items: readonly Deck[]) =>
    items.filter((entry) => !entry.archivedAt).map((entry) => entry.id);
  const isSibling = siblingDecksIn('f1');

  // The regression: a neighbour-based step spent the move on the archived deck,
  // so the stored order changed while the shelf order did not move at all.
  const naive = moveSibling(
    decks,
    'b',
    (entry) => (entry.folderId ?? null) === 'f1',
    -1
  );
  assert.deepEqual(naive.map((entry) => entry.id), ['a', 'b', 'archived']);
  assert.deepEqual(shelfOrder(naive), ['a', 'b']);

  // With the shared predicate the step crosses the archived slot and swaps the
  // two decks the learner can actually see.
  const stepped = moveSibling(decks, 'b', isSibling, -1);
  assert.deepEqual(stepped.map((entry) => entry.id), ['b', 'archived', 'a']);
  assert.deepEqual(shelfOrder(stepped), ['b', 'a']);

  // The drag path takes the same group, so both routes land on one order.
  const dragged = moveSiblingTo(decks, 'b', isSibling, 0);
  assert.deepEqual(
    dragged.map((entry) => entry.id),
    stepped.map((entry) => entry.id)
  );

  // An archived deck is never a sibling, and neither is a deck in another
  // folder or an unfiled one.
  assert.equal(isSibling(decks[1]), false);
  assert.equal(isSibling(deck('elsewhere', { folderId: 'f2' })), false);
  assert.equal(isSibling(deck('loose')), false);
  assert.equal(siblingDecksIn(null)(deck('loose')), true);
  assert.equal(siblingDecksIn(null)(deck('filed', { folderId: 'f1' })), false);
  assert.equal(siblingDecksIn(null)(deck('retired', { archivedAt: 2 })), false);
});

test('counts ignore archived decks', () => {
  const decks = [
    deck('a', { folderId: 'f1' }),
    deck('b', { folderId: 'f1', archivedAt: 5 }),
  ];
  assert.equal(folderDeckCount(decks, 'f1'), 1);
  assert.equal(folderDeckCount(decks, 'nope'), 0);
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
