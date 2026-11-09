import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { alpha, colors, glass, radii } from '../../theme/tokens';

type FolderGlassProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** The folder's tint, carried by the small jacket tab. */
  tabColor?: string;
  radius?: number;
  padding?: number;
  testID?: string;
};

/**
 * FolderGlass — the translucent jacket around a folder surface.
 *
 * It is deliberately a little denser than the shelf partition: a folder is a
 * thing inside the shelf, not another page section. The slim top tab keeps the
 * folder metaphor even when the selected glyph is something else.
 */
export function FolderGlass({
  children,
  style,
  tabColor,
  radius = radii.pane,
  padding = 16,
  testID,
}: FolderGlassProps) {
  return (
    <View testID={testID} style={[styles.shell, { borderRadius: radius, padding }, style]}>
      <BlurView
        intensity={glass.blurFolder}
        tint="dark"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wash]} />
      {tabColor ? (
        <View
          pointerEvents="none"
          style={[styles.tab, { backgroundColor: alpha(tabColor, 0.55) }]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alpha(colors.outlineSoft, 0.3),
  },
  wash: {
    backgroundColor: glass.folder,
  },
  tab: {
    position: 'absolute',
    top: 0,
    left: 16,
    width: 54,
    height: 5,
    borderBottomStartRadius: radii.sm,
    borderBottomEndRadius: radii.sm,
  },
});
