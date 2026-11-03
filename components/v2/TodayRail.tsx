import { View } from 'react-native';
import { AppText } from '../AppText';
import { fills, radii } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

export type TodayRailSegment = {
  label: string;
  value: number;
  color: string;
};

/**
 * TodayRail — what today actually contains, as a proportion.
 *
 * v1 showed one studied share for one deck. This rail splits the day into the
 * three states the scheduler already names (due, learning, review) and keeps a
 * legend underneath, so the bar is never colour-only information. The bar
 * itself is decoration for a screen reader; the legend is the readable form.
 */
export function TodayRail({ segments }: { segments: TodayRailSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          flexDirection: 'row',
          height: v2.rail.height,
          borderRadius: radii.pill,
          backgroundColor: fills.track,
          overflow: 'hidden',
        }}
      >
        {segments.map((segment) => (
          <View
            key={segment.label}
            style={{
              flex: total > 0 ? segment.value / total : 0,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </View>

      <View className="mt-3 flex-row flex-wrap" style={{ columnGap: 16, rowGap: 6 }}>
        {segments.map((segment) => (
          <View key={segment.label} className="flex-row items-center" style={{ gap: 6 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: segment.color,
              }}
            />
            <AppText variant="caption" tone="muted">
              {segment.label}
            </AppText>
            <AppText variant="caption" weight="semibold">
              {segment.value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
