import { useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { AppText } from '../AppText';
import { Serif } from './Serif';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

export type DueKind = 'deck' | 'folder' | 'subfolder';

type DueFigureProps = {
  /** Today's queue total for the deck or subtree. */
  value: number;
  kind: DueKind;
  /** The quiet word under a zero: "clear" for a deck, "empty" for a folder. */
  clearLabel?: string;
  /**
   * What a zero means. `success` (teal) is a caught-up scope; `muted` is a
   * scope that simply has nothing to schedule yet, like a deck with no cards.
   */
  labelTone?: 'success' | 'muted';
  /** The numeral's test id; the label gets `${testID}-label`. */
  testID?: string;
  style?: ViewStyle | ViewStyle[];
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * DueFigure — the saffron figure at a row's trailing edge.
 *
 * The numeral and its label are deliberately separate text nodes: the serif
 * figure is the scan target, the 12px word says what it counts, and tests read
 * the exact number without parsing a suffix. A zero draws an em dash in the
 * quiet ink and a teal "clear"/"empty", so a caught-up row still states
 * something true instead of showing a loud zero.
 */
export function DueFigure({
  value,
  kind,
  clearLabel = 'due',
  labelTone = 'success',
  testID,
  style,
}: DueFigureProps) {
  const { width } = useWindowDimensions();
  const wide = width >= v4.layout.wide;
  const type =
    kind === 'deck'
      ? wide
        ? v4.type.dueDeckWide
        : v4.type.dueDeck
      : kind === 'folder'
        ? v4.type.dueFolder
        : v4.type.dueSubfolder;
  const minWidth =
    kind === 'deck'
      ? wide
        ? v4.due.deckMinWidthWide
        : v4.due.deckMinWidth
      : kind === 'folder'
        ? v4.due.folderMinWidth
        : v4.due.subfolderMinWidth;

  const clear = value <= 0;
  const label = clear ? clearLabel : 'due';
  const labelGap =
    kind === 'deck'
      ? v4.due.labelGap
      : kind === 'folder'
        ? v4.due.folderLabelGap
        : v4.due.subfolderLabelGap;

  return (
    <View
      style={[
        {
          minWidth,
          alignItems: 'flex-end',
          justifyContent: 'center',
          flexShrink: 0,
        },
        style,
      ]}
    >
      <Serif
        testID={testID}
        numberOfLines={1}
        style={[type, NUMERIC, { color: clear ? colors.outline : colors.v4Saffron }]}
      >
        {clear ? '—' : value}
      </Serif>
      <AppText
        testID={testID ? `${testID}-label` : undefined}
        numberOfLines={1}
        style={[
          v4.type.dueLabel,
          {
            marginTop: labelGap,
            color: clear && labelTone === 'success' ? colors.v4Teal : colors.outline,
          },
        ]}
      >
        {label}
      </AppText>
    </View>
  );
}
