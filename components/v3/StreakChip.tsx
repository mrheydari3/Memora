import { Animated, Pressable, View } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { colors, iconSize } from '../../theme/tokens';
import { usePressFeedback } from '../../motion';

type StreakChipProps = {
  /** Current study-day streak, printed on the pill. */
  streak: number;
  /** Opens the streak calendar; Home owns routing and haptics. */
  onPress: () => void;
};

/**
 * The Home streak shortcut: a flame and day count in a 44px target.
 *
 * It lives in the app bar, except below the narrow breakpoint where the bar
 * cannot hold it and the full wordmark, so Home hands it to `TodayPane`. The
 * pill, ink and accessible name are identical in both slots.
 */
export function StreakChip({ streak, onPress }: StreakChipProps) {
  const press = usePressFeedback({ scale: 0.96 });

  return (
    <Animated.View style={press.style}>
      <Pressable
        testID="home-streak-control"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${streak}-day streak. Open streak calendar.`}
        accessibilityHint="Shows your streak calendar and weekly rest day."
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            minHeight: 30,
            justifyContent: 'center',
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.surfaceInset,
          }}
        >
          <MaterialIcons
            name="local-fire-department"
            size={iconSize.sm}
            color={streak > 0 ? colors.warning : colors.outline}
          />
          <AppText
            variant="caption"
            weight="semibold"
            tone={streak > 0 ? 'warning' : 'muted'}
          >
            {streak}d
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}
