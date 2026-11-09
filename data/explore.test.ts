/**
 * Explore engine tests — signals, scope, exclusions and determinism.
 * Run with `npm test` or the single-file node command in the plan.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExplorePicks } from './explore';
import type { ExploreDeckStats, ExploreInput } from './explore';
import type { Deck, DeckFolder, Flashcard, FSRSState, Rating, ReviewLogEntry } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 7, 12, 0, 0).getTime();

function makeDeck(id: string, name = id, extra: Partial<Deck> = {}): Deck {
  return {
    id,
    name,
    icon: 'book',
    color: '#808080',
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    learningSteps: [],
    masteredIntervalMultiplier: 2.5,
    createdAt: NOW - 60 * DAY,
    folderId: null,
    ...extra,
  };
}

function makeFolder(id: string, name = id, parentId: string | null = null): DeckFolder {
  return { id, name, createdAt: NOW - 60 * DAY, parentId };
}

function makeCard(
  deckId: string,
  id: string,
  options: {
    state?: FSRSState;
    dueAt?: number;
    lastReviewAt?: number | null;
  } = {}
): Flashcard {
  const state = options.state ?? 'Review';
  const lastReview =
    state === 'New'
      ? null
      : options.lastReviewAt === undefined
        ? new Date(NOW - DAY).toISOString()
        : options.lastReviewAt === null
          ? null
          : new Date(options.lastReviewAt).toISOString();

  return {
    id,
    deckId,
    front: { text: id, direction: 'ltr' },
    back: { text: id, direction: 'ltr' },
    createdAt: NOW - 30 * DAY,
    fsrs: {
      due: new Date(options.dueAt ?? NOW + DAY).toISOString(),
      stability: 2,
      difficulty: 5,
      elapsed_days: 1,
      scheduled_days: 2,
      reps: 1,
      lapses: 0,
      state,
      last_review: lastReview,
    },
  };
}

function studiedCards(deckId: string, count: number, lastReviewAt = NOW - DAY): Flashcard[] {
  return Array.from({ length: count }, (_, index) =>
    makeCard(deckId, `${deckId}-c${index}`, {
      dueAt: NOW + DAY,
      lastReviewAt,
    })
  );
}

function makeStats(
  deckId: string,
  due: number,
  newCount = 0,
  learningCount = 0,
  reviewCount = 0
): ExploreDeckStats {
  return { deckId, due, newCount, learningCount, reviewCount };
}

function makeReview(
  deckId: string,
  cardId: string,
  reviewedAt: number,
  rating: Rating = 3,
  stateBefore: FSRSState = 'Review'
): ReviewLogEntry {
  return { deckId, cardId, rating, reviewedAt, elapsedMs: 1_000, stateBefore };
}

function makeReviews(
  deckId: string,
  count: number,
  options: { lapses?: number; reviewedAt?: number; stateBefore?: FSRSState } = {}
): ReviewLogEntry[] {
  const reviewedAt = options.reviewedAt ?? NOW - DAY;
  return Array.from({ length: count }, (_, index) =>
    makeReview(
      deckId,
      `${deckId}-r${index}`,
      reviewedAt + index,
      index < (options.lapses ?? 0) ? 1 : 3,
      options.stateBefore ?? 'Review'
    )
  );
}

function makeInput(args: {
  decks: Deck[];
  cards: Record<string, Flashcard[]>;
  stats: ExploreDeckStats[];
  reviews?: ReviewLogEntry[];
  folders?: DeckFolder[];
  scope?: string | null;
  exclude?: string[];
}): ExploreInput {
  return {
    decks: args.decks,
    cardsByDeck: args.cards,
    statsByDeck: args.stats,
    reviewLog: args.reviews ?? [],
    folders: args.folders ?? [],
    scopeFolderId: args.scope ?? null,
    excludeDeckIds: args.exclude ?? [],
    now: NOW,
  };
}

test('excludes archived, empty, hero and out-of-scope decks', () => {
  const decks = [
    makeDeck('archived', 'Archived', { archivedAt: NOW - DAY, folderId: 'f1' }),
    makeDeck('empty', 'Empty', { folderId: 'f1' }),
    makeDeck('hero', 'Hero', { folderId: 'f1' }),
    makeDeck('outside', 'Outside', { folderId: 'f2' }),
    makeDeck('inside', 'Inside', { folderId: 'f1' }),
  ];
  const cards = {
    archived: studiedCards('archived', 8),
    empty: [],
    hero: studiedCards('hero', 8),
    outside: studiedCards('outside', 8),
    inside: studiedCards('inside', 8),
  };
  const stats = decks.map((deck) =>
    makeStats(deck.id, deck.id === 'empty' ? 0 : 6, 0, 0, deck.id === 'empty' ? 0 : 6)
  );

  const picks = buildExplorePicks(
    makeInput({
      decks,
      cards,
      stats,
      folders: [makeFolder('f1'), makeFolder('f2')],
      scope: 'f1',
      exclude: ['hero'],
    })
  );

  assert.deepEqual(
    picks.map((pick) => pick.deckId),
    ['inside']
  );
});

test('backlog states overdue and due, and carries the queue totals', () => {
  const deck = makeDeck('a');
  const cards = [
    ...Array.from({ length: 2 }, (_, index) =>
      makeCard('a', `overdue-${index}`, { dueAt: NOW - 2 * DAY, lastReviewAt: NOW - DAY })
    ),
    ...studiedCards('a', 10),
  ];
  const reviews = makeReviews('a', 12, { reviewedAt: NOW - DAY });

  const picks = buildExplorePicks(
    makeInput({
      decks: [deck],
      cards: { a: cards },
      stats: [makeStats('a', 7, 0, 0, 7)],
      reviews,
    })
  );

  assert.equal(picks.length, 1);
  assert.equal(picks[0].kind, 'backlog');
  assert.equal(picks[0].role, 'now');
  assert.equal(picks[0].due, 7);
  assert.equal(picks[0].reason, '2 overdue · 7 due today');
  assert.equal(picks[0].progress, 1);
  assert.equal(picks[0].lastStudiedAt, NOW - DAY + 11);
});

test('needs attention waits for thirty reviews and a fifth of them lapsing', () => {
  const decks = [makeDeck('enough'), makeDeck('small')];
  const cards = {
    enough: studiedCards('enough', 30),
    small: studiedCards('small', 30),
  };
  const stats = [makeStats('enough', 0), makeStats('small', 0)];
  const reviews = [
    ...makeReviews('enough', 30, { lapses: 6 }),
    ...makeReviews('small', 29, { lapses: 6 }),
  ];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => pick.deckId),
    ['enough']
  );
  assert.equal(picks[0].kind, 'care');
  assert.equal(picks[0].role, 'keep-going');
  assert.equal(picks[0].reason, '6 lapses in 30 reviews');
});

test('almost there needs a real near-finish, not just a high percentage', () => {
  const decks = [makeDeck('almost'), makeDeck('seventy'), makeDeck('complete')];
  const cards = {
    almost: [
      ...studiedCards('almost', 8),
      makeCard('almost', 'almost-new-1', { state: 'New' }),
      makeCard('almost', 'almost-new-2', { state: 'New' }),
    ],
    seventy: [
      ...studiedCards('seventy', 7),
      ...Array.from({ length: 3 }, (_, index) =>
        makeCard('seventy', `seventy-new-${index}`, { state: 'New' })
      ),
    ],
    complete: studiedCards('complete', 10),
  };
  const stats = [
    makeStats('almost', 2, 2),
    makeStats('seventy', 3, 3),
    makeStats('complete', 1, 0, 0, 1),
  ];
  const reviews = [
    ...makeReviews('almost', 8),
    ...makeReviews('seventy', 7),
    ...makeReviews('complete', 10),
  ];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => pick.kind),
    ['almost']
  );
  assert.equal(picks[0].reason, '80% studied · 2 cards left');
  assert.equal(picks[0].role, 'keep-going');
});

test('rediscover starts at seven quiet days and reports the gap', () => {
  const decks = [makeDeck('ten-days'), makeDeck('six-days')];
  const cards = {
    'ten-days': [
      ...studiedCards('ten-days', 5, NOW - 10 * DAY),
      ...Array.from({ length: 5 }, (_, index) =>
        makeCard('ten-days', `ten-new-${index}`, { state: 'New' })
      ),
    ],
    'six-days': [
      ...studiedCards('six-days', 5, NOW - 6 * DAY),
      ...Array.from({ length: 5 }, (_, index) =>
        makeCard('six-days', `six-new-${index}`, { state: 'New' })
      ),
    ],
  };
  const stats = [makeStats('ten-days', 5, 5), makeStats('six-days', 5, 5)];
  const reviews = [
    ...makeReviews('ten-days', 5, { reviewedAt: NOW - 10 * DAY - 1_000 }),
    ...makeReviews('six-days', 5, { reviewedAt: NOW - 6 * DAY }),
  ];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => pick.deckId),
    ['ten-days']
  );
  assert.equal(picks[0].kind, 'rediscover');
  assert.equal(picks[0].reason, '10 days since last review · 50% studied');
  assert.equal(picks[0].role, 'keep-going');
});

test('fresh start is a never-studied deck with new cards and no overdue work', () => {
  const cards = Array.from({ length: 20 }, (_, index) =>
    makeCard('fresh', `fresh-${index}`, { state: 'New' })
  );

  const picks = buildExplorePicks(
    makeInput({
      decks: [makeDeck('fresh', 'Fresh', { createdAt: NOW - 2 * DAY })],
      cards: { fresh: cards },
      stats: [makeStats('fresh', 20, 20)],
    })
  );

  assert.deepEqual(
    picks.map((pick) => pick.kind),
    ['fresh']
  );
  assert.equal(picks[0].reason, '20 new cards · not started');
  assert.equal(picks[0].role, 'fresh');
});

test('a deck gets one signal and one row, even when several qualify', () => {
  const decks = [makeDeck('both'), makeDeck('almost')];
  const cards = {
    both: [
      ...studiedCards('both', 11),
      makeCard('both', 'both-new', { state: 'New' }),
    ],
    almost: [
      ...studiedCards('almost', 8),
      makeCard('almost', 'almost-new-1', { state: 'New' }),
      makeCard('almost', 'almost-new-2', { state: 'New' }),
    ],
  };
  const stats = [makeStats('both', 5, 0, 0, 5), makeStats('almost', 2, 2)];
  const reviews = [...makeReviews('both', 11), ...makeReviews('almost', 8)];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => [pick.deckId, pick.kind]),
    [
      ['both', 'backlog'],
      ['almost', 'almost'],
    ]
  );
  assert.equal(new Set(picks.map((pick) => pick.deckId)).size, picks.length);
});

test('scope follows descendant folders, and the root sees the whole library', () => {
  const folders = [makeFolder('root'), makeFolder('child', 'Child', 'root'), makeFolder('other')];
  const decks = [
    makeDeck('root-deck', 'Root', { folderId: 'root' }),
    makeDeck('child-deck', 'Child deck', { folderId: 'child' }),
    makeDeck('unfiled', 'Unfiled'),
    makeDeck('other-deck', 'Other', { folderId: 'other' }),
  ];
  const cards = {
    'root-deck': studiedCards('root-deck', 8),
    'child-deck': [
      ...studiedCards('child-deck', 8),
      makeCard('child-deck', 'child-new-1', { state: 'New' }),
      makeCard('child-deck', 'child-new-2', { state: 'New' }),
    ],
    unfiled: Array.from({ length: 10 }, (_, index) =>
      makeCard('unfiled', `unfiled-${index}`, { state: 'New' })
    ),
    'other-deck': [
      ...studiedCards('other-deck', 5, NOW - 10 * DAY),
      ...Array.from({ length: 5 }, (_, index) =>
        makeCard('other-deck', `other-new-${index}`, { state: 'New' })
      ),
    ],
  };
  const stats = [
    makeStats('root-deck', 6, 0, 0, 6),
    makeStats('child-deck', 2, 2),
    makeStats('unfiled', 10, 10),
    makeStats('other-deck', 5, 5),
  ];
  const reviews = [
    ...makeReviews('root-deck', 8),
    ...makeReviews('child-deck', 8),
    ...makeReviews('other-deck', 5, { reviewedAt: NOW - 10 * DAY }),
  ];

  const scoped = buildExplorePicks(
    makeInput({ decks, cards, stats, reviews, folders, scope: 'root' })
  );
  assert.deepEqual(
    scoped.map((pick) => pick.deckId),
    ['root-deck', 'child-deck']
  );

  const all = buildExplorePicks(makeInput({ decks, cards, stats, reviews, folders }));
  assert.deepEqual(
    all.map((pick) => pick.deckId),
    ['root-deck', 'child-deck', 'other-deck', 'unfiled']
  );
});

test('the engine is deterministic and breaks ties by name then id', () => {
  const decks = [makeDeck('beta', 'Beta'), makeDeck('alpha', 'Alpha')];
  const cards = {
    beta: studiedCards('beta', 8),
    alpha: studiedCards('alpha', 8),
  };
  const stats = [makeStats('beta', 6, 0, 0, 6), makeStats('alpha', 6, 0, 0, 6)];
  const reviews = [...makeReviews('beta', 8), ...makeReviews('alpha', 8)];

  const forward = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));
  const reverse = buildExplorePicks(
    makeInput({ decks: [...decks].reverse(), cards, stats, reviews })
  );

  assert.deepEqual(forward, reverse);
  assert.equal(forward.length, 1);
  assert.equal(forward[0].deckId, 'alpha');
});

test('backlog is dismissed below the review-work threshold', () => {
  const decks = [makeDeck('below'), makeDeck('at')];
  const cards = {
    below: studiedCards('below', 10),
    at: studiedCards('at', 10),
  };
  const stats = [makeStats('below', 4, 0, 0, 4), makeStats('at', 5, 0, 1, 4)];
  const reviews = [...makeReviews('below', 10), ...makeReviews('at', 10)];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => [pick.deckId, pick.kind, pick.reason]),
    [['at', 'backlog', '5 due today']]
  );
});

test('the hero deck is excluded, so a one-deck library has nothing to explore', () => {
  const cards = studiedCards('only', 8);
  const picks = buildExplorePicks(
    makeInput({
      decks: [makeDeck('only')],
      cards: { only: cards },
      stats: [makeStats('only', 6, 0, 0, 6)],
      reviews: makeReviews('only', 8),
      exclude: ['only'],
    })
  );

  assert.deepEqual(picks, []);
});

test('almost there caps the near-finished window at five cards or ten percent', () => {
  // Ten percent of 60 is six, so six cards left still qualifies and seven does not.
  const nearCards = [...studiedCards('near', 54), ...Array.from({ length: 6 }, (_, index) =>
    makeCard('near', `near-new-${index}`, { state: 'New' })
  )];
  const edgeCards = [...studiedCards('edge', 53), ...Array.from({ length: 7 }, (_, index) =>
    makeCard('edge', `edge-new-${index}`, { state: 'New' })
  )];

  const near = buildExplorePicks(
    makeInput({
      decks: [makeDeck('near')],
      cards: { near: nearCards },
      stats: [makeStats('near', 6, 6)],
    })
  );
  const edge = buildExplorePicks(
    makeInput({
      decks: [makeDeck('edge')],
      cards: { edge: edgeCards },
      stats: [makeStats('edge', 7, 7)],
    })
  );

  assert.deepEqual(
    near.map((pick) => [pick.deckId, pick.kind, pick.reason]),
    [['near', 'almost', '90% studied · 6 cards left']]
  );
  assert.deepEqual(edge, []);
});

test('ties prefer the deck with the oldest last review', () => {
  const decks = [makeDeck('younger'), makeDeck('older')];
  const cards = {
    younger: studiedCards('younger', 30),
    older: studiedCards('older', 30),
  };
  const stats = [makeStats('younger', 0), makeStats('older', 0)];
  const reviews = [
    ...makeReviews('younger', 30, { lapses: 6, reviewedAt: NOW - DAY }),
    ...makeReviews('older', 30, { lapses: 6, reviewedAt: NOW - 5 * DAY }),
  ];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => pick.deckId),
    ['older']
  );
  assert.equal(picks[0].kind, 'care');
});

test('ties prefer the higher due count, then the deck name and id', () => {
  const decks = [makeDeck('beta', 'Beta'), makeDeck('alpha', 'Alpha')];
  const cards = {
    beta: studiedCards('beta', 30),
    alpha: studiedCards('alpha', 30),
  };
  const stats = [makeStats('beta', 3), makeStats('alpha', 7)];
  const reviews = [
    ...makeReviews('beta', 30, { lapses: 6, reviewedAt: NOW - 5 * DAY }),
    ...makeReviews('alpha', 30, { lapses: 6, reviewedAt: NOW - 5 * DAY }),
  ];

  const picks = buildExplorePicks(makeInput({ decks, cards, stats, reviews }));

  assert.deepEqual(
    picks.map((pick) => [pick.deckId, pick.kind, pick.reason]),
    [['alpha', 'care', '6 lapses in 30 reviews']]
  );
});

test('empty input returns an empty list', () => {
  assert.deepEqual(
    buildExplorePicks(
      makeInput({ decks: [], cards: {}, stats: [] })
    ),
    []
  );
});
