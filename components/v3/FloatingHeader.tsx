import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, glass, heights, rims } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type FloatingHeaderProps = {
  children: React.ReactNode;
  /** The page column the bar follows; the default is the 960px reading column. */
  maxWidth?: number;
  /** The outer shell, including the top gap. */
  testID?: string;
  /** The glass bar itself. */
  barTestID?: string;
};

/**
 * FloatingHeader — the glass shell every top app bar shares.
 *
 * The bar sits 12px below the safe area and 7px inside the page column. Its 1px
 * rim and 12px content padding cancel the inset, so the header content and the
 * page body share one left edge. The shell owns the blur, the low-ink tint and
 * the rounded four-sided crop; callers only supply the row's controls.
 */
export function FloatingHeader({
  children,
  maxWidth,
  testID,
  barTestID,
}: FloatingHeaderProps) {
  const barMaxWidth = (maxWidth ?? v3.layout.contentMaxWidth) - v3.appBar.sideInset * 2;

  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={{
        paddingTop: v3.appBar.floatGap,
        paddingHorizontal: v3.appBar.sideInset,
      }}
    >
      {/* The top gap is page ink, not a second strip: content disappears into
          the canvas above the bar while the bar's own area stays transparent
          for the blur. It still catches taps, so hidden content cannot be hit
          through the gap. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: v3.appBar.floatGap,
          backgroundColor: colors.background,
        }}
      />

      <View
        testID={barTestID}
        style={{
          width: '100%',
          maxWidth: barMaxWidth,
          alignSelf: 'center',
          height: heights.pageHeader,
          borderRadius: v3.appBar.radius,
          borderCurve: 'continuous',
          borderWidth: 1,
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
            flexDirection: 'row',
            alignItems: 'center',
            gap: v3.appBar.contentGap,
            paddingHorizontal: v3.appBar.padding,
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
