import { useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize, shadow, veil } from '../theme/tokens';
import { usePressFeedback } from '../motion';
import { HapticsEngine } from '../services/haptics';

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
  const isOutline = variant === 'outline';
  const filled = isPrimary || isQuiet;

  // Interpolated outside JSX: Reanimated's babel heuristic flags any `.value` it
  // finds in an inline style, even for the core Animated API used here.
  const pressVeil = useMemo(
    () => ({
      opacity: press.value.interpolate({
        inputRange: [0, 1],
        outputRange: [0, isQuiet ? 0.1 : 0.06],
      }),
    }),
    [press.value, isQuiet]
  );

  // No outlines: a variant is a fill plus a weight of shadow, nothing more.
  const background: ViewStyle | undefined = filled
    ? { backgroundColor: disabled ? fills.control : colors.primaryContainer }
    : variant === 'secondary'
      ? { backgroundColor: fills.control }
      : isOutline
        ? { backgroundColor: disabled ? fills.control : colors.accentSoft }
        : undefined;

  // Disabled is a state, not a variant: even a text button must lose its
  // accent treatment or it still reads as an available action.
  const labelTone = disabled
    ? 'muted'
    : filled
      ? 'onAccent'
      : destructive
        ? 'danger'
        : isText || isOutline
          ? 'accent'
          : 'default';

  const glyph = disabled
    ? colors.outline
    : filled
      ? colors.onPrimaryContainer
      : destructive
        ? colors.error
        : isText || isOutline
          ? colors.primary
          : colors.onSurface;

  const depth: ViewStyle | undefined = disabled
    ? undefined
    : isQuiet
      ? styles.quiet
      : isPrimary
        ? // The primary action is separated by its lift, not by a halo or a rim.
          { boxShadow: shadow.action }
        : undefined;

  return (
    <View className={className}>
      <Animated.View style={press.style}>
        <Pressable
          className="w-full flex-row items-center justify-center rounded-md px-5"
          style={[
            // A minimum, not a fixed height: at 200% text size the label wraps
            // onto a second line and the button grows with it instead of
            // clipping the words.
            { minHeight: isText ? 44 : height, paddingVertical: 12 },
            background,
            depth,
            isQuiet && { overflow: 'hidden' },
          ]}
          onPress={
            onPress
              ? () => {
                  HapticsEngine.selection();
                  onPress();
                }
              : undefined
          }
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={disabled || loading}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: disabled || loading }}
          aria-disabled={disabled || loading}
        >
          {!disabled && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pressVeil, pressVeil]}
            />
          )}

          {loading ? (
            <ActivityIndicator color={colors.onPrimaryContainer} />
          ) : (
            <>
              {icon && (
                <MaterialIcons
                  name={icon}
                  size={iconSize.lg}
                  color={glyph}
                  style={label ? { marginEnd: 8 } : undefined}
                />
              )}
              <AppText
                variant="body"
                weight="semibold"
                tone={labelTone}
                style={{ textAlign: 'center' }}
              >
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
});
