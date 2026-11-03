import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { GlassCard } from '../GlassCard';
import { alpha, colors, heights, iconSize, radii } from '../../theme/tokens';
import { usePressFeedback } from '../../motion';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckRowProps = {
  name: string;
  icon: IconName;
  /** The deck's own colour — user data, washed into its tile. */
  color: string;
  cardCount: number;
  due: number;
  /** Folder name, printed as the row's context. */
  folder?: string;
  /** Studied share, 0–1. */
  progress: number;
  onPress?: () => void;
};

/**
 * DeckRow — one deck, landscape, across the full content width.
 *
 * The shelf's narrow covers became rows so every deck is visible without a
 * sideways scroll: colour and glyph identify it, the name and studied share read
 * left to right, and the due count stays the loud number on the right. Rows
 * stack, so the rest of the library simply follows underneath.
 */
export function DeckRow({
  name,
  icon,
  color,
  cardCount,
  due,
  folder,
  progress,
  onPress,
}: DeckRowProps) {
  const press = usePressFeedback({ scale: 0.99 });
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const percentLabel = percent === 0 && clamped > 0 ? '<1%' : `${percent}%`;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Pressable
        testID="deck-row"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        // Named by its content, like the shelf card: name, count, studied share
        // and due line are already the whole label.
        accessibilityHint="Open deck"
        style={{ width: '100%' }}
      >
        <GlassCard
          padding="sm"
          style={{ width: '100%', borderRadius: v2.radii.card, minHeight: 96 }}
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              style={{
                width: heights.icon,
                height: heights.icon,
                borderRadius: radii.micro,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(color, 0.18),
              }}
            >
              <MaterialIcons name={icon} size={iconSize.lg} color={color} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodyLg" weight="semibold" numberOfLines={2}>
                {name}
              </AppText>
              <AppText variant="caption" tone="muted" className="mt-1" numberOfLines={1}>
                {cardCount} {cardLabel} · {percentLabel} studied
                {folder ? ` · ${folder}` : ''}
              </AppText>
            </View>

            <View style={{ minWidth: 52, alignItems: 'flex-end' }}>
              <AppText variant="title" tone={due > 0 ? 'default' : 'muted'} style={v2.type.stat}>
                {due}
              </AppText>
              <AppText variant="caption" weight="semibold" tone={due > 0 ? 'accent' : 'muted'}>
                {due > 0 ? 'due today' : 'caught up'}
              </AppText>
            </View>

            <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
