import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../AppText';
import { PrimaryButton } from '../PrimaryButton';
import { Masthead } from './Masthead';
import { ShelfSearch } from './ShelfSearch';
import type { ShelfFilter } from './ShelfSearch';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type EmptyLibraryProps = {
  onCreateDeck: () => void;
};

/**
 * EmptyLibrary — the shelf before the first deck exists.
 *
 * It is not a bare empty pane: the V4 masthead and tools still frame the page,
 * so the library's shape is visible from the first visit. The sentinel copy
 * (`No decks yet`) stays exact, and the one action creates the first deck.
 */
export function EmptyLibrary({ onCreateDeck }: EmptyLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ShelfFilter>('all');

  return (
    <View testID="library-empty">
      <Masthead title="Your decks" due={0} deckCount={0} folderCount={0} />
      <ShelfSearch
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        active={query.trim().length > 0 || filter === 'due'}
        resultLabel="0 decks · 0 folders"
      />

      <View
        style={{
          marginTop: v4.layout.sectionGap,
          paddingTop: 26,
          paddingBottom: 8,
          borderTopWidth: 1,
          borderTopColor: colors.v4LineStrong,
          gap: 8,
        }}
      >
        <AppText
          headingLevel={2}
          weight="semibold"
          style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.2 }}
        >
          No decks yet
        </AppText>
        <AppText style={[v4.type.meta, { color: colors.onSurfaceVariant }]}>
          Create your first deck to start building a memory.
        </AppText>
        <View style={{ marginTop: 10, width: 208, maxWidth: '100%' }}>
          <PrimaryButton label="Create a deck" icon="add" onPress={onCreateDeck} />
        </View>
      </View>
    </View>
  );
}
