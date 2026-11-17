import { Pressable, useWindowDimensions, View } from 'react-native';
import { SearchBar } from '../SearchBar';
import { AppText } from '../AppText';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

export type ShelfFilter = 'all' | 'due';

type ShelfSearchProps = {
  query: string;
  onQueryChange: (text: string) => void;
  filter: ShelfFilter;
  onFilterChange: (filter: ShelfFilter) => void;
  /** True while a query or a non-default filter is narrowing the shelf. */
  active: boolean;
  /** e.g. "3 decks · 1 folder", printed only while `active`. */
  resultLabel?: string;
};

type FilterButtonProps = {
  label: string;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
  testID: string;
};

function FilterButton({
  label,
  accessibilityLabel,
  active,
  onPress,
  testID,
}: FilterButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      style={{
        minHeight: 44,
        minWidth: 44,
        borderRadius: v4.control.filterRadius,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: v4.control.filterPad,
        backgroundColor: active ? colors.v4SaffronWash : 'transparent',
      }}
    >
      <AppText
        numberOfLines={1}
        style={[
          v4.type.control,
          {
            color: active ? colors.v4Saffron : colors.onSurfaceVariant,
            fontWeight: active ? '600' : '500',
          },
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * ShelfSearch — the shelf's instrument line.
 *
 * One 44px field and a two-choice segmented filter live on the same line while
 * the canvas has room; below that the filters wrap under the field instead of
 * shrinking the input. The result split appears only while something is being
 * filtered, so the resting library keeps its quiet.
 */
export function ShelfSearch({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  active,
  resultLabel,
}: ShelfSearchProps) {
  const { width } = useWindowDimensions();
  const wide = width >= v4.layout.wide;

  return (
    <View style={{ marginTop: wide ? v4.layout.toolsGapWide : v4.layout.toolsGap }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: v4.control.actionGap,
        }}
      >
        <View
          style={{
            flexGrow: wide ? 0 : 1,
            flexBasis: wide ? 340 : 190,
            minWidth: 0,
            width: wide ? 340 : undefined,
          }}
        >
          <SearchBar
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search decks and folders"
            accessibilityLabel="Search your library"
            fillColor={colors.v4Field}
            focusColor={colors.v4Saffron}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: v4.control.filterGap,
          }}
        >
          <FilterButton
            label="All"
            accessibilityLabel="Show all"
            active={filter === 'all'}
            onPress={() => onFilterChange('all')}
            testID="shelf-filter-all"
          />
          <FilterButton
            label="Due"
            accessibilityLabel="Due only"
            active={filter === 'due'}
            onPress={() => onFilterChange('due')}
            testID="shelf-filter-due"
          />
        </View>
      </View>

      {active ? (
        <AppText
          testID="library-results-count"
          style={[v4.type.folderMeta, { color: colors.outline, marginTop: 8 }]}
        >
          {resultLabel ?? 'No matches'}
        </AppText>
      ) : null}
    </View>
  );
}
