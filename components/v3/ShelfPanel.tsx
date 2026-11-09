import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { alpha, colors, glass, radii } from '../../theme/tokens';

type ShelfPanelProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
};

/**
 * ShelfPanel — the full-width glass partition around Home's library shelf.
 *
 * Today is the page's one hero scene. The shelf sits one level below it: a
 * quieter blur, a very low-alpha wash and one hairline rim. The wash is painted
 * above the blur (not as the parent's background) so the partition still reads
 * as a layer floating over the canvas.
 */
export function ShelfPanel({
  children,
  style,
  testID = 'shelf-panel',
}: ShelfPanelProps) {
  return (
    <View testID={testID} style={[styles.panel, style]}>
      <BlurView
        intensity={glass.blurShelf}
        tint="dark"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wash]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.pane,
    borderWidth: 1,
    borderColor: alpha(colors.outlineSoft, 0.24),
  },
  wash: {
    backgroundColor: glass.shelf,
  },
});
