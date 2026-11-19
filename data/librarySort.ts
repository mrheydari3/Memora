import type { LibrarySort } from './types';

/**
 * Ordering for the Home shelf.
 *
 * Pins are not a sort mode: a pinned folder or deck stays above its unpinned
 * peers under every mode, and the chosen mode orders within each group. Manual
 * keeps the stored order, which is what drag-and-drop and Move up/down write, so
 * switching back never rewrites the user's arrangement.
 */

export type ShelfSortKeys = {
  name: string;
  pinned: boolean;
  /** Cards a session started now would show; 0 when caught up. */
  due: number;
  /** Epoch ms of the latest review, or null when never studied. */
  lastStudiedAt: number | null;
};

export const LIBRARY_SORT_OPTIONS = [
  {
    value: 'manual',
    label: 'Manual',
    shortLabel: 'Manual',
    description: 'Keep the order you arranged.',
  },
  {
    value: 'due',
    label: 'Due',
    shortLabel: 'Due',
    description: 'Most cards waiting first.',
  },
  {
    value: 'name',
    label: 'Name',
    shortLabel: 'Name',
    description: 'Alphabetical, A to Z.',
  },
  {
    value: 'recent',
    label: 'Recently studied',
    shortLabel: 'Recent',
    description: 'Latest session first.',
  },
] as const satisfies ReadonlyArray<{
  value: LibrarySort;
  label: string;
  shortLabel: string;
  description: string;
}>;

export function librarySortLabel(sort: LibrarySort): string {
  return (
    LIBRARY_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Manual'
  );
}

/**
 * Sorts a shelf level. Ties keep their stored order (Array#sort is stable), so
 * two caught-up folders stay where the user put them under Due, and two decks
 * studied in the same session keep their arrangement under Recently studied.
 */
export function sortShelf<T>(
  rows: readonly T[],
  sort: LibrarySort,
  read: (row: T) => ShelfSortKeys
): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const row of rows) (read(row).pinned ? pinned : rest).push(row);

  if (sort === 'manual') return [...pinned, ...rest];

  const compare = (a: T, b: T): number => {
    const left = read(a);
    const right = read(b);
    switch (sort) {
      case 'due':
        return right.due - left.due;
      case 'name':
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      case 'recent':
        // A deck with no history is behind every studied deck, not "oldest".
        return (right.lastStudiedAt ?? -1) - (left.lastStudiedAt ?? -1);
      default:
        return 0;
    }
  };

  return [...pinned.sort(compare), ...rest.sort(compare)];
}
