import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import {
  alpha,
  colors,
  fills,
  glassFill,
  heights,
  iconSize,
  rims,
  shadow,
  veil,
} from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type ButtonVariant = 'primary' | 'primaryQuiet' | 'secondary' | 'outline' | 'text';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** md = 48 for secondary controls, lg = 52 for the screen's primary action. */
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  className?: string;
  accessibilityLabel?: string;
};

/**
 * Button — the only action primitive.
 *
 * One label style across every variant (15px semibold), so a secondary button
 * never whispers in a smaller voice than the primary one. Fill, height and
 * border come from the variant matrix; at most one `primary` per screen.
 *
 * Every variant answers a touch the same way: a spring to 0.975 and a faint
 * veil, both on the native driver. The old web-only `active:` class did nothing
 * on a phone, which is where this app is actually pressed.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled = false,
  loading = false,
  destructive = false,
  className = '',
  accessibilityLabel,
}: ButtonProps) {
  const press = usePressFeedback({ scale: 0.975 });

  const height = size === 'md' ? heights.buttonSm : heights.button;
  const isPrimary = variant === 'primary';
  const isQuiet = variant === 'primaryQuiet';
  const isText = variant === 'text';
  const filled = isPrimary || isQuiet;

  const background: ViewStyle | undefined = filled
    ? { backgroundColor: disabled ? fills.control : colors.primaryContainer }
    : variant === 'secondary'
      ? glassFill
      : undefined;

  const border = isPrimary
    ? disabled
      ? 'border-hairline'
      : 'border-transparent'
    : variant === 'outline'
      ? 'border-accent-line'
      : variant === 'secondary'
        ? 'border-hairline'
        : 'border-transparent';

  const labelTone = filled
    ? disabled
      ? 'muted'
      : 'onAccent'
    : destructive
      ? 'danger'
      : isText
        ? 'accent'
        : 'default';

  const glyph = filled
    ? disabled
      ? colors.outline
      : colors.onPrimaryContainer
    : destructive
      ? colors.error
      : isText
        ? colors.primary
        : colors.onSurface;

  const depth: ViewStyle | undefined = disabled
    ? undefined
    : isQuiet
      ? styles.quiet
      : isPrimary
        ? // The primary action carries a lit rim and a neutral lift, so it reads
          // as a clean raised key on any surface instead of glowing into it.
          { borderColor: rims.faint, boxShadow: shadow.action }
        : undefined;

  return (
    <View className={className}>
      <Animated.View style={press.style}>
        <Pressable
          className={`w-full flex-row items-center justify-center rounded-md border px-5 ${border}`}
          style={[
            { height: isText ? undefined : height, minHeight: isText ? 44 : undefined },
            background,
            depth,
            isQuiet && { overflow: 'hidden' },
          ]}
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={disabled || loading}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled }}
        >
          {!disabled && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pressVeil,
                {
                  opacity: press.value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, isQuiet ? 0.1 : 0.06],
                  }),
                },
              ]}
            />
          )}
          {isQuiet && !disabled && <View style={styles.rim} />}

          {loading ? (
            <ActivityIndicator color={colors.onPrimaryContainer} />
          ) : (
            <>
              {icon && (
                <MaterialIcons
                  name={icon}
                  size={iconSize.lg}
                  color={glyph}
                  style={label ? { marginRight: 8 } : undefined}
                />
              )}
              <AppText variant="body" weight="semibold" tone={labelTone} numberOfLines={1}>
                {label}
              </AppText>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  quiet: {
    borderColor: rims.faint,
    // The rating tiles' depth, plus a whisper of the accent so the CTA still
    // reads as the primary action without a halo.
    boxShadow: `0 8px 18px ${alpha(veil, 0.3)}, 0 4px 14px ${alpha(
      colors.primaryContainer,
      0.14
    )}`,
  },
  pressVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: veil,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: rims.tile,
  },
});
