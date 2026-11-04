import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../AppText';
import { usePressFeedback, useReveal } from '../../motion';
import { alpha, colors, heights, motion, radii } from '../../theme/tokens';
import type { Rating, RatingButtonLabel } from '../../data/types';

const RATING_META: Record<Rating, { name: string; tint: string }> = {
  1: { name: 'Again', tint: colors.error },
  2: { name: 'Hard', tint: colors.warning },
  3: { name: 'Good', tint: colors.success },
  4: { name: 'Easy', tint: colors.primary },
};

type RatingTileProps = {
  rating: Rating;
  label: string;
  index: number;
  narrow: boolean;
  disabled: boolean;
  onRate: (rating: Rating) => void;
};

/**
 * One rating key. The interval and rating name are the only content: a glyph
 * behind the text crossed both of them at phone width, so the tile carries a
 * tinted fill instead of a watermark.
 */
function RatingTile({ rating, label, index, narrow, disabled, onRate }: RatingTileProps) {
  const meta = RATING_META[rating];
  const reveal = useReveal(rating, { delay: index * 40, duration: motion.fast, scale: 0.96 });
  const press = usePressFeedback({ scale: 0.95 });
  const hasLabel = label.length > 0;

  return (
    <Animated.View
      style={[styles.cell, { flexBasis: narrow ? '46%' : '20%' }, reveal.style]}
    >
      <Animated.View style={[styles.cell, press.style]}>
        <Pressable
          onPress={() => onRate(rating)}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: alpha(meta.tint, pressed ? 0.16 : 0.1),
              opacity: disabled ? 0.4 : 1,
            },
          ]}
        >
          {hasLabel && (
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
  );
}

type StudyRatingsProps = {
  labels: RatingButtonLabel[];
  onRate: (rating: Rating) => void;
  disabled?: boolean;
  narrow?: boolean;
};

/**
 * StudyRatings — the v2 rating keys. Four across on a phone; two columns below
 * 360px or at 200% mobile zoom, so a key never shrinks under the 44px floor.
 * Each key dips under the finger and springs back on release.
 */
export function StudyRatings({
  labels,
  onRate,
  disabled = false,
  narrow = false,
}: StudyRatingsProps) {
  return (
    <View style={styles.row}>
      {([1, 2, 3, 4] as Rating[]).map((rating, index) => {
        const label = labels.find((entry) => entry.rating === rating)?.label ?? '';
        return (
          <RatingTile
            key={rating}
            rating={rating}
            label={label}
            index={index}
            narrow={narrow}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 44,
  },
  tile: {
    minHeight: heights.ratingTile,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 6,
  },
});
