import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { GlassCard } from '../GlassCard';
import { colors, fills, heights, iconSize, radii } from '../../theme/tokens';
import { usePressFeedback } from '../../motion';
import { v2 } from '../../theme/v2';

type FolderRowProps = {
  name: string;
  decks: number;
  /** Cards due across the folder's decks. */
  due: number;
  onPress: () => void;
};

/**
 * FolderRow — a folder in the same shelf as the decks it holds.
 *
 * A folder used to be a filter chip under the list, so "inside a folder" was a
 * filtered view of the same page with no way to tell where you were. Here it is
 * an entry: the folder sits above its decks in `Your decks`, carries how many
 * decks and cards want attention, and opens as its own view with a way back.
 *
 * The glyph and the folder count are the difference from a deck row; the pane,
 * tile size and rhythm are shared, because both are things you open.
 */
export function FolderRow({ name, decks, due, onPress }: FolderRowProps) {
  const press = usePressFeedback({ scale: 0.99 });
  const deckLabel = decks === 1 ? 'deck' : 'decks';
  const meta = due > 0 ? `${decks} ${deckLabel} · ${due} due` : `${decks} ${deckLabel}`;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Pressable
        testID="folder-row"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityHint="Open folder"
        style={{ width: '100%' }}
      >
        <GlassCard padding="sm" style={{ width: '100%', borderRadius: v2.radii.card }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              style={{
                width: heights.tileLg,
                height: heights.tileLg,
                borderRadius: radii.micro,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: fills.tile,
                flexShrink: 0,
              }}
            >
              <MaterialIcons name="folder" size={iconSize.lg} color={colors.onSurfaceVariant} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" tone="muted" className="mt-1" numberOfLines={1}>
                {meta}
              </AppText>
            </View>

            <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
