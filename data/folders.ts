/**
 * Folders — one flat grouping level over decks.
 *
 * A folder is a *view*, not a container: a deck keeps its cards, its schedule and
 * its reviews, and only gains a `folderId`. Folders never hold other folders;
 * deleting one therefore never deletes a deck — its decks become unfiled.
 *
 * Everything here is pure so it can be unit-tested without AsyncStorage or React,
 * and so the store and the screens agree on what a folder is.
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
  options: {
    id?: string;
    now?: number;
    icon?: string;
    color?: string;
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

/**
 * Clears `folderId` for every deck that pointed at a deleted folder: with one
 * flat level there is no parent to move them up to, so they become unfiled.
 * Returns the same array reference when nothing changed, so the caller can skip
 * a write.
 */
export function detachDecksFromFolder(
  decks: readonly Deck[],
  id: string
): Deck[] {
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
 * A folder as saved before the flat model: it may still carry a `parentId`.
 * Only the load migration and its tests should need this shape.
 */
export type LegacyFolder = DeckFolder & { parentId?: string | null };

/**
 * Drops the legacy parent link from every folder, keeping its icon, colour,
 * pin and place in the order. Decks are untouched: they still point at the
 * same folder id, which is now a top-level folder. Returns the same array
 * reference when there was nothing to migrate, so load only writes when needed.
 */
export function flattenLegacyFolders(
  folders: readonly LegacyFolder[]
): { folders: DeckFolder[]; changed: boolean } {
  let changed = false;
  const next = folders.map((folder) => {
    if (!('parentId' in folder)) return folder as DeckFolder;
    changed = true;
    const { parentId: _parentId, ...flat } = folder;
    return flat;
  });
  return { folders: next, changed };
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
 * The decks that share one shelf position: filed in the same folder (or both
 * unfiled) and not archived.
 *
 * Move up/down and drag both take their sibling group from here, because the
 * shelf never renders an archived deck: a step that lands on one changes the
 * stored order while the visible order stays put. One predicate, one rule.
 */
export function siblingDecksIn(folderId: string | null): (deck: Deck) => boolean {
  return (deck) => (deck.folderId ?? null) === folderId && !deck.archivedAt;
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
 * Moves an item to a target slot within its displayed sibling group. Unlike
 * `moveSibling`, this can cross several neighbours in one write, and it keeps
 * pinned items in the top segment so a drag cannot silently undo the pin rule.
 */
export function moveSiblingTo<T extends { id: string; pinnedAt?: number | null }>(
  items: readonly T[],
  id: string,
  isSibling: (item: T) => boolean,
  targetIndex: number
): T[] {
  const slots: number[] = [];
  items.forEach((item, index) => {
    if (isSibling(item)) slots.push(index);
  });
  if (slots.length < 2) return items as T[];

  const group = sortPinned(slots.map((index) => items[index]));
  const from = group.findIndex((item) => item.id === id);
  if (from < 0) return items as T[];

  const firstUnpinned = group.findIndex((item) => item.pinnedAt == null);
  const pinned = group[from].pinnedAt != null;
  const min = pinned ? 0 : firstUnpinned;
  const max = pinned
    ? firstUnpinned < 0
      ? group.length - 1
      : firstUnpinned - 1
    : group.length - 1;
  const requested = Number.isFinite(targetIndex) ? Math.round(targetIndex) : from;
  const to = Math.max(min, Math.min(requested, max));
  if (to === from) return items as T[];

  const [moving] = group.splice(from, 1);
  group.splice(to, 0, moving);

  const next = [...items];
  slots.forEach((slot, index) => {
    next[slot] = group[index];
  });
  return next;
}

/**
 * The library tab's flat grouping: every folder in stored order, then the
 * unfiled decks. Folders are one flat level, so no folder is nested under
 * another here either.
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
