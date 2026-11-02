import { Animated, Pressable, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { MaterialIcons } from './Icon';
import { alpha, colors, fills, heights, iconSize } from '../theme/tokens';
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
 * IconButton — a filled circle with a single glyph. The app bar, deck cards,
 * sheets, steppers and the study header all use this shape, so an icon control
 * looks the same everywhere.
 *
 * No outline: the circle is a fill step against its parent, and a danger or
 * active state re-tints that fill instead of drawing a ring.
 *
 * The circle is the *visual* size (32/38/44); the press target is always at
 * least 44×44. `hitSlop` alone was not enough: react-native-web drops it, so a
 * phone got the padding while a browser got a 38px target that fails WCAG 2.5.8.
 * The target is therefore laid out, not slopped on, and the fill is drawn by an
 * inner view so the larger box stays invisible.
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
  const target = Math.max(diameter, heights.hit);
  const press = usePressFeedback({ scale: 0.92 });

  const glyph = active
    ? colors.primary
    : tone === 'danger'
      ? colors.error
      : tone === 'accent'
        ? colors.primary
        : colors.onSurfaceVariant;

  const background = active
    ? colors.accentActive
    : tone === 'danger'
      ? alpha(colors.error, 0.12)
      : tone === 'accent'
        ? colors.accentFaint
        : fills.control;

  return (
    <View className={className}>
      <Animated.View style={press.style}>
        <Pressable
          style={{ width: target, height: target, alignItems: 'center', justifyContent: 'center' }}
          onPress={disabled ? undefined : onPress}
          onPressIn={disabled ? undefined : press.onPressIn}
          onPressOut={disabled ? undefined : press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
        >
          <View
            style={{
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              backgroundColor: background,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <MaterialIcons name={icon} size={glyphSize} color={glyph} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
