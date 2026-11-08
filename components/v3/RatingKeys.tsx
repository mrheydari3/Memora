import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../AppText';
import { usePressFeedback } from '../../motion';
import { alpha, colors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import type { Rating } from '../../data/types';

export type RatingKey = {
  rating: Rating;
  /** The visible rating name: Again / Hard / Good / Easy. */
  label: string;
  /** The scheduler's interval preview, e.g. "1m" or "<12h". */
  interval: string;
};

const TINT: Record<Rating, string> = {
  1: colors.error,
  2: colors.warning,
  3: colors.success,
  4: colors.primary,
};

type RatingKeyButtonProps = RatingKey & {
  disabled: boolean;
  onRate: (rating: Rating) => void;
};

function RatingKeyButton({ rating, label, interval, disabled, onRate }: RatingKeyButtonProps) {
  const press = usePressFeedback({ scale: 0.95 });
  const tint = TINT[rating];
  const accessibleLabel = interval ? `${interval} ${label} ${rating}` : `${label} ${rating}`;

  return (
    <Animated.View style={[styles.cell, press.style]}>
      <Pressable
        testID={`rating-${rating}`}
        onPress={() => onRate(rating)}
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibleLabel}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.key,
          {
            backgroundColor: alpha(tint, pressed ? 0.2 : 0.1),
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={1}
          style={{ color: tint, opacity: 0.82 }}
        >
          {interval}{' '}
        </AppText>
        <AppText
          variant="body"
          weight="semibold"
          numberOfLines={1}
          style={{ color: tint, marginTop: 1 }}
        >
          {label}{' '}
        </AppText>
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={1}
          style={{ color: colors.outline, marginTop: 1, opacity: 0.8 }}
        >
          {rating}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

type RatingKeysProps = {
  keys: readonly RatingKey[];
  onRate: (rating: Rating) => void;
  disabled?: boolean;
};

/**
 * RatingKeys — the four study ratings in one row.
 *
 * The reference reads interval → name → shortcut, so the scheduler's preview
 * leads and the key number closes the tile. The accessibility name keeps the
 * full meaning: "Again — 1m, key 1". The tint is always paired with text and a
 * pressed fill, so colour is never the only signal.
 */
export function RatingKeys({ keys, onRate, disabled = false }: RatingKeysProps) {
  return (
    <View style={styles.row}>
      {keys.map((key) => (
        <RatingKeyButton
          key={key.rating}
          {...key}
          disabled={disabled}
          onRate={onRate}
        />
      ))}
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
    flexBasis: 0,
    minWidth: 44,
  },
  key: {
    minHeight: v3.heights.ratingKey,
    borderRadius: v3.radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
});
