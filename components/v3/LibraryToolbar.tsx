import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../AppText';
import { Chip } from '../Chip';
import { SearchBar } from '../SearchBar';
import { Menu } from '../menu/Menu';
import { useResponsive } from '../../hooks/useResponsive';
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
 * rhythm — a 44px field, two filter pills and the sort trigger. On phones the
 * field owns a full row and the instruments sit beneath it, so the placeholder
 * never fights the chips for width; from the tablet breakpoint up they share
 * one row. The result count appears only when something is actually being
 * filtered. Sort is a menu, not a fourth filter: its value belongs to the
 * chosen order, so the compact icon trigger carries the current order in its
 * accessible name and the menu owns the list.
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
  const { tablet } = useResponsive();
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* A phone gives the field the whole line; a tablet lets it grow from
            its readable floor while the instruments stay on the same line. */}
        <View style={{ flexGrow: 1, flexBasis: tablet ? MIN_SEARCH_WIDTH : '100%' }}>
          <SearchBar
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search library"
            accessibilityLabel="Search your library"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
