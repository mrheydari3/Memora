import { View } from 'react-native';
import { fills } from '../theme/tokens';

type Segment = {
  value: number;
  color: string;
};

type SegmentedProgressBarProps = {
  segments: Segment[];
  height?: number;
  /** Hairline gap between segments, so the rail reads as a meter. */
  gap?: number;
  className?: string;
};

/**
 * SegmentedProgressBar — a 6px track split into proportional colour segments
 * (mastered / learning / new). The track is a hairline-bordered glass rail so it
 * reads on every pane.
 */
export function SegmentedProgressBar({
  segments,
  height = 6,
  gap = 0,
  className = '',
}: SegmentedProgressBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <View
      className={`flex-row overflow-hidden rounded-full border border-hairline ${className}`}
      style={{ height, backgroundColor: fills.track, gap }}
    >
      {segments.map((segment, i) => {
        // Destructured on purpose: `.value` inside a JSX style object trips
        // Reanimated's babel heuristic, which cannot tell data from a shared value.
        const { value, color } = segment;
        return value > 0 ? (
          <View key={i} style={{ flex: value, minWidth: 6, backgroundColor: color }} />
        ) : null;
      })}
    </View>
  );
}
