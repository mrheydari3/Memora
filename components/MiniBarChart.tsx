import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { AppText } from './AppText';
import { colors, motion } from '../theme/tokens';
import { EASE, USE_NATIVE_DRIVER, prefersReducedMotion } from '../motion';

type BarData = { value: number; label: string; color?: string; highlight?: boolean };

type MiniBarChartProps = {
  data: BarData[];
  height?: number;
  /** Max value for scaling. If not provided, computed from data. */
  maxValue?: number;
  showValues?: boolean;
};

/** The bar never collapses to a line: 4% keeps the baseline readable. */
const FLOOR = 0.04;

/**
 * MiniBarChart — bars on a shared baseline. Each bar sits on a faint rail so
 * empty days still read as days; today is the accent bar with a soft glow.
 *
 * On mount the bars grow up from the baseline, left to right, by scaling the bar
 * around its own centre and translating half the shrink back down — so the
 * baseline never moves and no layout is animated. Runs once, on the native
 * driver, and renders finished under reduce-motion.
 */
export function MiniBarChart({ data, height = 56, maxValue, showValues = false }: MiniBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      grow.setValue(1);
      return;
    }
    // One short pass on mount: the bars rise from the baseline and stop.
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: motion.base,
      easing: EASE.standard,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [grow]);

  return (
    <View>
      <View className="flex-row items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = Math.max(3, (d.value / max) * height);
          // Each bar fills its slice of the shared clock, so the row grows left
          // to right without one timer per bar.
          const from = Math.min(0.55, i * 0.06);
          const progress = grow.interpolate({
            inputRange: [from, Math.min(1, from + 0.45)],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          });
          const scaleY = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [FLOOR, 1],
          });
          const translateY = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [(barHeight * (1 - FLOOR)) / 2, 0],
          });

          return (
            <View key={i} className="flex-1 items-center justify-end">
              {showValues && d.value > 0 && (
                <AppText variant="caption" weight="medium" tone="muted" className="mb-1">
                  {d.value}
                </AppText>
              )}
              <Animated.View style={{ width: '100%', transform: [{ translateY }] }}>
                <Animated.View
                  className="w-full rounded-sm"
                  style={{
                    height: barHeight,
                    backgroundColor: d.highlight ? colors.primary : (d.color ?? colors.accentSoft),
                    transform: [{ scaleY }],
                    ...(d.highlight
                      ? { boxShadow: `0 0 10px ${colors.accentLine}` }
                      : {}),
                  }}
                />
              </Animated.View>
            </View>
          );
        })}
      </View>
      <View className="mt-2 flex-row">
        {data.map((d, i) => (
          <AppText
            key={i}
            variant="caption"
            weight="medium"
            tone={d.highlight ? 'accent' : 'muted'}
            align="center"
            className="flex-1"
          >
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}
