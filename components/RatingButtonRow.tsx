import { useMemo, useRef } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import type { Rating, RatingButtonLabel } from '../data/types';
import { AppText } from './AppText';
import { EASE, timingTo, usePressFeedback, useReveal } from '../motion';
import { alpha, colors, motion, radii, rims } from '../theme/tokens';

// The four ratings carry the only colour on this screen: red → green → azure.
const RATING_META: Record<
  Rating,
  { name: string; tint: string; bg: string; border: string; activeBg: string }
> = {
  1: {
    name: 'Again',
    tint: colors.error,
    bg: alpha(colors.error, 0.1),
    border: alpha(colors.error, 0.26),
    activeBg: alpha(colors.error, 0.16),
  },
  2: {
    name: 'Hard',
    tint: colors.warning,
    bg: alpha(colors.warning, 0.09),
    border: alpha(colors.warning, 0.24),
    activeBg: alpha(colors.warning, 0.15),
  },
  3: {
    name: 'Good',
    tint: colors.success,
    bg: alpha(colors.success, 0.09),
    border: alpha(colors.success, 0.24),
    activeBg: alpha(colors.success, 0.15),
  },
  4: {
    name: 'Easy',
    tint: colors.primary,
    bg: alpha(colors.primary, 0.12),
    border: alpha(colors.primary, 0.3),
    activeBg: alpha(colors.primary, 0.18),
  },
};

const TILE_HEIGHT = 68;

type RatingButtonRowProps = {
  labels: RatingButtonLabel[];
  onRate: (rating: Rating) => void;
  disabled?: boolean;
};

type RatingTileProps = {
  rating: Rating;
  label: string;
  index: number;
  disabled: boolean;
  onRate: (rating: Rating) => void;
};

/**
 * One rating tile. It eases up on mount (staggered across the row) and dips
 * under the finger, so the row feels like a set of physical keys rather than
 * four flat rectangles appearing at once.
 */
function RatingTile({ rating, label, index, disabled, onRate }: RatingTileProps) {
  const meta = RATING_META[rating];
  const reveal = useReveal(rating, { delay: index * 45, duration: motion.slow, scale: 0.94 });
  const press = usePressFeedback({ scale: 0.955 });
  const hover = useRef(new Animated.Value(0)).current;
  const hoverStyle = useMemo(
    () => ({
      transform: [
        { scale: hover.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
      ],
    }),
    [hover]
  );

  // Pointer devices get a soft lift; touch never fires these events.
  const hoverTo = (toValue: number) => {
    timingTo(hover, toValue, { duration: motion.fast, easing: EASE.press });
  };

  const hasLabel = label.length > 0;

  return (
    <Animated.View style={[styles.cell, reveal.style]}>
      <Animated.View style={[styles.cell, press.style]}>
        <Animated.View style={[styles.cell, hoverStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: pressed ? meta.activeBg : meta.bg,
            borderColor: meta.border,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
        onPress={() => onRate(rating)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onHoverIn={() => hoverTo(1)}
        onHoverOut={() => hoverTo(0)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${meta.name}${hasLabel ? ` (${label})` : ''}`}
        accessibilityState={{ disabled }}
      >
        {/* Pointer hover sheen, then the lit top rim from the card language */}
        <Animated.View
          style={[
            styles.sheen,
            {
              pointerEvents: 'none',
              opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }),
            },
          ]}
        />
        <View style={styles.rim} />

        {hasLabel && (
          // Never uppercased: these are interval units, and "1m" (one minute)
          // must not read as "1M" (one month).
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: meta.tint, letterSpacing: 0.9 }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        )}
        <AppText
          variant="bodySm"
          weight="semibold"
          style={{ color: meta.tint, marginTop: hasLabel ? 2 : 0, letterSpacing: 0.1 }}
          numberOfLines={1}
        >
          {meta.name}
        </AppText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * RatingButtonRow — four smoked-glass tiles tinted by rating. Each tile shows a
 * small interval above the rating name; the semantic tint is the only colour, so
 * the row sits inside the same frosted language as the card above it.
 */
export function RatingButtonRow({ labels, onRate, disabled = false }: RatingButtonRowProps) {
  return (
    <View style={styles.row}>
      {([1, 2, 3, 4] as Rating[]).map((rating, index) => {
        const label = labels.find((l) => l.rating === rating)?.label ?? '';
        return (
          <RatingTile
            key={rating}
            rating={rating}
            label={label}
            index={index}
            disabled={disabled}
            onRate={onRate}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
  },
  tile: {
    height: TILE_HEIGHT,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: `0 8px 18px ${alpha(colors.background, 0.3)}`,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: rims.tile,
    pointerEvents: 'none',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    backgroundColor: colors.inverseSurface,
  },
});
