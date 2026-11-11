import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFolderAggregates,
  buildFolderPaths,
  buildLibraryIndex,
  childFoldersOf,
  foldSearch,
  indexReviews,
  matchesSearch,
  summarizeQueue,
} from './library';
import { buildStudyQueue } from './session';
import { buildDevLibrary } from './devFixture';
import { buildScaleLibrary, MEDIUM_SCALE, STRESS_SCALE } from './libraryFixture';
import { folderSubtreeCounts } from './folders';
import type { Deck, Flashcard, ReviewLogEntry } from './types';

const NOW = new Date('2026-11-10T12:00:00Z').getTime();

/**
 * The parity contract: the index's arithmetic must describe exactly the queue
 * `buildStudyQueue` would hand a session — totals and split, caps included.
 */
function assertParity(
  deck: Deck,
  cards: Flashcard[],
  log: ReviewLogEntry[],
  label: string
): void {
  const reviews = indexReviews(log, NOW);
  const summary = summarizeQueue(
    deck,
    cards,
    {
      newSeenToday: reviews.newSeenToday.get(deck.id),
      reviewsToday: reviews.reviewsToday.get(deck.id),
    },
    NOW
  );
  const queue = buildStudyQueue(deck, cards, log, NOW);
  const learning = queue.dueCards.filter(
    (card) => card.fsrs.state === 'Learning' || card.fsrs.state === 'Relearning'
  ).length;

  assert.equal(summary.total, queue.total, `${label}: total`);
  assert.equal(summary.newCount, queue.newCards.length, `${label}: new`);
  assert.equal(summary.learningCount, learning, `${label}: learning`);
  assert.equal(summary.reviewCount, queue.dueCards.length - learning, `${label}: review`);
  assert.equal(summary.cardCount, cards.length, `${label}: cards`);
}

test('queue summaries match buildStudyQueue on the dev library', () => {
  const library = buildDevLibrary(NOW);
  for (const deck of library.decks) {
    assertParity(deck, library.cardsByDeck[deck.id] ?? [], library.reviewLog, deck.name);
  }
});

test('queue summaries match buildStudyQueue under every daily cap shape', () => {
  const base = buildDevLibrary(NOW).decks[0];
  const cards = buildDevLibrary(NOW).cardsByDeck[base.id];
  const caps: { newCardsPerDay: number; maxCardsPerDay: number }[] = [
    { newCardsPerDay: 0, maxCardsPerDay: 0 },
    { newCardsPerDay: 1, maxCardsPerDay: 1 },
    { newCardsPerDay: 3, maxCardsPerDay: 5 },
    { newCardsPerDay: 20, maxCardsPerDay: 80 },
    { newCardsPerDay: 500, maxCardsPerDay: 500 },
  ];
  const log = buildDevLibrary(NOW).reviewLog;
  for (const cap of caps) {
    const deck = { ...base, ...cap };
    assertParity(deck, cards, log, `caps ${cap.newCardsPerDay}/${cap.maxCardsPerDay}`);
  }
});

test('fast repetition and learning states keep their exact split', () => {
  const library = buildDevLibrary(NOW);
  const deck = library.decks.find((entry) => entry.id === 'deck-german-a2b1')!;
  for (const preset of ['fsrs', 'fast', 'general'] as const) {
    for (const target of [deck, { ...deck, algorithmPreset: preset }]) {
      assertParity(target, library.cardsByDeck[deck.id], library.reviewLog, preset);
    }
  }
});

test('folder aggregates equal the per-folder subtree walk', () => {
  const library = buildDevLibrary(NOW);
  const index = buildLibraryIndex(
    library.decks,
    library.folders,
    library.cardsByDeck,
    library.reviewLog,
    { now: NOW }
  );
  const dueByDeck = Object.fromEntries(index.entries.map((entry) => [entry.deck.id, entry.total]));
  const subtrees = folderSubtreeCounts(library.folders, library.decks, dueByDeck);

  for (const folder of library.folders) {
    const aggregate = index.aggregates.get(folder.id);
    const subtree = subtrees.get(folder.id);
    assert.ok(aggregate, `aggregate for ${folder.name}`);
    assert.ok(subtree, `subtree for ${folder.name}`);
    assert.equal(aggregate.decks, subtree.decks, `${folder.name}: decks`);
    assert.equal(aggregate.due, subtree.due, `${folder.name}: due`);
    assert.equal(aggregate.nestedFolders, subtree.nestedFolders, `${folder.name}: nested`);
    assert.equal(aggregate.directDecks, index.byFolderId.get(folder.id)?.length ?? 0);
  }
});

test('paths and children resolve once and survive a parent cycle', () => {
  const library = buildDevLibrary(NOW);
  const paths = buildFolderPaths(library.folders);
  assert.deepEqual(
    paths.get('fold-de')?.map((folder) => folder.name),
    ['Languages', 'German']
  );

  const cyclic = [
    { id: 'a', name: 'A', createdAt: NOW, parentId: 'b' },
    { id: 'b', name: 'B', createdAt: NOW, parentId: 'a' },
  ];
  const index = buildLibraryIndex([], cyclic, {}, [], { now: NOW });
  assert.equal(index.aggregates.size, 2);
  assert.deepEqual(index.totals, {
    decks: 0,
    folders: 2,
    due: 0,
    dueDecks: 0,
    cards: 0,
    studied: 0,
    progress: 0,
    caughtUpDecks: 0,
    caughtUpFolders: 0,
    archived: 0,
  });
  assert.ok(buildFolderPaths(cyclic).get('a')!.length >= 1);
  assert.equal(childFoldersOf(index, null).length, 0);
});

test('orphan decks stay unfiled and never pad a folder', () => {
  const library = buildDevLibrary(NOW);
  const orphanDeck = { ...library.decks[0], id: 'deck-orphan', folderId: 'fold-gone' };
  const index = buildLibraryIndex(
    [...library.decks, orphanDeck],
    library.folders,
    library.cardsByDeck,
    library.reviewLog,
    { now: NOW }
  );

  assert.ok(index.unfiled.some((entry) => entry.deck.id === 'deck-orphan'));
  for (const list of index.byFolderId.values()) {
    assert.ok(!list.some((entry) => entry.deck.id === 'deck-orphan'));
  }
});

test('search folding matches Persian variants and joins ZWNJ', () => {
  assert.equal(matchesSearch('فارسی — کارت‌های راست‌به‌چپ', foldSearch('کارتها')), true);
  assert.equal(matchesSearch('فارسی — کارت‌های راست‌به‌چپ', foldSearch('کارت‌ها')), true);
  assert.equal(matchesSearch('فارسی — کارت‌های راست‌به‌چپ', foldSearch('فارسی')), true);
  assert.equal(matchesSearch('Deck 12', foldSearch('  DECK  12 ')), true);
  assert.equal(matchesSearch('Deck 12', foldSearch('deck 13')), false);
  // Arabic keyboard variants fold onto the Persian letters.
  assert.equal(matchesSearch('فارسی', foldSearch('فارسي')), true);
});

test('stress library indexes in one pass and keeps every total', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  const index = buildLibraryIndex(
    library.decks,
    library.folders,
    library.cardsByDeck,
    library.reviewLog,
    { now: NOW }
  );

  const active = library.decks.filter((deck) => !deck.archivedAt);
  assert.equal(index.entries.length, active.length);
  assert.equal(index.archived.length, library.decks.length - active.length);
  assert.equal(index.totals.decks, active.length);
  assert.equal(index.totals.cards, active.reduce((sum, deck) => sum + (library.cardsByDeck[deck.id]?.length ?? 0), 0));

  // Every active deck is reachable exactly once: either in a folder or unfiled.
  const placed = new Set<string>();
  for (const list of index.byFolderId.values()) {
    for (const entry of list) {
      assert.ok(!placed.has(entry.deck.id), `duplicate placement ${entry.deck.id}`);
      placed.add(entry.deck.id);
    }
  }
  for (const entry of index.unfiled) {
    assert.ok(!placed.has(entry.deck.id), `duplicate unfiled ${entry.deck.id}`);
    placed.add(entry.deck.id);
  }
  assert.equal(placed.size, active.length);

  // The root folders' subtree totals add up to the library totals.
  const roots = childFoldersOf(index, null);
  const rootDecks = roots.reduce((sum, folder) => sum + (index.aggregates.get(folder.id)?.decks ?? 0), 0);
  const rootDue = roots.reduce((sum, folder) => sum + (index.aggregates.get(folder.id)?.due ?? 0), 0);
  assert.equal(rootDecks + index.unfiled.length, active.length);
  assert.equal(rootDue + index.unfiled.reduce((sum, entry) => sum + entry.total, 0), index.totals.due);

  // And a medium index still matches the session builder for every deck.
  const medium = buildScaleLibrary(MEDIUM_SCALE, NOW);
  const mediumIndex = buildLibraryIndex(
    medium.decks,
    medium.folders,
    medium.cardsByDeck,
    medium.reviewLog,
    { now: NOW }
  );
  for (const entry of mediumIndex.entries.slice(0, 20)) {
    assertParity(
      entry.deck,
      medium.cardsByDeck[entry.deck.id] ?? [],
      medium.reviewLog,
      entry.deck.id
    );
  }
});

test('bottom-up aggregation visits each folder once', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  const index = buildLibraryIndex(
    library.decks,
    library.folders,
    library.cardsByDeck,
    library.reviewLog,
    { now: NOW }
  );
  const children = new Map<string, string[]>();
  for (const folder of library.folders) children.set(folder.id, []);
  for (const folder of library.folders) {
    if (folder.parentId) children.get(folder.parentId)?.push(folder.id);
  }

  // The aggregate for a folder must equal direct totals plus its children's,
  // which is only true if the fold is bottom-up and cycle-safe.
  for (const folder of library.folders) {
    const aggregate = index.aggregates.get(folder.id)!;
    const direct = index.byFolderId.get(folder.id) ?? [];
    let decks = direct.length;
    let due = direct.reduce((sum, entry) => sum + entry.total, 0);
    for (const childId of children.get(folder.id) ?? []) {
      const child = index.aggregates.get(childId)!;
      decks += child.decks;
      due += child.due;
    }
    assert.equal(aggregate.decks, decks, `${folder.id}: decks`);
    assert.equal(aggregate.due, due, `${folder.id}: due`);
  }
});

test('empty library and deleted folders are handled without special cases', () => {
  const index = buildLibraryIndex([], [], {}, [], { now: NOW });
  assert.deepEqual(index.entries, []);
  assert.deepEqual(index.unfiled, []);
  assert.equal(index.totals.due, 0);
  assert.equal(index.totals.progress, 0);

  const library = buildDevLibrary(NOW);
  const folderless = buildLibraryIndex(library.decks, [], library.cardsByDeck, library.reviewLog, {
    now: NOW,
  });
  assert.equal(folderless.byFolderId.size, 0);
  assert.equal(folderless.unfiled.length, folderless.entries.length);

  const aggregates = buildFolderAggregates(library.folders, new Map(), new Map());
  assert.equal(aggregates.get('fold-empty')?.decks, 0);
});
