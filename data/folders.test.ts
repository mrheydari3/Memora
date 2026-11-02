import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_NAME_MAX,
  createFolder,
  detachDecksFromFolder,
  findFolderByName,
  folderDeckCount,
  groupDecksByFolder,
  normalizeFolderName,
  removeFolder,
  renameFolder,
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
