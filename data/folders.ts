/**
 * Folders — a light grouping over decks.
 *
 * A folder is a *view*, not a container: a deck keeps its cards, its schedule and
 * its reviews, and only gains a `folderId`. Deleting a folder therefore never
 * deletes a deck — the decks simply become unfiled again.
 *
 * Everything here is pure so it can be unit-tested without AsyncStorage or React,
 * and so the store and the screens agree on what a valid folder name is.
 */

import type { Deck, DeckFolder } from './types';

/** Long enough for a language or a subject, short enough for a chip. */
export const FOLDER_NAME_MAX = 40;

export type FolderError = 'empty' | 'duplicate';

export type FolderResult =
  | { ok: true; folder: DeckFolder; folders: DeckFolder[] }
  | { ok: false; error: FolderError };

/** Collapses inner whitespace, trims, and caps the length. */
export function normalizeFolderName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX);
}

/**
 * Case-insensitive lookup, because "German" and "german" are one folder to a
 * person even though they are two strings to a computer.
 */
export function findFolderByName(
  folders: readonly DeckFolder[],
  name: string,
  ignoreId?: string
): DeckFolder | undefined {
  const key = normalizeFolderName(name).toLocaleLowerCase();
  if (!key) return undefined;
  return folders.find(
    (folder) => folder.id !== ignoreId && folder.name.toLocaleLowerCase() === key
  );
}

export function nextFolderId(now: number = Date.now()): string {
  return `folder-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFolder(
  folders: readonly DeckFolder[],
  rawName: string,
  options: { id?: string; now?: number } = {}
): FolderResult {
  const name = normalizeFolderName(rawName);
  if (!name) return { ok: false, error: 'empty' };
  if (findFolderByName(folders, name)) return { ok: false, error: 'duplicate' };

  const now = options.now ?? Date.now();
  const folder: DeckFolder = { id: options.id ?? nextFolderId(now), name, createdAt: now };
  return { ok: true, folder, folders: [...folders, folder] };
}

export function renameFolder(
  folders: readonly DeckFolder[],
  id: string,
  rawName: string
): FolderResult {
  const name = normalizeFolderName(rawName);
  if (!name) return { ok: false, error: 'empty' };
  if (findFolderByName(folders, name, id)) return { ok: false, error: 'duplicate' };
  const existing = folders.find((folder) => folder.id === id);
  if (!existing) return { ok: false, error: 'empty' };

  return {
    ok: true,
    folder: { ...existing, name },
    folders: folders.map((folder) => (folder.id === id ? { ...folder, name } : folder)),
  };
}

export function removeFolder(folders: readonly DeckFolder[], id: string): DeckFolder[] {
  return folders.filter((folder) => folder.id !== id);
}

/**
 * Clears `folderId` from every deck that pointed at a deleted folder. Returns the
 * same array reference when nothing changed, so the caller can skip a write.
 */
export function detachDecksFromFolder(decks: readonly Deck[], id: string): Deck[] {
  let changed = false;
  const next = decks.map((deck) => {
    if (deck.folderId !== id) return deck;
    changed = true;
    return { ...deck, folderId: null };
  });
  return changed ? next : (decks as Deck[]);
}

/** Visible decks in a folder; archived decks never pad the count. */
export function folderDeckCount(decks: readonly Deck[], folderId: string): number {
  return decks.reduce(
    (count, deck) => count + (deck.folderId === folderId && !deck.archivedAt ? 1 : 0),
    0
  );
}

/**
 * The home list: folders in their creation order, then an optional unfiled group
 * at the end. Empty folders are kept so a folder someone just made is visible
 * before it has anything in it.
 */
export function groupDecksByFolder(
  decks: readonly Deck[],
  folders: readonly DeckFolder[]
): { folder: DeckFolder | null; decks: Deck[] }[] {
  const visible = decks.filter((deck) => !deck.archivedAt);
  const groups = folders.map((folder) => ({
    folder: folder as DeckFolder | null,
    decks: visible.filter((deck) => deck.folderId === folder.id),
  }));

  const unfiled = visible.filter(
    (deck) => !deck.folderId || !folders.some((folder) => folder.id === deck.folderId)
  );

  return unfiled.length > 0 ? [...groups, { folder: null, decks: unfiled }] : groups;
}
