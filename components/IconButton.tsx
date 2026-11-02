import { Animated, Pressable, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fills, heights, iconSize } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type IconButtonProps = {
  icon: IconName;
  /** Receives the press event so nested controls can stop it from bubbling. */
  onPress?: (event: GestureResponderEvent) => void;
  /** sm = 32, md = 38, lg = 44 — the only three control sizes in the app. */
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'accent' | 'danger';
  /** Filled accent treatment for the one active control in a group. */
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  /** Glyph size; defaults to the 18px step. */
  glyphSize?: number;
  className?: string;
};

const DIAMETER = { sm: heights.iconSm, md: heights.icon, lg: heights.iconLg } as const;

/**
 * IconButton — a hairline circle with a single glyph. The app bar, deck cards,
 * sheets, steppers and the study header all use this shape, so an icon control
 * looks the same everywhere.
 *
 * Its hit target is always at least 44px: the visual circle can be 32 or 38.
 * The press dips to 0.92 on a spring, which is what makes the small circles feel
 * responsive under a thumb.
 */
export function IconButton({
  icon,
  onPress,
  size = 'md',
  tone = 'neutral',
  active = false,
  disabled = false,
  accessibilityLabel,
  glyphSize = iconSize.md,
  className = '',
}: IconButtonProps) {
  const diameter = DIAMETER[size];
  const press = usePressFeedback({ scale: 0.92 });

  const glyph = active
    ? colors.primary
    : tone === 'danger'
      ? colors.error
      : tone === 'accent'
        ? colors.primary
        : colors.onSurfaceVariant;

  return (
    <View className={className}>
      <Animated.View style={[{ width: diameter, height: diameter }, press.style]}>
        <Pressable
          className={`items-center justify-center rounded-full border ${
            active ? 'border-accent-line' : 'border-hairline'
          } ${disabled ? 'opacity-40' : ''}`}
          style={{
            width: diameter,
            height: diameter,
            backgroundColor: active ? colors.accentActive : fills.control,
          }}
          onPress={disabled ? undefined : onPress}
          onPressIn={disabled ? undefined : press.onPressIn}
          onPressOut={disabled ? undefined : press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          hitSlop={Math.max(0, (44 - diameter) / 2)}
        >
          <MaterialIcons name={icon} size={glyphSize} color={glyph} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
