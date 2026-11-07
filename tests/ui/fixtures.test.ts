import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS as K } from '../../data/storageKeys';
import {
  buildFixture,
  countsFromEntries,
  FIXTURE_IDS,
  fixtureInitScript,
  installFixture,
  LONG_FOLDER_NAME,
  SEED_CARD_COUNT,
  assertFixtureSentinel,
  type FailureMode,
  type FixtureSpec,
  type StorageLike,
} from './fixtures';

/** Fixed clock: every fixture must produce byte-identical output twice. */
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

type BrowserWindow = { __memoraFixture?: { id: string; readThrows: string[]; writeThrows: string[] } };

/**
 * A fresh Storage subclass per evaluation. Patching the shared MemoryStorage
 * prototype would make F6's write failure leak into every later test.
 */
function newBrowserStorage() {
  class BrowserStorage extends MemoryStorage {}
  return { storage: new BrowserStorage(), StorageClass: BrowserStorage };
}

/** Evaluate the init script the way a browser would. */
function runInitScript(spec: FixtureSpec, mode: FailureMode = 'read') {
  const { storage, StorageClass } = newBrowserStorage();
  const windowStub: BrowserWindow = {};
  const evaluate = new Function(
    'localStorage',
    'Storage',
    'DOMException',
    'window',
    fixtureInitScript(spec, mode)
  );
  evaluate(storage, StorageClass, DOMException, windowStub);
  return { storage, windowStub };
}

test('every fixture installs its declared sentinel', () => {
  for (const id of FIXTURE_IDS) {
    const spec = buildFixture(id, NOW);
    const storage = new MemoryStorage();
    const counts = installFixture(storage, spec);
    assert.deepEqual(counts, spec.sentinel.installed, `${id} installed counts`);
    assertFixtureSentinel(counts, spec, 'installed');
  }
});

test('F0 is empty storage and boots into the shipped seed', () => {
  const spec = buildFixture('F0', NOW);
  assert.deepEqual(spec.entries, {});
  assert.deepEqual(spec.sentinel.installed, {
    decks: 0,
    cards: 0,
    folders: 0,
    reviews: 0,
    initialized: false,
    gameRecords: 0,
  });
  assert.equal(spec.sentinel.booted.decks, 1);
  assert.equal(spec.sentinel.booted.cards, 1817);
  assert.equal(spec.sentinel.booted.cards, SEED_CARD_COUNT);
});

test('F1 is exactly a wiped device and must not re-seed', () => {
  const spec = buildFixture('F1', NOW);
  assert.deepEqual(Object.keys(spec.entries), [K.initialized]);
  assert.deepEqual(spec.sentinel.booted, {
    decks: 0,
    cards: 0,
    folders: 0,
    reviews: 0,
    initialized: true,
    gameRecords: 0,
  });
  assert.equal(spec.sentinel.text, 'No decks yet');
});

test('F2 has the edge shapes: 47 cards, four states, 33 reviews, long folder', () => {
  const spec = buildFixture('F2', NOW);
  const cards = JSON.parse(spec.entries[K.allCards]) as Record<string, Array<Record<string, unknown>>>;
  const allCards = Object.values(cards).flat();
  const decks = JSON.parse(spec.entries[K.decks]) as Array<Record<string, unknown>>;
  const folders = JSON.parse(spec.entries[K.folders]) as Array<Record<string, unknown>>;
  const reviews = JSON.parse(spec.entries[K.reviewLog]) as Array<{ reviewedAt: number }>;
  const games = JSON.parse(spec.entries[K.gameRecords]) as Record<string, { bestScore: number }>;

  assert.equal(spec.sentinel.installed.decks, 6);
  assert.equal(spec.sentinel.installed.cards, 47);
  assert.equal(spec.sentinel.installed.folders, 5);
  assert.equal(spec.sentinel.installed.reviews, 33);
  assert.equal(spec.sentinel.installed.gameRecords, 1);

  const states = [...new Set(allCards.map((card) => (card.fsrs as { state: string }).state))].sort();
  assert.deepEqual(states, ['Learning', 'New', 'Relearning', 'Review']);
  assert.equal(folders.filter((folder) => String(folder.name).length === 40).length, 1);
  assert.equal(LONG_FOLDER_NAME.length, 40);
  assert.ok(folders.some((folder) => folder.name === 'Nothing here yet'));
  assert.ok(decks.some((deck) => deck.id === 'deck-empty'));
  assert.ok(decks.some((deck) => deck.archivedAt));
  assert.ok(decks.some((deck) => String(deck.name).length >= 40));
  assert.ok(allCards.some((card) => (card.front as { direction: string }).direction === 'rtl'));

  assert.equal(reviews.length, 33);
  const days = new Set(reviews.map((review) => new Date(review.reviewedAt).toISOString().slice(0, 10)));
  assert.equal(days.size, 13);
  assert.equal(Object.values(games)[0]?.bestScore, 9);
});

test('F3 is the exact /dev dataset, sharing F2 cards but not its extra folder', () => {
  const dev = buildFixture('F3', NOW);
  const edge = buildFixture('F2', NOW);

  assert.equal(dev.install, 'dev-screen');
  assert.equal(dev.sentinel.installed.decks, 6);
  assert.equal(dev.sentinel.installed.cards, 47);
  assert.equal(dev.sentinel.installed.folders, 4);
  assert.equal(dev.sentinel.installed.reviews, 33);
  assert.equal(dev.entries[K.allCards], edge.entries[K.allCards]);
  assert.notEqual(dev.entries[K.folders], edge.entries[K.folders]);
});

test('F4 holds 100 decks × 50 cards', () => {
  const spec = buildFixture('F4', NOW);
  assert.equal(spec.sentinel.installed.decks, 100);
  assert.equal(spec.sentinel.installed.cards, 5000);
  assert.equal(spec.sentinel.installed.folders, 0);
  assert.equal(spec.sentinel.installed.reviews, 0);

  const cards = JSON.parse(spec.entries[K.allCards]) as Record<string, unknown[]>;
  assert.equal(Object.keys(cards).length, 100);
  assert.ok(Object.values(cards).every((list) => list.length === 50));
});

test('F5 preserves corrupt JSON and does not seed over it', () => {
  const spec = buildFixture('F5', NOW);
  assert.throws(() => JSON.parse(spec.entries[K.decks]!));
  assert.throws(() => JSON.parse(spec.entries[K.allCards]!));
  assert.equal(spec.sentinel.installed.decks, 0);
  assert.equal(spec.sentinel.installed.cards, 0);
  assert.equal(spec.sentinel.installed.initialized, true);
  assert.equal(spec.sentinel.booted.decks, 0);
  assert.equal(spec.sentinel.text, 'No decks yet');
});

test('F6 read mode throws only for memory:decks and keeps the seeded library', () => {
  const spec = buildFixture('F6', NOW);
  const { storage, windowStub } = runInitScript(spec, 'read');

  assert.throws(
    () => storage.getItem(K.decks),
    (error: unknown) => error instanceof DOMException && error.name === 'UnknownError'
  );
  assert.equal(storage.getItem(K.settings), spec.entries[K.settings]);
  assert.equal(storage.getItem(K.initialized), '1');
  assert.equal(windowStub.__memoraFixture?.id, 'F6');
  assert.deepEqual(windowStub.__memoraFixture?.readThrows, [K.decks]);
  assert.deepEqual(windowStub.__memoraFixture?.writeThrows, []);
  assert.equal(spec.sentinel.text, 'Couldn’t open your library');
});

test('F6 write mode rejects the write while other keys still work', () => {
  const spec = buildFixture('F6', NOW);
  const { storage, windowStub } = runInitScript(spec, 'write');

  assert.equal(storage.getItem(K.decks), spec.entries[K.decks]);
  assert.throws(
    () => storage.setItem(K.decks, '[]'),
    (error: unknown) => error instanceof DOMException && error.name === 'QuotaExceededError'
  );
  storage.setItem('other:key', 'keep');
  assert.equal(storage.getItem('other:key'), 'keep');
  assert.deepEqual(windowStub.__memoraFixture?.readThrows, []);
});

test('installing a fixture resets every memory key and no state leaks', () => {
  const storage = new MemoryStorage();
  storage.setItem('other:key', 'keep');

  installFixture(storage, buildFixture('F2', NOW));
  assert.match(storage.getItem(K.decks) ?? '', /deck-persian/);

  installFixture(storage, buildFixture('F1', NOW));
  assert.equal(storage.getItem(K.decks), null);
  assert.equal(storage.getItem(K.allCards), null);
  assert.equal(storage.getItem(K.reviewLog), null);
  assert.equal(storage.getItem(K.settings), null);
  assert.equal(storage.getItem(K.initialized), '1');
  assert.equal(storage.getItem('other:key'), 'keep');

  installFixture(storage, buildFixture('F0', NOW));
  assert.equal(storage.getItem(K.initialized), null);
  assert.equal(storage.length, 1, 'only the unrelated origin key survives');
  assert.equal(storage.getItem('other:key'), 'keep');
});

test('the pre-boot script clears stale memory keys and preserves unrelated storage', () => {
  const { storage, StorageClass } = newBrowserStorage();
  storage.setItem(K.decks, 'stale');
  storage.setItem('other:key', 'keep');

  const spec = buildFixture('F0', NOW);
  const evaluate = new Function(
    'localStorage',
    'Storage',
    'DOMException',
    'window',
    fixtureInitScript(spec)
  );
  evaluate(storage, StorageClass, DOMException, {});

  assert.equal(storage.getItem(K.decks), null);
  assert.equal(storage.getItem('other:key'), 'keep');
});

test('a sentinel mismatch names the count that drifted', () => {
  const spec = buildFixture('F2', NOW);
  assert.throws(
    () => assertFixtureSentinel({ ...spec.sentinel.installed, decks: 5 }, spec, 'installed'),
    /decks 5 ≠ 6/
  );
});

test('fixture data is deterministic for a fixed clock', () => {
  for (const id of FIXTURE_IDS) {
    assert.deepEqual(buildFixture(id, NOW), buildFixture(id, NOW), `${id} must be byte-identical`);
  }
});

test('F2 counts parse back from its own entries', () => {
  const spec = buildFixture('F2', NOW);
  assert.deepEqual(countsFromEntries(spec.entries), spec.sentinel.installed);
});
