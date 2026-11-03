/**
 * Session queue builder — the single source of truth for "what do I study
 * today". Used by the study screen (to build its queue) and by the home and
 * deck screens (to show how many cards are actually waiting), so the number
 * on the button always matches the number of cards in the session.
 */

import type { Deck, Flashcard, ReviewLogEntry } from './types';

export type StudyQueue = {
  newCards: Flashcard[];
  dueCards: Flashcard[];
  /** Total cards that would be shown in a session started now. */
  total: number;
};

const STATE_OF = (entry: ReviewLogEntry) =>
  entry.fsrs?.state ?? entry.stateBefore ?? (entry.cardWasNew ? 'New' : 'Review');

/**
 * Daily caps use local midnight, while ts-fsrs measures elapsed days as UTC
 * calendar-day differences. Around midnight or a DST switch the two can
 * disagree by one day, which shifts a single card's schedule by an interval —
 * it never corrupts the stored memory state.
 */
function startOfDay(now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export function buildStudyQueue(
  deck: Deck,
  cards: Flashcard[],
  reviewLog: ReviewLogEntry[],
  now: number = Date.now()
): StudyQueue {
  const startOfToday = startOfDay(now);

  // Caps are per deck: a session in deck A must not spend deck B's budget,
  // even though both write to one shared log.
  const todaysLogs = reviewLog.filter(
    (e) => e.deckId === deck.id && e.reviewedAt >= startOfToday
  );
  // Anki-style caps:
  //  - distinct new cards seen today count against newCardsPerDay
  //  - review cards answered today count against maxCardsPerDay
  //  - learning/relearning steps are exempt: a card in the middle of its
  //    learning phase can be seen several times in one day, and those repeats
  //    must not eat the daily review budget.
  const newReviewedToday = new Set(
    todaysLogs.filter((e) => e.cardWasNew).map((e) => e.cardId)
  ).size;
  const reviewsToday = todaysLogs.filter((e) => STATE_OF(e) === 'Review').length;

  const dueAt = (card: Flashcard) => new Date(card.fsrs.due).getTime();

  const newCards = cards
    .filter((c) => c.fsrs.state === 'New')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, deck.newCardsPerDay - newReviewedToday));

  const learningCards = cards
    .filter(
      (c) => (c.fsrs.state === 'Learning' || c.fsrs.state === 'Relearning') && dueAt(c) <= now
    )
    .sort((a, b) => dueAt(a) - dueAt(b));

  const reviewCards = cards
    .filter((c) => c.fsrs.state === 'Review' && dueAt(c) <= now)
    .sort((a, b) => dueAt(a) - dueAt(b))
    .slice(0, Math.max(0, deck.maxCardsPerDay - reviewsToday));

  const dueCards = [...learningCards, ...reviewCards];

  return { newCards, dueCards, total: newCards.length + dueCards.length };
}

/** Cards that count as "waiting today" for a deck, ignoring the daily caps. */
export function dueNow(cards: Flashcard[], now: number = Date.now()): Flashcard[] {
  return cards.filter(
    (c) => c.fsrs.state === 'New' || new Date(c.fsrs.due).getTime() <= now
  );
}
