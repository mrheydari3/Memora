import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { alpha, colors, fills, glass, radii } from '../../theme/tokens';

type FolderGlassProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  padding?: number;
  testID?: string;
  /** Light the jacket while a pointer is over it (desktop hover). */
  hovered?: boolean;
  /**
   * Square the bottom corners where the surface continues into list rows
   * beneath it (an expanded folder's decks).
   */
  squareBottom?: boolean;
};

/**
 * FolderGlass — the translucent jacket around a folder surface.
 *
 * It uses the same frosted recipe as the Today scene — the backdrop blur, the
 * card-face wash at 55% and the brighter lit rim — so a folder reads as glass
 * over the shelf rather than as a flat tile. The jacket itself carries no tint:
 * the illustrated folder inside is what names the folder's colour.
 */
export function FolderGlass({
  children,
  style,
  radius = radii.pane,
  padding = 16,
  testID,
  hovered = false,
  squareBottom = false,
}: FolderGlassProps) {
  // The body under an expanded folder is made of list rows, so the jacket must
  // not round its bottom edge above them.
  const corners = squareBottom
    ? {
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    : { borderRadius: radius };

  return (
    <View testID={testID} style={[styles.shell, { padding }, corners, style]}>
      {/* The blur and its wash carry the shell's radius themselves: a
          backdrop-filter layer is not clipped by an ancestor's rounded corners
          in Chromium, so a square layer left a second corner inside the card. */}
      <BlurView
        // A folder is a small surface, so its refraction is a touch firmer than
        // the Today scene and never as strong as the hero behind it.
        intensity={glass.blurFolder}
        tint="dark"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, corners]}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wash, corners]} />
      {hovered ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hover, corners]} />
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
    borderColor: alpha(colors.outlineSoft, 0.52),
  },
  wash: {
    backgroundColor: alpha(colors.surfaceCardFace, 0.55),
  },
  hover: {
    backgroundColor: fills.subtle,
  },
});
