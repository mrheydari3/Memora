import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fills, heights } from '../theme/tokens';
import { springTo, usePressFeedback } from '../motion';

type ChipProps = {
  label: string;
  /**
   * Longer, self-explanatory name for assistive tech ("Folder German A2").
   * Must contain the visible label, or it contradicts the screen (WCAG 2.5.3).
   */
  accessibilityLabel?: string;
  active: boolean;
  onPress: () => void;
  /**
   * filter = a filled accent pill when selected (library categories);
   * select = a hairline pill with an accent rim when selected (deck picker).
   */
  variant?: 'filter' | 'select';
};

/**
 * Chip — the one pill-shaped choice in the app. Two appearances only: a filter
 * that fills with the accent when on, and a selector that tints with it.
 *
 * No outline on either: selection is the fill behind the label. The pill dips
 * under a finger, both on the native driver and skipped under reduce-motion.
 */
export function Chip({
  label,
  accessibilityLabel,
  active,
  onPress,
  variant = 'filter',
}: ChipProps) {
  const press = usePressFeedback({ scale: 0.94 });
  const filled = variant === 'filter' && active;
  const rimmed = variant === 'select' && active;
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    springTo(fill, filled ? 1 : 0);
  }, [filled, fill]);

  return (
    <Animated.View style={press.style}>
      <Pressable
        className="overflow-hidden rounded-full px-4"
        // A chip used to draw 36px; the pill keeps its shape but the press box
        // is 44px tall, which is what WCAG 2.5.8 and a thumb ask for.
        style={{
          backgroundColor: rimmed ? colors.accentActive : fills.tile,
          minHeight: heights.hit,
          justifyContent: 'center',
        }}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        /*
         * `aria-pressed`, not only `accessibilityState`: react-native-web does
         * not expose `selected` on a button, so a screen reader could not tell
         * which filter was on ("Bio" and "Chimi" read identically).
         */
        aria-pressed={active}
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {variant === 'filter' && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.primary,
              opacity: fill,
              transform: [
                { scale: fill.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            }}
          />
        )}
        <AppText
          variant="bodySm"
          weight={variant === 'select' ? 'medium' : 'semibold'}
          tone={filled ? 'onAccent' : active ? 'accent' : 'muted'}
          numberOfLines={1}
        >
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
