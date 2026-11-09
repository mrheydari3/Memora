/**
 * Explore — the deck-level discovery lens for Your Decks.
 *
 * This is deliberately not a second scheduling engine. FSRS still owns every
 * due date; Explore only reads the queues the shelf already built and answers
 * "which deck should I open next, and why?". It is pure, deterministic and
 * cheap: one pass over the review log, one over the cards, then one best pick
 * per signal. The full intelligence report is intentionally not built here —
 * Home must stay a screen, not a statistics run.
 *
 * A deck can qualify for several signals, but it is assigned exactly one, in
 * priority order, so the same deck can never appear twice in the sheet.
 */

import { folderDescendantIds } from './folders';
import { MIN_DECK_SAMPLE } from './intelligence/core/constants';
import { startOfDay } from './intelligence/core/dates';
import type { Deck, DeckFolder, Flashcard, ReviewLogEntry } from './types';

export type ExploreKind = 'backlog' | 'care' | 'almost' | 'rediscover' | 'fresh';
export type ExploreRole = 'now' | 'keep-going' | 'fresh';

/** Queue totals from Home's `deckQueues`, already capped by `buildStudyQueue`. */
export type ExploreDeckStats = {
  deckId: string;
  due: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
};

export type ExploreInput = {
  decks: readonly Deck[];
  cardsByDeck: Readonly<Record<string, readonly Flashcard[]>>;
  statsByDeck: readonly ExploreDeckStats[];
  reviewLog: readonly ReviewLogEntry[];
  folders: readonly DeckFolder[];
  /** null/undefined explores the whole active library; a folder explores its subtree. */
  scopeFolderId?: string | null;
  /** Usually the deck the Today hero already offers. */
  excludeDeckIds?: readonly string[];
  now: number;
};

export type ExplorePick = {
  deckId: string;
  kind: ExploreKind;
  role: ExploreRole;
  /** One factual line; counts only, never a model estimate. */
  reason: string;
  due: number;
  /** Studied share, 0–1. */
  progress: number;
  lastStudiedAt: number | null;
  /** Internal ordering aid. Never displayed. */
  score: number;
};

const DAY_MS = 86_400_000;
const CARE_RATE = 0.2;
const QUIET_DAYS = 7;
const ALMOST_SHARE = 0.8;

const KIND_ROLE: Record<ExploreKind, ExploreRole> = {
  backlog: 'now',
  care: 'keep-going',
  almost: 'keep-going',
  rediscover: 'keep-going',
  fresh: 'fresh',
};

const KIND_ORDER: Record<ExploreKind, number> = {
  backlog: 0,
  care: 1,
  almost: 2,
  rediscover: 3,
  fresh: 4,
};

const ROLE_ORDER: Record<ExploreRole, number> = {
  now: 0,
  'keep-going': 1,
  fresh: 2,
};

const KIND_PRIORITY: readonly ExploreKind[] = [
  'backlog',
  'care',
  'almost',
  'rediscover',
  'fresh',
];

type Candidate = { deck: Deck; pick: ExplorePick };

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const num = (value: number): string => value.toLocaleString('en-US');

const cardsLabel = (value: number): string =>
  `${num(value)} ${value === 1 ? 'card' : 'cards'}`;

function compareCandidates(a: Candidate, b: Candidate): number {
  const score = b.pick.score - a.pick.score;
  if (Math.abs(score) > 1e-9) return score;

  if (a.pick.due !== b.pick.due) return b.pick.due - a.pick.due;

  // Never-studied decks sort as the oldest; this only breaks a tie.
  const lastA = a.pick.lastStudiedAt ?? 0;
  const lastB = b.pick.lastStudiedAt ?? 0;
  if (lastA !== lastB) return lastA - lastB;

  return a.deck.name.localeCompare(b.deck.name, 'en') || a.deck.id.localeCompare(b.deck.id);
}

/**
 * Rank the active decks in scope into one best pick per signal.
 *
 * Order is role (Now → Keep going → Fresh start), then signal priority. The
 * output is stable for the same input: no clock reads, no randomness.
 */
export function buildExplorePicks(input: ExploreInput): ExplorePick[] {
  const statsById = new Map(input.statsByDeck.map((stats) => [stats.deckId, stats]));
  const excluded = new Set(input.excludeDeckIds ?? []);
  const scope = input.scopeFolderId
    ? new Set([input.scopeFolderId, ...folderDescendantIds(input.folders, input.scopeFolderId)])
    : null;

  // One pass for the two facts the queue does not carry: when the deck was
  // last touched, and how it performed on reviews that had reached Review.
  const lastStudied = new Map<string, number>();
  const lapseSamples = new Map<string, number>();
  const lapses = new Map<string, number>();

  for (const entry of input.reviewLog) {
    const previous = lastStudied.get(entry.deckId);
    if (previous === undefined || entry.reviewedAt > previous) {
      lastStudied.set(entry.deckId, entry.reviewedAt);
    }

    const stateBefore = entry.fsrs?.state ?? entry.stateBefore;
    if (stateBefore !== 'Review') continue;

    lapseSamples.set(entry.deckId, (lapseSamples.get(entry.deckId) ?? 0) + 1);
    if (entry.rating === 1) {
      lapses.set(entry.deckId, (lapses.get(entry.deckId) ?? 0) + 1);
    }
  }

  const today = startOfDay(input.now);
  const candidatesByKind = new Map<ExploreKind, Candidate[]>();

  for (const deck of input.decks) {
    if (deck.archivedAt || excluded.has(deck.id)) continue;
    if (scope && (!deck.folderId || !scope.has(deck.folderId))) continue;

    const cards = input.cardsByDeck[deck.id] ?? [];
    if (cards.length === 0) continue;

    const stats = statsById.get(deck.id) ?? {
      deckId: deck.id,
      due: 0,
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
    };

    let studied = 0;
    let overdue = 0;
    for (const card of cards) {
      if (card.fsrs.last_review != null) studied += 1;
      if (card.fsrs.state === 'New') continue;

      const dueAt = new Date(card.fsrs.due).getTime();
      if (Number.isFinite(dueAt) && dueAt < today) overdue += 1;
    }

    const progress = studied / cards.length;
    const remaining = cards.length - studied;
    const lastStudiedAt = lastStudied.get(deck.id) ?? null;
    const quietDays =
      lastStudiedAt === null
        ? null
        : Math.max(0, Math.floor((input.now - lastStudiedAt) / DAY_MS));
    const sample = lapseSamples.get(deck.id) ?? 0;
    const lapseCount = lapses.get(deck.id) ?? 0;
    const lapseRate = sample > 0 ? lapseCount / sample : 0;
    const dueWork = stats.learningCount + stats.reviewCount;

    let kind: ExploreKind | null = null;
    let score = 0;
    let reason = '';

    if (overdue > 0 || (stats.due > 0 && dueWork >= 5)) {
      kind = 'backlog';
      score = clamp01(overdue / 10) * 0.6 + clamp01(stats.due / 40) * 0.4;
      reason =
        overdue > 0
          ? stats.due > 0
            ? `${num(overdue)} overdue · ${num(stats.due)} due today`
            : `${num(overdue)} overdue`
          : `${num(stats.due)} due today`;
    } else if (sample >= MIN_DECK_SAMPLE && lapseRate >= CARE_RATE) {
      kind = 'care';
      score = clamp01(lapseRate / 0.4) * 0.7 + clamp01(lapseCount / 10) * 0.3;
      reason = `${num(lapseCount)} ${lapseCount === 1 ? 'lapse' : 'lapses'} in ${num(
        sample
      )} reviews`;
    } else if (
      cards.length >= 5 &&
      progress >= ALMOST_SHARE &&
      remaining > 0 &&
      remaining <= Math.max(5, Math.ceil(cards.length * 0.1))
    ) {
      kind = 'almost';
      score = progress * 0.6 + (1 - remaining / cards.length) * 0.4;
      reason = `${Math.round(progress * 100)}% studied · ${cardsLabel(remaining)} left`;
    } else if (studied > 0 && quietDays !== null && quietDays >= QUIET_DAYS) {
      kind = 'rediscover';
      score = clamp01(quietDays / 30) * 0.6 + progress * 0.4;
      reason = `${num(quietDays)} days since last review · ${Math.round(
        progress * 100
      )}% studied`;
    } else if (studied === 0 && stats.newCount > 0 && overdue === 0) {
      kind = 'fresh';
      const ageDays = Math.max(0, (input.now - deck.createdAt) / DAY_MS);
      const recency = clamp01(1 - ageDays / 30);
      score = clamp01(stats.newCount / 20) * 0.6 + recency * 0.4;
      reason = `${num(stats.newCount)} new ${
        stats.newCount === 1 ? 'card' : 'cards'
      } · not started`;
    }

    if (!kind) continue;

    const pick: ExplorePick = {
      deckId: deck.id,
      kind,
      role: KIND_ROLE[kind],
      reason,
      due: stats.due,
      progress,
      lastStudiedAt,
      score,
    };

    const list = candidatesByKind.get(kind);
    if (list) list.push({ deck, pick });
    else candidatesByKind.set(kind, [{ deck, pick }]);
  }

  const picks = KIND_PRIORITY.flatMap((kind) => {
    const candidates = candidatesByKind.get(kind);
    if (!candidates?.length) return [];
    return [[...candidates].sort(compareCandidates)[0]];
  }).map((candidate) => candidate.pick);

  return picks.sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.score - a.score
  );
}
