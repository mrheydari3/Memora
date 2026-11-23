import { View } from 'react-native';
import { AppText } from '../AppText';
import { Chip } from '../Chip';
import { SearchBar } from '../SearchBar';
import { Select } from '../menu/Select';
import { useResponsive } from '../../hooks/useResponsive';
import { useTextScale } from '../../hooks/useTextScale';
import type { LibrarySort } from '../../data/types';
import { LIBRARY_SORT_OPTIONS, librarySortLabel } from '../../data/librarySort';

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
 * filtered.
 *
 * Sort is the same labelled `Select` the deck ledger uses: the trigger reads
 * "Sort: Due", so the current order is visible without opening the menu. The
 * old icon-only trigger carried that value only in its accessible name.
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
  const { tablet, width } = useResponsive();
  const { largeText } = useTextScale();
  // At 320px the two chips and the pill trigger need 312px together, more
  // than the 280px content column. Stack them before they can clip.
  const stackControls = largeText || width < 360;
  const shortLabel =
    LIBRARY_SORT_OPTIONS.find((option) => option.value === sort)?.shortLabel ??
    librarySortLabel(sort);
  const sortOptions = LIBRARY_SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    accessibilityLabel: `Sort by ${option.label}`,
  }));

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
        <View
          style={{
            flexDirection: stackControls ? 'column' : 'row',
            alignItems: stackControls ? 'flex-start' : 'center',
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
          </View>
          {/* At 200% the chips and the trigger stack on separate rows; sharing
              a 320px line pushed the trigger's right edge off screen. */}
          <Select
            label="Sort"
            value={sort}
            valueLabel={shortLabel}
            options={sortOptions}
            onChange={(value) => onSortChange(value as LibrarySort)}
            icon="sort"
            sheetTitle="Sort shelf"
            sheetSubtitle="Pinned folders and decks stay first."
            width={280}
            testID="library-sort"
          />
        </View>
      </View>

      {active ? (
        <AppText testID="library-results-count" variant="caption" tone="tertiary">
          {resultLabel ?? 'No matches'}
        </AppText>
      ) : null}
    </View>
  );
}
