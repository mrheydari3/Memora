import { Animated, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { AppText } from './AppText';
import { fills, layout, motion } from '../theme/tokens';
import { useReveal } from '../motion';

type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubtitle?: string;
};

/**
 * DonutChart — SVG donut on a hairline track. Segment ends are rounded; the
 * centre carries the total in the title scale.
 *
 * The chart settles in with a short scale/fade as its card appears, so it reads
 * as part of the page's entrance rather than a graphic that was already there.
 */
export function DonutChart({
  segments,
  size = layout.donut,
  strokeWidth = 10,
  centerLabel,
  centerSubtitle,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const reveal = useReveal('donut', { distance: 0, scale: 0.94, duration: motion.slow });

  let offset = 0;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Animated.View
        className="items-center justify-center"
        style={[{ width: size, height: size }, reveal.style]}
      >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* transform string instead of rotation/origin: the latter is emitted
            as a `transform-origin` DOM attribute on web, which React warns about */}
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fills.track}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segments.map((segment, i) => {
            // A zero-length round-capped arc still paints a dot, so skip empties.
            if (segment.value <= 0) return null;
            const length = (segment.value / total) * circumference;
            const circle = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += length;
            return circle;
          })}
        </G>
      </Svg>
      {centerLabel && (
        <View
          className="absolute items-center justify-center"
          style={{ width: size, height: size }}
        >
          <AppText variant="title">{centerLabel}</AppText>
          {centerSubtitle && (
            <AppText variant="caption" tone="muted" className="uppercase">
              {centerSubtitle}
            </AppText>
          )}
        </View>
      )}
      </Animated.View>
    </View>
  );
}
