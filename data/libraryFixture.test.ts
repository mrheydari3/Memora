import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScaleLibrary, MEDIUM_SCALE, STRESS_SCALE } from './libraryFixture';
import { buildFolderPaths } from './library';

const NOW = new Date('2026-11-10T12:00:00Z').getTime();

const cardCount = (library: ReturnType<typeof buildScaleLibrary>) =>
  Object.values(library.cardsByDeck).reduce((sum, cards) => sum + cards.length, 0);

test('medium fixture has the requested shape', () => {
  const library = buildScaleLibrary(MEDIUM_SCALE, NOW);
  assert.equal(library.decks.length, 100);
  assert.equal(library.folders.length, 20);
  assert.equal(cardCount(library), 5_000);
  assert.equal(library.reviewLog.length, 20_000);
});

test('stress fixture has the requested shape', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  assert.equal(library.decks.length, 300);
  assert.equal(library.folders.length, 60);
  assert.equal(cardCount(library), 15_000);
  assert.equal(library.reviewLog.length, 75_000);
});

test('fixtures carry the hard shapes, not only counts', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  assert.ok(library.decks.some((deck) => deck.archivedAt != null), 'archived deck');
  assert.ok(library.decks.some((deck) => deck.pinnedAt != null), 'pinned deck');
  assert.ok(library.decks.some((deck) => (library.cardsByDeck[deck.id] ?? []).length === 0), 'empty deck');
  assert.ok(library.decks.some((deck) => deck.name.length > 100), 'long deck name');
  assert.ok(library.decks.some((deck) => /[\u0600-\u06FF]/.test(deck.name)), 'Persian deck name');
  assert.ok(library.folders.some((folder) => /[\u0600-\u06FF]/.test(folder.name)), 'Persian folder name');
  assert.ok(
    library.folders.some((folder) => folder.name.length > 100),
    'long folder name'
  );
});

test('folder nesting runs deeper than five levels', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  const paths = buildFolderPaths(library.folders);
  const deepest = Math.max(...[...paths.values()].map((path) => path.length));
  assert.ok(deepest >= 5, `deepest folder path is ${deepest}`);
});

test('ids are unique, so rows and keys cannot collide', () => {
  const library = buildScaleLibrary(STRESS_SCALE, NOW);
  assert.equal(new Set(library.decks.map((deck) => deck.id)).size, library.decks.length);
  assert.equal(new Set(library.folders.map((folder) => folder.id)).size, library.folders.length);
  const cardIds = new Set<string>();
  for (const cards of Object.values(library.cardsByDeck)) {
    for (const card of cards) {
      assert.ok(!cardIds.has(card.id), `duplicate card ${card.id}`);
      cardIds.add(card.id);
    }
  }
});

test('the fixture is deterministic for a pinned clock', () => {
  const first = buildScaleLibrary(MEDIUM_SCALE, NOW);
  const second = buildScaleLibrary(MEDIUM_SCALE, NOW);
  assert.deepEqual(first, second);
});
