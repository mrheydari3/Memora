import { useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { alpha, colors } from '../../theme/tokens';

/** Width of the root channel the rows leave free on their left. */
const RAIL = 26;
const TRUNK_X = 8;
const STROKE = 1.5;
const ROW_GAP = 12;

type DeckRootsProps = {
  rows: { key: string; node: React.ReactNode }[];
};

/**
 * DeckRoots — the library drawn as a root system.
 *
 * One trunk drops from the section header and every deck grows off it on a
 * curved root that meets the deck's own tile; past the last deck the trunk
 * splits into two short tips that reach down toward the folder rail. The
 * branches are measured, not assumed: each row reports its own height, so a
 * two-line deck name moves its branch instead of breaking the line.
 *
 * It is decoration for assistive tech (`pointerEvents="none"`, hidden from the
 * accessibility tree): the rows themselves carry every number and name.
 */
export function DeckRoots({ rows }: DeckRootsProps) {
  const [centers, setCenters] = useState<Record<string, number>>({});
  const [height, setHeight] = useState(0);

  const onRowLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { y, height: rowHeight } = event.nativeEvent.layout;
    const center = Math.round(y + rowHeight / 2);
    setCenters((prev) => (prev[key] === center ? prev : { ...prev, [key]: center }));
  };

  const trunkInk = alpha(colors.onSurfaceVariant, 0.55);
  const branchInk = alpha(colors.primary, 0.42);

  const branchCenters = rows
    .map((row) => centers[row.key])
    .filter((center): center is number => typeof center === 'number');

  const last = branchCenters.length > 0 ? Math.max(...branchCenters) : null;
  const tip = last === null ? null : last + 18;

  const trunk = tip === null ? '' : `M${TRUNK_X},0 L${TRUNK_X},${tip}`;

  // Each deck is fed by a root that leaves the trunk, bows down a little and
  // rises into the card's own tile — a connection, not a tick on a timeline.
  const branches = branchCenters.map(
    (center) =>
      `M${TRUNK_X},${center} C ${TRUNK_X + 7},${center + 2} ${RAIL - 10},${center - 7} ${RAIL - 2},${center - 1}`
  );

  // Past the last deck the trunk forks into roots: two that reach down toward
  // the folder rail, and two finer hairs beside them, so the end tapers out
  // instead of stopping at a blunt tip.
  const tips =
    tip === null
      ? []
      : [
          { d: `M${TRUNK_X},${tip - 6} C ${TRUNK_X - 4},${tip + 2} ${TRUNK_X - 7},${tip + 9} ${TRUNK_X - 7.5},${tip + 22}`, width: STROKE, opacity: 1 },
          { d: `M${TRUNK_X},${tip - 6} C ${TRUNK_X + 4},${tip + 3} ${TRUNK_X + 7},${tip + 11} ${TRUNK_X + 9},${tip + 24}`, width: STROKE, opacity: 1 },
          { d: `M${TRUNK_X},${tip - 2} C ${TRUNK_X - 3},${tip + 4} ${TRUNK_X - 5},${tip + 8} ${TRUNK_X - 5},${tip + 16}`, width: STROKE * 0.6, opacity: 0.7 },
          { d: `M${TRUNK_X},${tip - 2} C ${TRUNK_X + 3},${tip + 4} ${TRUNK_X + 5},${tip + 9} ${TRUNK_X + 6},${tip + 17}`, width: STROKE * 0.6, opacity: 0.7 },
        ];

  return (
    <View
      style={{ position: 'relative', paddingLeft: RAIL }}
      onLayout={(event) => setHeight(Math.round(event.nativeEvent.layout.height))}
    >
      {tip !== null && (
        // The a11y and pointer props belong on a View: `react-native-svg`
        // forwards unknown props to the DOM, and React then logs a warning for
        // each one — which the dev error toast turns into an axe failure.
        <View
          style={{ position: 'absolute', left: 0, top: 0 }}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={RAIL} height={Math.max(height, tip + 28)}>
            <Path
              d={trunk}
              stroke={trunkInk}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
            {branches.map((d, index) => (
              <Path
                key={index}
                d={d}
                stroke={branchInk}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {tips.map((rootTip, index) => (
              <Path
                key={`tip-${index}`}
                d={rootTip.d}
                stroke={alpha(colors.onSurfaceVariant, 0.5 * rootTip.opacity)}
                strokeWidth={rootTip.width}
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      )}

      <View style={{ gap: ROW_GAP }}>
        {rows.map((row) => (
          <View key={row.key} onLayout={onRowLayout(row.key)}>
            {row.node}
          </View>
        ))}
      </View>
    </View>
  );
}
