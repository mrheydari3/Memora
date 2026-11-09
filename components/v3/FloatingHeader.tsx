import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, heights, rims, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type FloatingHeaderProps = {
  children: React.ReactNode;
  /** The page column the bar's content follows; the default is the 960px reading column. */
  maxWidth?: number;
  /** The glass shell. */
  testID?: string;
  /** The glass bar itself. */
  barTestID?: string;
};

/**
 * FloatingHeader — the glass shell every top app bar shares.
 *
 * The bar is welded to the top edge: full width, square top corners and a 20px
 * bottom curve, so it reads as a notch cut into the page. Only the bottom edge
 * carries the soft rim; the top meets the canvas and the sides sit on the
 * viewport edge, where a hairline would never be seen.
 *
 * Its content still lands on the page column and its 20px gutter, so the app bar
 * and the body share one left edge. The body scrolls beneath the glass, which
 * stays transparent enough to show it.
 */
export function FloatingHeader({
  children,
  maxWidth,
  testID,
  barTestID,
}: FloatingHeaderProps) {
  const column = maxWidth ?? v3.layout.contentMaxWidth;

  return (
    <View testID={testID} pointerEvents="box-none">
      <View
        testID={barTestID}
        style={{
          width: '100%',
          height: heights.pageHeader,
          borderBottomLeftRadius: v3.appBar.radius,
          borderBottomRightRadius: v3.appBar.radius,
          borderBottomWidth: 1,
          borderColor: rims.soft,
          overflow: 'hidden',
        }}
      >
        <BlurView
          intensity={glass.blurHeader}
          tint="dark"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: glass.appBar }]}
        />

        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: column,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: v3.appBar.contentGap,
            // The page gutter, so the bar and the body share one left edge at
            // every width.
            paddingHorizontal: spacing.screen,
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
