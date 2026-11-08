/**
 * Folders — a light grouping over decks, and now a tree of folders.
 *
 * A folder is a *view*, not a container: a deck keeps its cards, its schedule and
 * its reviews, and only gains a `folderId`. Deleting a folder therefore never
 * deletes a deck — the decks (and any child folders) move up one level.
 *
 * Everything here is pure so it can be unit-tested without AsyncStorage or React,
 * and so the store and the screens agree on what a valid folder tree is.
 */

import type { Deck, DeckFolder } from './types';

/** Long enough for a language or a subject, short enough for a chip. */
export const FOLDER_NAME_MAX = 40;

export type FolderError = 'empty' | 'duplicate' | 'cycle';

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

/** A folder's parent; a missing field means the top level. */
export function folderParentId(folder: DeckFolder): string | null {
  return folder.parentId ?? null;
}

/** Folders directly inside `parentId`; null is the top level. */
export function childFolders(
  folders: readonly DeckFolder[],
  parentId?: string | null
): DeckFolder[] {
  const parent = parentId ?? null;
  return folders.filter((folder) => folderParentId(folder) === parent);
}

/** Every folder from the top level down to `id`, inclusive. */
export function folderPath(folders: readonly DeckFolder[], id: string): DeckFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: DeckFolder[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}

/** Ids of every folder below `id`, so a folder can never be nested into itself. */
export function folderDescendantIds(
  folders: readonly DeckFolder[],
  id: string
): Set<string> {
  const descendants = new Set<string>();
  const walk = (parentId: string) => {
    for (const folder of folders) {
      if (folderParentId(folder) === parentId && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        walk(folder.id);
      }
    }
  };
  walk(id);
  return descendants;
}

/** True when `id` may be moved under `parentId` (or to the top level). */
export function canNestFolder(
  folders: readonly DeckFolder[],
  id: string,
  parentId: string | null
): boolean {
  if (parentId === null) return true;
  if (parentId === id) return false;
  if (!folders.some((folder) => folder.id === parentId)) return false;
  return !folderDescendantIds(folders, id).has(parentId);
}

export function createFolder(
  folders: readonly DeckFolder[],
  rawName: string,
  options: {
    id?: string;
    now?: number;
    icon?: string;
    color?: string;
    parentId?: string | null;
  } = {}
): FolderResult {
  const name = normalizeFolderName(rawName);
  if (!name) return { ok: false, error: 'empty' };
  if (findFolderByName(folders, name)) return { ok: false, error: 'duplicate' };

  const now = options.now ?? Date.now();
  const folder: DeckFolder = {
    id: options.id ?? nextFolderId(now),
    name,
    createdAt: now,
    // A folder saved before appearance existed simply has neither key; the
    // shelf falls back to the neutral folder glyph.
    ...(options.icon ? { icon: options.icon } : {}),
    ...(options.color ? { color: options.color } : {}),
    ...(options.parentId ? { parentId: options.parentId } : {}),
  };
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

/** Re-parents the folders that pointed at `id`, so deleting one keeps its tree. */
export function detachChildFolders(
  folders: readonly DeckFolder[],
  id: string,
  parentId: string | null
): DeckFolder[] {
  return folders.map((folder) =>
    folderParentId(folder) === id ? { ...folder, parentId } : folder
  );
}

/**
 * Clears `folderId` (or moves it to the deleted folder's parent) for every deck
 * that pointed at a deleted folder. Returns the same array reference when
 * nothing changed, so the caller can skip a write.
 */
export function detachDecksFromFolder(
  decks: readonly Deck[],
  id: string,
  parentId: string | null = null
): Deck[] {
  let changed = false;
  const next = decks.map((deck) => {
    if (deck.folderId !== id) return deck;
    changed = true;
    return { ...deck, folderId: parentId };
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

export type FolderSubtreeCount = { decks: number; due: number; nestedFolders: number };

/**
 * Every folder's whole visible subtree: decks filed directly inside it plus
 * everything filed in its descendants, their study-queue totals, and how many
 * child folders its group can open onto. Archived decks are never counted.
 *
 * A corrupt parent cycle must not hang the shelf, so each walk stops when it
 * reaches a folder it has already visited. The map has an entry for every
 * folder, including empty leaves.
 */
export function folderSubtreeCounts(
  folders: readonly DeckFolder[],
  decks: readonly Deck[],
  dueByDeck: Readonly<Record<string, number>>
): Map<string, FolderSubtreeCount> {
  const childrenByParent = new Map<string, DeckFolder[]>();
  for (const folder of folders) {
    const parentId = folderParentId(folder);
    if (!parentId) continue;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(parentId, siblings);
  }

  const visibleDecksByFolder = new Map<string, Deck[]>();
  for (const deck of decks) {
    if (deck.archivedAt || !deck.folderId) continue;
    const list = visibleDecksByFolder.get(deck.folderId) ?? [];
    list.push(deck);
    visibleDecksByFolder.set(deck.folderId, list);
  }

  const counts = new Map<string, FolderSubtreeCount>();
  for (const folder of folders) {
    const visited = new Set<string>();
    const pending = [folder.id];
    let deckCount = 0;
    let due = 0;

    while (pending.length > 0) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);

      for (const deck of visibleDecksByFolder.get(id) ?? []) {
        deckCount += 1;
        due += dueByDeck[deck.id] ?? 0;
      }
      for (const child of childrenByParent.get(id) ?? []) {
        if (!visited.has(child.id)) pending.push(child.id);
      }
    }

    counts.set(folder.id, {
      decks: deckCount,
      due,
      nestedFolders: childrenByParent.get(folder.id)?.length ?? 0,
    });
  }

  return counts;
}

/**
 * Pinned folders and decks float above their siblings. The order inside each
 * group stays the stored order, which is what `moveSibling` rewrites.
 */
export function sortPinned<T extends { pinnedAt?: number | null }>(
  items: readonly T[]
): T[] {
  const pinned = items.filter((item) => item.pinnedAt != null);
  if (pinned.length === 0) return [...items];
  return [...pinned, ...items.filter((item) => item.pinnedAt == null)];
}

/**
 * Moves an item one step within its own siblings, in the order the shelf shows
 * them (pinned first, then stored order), and writes that order back into the
 * slots those siblings occupied. Returns the same array when the item cannot
 * move, so the store can skip a write.
 */
export function moveSibling<T extends { id: string; pinnedAt?: number | null }>(
  items: readonly T[],
  id: string,
  isSibling: (item: T) => boolean,
  delta: number
): T[] {
  const slots: number[] = [];
  items.forEach((item, index) => {
    if (isSibling(item)) slots.push(index);
  });
  if (slots.length < 2) return items as T[];

  const group = sortPinned(slots.map((index) => items[index]));
  const from = group.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= group.length) return items as T[];

  [group[from], group[to]] = [group[to], group[from]];

  const next = [...items];
  slots.forEach((slot, index) => {
    next[slot] = group[index];
  });
  return next;
}

/**
 * The library tab's flat grouping: every folder in stored order, then the
 * unfiled decks. Home uses `childFolders` for the nested view instead.
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
