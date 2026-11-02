import { create } from 'zustand';
import type { Deck, DeckFolder, Flashcard } from '../data/types';
import * as repo from '../data/repository';
import {
  createFolder,
  detachDecksFromFolder,
  removeFolder,
  renameFolder,
  type FolderError,
} from '../data/folders';
import { defaultFSRSState, sampleDecks, sampleCards } from '../data/seed';
import { resolveFsrsParams } from '../data/fsrs-params';
import { useReviewStore } from './useReviewStore';

type DeckStore = {
  // State
  decks: Deck[];
  folders: DeckFolder[];
  cardsByDeck: Record<string, Flashcard[]>;
  loaded: boolean;

  // Actions
  load: () => Promise<void>;
  addFolder: (name: string) => Promise<{ ok: true; folder: DeckFolder } | { ok: false; error: FolderError }>;
  renameFolder: (id: string, name: string) => Promise<{ ok: boolean; error?: FolderError }>;
  deleteFolder: (id: string) => Promise<void>;
  setDeckFolder: (deckId: string, folderId: string | null) => Promise<void>;
  addDeck: (deck: Deck) => Promise<void>;
  updateDeck: (id: string, partial: Partial<Deck>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  duplicateDeck: (id: string) => Promise<string | null>;
  resetDeckProgress: (deckId: string) => Promise<void>;
  addCard: (card: Flashcard) => Promise<void>;
  updateCard: (cardId: string, partial: Partial<Flashcard>) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  // Getters
  getDeck: (id: string) => Deck | undefined;
  getCards: (deckId: string) => Flashcard[];
  getDueCards: (deckId: string) => Flashcard[];
};

export const useDeckStore = create<DeckStore>((set, get) => ({
  decks: [],
  folders: [],
  cardsByDeck: {},
  loaded: false,

  load: async () => {
    try {
      let decks = await repo.loadDecks();
      const folders = await repo.loadFolders();
      const allCards = await repo.loadAllCards();

      // First run: seed the shipped deck.
      if (decks.length === 0) {
        await repo.saveDecks(sampleDecks);
        await repo.saveAllCards(sampleCards);
        set({ decks: sampleDecks, folders, cardsByDeck: sampleCards, loaded: true });
        return;
      }

      // Migration: remove the old placeholder sample decks (German A1 / CS /
      // Law) and only their cards. Everything the user created is kept — the
      // previous version replaced the whole library with the seed data here,
      // which silently deleted real decks and review progress.
      const LEGACY_IDS = ['deck-german-a1', 'deck-cs', 'deck-law'];
      const legacyIds = decks.filter((d) => LEGACY_IDS.includes(d.id)).map((d) => d.id);
      let decksChanged = false;
      let cardsChanged = false;

      if (legacyIds.length > 0) {
        decks = decks.filter((d) => !LEGACY_IDS.includes(d.id));
        for (const id of legacyIds) delete allCards[id];
        decksChanged = true;
        cardsChanged = true;
      }

      // If removing the legacy decks left the library empty, restore the seed.
      if (decks.length === 0) {
        decks = sampleDecks;
        Object.assign(allCards, sampleCards);
        decksChanged = true;
        cardsChanged = true;
      }

      // Backfill fields added after a deck was first saved (e.g. rating).
      const sampleMap = new Map(sampleDecks.map((d) => [d.id, d]));
      decks = decks.map((d) => {
        const sample = sampleMap.get(d.id);
        if (sample && d.rating === undefined && sample.rating !== undefined) {
          decksChanged = true;
          return { ...d, rating: sample.rating };
        }
        return d;
      });

      // Backfill FSRS-6 parameters on decks saved before presets existed. They
      // are optional in the model, so this only has to happen once per deck.
      decks = decks.map((d) => {
        const missingFsrsFields =
          d.requestRetention === undefined ||
          d.maximumInterval === undefined ||
          d.enableFuzz === undefined ||
          d.enableShortTerm === undefined ||
          d.fsrsLearningSteps === undefined ||
          d.fsrsRelearningSteps === undefined;
        if (!missingFsrsFields) return d;
        decksChanged = true;
        return { ...d, ...resolveFsrsParams(d) };
      });

      if (decksChanged) await repo.saveDecks(decks);
      if (cardsChanged) await repo.saveAllCards(allCards);

      set({ decks, folders, cardsByDeck: allCards, loaded: true });
    } catch (e) {
      console.error('Failed to load decks:', e);
      // Fallback to sample data
      set({ decks: sampleDecks, folders: [], cardsByDeck: sampleCards, loaded: true });
    }
  },

  addFolder: async (name) => {
    const result = createFolder(get().folders, name);
    if (!result.ok) return { ok: false, error: result.error };
    await repo.saveFolders(result.folders);
    set({ folders: result.folders });
    return { ok: true, folder: result.folder };
  },

  renameFolder: async (id, name) => {
    const result = renameFolder(get().folders, id, name);
    if (!result.ok) return { ok: false, error: result.error };
    await repo.saveFolders(result.folders);
    set({ folders: result.folders });
    return { ok: true };
  },

  deleteFolder: async (id) => {
    const folders = removeFolder(get().folders, id);
    // Decks are only unfiled, never deleted: a folder owns nothing.
    const decks = detachDecksFromFolder(get().decks, id);
    await repo.saveFolders(folders);
    if (decks !== get().decks) await repo.saveDecks(decks);
    set({ folders, decks });
  },

  setDeckFolder: async (deckId, folderId) => {
    const decks = get().decks.map((deck) =>
      deck.id === deckId ? { ...deck, folderId } : deck
    );
    await repo.saveDecks(decks);
    set({ decks });
  },

  addDeck: async (deck) => {
    const decks = [...get().decks, deck];
    await repo.saveDecks(decks);
    set({ decks });
  },

  updateDeck: async (id, partial) => {
    const decks = get().decks.map((d) => (d.id === id ? { ...d, ...partial } : d));
    await repo.saveDecks(decks);
    set({ decks });
  },

  deleteDeck: async (id) => {
    const decks = get().decks.filter((d) => d.id !== id);
    const cardsByDeck = { ...get().cardsByDeck };
    delete cardsByDeck[id];
    await repo.saveDecks(decks);
    await repo.saveAllCards(cardsByDeck);
    set({ decks, cardsByDeck });
  },

  duplicateDeck: async (id) => {
    const source = get().decks.find((d) => d.id === id);
    if (!source) return null;
    const newId = `deck-${Date.now()}`;
    const copy: Deck = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      createdAt: Date.now(),
    };
    const decks = [...get().decks, copy];
    const cardsByDeck = { ...get().cardsByDeck };
    cardsByDeck[newId] = (cardsByDeck[id] ?? []).map((c) => ({
      ...c,
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deckId: newId,
    }));
    await repo.saveDecks(decks);
    await repo.saveAllCards(cardsByDeck);
    set({ decks, cardsByDeck });
    return newId;
  },

  resetDeckProgress: async (deckId) => {
    // A full reset: keeping stability/difficulty/lapses while marking a card New
    // leaves FSRS with a memory state that no review ever produced.
    const cardsByDeck = { ...get().cardsByDeck };
    cardsByDeck[deckId] = (cardsByDeck[deckId] ?? []).map((c) => ({
      ...c,
      fsrs: defaultFSRSState(),
    }));
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
    // The history for this deck no longer describes its cards, so drop it too;
    // otherwise statistics and any future parameter optimization read reviews
    // of a schedule that no longer exists.
    await useReviewStore.getState().clearDeckLog(deckId);
  },

  addCard: async (card) => {
    const cardsByDeck = { ...get().cardsByDeck };
    const existing = cardsByDeck[card.deckId] ?? [];
    cardsByDeck[card.deckId] = [...existing, card];
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
  },

  updateCard: async (cardId, partial) => {
    const cardsByDeck = { ...get().cardsByDeck };
    for (const deckId of Object.keys(cardsByDeck)) {
      cardsByDeck[deckId] = cardsByDeck[deckId].map((c) =>
        c.id === cardId ? { ...c, ...partial } : c
      );
    }
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
  },

  deleteCard: async (cardId) => {
    const cardsByDeck = { ...get().cardsByDeck };
    for (const deckId of Object.keys(cardsByDeck)) {
      cardsByDeck[deckId] = cardsByDeck[deckId].filter((c) => c.id !== cardId);
    }
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
  },

  getDeck: (id) => get().decks.find((d) => d.id === id),
  getCards: (deckId) => get().cardsByDeck[deckId] ?? [],
  getDueCards: (deckId) => {
    const cards = get().cardsByDeck[deckId] ?? [];
    const now = Date.now();
    // New cards are always available to study, so they count as due here the
    // same way every screen counts them. Compare parsed dates, not ISO strings.
    return cards.filter(
      (c) => c.fsrs.state === 'New' || new Date(c.fsrs.due).getTime() <= now
    );
  },
}));