import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { alpha, colors, glassFill } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

export type SurfaceTone = 'scene' | 'pane' | 'inset' | 'control';
export type SurfaceRadius = 'control' | 'card' | 'pane';
export type SurfacePadding = 'none' | 'sm' | 'md';

const PADDING: Record<SurfacePadding, number> = { none: 0, sm: 16, md: 20 };
const RADIUS: Record<SurfaceRadius, number> = {
  control: v3.radii.control,
  card: v3.radii.card,
  pane: v3.radii.pane,
};

type SurfaceProps = {
  tone?: SurfaceTone;
  radius?: SurfaceRadius;
  padding?: SurfacePadding;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  children: React.ReactNode;
};

/**
 * Surface — the one pane primitive in the v3 language.
 *
 * `scene` is the page's raised card face: the opal ink `surfaceCardFace` with
 * the single 1px lit rim that v3 allows. `pane` is the smoked glass row/card
 * fill, `inset` is content nested inside a pane, and `control` is a chip, rail
 * or icon tile. Radii are roles, not numbers: 14 for a control, 22 for a card,
 * 24 for a pane.
 *
 * Nothing else in the app writes the scene fill or its rim. A screen composes
 * one `scene` at most, then panes and insets beneath it, so depth comes from
 * the fill ladder instead of a second outline.
 */
export function Surface({
  tone = 'pane',
  radius = 'pane',
  padding = 'md',
  style,
  testID,
  children,
}: SurfaceProps) {
  const fill: ViewStyle =
    tone === 'scene'
      ? {
          backgroundColor: colors.surfaceCardFace,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.3),
        }
      : tone === 'inset'
        ? { backgroundColor: colors.surfaceInset }
        : tone === 'control'
          ? { backgroundColor: colors.surfaceControl }
          : {};

  return (
    <View
      testID={testID}
      style={[
        tone === 'pane' ? glassFill : null,
        { borderRadius: RADIUS[radius], padding: PADDING[padding] },
        fill,
        style,
      ]}
    >
      {children}
    </View>
  );
}
