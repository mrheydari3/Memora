import { View } from 'react-native';
import { AppText } from '../AppText';
import { Chip } from '../Chip';
import { SearchBar } from '../SearchBar';

export type LibraryFilter = 'all' | 'due';

type LibraryToolbarProps = {
  query: string;
  onQueryChange: (text: string) => void;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  /** True while a query or a non-default filter is narrowing the shelf. */
  active: boolean;
  /** e.g. "3 decks · 1 folder", printed only while `active`. */
  resultLabel?: string;
};

/**
 * LibraryToolbar — one compact search line under the masthead.
 *
 * Search is an instrument, not a section: it stays inside the library's own
 * rhythm — a 44px field and two filter pills on one line, wrapping only when
 * the canvas cannot hold them. The result count appears only when something is
 * actually being filtered, so the resting library keeps its quiet.
 */
export function LibraryToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  active,
  resultLabel,
}: LibraryToolbarProps) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 190, minWidth: 0 }}>
          <SearchBar
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search decks and folders"
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
