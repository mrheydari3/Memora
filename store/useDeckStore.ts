import { create } from 'zustand';
import type { Deck, DeckFolder, Flashcard, GameRecord, ReviewLogEntry } from '../data/types';
import * as repo from '../data/repository';
import {
  createFolder,
  detachDecksFromFolder,
  flattenLegacyFolders,
  moveSibling,
  moveSiblingTo,
  removeFolder,
  renameFolder,
  siblingDecksIn,
  type FolderError,
} from '../data/folders';
import { defaultFSRSState, sampleDecks, sampleCards } from '../data/seed';
import { resolveFsrsParams } from '../data/fsrs-params';
import { useReviewStore } from './useReviewStore';
import { useGameStore } from './useGameStore';

/** How long a deletion stays reversible before its cleanup commits. */
export const DELETE_UNDO_MS = 6000;

/** The deletion the snackbar is offering to restore. */
export type PendingDelete = {
  kind: 'folder' | 'deck';
  name: string;
  expiresAt: number;
};

/**
 * What a restore needs that the saved library no longer holds. A folder keeps
 * its place and the decks it owned; a deck also keeps its cards, which are only
 * dropped from storage on a normal delete so an undo can put them back.
 */
type DeleteSnapshot =
  | { kind: 'folder'; folder: DeckFolder; index: number; deckIds: string[] }
  | {
      kind: 'deck';
      deck: Deck;
      index: number;
      cards: Flashcard[];
      log: ReviewLogEntry[];
      game?: GameRecord;
    };

let deleteSnapshot: DeleteSnapshot | null = null;
let deleteTimer: ReturnType<typeof setTimeout> | null = null;

function clearDeleteTimer() {
  if (deleteTimer) clearTimeout(deleteTimer);
  deleteTimer = null;
}

/** Close the undo window. The delete itself already landed. */
function commitPendingDelete() {
  deleteSnapshot = null;
  clearDeleteTimer();
  useDeckStore.setState({ pendingDelete: null });
}

/** Hold a deletion open for `DELETE_UNDO_MS`; a second delete commits the first. */
function stageDelete(snapshot: DeleteSnapshot, notice: Omit<PendingDelete, 'expiresAt'>) {
  void commitPendingDelete();
  deleteSnapshot = snapshot;
  deleteTimer = setTimeout(() => {
    void commitPendingDelete();
  }, DELETE_UNDO_MS);
  useDeckStore.setState({ pendingDelete: { ...notice, expiresAt: Date.now() + DELETE_UNDO_MS } });
}

type DeckStore = {
  // State
  decks: Deck[];
  folders: DeckFolder[];
  cardsByDeck: Record<string, Flashcard[]>;
  loaded: boolean;
  /** Set when the first read fails. The app gates on this instead of showing an empty library. */
  loadError: string | null;
  /** The deletion that can still be undone, shown by the snackbar. */
  pendingDelete: PendingDelete | null;

  // Actions
  load: () => Promise<void>;
  addFolder: (
    name: string,
    options?: { icon?: string; color?: string }
  ) => Promise<{ ok: true; folder: DeckFolder } | { ok: false; error: FolderError }>;
  /** Renames or repaints a folder in one write. */
  updateFolder: (
    id: string,
    patch: { name?: string; icon?: string; color?: string }
  ) => Promise<{ ok: true } | { ok: false; error: FolderError }>;
  toggleFolderPinned: (id: string) => Promise<void>;
  /** Moves a folder one step in the flat folder order. */
  moveFolder: (id: string, delta: number) => Promise<void>;
  /** Writes a drag target in the flat folder order. */
  moveFolderTo: (id: string, toIndex: number) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<{ ok: boolean; error?: FolderError }>;
  deleteFolder: (id: string) => Promise<void>;
  /** Restore the folder or deck held by the snackbar, if the window is open. */
  undoDelete: () => Promise<void>;
  setDeckFolder: (deckId: string, folderId: string | null) => Promise<void>;
  toggleDeckPinned: (id: string) => Promise<void>;
  /** Moves a deck one step among the decks in its folder. */
  moveDeck: (id: string, delta: number) => Promise<void>;
  /** Writes a drag target for a deck among the active decks in its folder. */
  moveDeckTo: (id: string, toIndex: number) => Promise<void>;
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
  loadError: null,
  pendingDelete: null,

  load: async () => {
    set({ loadError: null });
    try {
      let decks = await repo.loadDecks();
      const loadedFolders = await repo.loadFolders();
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

      // Migration: folders used to form a tree via `parentId`. They are one
      // flat level now. Dropping the parent link preserves every deck and its
      // folderId, so no deck moves; library-wide totals are unchanged, while a
      // former parent now owns only the decks filed directly in it.
      const flattened = flattenLegacyFolders(loadedFolders);
      const folders = flattened.folders;
      if (flattened.changed) await repo.saveFolders(folders);

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
      // Never install an empty library after a read failure: the next mutation
      // would persist it over the real one. Leave `loaded` false and let the
      // root layout show a retry screen; no screen can mount a write path.
      set({ loadError: 'Your saved library could not be read.' });
    }
  },

  addFolder: async (name, options) => {
    const result = createFolder(get().folders, name, options ?? {});
    if (!result.ok) return { ok: false, error: result.error };
    await repo.saveFolders(result.folders);
    set({ folders: result.folders });
    return { ok: true, folder: result.folder };
  },

  updateFolder: async (id, patch) => {
    let folders = get().folders;
    if (!folders.some((folder) => folder.id === id)) return { ok: false, error: 'empty' };

    if (patch.name !== undefined) {
      const renamed = renameFolder(folders, id, patch.name);
      if (!renamed.ok) return { ok: false, error: renamed.error };
      folders = renamed.folders;
    }
    folders = folders.map((folder) =>
      folder.id === id
        ? {
            ...folder,
            ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
            ...(patch.color !== undefined ? { color: patch.color } : {}),
          }
        : folder
    );
    await repo.saveFolders(folders);
    set({ folders });
    return { ok: true };
  },

  toggleFolderPinned: async (id) => {
    const folders = get().folders.map((folder) =>
      folder.id === id ? { ...folder, pinnedAt: folder.pinnedAt ? null : Date.now() } : folder
    );
    await repo.saveFolders(folders);
    set({ folders });
  },

  moveFolder: async (id, delta) => {
    const folder = get().folders.find((entry) => entry.id === id);
    if (!folder) return;
    const folders = moveSibling(
      get().folders,
      id,
      () => true,
      delta
    );
    if (folders === get().folders) return;
    await repo.saveFolders(folders);
    set({ folders });
  },

  moveFolderTo: async (id, toIndex) => {
    // The shelf lists every folder in one flat order, so a drag addresses
    // that order rather than a per-level sibling group.
    const folders = moveSiblingTo(get().folders, id, () => true, toIndex);
    if (folders === get().folders) return;
    await repo.saveFolders(folders);
    set({ folders });
  },

  renameFolder: async (id, name) => {
    const result = renameFolder(get().folders, id, name);
    if (!result.ok) return { ok: false, error: result.error };
    await repo.saveFolders(result.folders);
    set({ folders: result.folders });
    return { ok: true };
  },

  deleteFolder: async (id) => {
    // Nothing is deleted with a folder: its decks become unfiled, and no other
    // folder can have pointed at it. The snapshot remembers both, so an undo
    // can put the folder back with its decks filed again.
    const folder = get().folders.find((entry) => entry.id === id);
    if (!folder) return;
    const index = get().folders.findIndex((entry) => entry.id === id);
    const deckIds = get().decks.filter((deck) => deck.folderId === id).map((deck) => deck.id);
    const folders = removeFolder(get().folders, id);
    const decks = detachDecksFromFolder(get().decks, id);
    await repo.saveFolders(folders);
    if (decks !== get().decks) await repo.saveDecks(decks);
    set({ folders, decks });
    stageDelete({ kind: 'folder', folder, index, deckIds }, { kind: 'folder', name: folder.name });
  },

  toggleDeckPinned: async (id) => {
    const decks = get().decks.map((deck) =>
      deck.id === id ? { ...deck, pinnedAt: deck.pinnedAt ? null : Date.now() } : deck
    );
    await repo.saveDecks(decks);
    set({ decks });
  },

  moveDeck: async (id, delta) => {
    const deck = get().decks.find((entry) => entry.id === id);
    if (!deck) return;
    const folderId = deck.folderId ?? null;
    // Archived decks are not on the shelf, so they are not siblings here
    // either — the same rule the drag path uses.
    const decks = moveSibling(get().decks, id, siblingDecksIn(folderId), delta);
    if (decks === get().decks) return;
    await repo.saveDecks(decks);
    set({ decks });
  },

  moveDeckTo: async (id, toIndex) => {
    const deck = get().decks.find((entry) => entry.id === id);
    if (!deck) return;
    const folderId = deck.folderId ?? null;
    const decks = moveSiblingTo(get().decks, id, siblingDecksIn(folderId), toIndex);
    if (decks === get().decks) return;
    await repo.saveDecks(decks);
    set({ decks });
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
    const deck = get().decks.find((entry) => entry.id === id);
    if (!deck) return;
    const index = get().decks.findIndex((entry) => entry.id === id);
    // The deck leaves the library and its history leaves the log at once, so
    // statistics never count a deleted deck. The snapshot is the undo's copy.
    const cards = get().cardsByDeck[id] ?? [];
    const log = useReviewStore.getState().getLogsForDeck(id);
    const game = useGameStore.getState().getRecord(id);
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
    stageDelete(
      { kind: 'deck', deck, index, cards, log, game },
      { kind: 'deck', name: deck.name }
    );
  },

  undoDelete: async () => {
    const snapshot = deleteSnapshot;
    if (!snapshot) return;
    deleteSnapshot = null;
    clearDeleteTimer();
    set({ pendingDelete: null });

    if (snapshot.kind === 'folder') {
      const folders = [...get().folders];
      if (!folders.some((folder) => folder.id === snapshot.folder.id)) {
        folders.splice(Math.min(snapshot.index, folders.length), 0, snapshot.folder);
      }
      const deckIds = new Set(snapshot.deckIds);
      // A deck moved somewhere else during the window keeps its newer home.
      const decks = get().decks.map((deck) =>
        deckIds.has(deck.id) && deck.folderId == null
          ? { ...deck, folderId: snapshot.folder.id }
          : deck
      );
      await repo.saveFolders(folders);
      await repo.saveDecks(decks);
      set({ folders, decks });
      return;
    }

    const decks = [...get().decks];
    if (!decks.some((deck) => deck.id === snapshot.deck.id)) {
      decks.splice(Math.min(snapshot.index, decks.length), 0, snapshot.deck);
    }
    const cardsByDeck = { ...get().cardsByDeck, [snapshot.deck.id]: snapshot.cards };
    await repo.saveDecks(decks);
    await repo.saveAllCards(cardsByDeck);
    set({ decks, cardsByDeck });

    // The history was removed with the deck; put it back with the deck.
    try {
      await useReviewStore.getState().restoreDeckLog(snapshot.log);
      if (snapshot.game) await useGameStore.getState().restoreDeckRecord(snapshot.game);
    } catch (e) {
      console.error('Failed to restore deleted deck history:', e);
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