import { Animated, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize, layout } from '../theme/tokens';
import { staggerDelay, useReveal } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type AchievementBadgeProps = {
  icon: IconName;
  name: string;
  color: string;
  earned: boolean;
  /** Position in the badge row, for the staggered entrance. */
  index?: number;
};

/**
 * AchievementBadge — 56px circular badge. Earned: a colour-tinted fill with the
 * badge's own glyph. Locked: a neutral fill with a small lock. Neither is
 * outlined; the tint alone separates the two states.
 *
 * The row cascades in left to right, so a profile scrolls to a rack that fills
 * rather than a row that was always there.
 */
export function AchievementBadge({ icon, name, color, earned, index = 0 }: AchievementBadgeProps) {
  const reveal = useReveal(`badge:${index}`, {
    delay: staggerDelay(index, 45),
    distance: 6,
    scale: 0.94,
  });

  return (
    <View className="items-center" style={{ width: layout.badgeColumn }}>
      <Animated.View className="items-center" style={[reveal.style, { width: layout.badgeColumn }]}>
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: heights.avatar,
          height: heights.avatar,
          backgroundColor: earned ? alpha(color, 0.16) : fills.tile,
        }}
      >
        <MaterialIcons
          name={icon}
          size={iconSize.xl}
          color={earned ? color : colors.outline}
        />
        {!earned && (
          <View
            className="absolute bottom-0 right-0 h-5 w-5 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface }}
          >
            <MaterialIcons name="lock" size={iconSize.xs} color={colors.outline} />
          </View>
        )}
      </View>
      <AppText variant="caption" tone="muted" align="center" className="mt-1.5" numberOfLines={2}>
        {name}
      </AppText>
      </Animated.View>
    </View>
  );
}
