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
import { useGameStore } from './useGameStore';

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
  /** Add a deck and all of its cards in one write (Discover import). */
  addDeckWithCards: (deck: Deck, cards: Flashcard[]) => Promise<void>;
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
      const initialized = await repo.isInitialized();

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

      // Seed only on a genuine first run. `initialized` distinguishes that
      // from a library the user emptied on purpose, and `hasCards` keeps a
      // corrupt decks array from overwriting cards that are still on disk.
      const hasCards = Object.values(allCards).some((cards) => cards.length > 0);
      if (decks.length === 0 && !initialized && !hasCards) {
        await repo.saveDecks(sampleDecks);
        await repo.saveAllCards(sampleCards);
        await repo.markInitialized();
        set({ decks: sampleDecks, folders, cardsByDeck: sampleCards, loaded: true });
        return;
      }

      if (!initialized) await repo.markInitialized();

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
      // Never install the seed in memory after a read failure: the next card
      // mutation would persist it over the real library.
      set({ decks: [], folders: [], cardsByDeck: {}, loaded: true });
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
    // A new deck starts with an (empty) card bucket, so every screen can read
    // `cardsByDeck[id]` without treating "not there yet" as "still loading".
    const cardsByDeck = { ...get().cardsByDeck };
    if (!cardsByDeck[deck.id]) cardsByDeck[deck.id] = [];
    await repo.saveDecks(decks);
    await repo.saveAllCards(cardsByDeck);
    set({ decks, cardsByDeck });
  },

  addDeckWithCards: async (deck, cards) => {
    const decks = [...get().decks, deck];
    const cardsByDeck = { ...get().cardsByDeck, [deck.id]: cards };
    await repo.saveAllCards(cardsByDeck);
    await repo.saveDecks(decks);
    set({ decks, cardsByDeck });
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
    // A deleted deck must not keep shaping statistics, the streak, the game
    // records or the legacy per-deck key. Cleanup is best-effort: the library
    // change has already landed, and a stale log is preferable to a failed
    // delete that leaves the deck on screen.
    try {
      await repo.removeDeckCardsKey(id);
      await useReviewStore.getState().clearDeckLog(id);
      await useGameStore.getState().clearDeckRecord(id);
    } catch (e) {
      console.error('Failed to clean up deleted deck:', e);
    }
  },

  duplicateDeck: async (id) => {
    const source = get().decks.find((d) => d.id === id);
    if (!source) return null;
    const now = Date.now();
    const newId = `deck-${now}`;
    const copy: Deck = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      archivedAt: null,
      createdAt: now,
    };
    const decks = [...get().decks, copy];
    const cardsByDeck = { ...get().cardsByDeck };
    // A copy is a fresh start: carrying the source's FSRS state without its
    // review log would make the duplicate look pre-studied and due on dates
    // no review of this deck ever produced.
    cardsByDeck[newId] = (cardsByDeck[id] ?? []).map((c, i) => ({
      ...c,
      id: `card-${now}-${Math.random().toString(36).slice(2, 8)}`,
      deckId: newId,
      createdAt: now + i,
      fsrs: defaultFSRSState(),
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
    let deckId: string | null = null;
    for (const key of Object.keys(cardsByDeck)) {
      if (cardsByDeck[key].some((card) => card.id === cardId)) {
        deckId = key;
        break;
      }
    }
    if (!deckId) return;
    cardsByDeck[deckId] = cardsByDeck[deckId].map((card) =>
      card.id === cardId ? { ...card, ...partial } : card
    );
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
  },

  deleteCard: async (cardId) => {
    const cardsByDeck = { ...get().cardsByDeck };
    let deckId: string | null = null;
    for (const key of Object.keys(cardsByDeck)) {
      if (cardsByDeck[key].some((card) => card.id === cardId)) {
        deckId = key;
        break;
      }
    }
    if (!deckId) return;
    cardsByDeck[deckId] = cardsByDeck[deckId].filter((card) => card.id !== cardId);
    await repo.saveAllCards(cardsByDeck);
    set({ cardsByDeck });
    // The card is gone; its review history no longer describes anything.
    try {
      await useReviewStore.getState().clearCardLog(cardId);
    } catch (e) {
      console.error('Failed to clean up deleted card history:', e);
    }
  },

  getDeck: (id) => get().decks.find((d) => d.id === id),
  getCards: (deckId) => get().cardsByDeck[deckId] ?? [],
}));