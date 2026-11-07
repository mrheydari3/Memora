/**
 * F0–F6 fixtures for the UI verification.
 *
 * A fixture is the storage state a surface is measured in, plus the sentinel
 * that proves the app actually booted into it. Installation is deliberately
 * separate from the app: every entry is written to the same `memory:*` keys
 * AsyncStorage uses on web, before the first store read.
 *
 * `fixtureInitScript()` is the browser adapter. Inject it with Playwright's
 * `page.addInitScript()` (or any pre-navigation hook) so F6 can make a read
 * throw before React mounts; evaluating it after load is too late.
 *
 * F2 and F3 share the same 47-card/33-review base on purpose: F3 is exactly
 * what `/dev` writes, and F2 adds the 40-character folder name the edge-case
 * surfaces need. Neither can drift from the other without a failing test.
 */

import type { Deck, Flashcard } from '../../data/types';
import { buildDevLibrary, type DevLibrary } from '../../data/devFixture';
import { sampleCards, sampleDecks } from '../../data/seed';
import { STORAGE_KEYS as K } from '../../data/storageKeys';
import { FIXTURES, type FixtureId } from './surfaces';

const DAY = 86_400_000;

/** The seed library's shipped deck; F0 and F5 must land here after boot. */
export const SEED_DECK_NAME = sampleDecks[0]?.name ?? 'Schritt Plus Neu A2/B1';
export const SEED_CARD_COUNT = Object.values(sampleCards).reduce(
  (sum, cards) => sum + cards.length,
  0
);

/** Exactly forty characters, so HM-13 has a folder name that must not overflow. */
export const LONG_FOLDER_NAME = 'Folder name with forty characters'.padEnd(40, '.');

export type StorageCounts = {
  decks: number;
  cards: number;
  folders: number;
  reviews: number;
  initialized: boolean;
  gameRecords: number;
};

export type FixtureSentinel = {
  /** What the storage must contain immediately after installation. */
  installed: StorageCounts;
  /** What the app must show after its first load (or its fallback). */
  booted: StorageCounts;
  /** Visible proof on `route` that this fixture, not another, is mounted. */
  text: string;
  route: string;
};

export type FixtureSpec = {
  id: FixtureId;
  label: string;
  /** `dev-screen` means the fixture is normally loaded through /dev, not cold storage. */
  install: 'storage' | 'dev-screen';
  entries: Record<string, string>;
  failure?: {
    /** Keys whose getItem throws, for the read-failure surface. */
    readThrows?: string[];
    /** Keys whose setItem throws, for the quota/write-failure case. */
    writeThrows?: string[];
  };
  sentinel: FixtureSentinel;
};

export type StorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const emptyCounts = (): StorageCounts => ({
  decks: 0,
  cards: 0,
  folders: 0,
  reviews: 0,
  initialized: false,
  gameRecords: 0,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parse = (raw: string | undefined): unknown => {
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt JSON is exactly what F5 stores; the app reads it as empty too.
    return null;
  }
};

export function countsFromEntries(entries: Record<string, string>): StorageCounts {
  const decks = asArray(parse(entries[K.decks]));
  const cards = asRecord(parse(entries[K.allCards]));
  const folders = asArray(parse(entries[K.folders]));
  const reviews = asArray(parse(entries[K.reviewLog]));
  const games = asRecord(parse(entries[K.gameRecords]));

  return {
    decks: decks.length,
    cards: Object.values(cards).reduce<number>((sum, list) => sum + asArray(list).length, 0),
    folders: folders.length,
    reviews: reviews.length,
    initialized: typeof entries[K.initialized] === 'string',
    gameRecords: Object.keys(games).length,
  };
}

function libraryEntries(library: DevLibrary): Record<string, string> {
  return {
    [K.decks]: JSON.stringify(library.decks),
    [K.folders]: JSON.stringify(library.folders),
    [K.allCards]: JSON.stringify(library.cardsByDeck),
    [K.reviewLog]: JSON.stringify(library.reviewLog),
    [K.gameRecords]: JSON.stringify(library.gameRecords),
    [K.settings]: JSON.stringify(library.settings),
    [K.initialized]: '1',
  };
}

/** F2: the dev library plus the long folder name the edge surfaces need. */
function edgeLibrary(now: number): DevLibrary {
  const library = buildDevLibrary(now);
  return {
    ...library,
    folders: [
      ...library.folders,
      {
        id: 'fold-long',
        name: LONG_FOLDER_NAME,
        createdAt: now - 6 * DAY,
        parentId: null,
      },
    ],
  };
}

/** F4: 100 decks × 50 cards, all New, for scroll and count pressure. */
function heavyLibrary(now: number): { decks: Deck[]; cardsByDeck: Record<string, Flashcard[]> } {
  const template = buildDevLibrary(now);
  const deckTemplate = template.decks[0];
  const cardTemplate = template.cardsByDeck[deckTemplate.id]?.[0];
  if (!deckTemplate || !cardTemplate) throw new Error('dev fixture has no template deck/card');

  const decks: Deck[] = [];
  const cardsByDeck: Record<string, Flashcard[]> = {};
  for (let i = 1; i <= 100; i++) {
    const suffix = String(i).padStart(3, '0');
    const id = `heavy-deck-${suffix}`;
    decks.push({
      ...deckTemplate,
      id,
      name: `Heavy deck ${suffix}`,
      folderId: null,
      pinnedAt: null,
      archivedAt: null,
      createdAt: now - i * 1000,
    });
    cardsByDeck[id] = Array.from({ length: 50 }, (_, index) => {
      const n = index + 1;
      return {
        ...cardTemplate,
        id: `${id}-c${String(n).padStart(2, '0')}`,
        deckId: id,
        front: { text: `Heavy front ${i}-${n}`, direction: 'ltr' as const },
        back: { text: `Heavy back ${i}-${n}`, direction: 'ltr' as const },
        createdAt: now - (i * 50 + index),
        fsrs: { ...cardTemplate.fsrs, due: new Date(now).toISOString(), last_review: null },
      };
    });
  }
  return { decks, cardsByDeck };
}

export function buildFixture(id: FixtureId, now: number = Date.now()): FixtureSpec {
  switch (id) {
    case 'F0':
      return {
        id,
        label: 'Fresh install',
        install: 'storage',
        entries: {},
        sentinel: {
          installed: emptyCounts(),
          booted: {
            decks: sampleDecks.length,
            cards: SEED_CARD_COUNT,
            folders: 0,
            reviews: 0,
            initialized: true,
            gameRecords: 0,
          },
          text: SEED_DECK_NAME,
          route: '/home',
        },
      };

    case 'F1':
      return {
        id,
        label: 'Emptied library',
        install: 'storage',
        // Exactly what /dev → Wipe leaves: every key gone, then the
        // first-run marker so the seed must not come back.
        entries: { [K.initialized]: '1' },
        sentinel: {
          installed: { ...emptyCounts(), initialized: true },
          booted: { ...emptyCounts(), initialized: true },
          text: 'No decks yet',
          route: '/home',
        },
      };

    case 'F2': {
      const library = edgeLibrary(now);
      const entries = libraryEntries(library);
      const counts = countsFromEntries(entries);
      return {
        id,
        label: 'Edge library',
        install: 'storage',
        entries,
        sentinel: { installed: counts, booted: counts, text: SEED_DECK_NAME, route: '/home' },
      };
    }

    case 'F3': {
      const library = buildDevLibrary(now);
      const entries = libraryEntries(library);
      const counts = countsFromEntries(entries);
      return {
        id,
        label: 'Dev fixture',
        install: 'dev-screen',
        entries,
        sentinel: { installed: counts, booted: counts, text: SEED_DECK_NAME, route: '/home' },
      };
    }

    case 'F4': {
      const { decks, cardsByDeck } = heavyLibrary(now);
      const entries: Record<string, string> = {
        [K.decks]: JSON.stringify(decks),
        [K.allCards]: JSON.stringify(cardsByDeck),
        [K.initialized]: '1',
      };
      const counts = countsFromEntries(entries);
      return {
        id,
        label: 'Heavy library',
        install: 'storage',
        entries,
        sentinel: { installed: counts, booted: counts, text: 'Heavy deck 001', route: '/home' },
      };
    }

    case 'F5':
      return {
        id,
        label: 'Corrupt storage',
        install: 'storage',
        entries: {
          [K.decks]: '[{"id": "deck-broken"',
          [K.allCards]: '{"deck-broken": [',
          // A returning install: corrupt JSON reads as empty, and the seed must
          // not silently replace it. The fallback is the normal empty library.
          [K.initialized]: '1',
        },
        sentinel: {
          installed: { ...emptyCounts(), initialized: true },
          booted: { ...emptyCounts(), initialized: true },
          text: 'No decks yet',
          route: '/home',
        },
      };

    case 'F6': {
      const entries = libraryEntries(edgeLibrary(now));
      const counts = countsFromEntries(entries);
      return {
        id,
        label: 'Read/write failure',
        install: 'storage',
        entries,
        failure: { readThrows: [K.decks], writeThrows: [K.decks] },
        sentinel: {
          installed: counts,
          booted: counts,
          text: 'Couldn’t open your library',
          route: '/home',
        },
      };
    }
  }
}

export function assertFixtureSentinel(
  actual: StorageCounts,
  spec: FixtureSpec,
  phase: 'installed' | 'booted'
): void {
  const expected = spec.sentinel[phase];
  const keys = Object.keys(expected) as (keyof StorageCounts)[];
  const mismatch = keys.filter((key) => actual[key] !== expected[key]);
  if (mismatch.length > 0) {
    const detail = mismatch.map((key) => `${key} ${String(actual[key])} ≠ ${String(expected[key])}`);
    throw new Error(`fixture ${spec.id} ${phase} sentinel mismatch: ${detail.join(', ')}`);
  }
}

/** Remove every key the app owns, leaving unrelated origin storage alone. */
export function resetFixtureStorage(storage: StorageLike): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && key.startsWith('memory:')) storage.removeItem(key);
  }
}

/** Reset, install, and prove the installed sentinel before any measurement. */
export function installFixture(storage: StorageLike, spec: FixtureSpec): StorageCounts {
  resetFixtureStorage(storage);
  for (const [key, value] of Object.entries(spec.entries)) storage.setItem(key, value);
  const counts = countsFromEntries(spec.entries);
  assertFixtureSentinel(counts, spec, 'installed');
  return counts;
}

export type FailureMode = 'read' | 'write';

/**
 * Return a self-executing script that resets and seeds `localStorage` before
 * the app boots. F6 patches `Storage.prototype` after seeding, so the fixture
 * data is in place and only the selected key starts throwing.
 */
export function fixtureInitScript(spec: FixtureSpec, mode: FailureMode = 'read'): string {
  const payload = JSON.stringify({
    id: spec.id,
    entries: spec.entries,
    readThrows: mode === 'read' ? (spec.failure?.readThrows ?? []) : [],
    writeThrows: mode === 'write' ? (spec.failure?.writeThrows ?? []) : [],
  });

  return `(() => {
  const fixture = ${payload};
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key && key.indexOf('memory:') === 0) localStorage.removeItem(key);
  }
  for (const key of Object.keys(fixture.entries)) {
    localStorage.setItem(key, fixture.entries[key]);
  }
  const proto = Storage.prototype;
  if (fixture.readThrows.length > 0) {
    const original = proto.getItem;
    proto.getItem = function (key) {
      if (fixture.readThrows.indexOf(key) !== -1) {
        throw new DOMException('fixture read failure: ' + key, 'UnknownError');
      }
      return original.call(this, key);
    };
  }
  if (fixture.writeThrows.length > 0) {
    const original = proto.setItem;
    proto.setItem = function (key, value) {
      if (fixture.writeThrows.indexOf(key) !== -1) {
        throw new DOMException('fixture write failure: ' + key, 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  }
  window.__memoraFixture = {
    id: fixture.id,
    readThrows: fixture.readThrows,
    writeThrows: fixture.writeThrows,
  };
})();`;
}

export const FIXTURE_IDS = FIXTURES;
