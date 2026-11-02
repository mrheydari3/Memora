import { Animated, Pressable, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { alpha, colors, fills, heights, iconSize, radii } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type ProgressRailProps = {
  /** Studied share, 0–1. */
  value: number;
  color?: string;
  height?: number;
  className?: string;
};

/**
 * ProgressRail — the quiet meter shared by the continue hero and the deck
 * cards. The track is a recessed fill, never an outline, so it sits inside the
 * pane without adding another border.
 */
export function ProgressRail({
  value,
  color = colors.primary,
  height = 6,
  className = '',
}: ProgressRailProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const percent = Math.round(clamped * 100);
  // A deck with one studied card out of thousands still deserves a visible
  // mark; a 2px sliver says "started" without claiming a whole percent.
  const width: DimensionValue = percent === 0 && clamped > 0 ? 2 : `${percent}%`;

  return (
    <View
      className={`w-full overflow-hidden ${className}`}
      style={{ height, borderRadius: radii.pill, backgroundColor: fills.track }}
    >
      <View
        style={{
          width,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

type DeckProgressCardProps = {
  name: string;
  icon: IconName;
  color: string;
  cardCount: number;
  due: number;
  /** Studied share, 0–1. */
  progress: number;
  onPress?: () => void;
};

/**
 * DeckProgressCard — a deck in the home list: the deck's own icon tile, its
 * name, the card/due meta line and one progress rail. The whole pane is the
 * press target, with no nested buttons.
 */
export function DeckProgressCard({
  name,
  icon,
  color,
  cardCount,
  due,
  progress,
  onPress,
}: DeckProgressCardProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const percentLabel = percent === 0 && progress > 0 ? '<1%' : `${percent}%`;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';
  const dueLabel = due > 0 ? `${due} due` : 'nothing due';

  return (
    <Animated.View style={press.style}>
      <Pressable
        className="w-full"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        /*
         * Named by its content. A hand-written label read "1817 cards. 20 due."
         * while the visible line is "1817 cards · 20 due", so the accessible
         * name did not contain the visible text (axe
         * `label-content-name-mismatch`, WCAG 2.5.3). The card's own title, meta
         * line and percentage already say everything a label would.
         */
      >
        <GlassCard padding="sm">
          <View className="flex-row items-center">
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

            <View className="ml-3 flex-1">
              <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>
                {name}
              </AppText>
              <AppText
                variant="caption"
                weight="medium"
                tone="muted"
                className="mt-0.5"
                numberOfLines={1}
              >
                {cardCount} {cardLabel} · {dueLabel}
              </AppText>
            </View>

            <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
          </View>

          <View className="mt-4 flex-row items-center">
            <View className="flex-1">
              <ProgressRail value={progress} />
            </View>
            <AppText variant="caption" weight="semibold" tone="muted" className="ml-3">
              {percentLabel}
            </AppText>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
