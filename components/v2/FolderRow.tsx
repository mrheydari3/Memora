import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { GlassCard } from '../GlassCard';
import { IconButton } from '../IconButton';
import { alpha, colors, fills, heights, iconSize, radii } from '../../theme/tokens';
import { usePressFeedback } from '../../motion';
import { v2 } from '../../theme/v2';
import { HintPressable } from '../HintPressable';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type FolderRowProps = {
  name: string;
  /** The folder's own icon; the neutral folder glyph until one is chosen. */
  icon?: string;
  /** The folder's own colour; absent folders keep the quiet neutral tile. */
  color?: string;
  decks: number;
  /** Cards due across the folder's decks. */
  due: number;
  /** Pinned folders keep the pin glyph beside their name. */
  pinned?: boolean;
  /** Opens the folder's edit sheet (name, icon, colour, pin, move). */
  onOptions?: () => void;
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
 * The icon and the count are the difference from a deck row; the pane, tile
 * size and rhythm are shared, because both are things you open. A folder may
 * carry its own icon and colour, washed into the tile exactly like a deck's, so
 * a library of folders is scannable by colour as well as by name.
 *
 * The menu is a sibling of the row button, not a control inside it, so a screen
 * reader never meets a button nested in a button.
 */
export function FolderRow({
  name,
  icon,
  color,
  decks,
  due,
  pinned = false,
  onOptions,
  onPress,
}: FolderRowProps) {
  const press = usePressFeedback({ scale: 0.99 });
  const deckLabel = decks === 1 ? 'deck' : 'decks';
  const meta = due > 0 ? `${decks} ${deckLabel} · ${due} due` : `${decks} ${deckLabel}`;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <GlassCard padding="sm" style={{ width: '100%', borderRadius: v2.radii.card }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <HintPressable
            hint="Open folder"
            testID="folder-row"
            onPress={onPress}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            accessibilityRole="button"
            style={{ flex: 1, minWidth: 0 }}
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View
                style={{
                  width: heights.tileLg,
                  height: heights.tileLg,
                  borderRadius: radii.micro,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: color ? alpha(color, 0.18) : fills.tile,
                  flexShrink: 0,
                }}
              >
                <MaterialIcons
                  name={(icon ?? 'folder') as IconName}
                  size={iconSize.lg}
                  color={color ?? colors.onSurfaceVariant}
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <AppText
                    variant="bodyLg"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {name}
                  </AppText>
                  {pinned && (
                    <MaterialIcons name="push-pin" size={iconSize.sm} color={colors.primary} />
                  )}
                </View>
                <AppText variant="caption" tone="muted" className="mt-1" numberOfLines={1}>
                  {meta}
                </AppText>
              </View>

              <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
            </View>
          </HintPressable>

          {onOptions && (
            <IconButton
              icon="more-vert"
              size="sm"
              accessibilityLabel={`Options for folder ${name}`}
              onPress={onOptions}
            />
          )}
        </View>
      </GlassCard>
    </Animated.View>
  );
}
