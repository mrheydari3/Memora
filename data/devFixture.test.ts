import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDevLibrary, DEV_MAIN_DECK_ID } from './devFixture';

/** A pinned clock, so the fixture has to be a function of `now` only. */
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

test('the fixture ships the six decks the empty states and RTL need', () => {
  const { decks } = buildDevLibrary(NOW);
  assert.equal(decks.length, 6);
  assert.equal(new Set(decks.map((deck) => deck.id)).size, 6);
  assert.equal(decks.filter((deck) => deck.archivedAt !== null && deck.archivedAt !== undefined).length, 1);
});

test('every deck owns a bucket, including the one with no cards', () => {
  const { decks, cardsByDeck } = buildDevLibrary(NOW);
  for (const deck of decks) {
    assert.ok(Array.isArray(cardsByDeck[deck.id]), `missing bucket for ${deck.id}`);
  }
  assert.equal(cardsByDeck['deck-empty'].length, 0);
  assert.equal(cardsByDeck['deck-due'].length, 6);
});

test('cards are well formed and filed under their own deck', () => {
  const { cardsByDeck } = buildDevLibrary(NOW);
  const all = Object.values(cardsByDeck).flat();
  assert.equal(all.length, 47);
  assert.equal(new Set(all.map((card) => card.id)).size, all.length);

  for (const card of all) {
    assert.ok(cardsByDeck[card.deckId].includes(card), `${card.id} is in the wrong bucket`);
    assert.ok(card.front.text.length > 0);
    assert.ok(card.back.text.length > 0);
    assert.ok(['New', 'Learning', 'Review', 'Relearning'].includes(card.fsrs.state));
    assert.equal(Number.isNaN(Date.parse(card.fsrs.due)), false);
  }

  const rtl = cardsByDeck['deck-persian'][0];
  assert.equal(rtl.front.direction, 'rtl');
  assert.equal(rtl.back.direction, 'ltr');
});

test('the review history spans thirteen days and only known cards', () => {
  const { reviewLog, cardsByDeck } = buildDevLibrary(NOW);
  assert.equal(reviewLog.length, 33);

  const known = new Set(cardsByDeck[DEV_MAIN_DECK_ID].map((card) => card.id));
  for (const entry of reviewLog) {
    assert.ok(known.has(entry.cardId), `${entry.cardId} is not in the fixture deck`);
    assert.ok(entry.rating >= 1 && entry.rating <= 4);
    assert.equal(Number.isNaN(Date.parse(new Date(entry.reviewedAt).toISOString())), false);
  }

  const oldest = Math.min(...reviewLog.map((entry) => entry.reviewedAt));
  assert.ok(NOW - oldest >= 12 * 86_400_000, 'history must reach back twelve days');
});

test('the same clock produces an identical library', () => {
  assert.deepEqual(buildDevLibrary(NOW), buildDevLibrary(NOW));
});
