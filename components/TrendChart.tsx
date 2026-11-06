import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AppText } from './AppText';
import { alpha, colors, fills } from '../theme/tokens';

export type TrendPoint = { value: number; label: string };

type TrendChartProps = {
  points: readonly TrendPoint[];
  height?: number;
  color?: string;
  /** Draw the soft fill under the line. */
  area?: boolean;
  /** Print the first, middle and last label under the plot. */
  labels?: boolean;
  /** Replaces the plot when every value is zero. */
  emptyLabel?: string;
  accessibilityLabel?: string;
};

/**
 * TrendChart — a single line over a complete calendar series.
 *
 * It plots what is in the series and nothing else: zero days sit on the
 * baseline, and a flat line stays flat. The last point is marked because "where
 * the line ends" is the part people look for, and the chart is measured with
 * `onLayout` so the stroke never stretches with the pane.
 */
export function TrendChart({
  points,
  height = 64,
  color = colors.primary,
  area = true,
  labels = false,
  emptyLabel,
  accessibilityLabel,
}: TrendChartProps) {
  const [width, setWidth] = useState(0);
  const values = points.map((point) => point.value);
  const peak = Math.max(...values, 0);
  const isEmpty = points.length === 0 || peak === 0;
  const padding = 5;
  const plotHeight = Math.max(1, height - padding * 2);

  const max = Math.max(peak, 1);
  const xOf = (index: number) =>
    points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
  const yOf = (value: number) => padding + (1 - value / max) * plotHeight;

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index)} ${yOf(point.value)}`)
    .join(' ');
  const areaPath =
    points.length > 1
      ? `${line} L ${width} ${height} L 0 ${height} Z`
      : '';

  const summary =
    accessibilityLabel ??
    (isEmpty
      ? 'No reviews in this range.'
      : `${points.length} days, peak ${peak} reviews per day.`);

  return (
    <View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
        accessibilityRole="img"
        accessibilityLabel={summary}
      >
        {isEmpty ? (
          <View className="flex-1 justify-end">
            <View style={{ height: 1, backgroundColor: fills.track }} />
            {emptyLabel ? (
              <AppText variant="caption" tone="muted" align="center" className="mt-2">
                {emptyLabel}
              </AppText>
            ) : null}
          </View>
        ) : width > 0 ? (
          <Svg width={width} height={height}>
            <Line
              x1={0}
              y1={height - padding}
              x2={width}
              y2={height - padding}
              stroke={fills.track}
              strokeWidth={1}
            />
            {area && areaPath ? <Path d={areaPath} fill={alpha(color, 0.12)} /> : null}
            <Path
              d={line}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.length > 0 ? (
              <Circle
                cx={xOf(points.length - 1)}
                cy={yOf(points[points.length - 1].value)}
                r={3}
                fill={color}
              />
            ) : null}
          </Svg>
        ) : (
          <View style={{ height: 1, backgroundColor: fills.track, marginTop: height - 1 }} />
        )}
      </View>

      {labels && points.length > 0 ? (
        <View className="mt-2 flex-row justify-between">
          <AppText variant="caption" tone="muted">
            {points[0].label}
          </AppText>
          {points.length > 2 ? (
            <AppText variant="caption" tone="muted">
              {points[Math.floor(points.length / 2)].label}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="muted">
            {points[points.length - 1].label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
