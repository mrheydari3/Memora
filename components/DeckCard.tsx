import { Animated, View, Pressable } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { MaterialIcons } from './Icon';
import { GlassCard } from './GlassCard';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { Pill } from './Pill';
import { alpha, colors, heights, iconSize } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckCardProps = {
  name: string;
  icon: IconName;
  color: string;
  cardCount: number;
  rating?: number;
  saved?: boolean;
  onPress?: () => void;
  onSave?: () => void;
  description?: string;
};

/**
 * DeckCard — the catalogue pane: a glass card with a 44px tile in the deck's
 * own colour, headline title, two-line description and a footer meta row.
 *
 * The tile is a tint of the deck's own colour, never a ring around it, and the
 * whole card is one press target with the same spring as every other control.
 */
export function DeckCard({
  name,
  icon,
  color,
  cardCount,
  rating,
  saved = false,
  onPress,
  onSave,
  description,
}: DeckCardProps) {
  const press = usePressFeedback({ scale: 0.985 });

  /*
    The card used to be a <button> wrapping a <button> (the save control), which
    is invalid HTML: Chrome logged "<button> cannot be a descendant of <button>",
    the tree hydrated differently, and axe reported `nested-interactive`. The
    structure is now: a plain pane, an invisible overlay button for "open", and
    the save control as its sibling above it — one target each, no nesting.
  */
  return (
    <Animated.View style={press.style}>
      <View className="rounded-xl">
        <Pressable
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          // The overlay covers the pane, so its own subtree holds no visible
          // text: the name is explicit and matches the card's title.
          accessibilityLabel={`Open ${name}`}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
        />
        <GlassCard>
          <View className="flex-row items-start justify-between">
            <View
              className="items-center justify-center rounded-md"
              style={{
                width: heights.tileLg,
                height: heights.tileLg,
                backgroundColor: alpha(color, 0.16),
              }}
            >
              <MaterialIcons name={icon} size={iconSize.lg} color={color} />
            </View>
            <View style={{ zIndex: 2 }}>
              <IconButton
                icon={saved ? 'bookmark' : 'bookmark-add'}
                size="sm"
                active={saved}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  onSave?.();
                }}
                accessibilityLabel={saved ? 'Remove from saved' : 'Save deck'}
              />
            </View>
          </View>

          <AppText variant="headline" weight="semibold" className="mt-3">
            {name}
          </AppText>
          {description && (
            <AppText variant="bodySm" tone="muted" className="mt-1" numberOfLines={2}>
              {description}
            </AppText>
          )}

          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="style" size={iconSize.sm} color={colors.outline} />
              <AppText variant="bodySm" weight="medium" tone="muted">
                {cardCount} cards
              </AppText>
            </View>
            {saved ? (
              <Pill label="Saved" tone="accent" />
            ) : rating !== undefined ? (
              <View className="flex-row items-center gap-1">
                <MaterialIcons name="star" size={iconSize.sm} color={colors.warning} />
                <AppText variant="bodySm" weight="medium">
                  {rating.toFixed(1)}
                </AppText>
              </View>
            ) : null}
          </View>
        </GlassCard>
      </View>
    </Animated.View>
  );
}
