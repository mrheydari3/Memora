import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../AppText';
import { Chip } from '../Chip';
import { SearchBar } from '../SearchBar';
import { Menu } from '../menu/Menu';
import type { MenuAction } from '../menu/types';
import type { LibrarySort } from '../../data/types';
import {
  LIBRARY_SORT_OPTIONS,
  librarySortLabel,
} from '../../data/librarySort';

export type LibraryFilter = 'all' | 'due';

/**
 * The narrowest the search field may get while still showing its placeholder.
 * Below this the instruments wrap beneath the field instead of squeezing it.
 */
const MIN_SEARCH_WIDTH = 160;

type LibraryToolbarProps = {
  query: string;
  onQueryChange: (text: string) => void;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  /** True while a query or a non-default filter is narrowing the shelf. */
  active: boolean;
  /** e.g. "3 decks · 1 folder", printed only while `active`. */
  resultLabel?: string;
};

/**
 * LibraryToolbar — one compact search line and the shelf's instruments.
 *
 * Search is an instrument, not a section: it stays inside the library's own
 * rhythm — a 44px field, two filter pills and the sort trigger. They share a
 * row when the canvas can hold them and wrap as one trailing group when it
 * cannot; the field keeps a readable minimum width instead of shrinking until
 * its placeholder clips. The result count appears only when something is
 * actually being filtered. Sort is a menu, not a fourth filter:
 * its value belongs to the chosen order, so the compact icon trigger carries
 * the current order in its accessible name and the menu owns the list.
 */
export function LibraryToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  active,
  resultLabel,
}: LibraryToolbarProps) {
  const sortAnchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sortOptions: MenuAction[] = LIBRARY_SORT_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    description: option.description,
    selected: option.value === sort,
    onPress: () => onSortChange(option.value),
  }));
  const shortLabel =
    LIBRARY_SORT_OPTIONS.find((option) => option.value === sort)?.shortLabel ??
    librarySortLabel(sort);

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, rowGap: 8, flexWrap: 'wrap' }}
      >
        {/* flexShrink defaults to 0, so the basis is also the field's floor. */}
        <View style={{ flexGrow: 1, flexBasis: MIN_SEARCH_WIDTH }}>
          <SearchBar
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search library"
            accessibilityLabel="Search your library"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Chip
            label="All"
            accessibilityLabel="Show all"
            active={filter === 'all'}
            onPress={() => onFilterChange('all')}
          />
          <Chip
            label="Due"
            accessibilityLabel="Due only"
            active={filter === 'due'}
            onPress={() => onFilterChange('due')}
          />
          <View ref={sortAnchorRef}>
            <Chip
              menu
              icon="sort"
              label=""
              accessibilityLabel={`Sort: ${shortLabel}`}
              active={false}
              onPress={() => setSortOpen(true)}
            />
          </View>
        </View>
      </View>

      {active ? (
        <AppText testID="library-results-count" variant="caption" tone="tertiary">
          {resultLabel ?? 'No matches'}
        </AppText>
      ) : null}

      <Menu
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        anchorRef={sortAnchorRef}
        label="Sort shelf"
        title="Sort shelf"
        subtitle="Pinned folders and decks stay first."
        actions={sortOptions}
        width={280}
      />
    </View>
  );
}
