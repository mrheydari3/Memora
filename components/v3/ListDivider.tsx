import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';

export type ListDividerInset = 'none' | 'tile' | 'dot' | 'card';

const INSET: Record<ListDividerInset, ViewStyle> = {
  /** A section rule that runs the pane's full width. */
  none: {},
  /** Rows with a leading 40px tile: the rule starts at the title. */
  tile: { marginStart: 68 },
  /** Rows with a leading state dot: the rule starts after the dot column. */
  dot: { marginStart: 34 },
  /** A card-level ledger that keeps a 16px gutter on both sides. */
  card: { marginHorizontal: 16 },
};

/**
 * ListDivider — the one rule inside a grouped list.
 *
 * A grouped pane is a scan list, not a stack of cards, so its rows may share one
 * quiet 20% hairline. The inset is semantic: tile rows start at their title, dot
 * rows after the status dot, card ledgers keep their own side gutter. Nothing
 * outside this component draws a raw 1px hairline.
 */
export function ListDivider({
  inset = 'none',
  style,
}: {
  inset?: ListDividerInset;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { height: 1, backgroundColor: colors.hairlineRule },
        INSET[inset],
        style,
      ]}
    />
  );
}
