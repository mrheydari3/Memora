/**
 * Discovery service — a clean seam for swapping in a real backend later.
 *
 * For MVP this returns bundled starter decks and static sample reviews
 * from local JSON. A future real backend would implement `fetchFeaturedDecks()`
 * behind this same interface without touching any screen code.
 */

import starterDecks from '../data/starterDecks.json';
import { FSRS_DEFAULTS } from '../data/fsrs-params';

export type FeaturedDeck = {
  id: string;
  name: string;
  icon: string;
  color: string;
  cardCount: number;
  rating: number;
  description: string;
  sampleCards: { front: string; back: string; frontDir?: 'ltr' | 'rtl'; backDir?: 'ltr' | 'rtl' }[];
  reviews: { author: string; rating: number; text: string }[];
};

export async function fetchFeaturedDecks(): Promise<FeaturedDeck[]> {
  // Simulate async fetch for a future real backend
  return Promise.resolve(starterDecks as FeaturedDeck[]);
}

/**
 * Copy a bundled Discover deck into the user's local "My Decks".
 * MVP scope: no backend — just a local copy (see Section 7.3 of the spec).
 */
export async function importDeck(
  featured: FeaturedDeck
): Promise<string> {
  const { defaultFSRSState } = await import('../data/seed');
  const { useDeckStore } = await import('../store/useDeckStore');

  const deckId = `deck-${Date.now()}`;
  const deck = {
    id: deckId,
    name: featured.name,
    description: featured.description,
    icon: featured.icon,
    color: featured.color,
    parentId: null,
    algorithmPreset: 'fsrs' as const,
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
    masteredIntervalMultiplier: 2.5,
    ...FSRS_DEFAULTS,
    createdAt: Date.now(),
  };

  const cards = featured.sampleCards.map((c, i) => ({
    id: `card-${deckId}-${i}`,
    deckId,
    front: { text: c.front, direction: c.frontDir ?? ('ltr' as const) },
    back: { text: c.back, direction: c.backDir ?? ('ltr' as const) },
    createdAt: Date.now() + i,
    fsrs: defaultFSRSState(),
  }));

  await useDeckStore.getState().addDeckWithCards(deck, cards);

  // Returned so the caller can open the imported deck instead of guessing an id.
  return deckId;
}