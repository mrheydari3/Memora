import { useWindowDimensions, View } from 'react-native';
import { AppText } from '../AppText';
import { Serif } from './Serif';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type MastheadProps = {
  /** "Your decks" at the root, the folder's name at a nested level. */
  title: string;
  /** Today's due total across the scope. */
  due: number;
  deckCount: number;
  folderCount: number;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Masthead — the library's printed title block.
 *
 * The title is the shelf's one page-scale serif line; the summary is a single
 * baseline of facts joined by quiet slashes. Above 980px the summary sits at
 * the title's right edge, so the page opens like a title page rather than a
 * dashboard. Every fact stays its own node for tests and screen readers, but
 * the run reads as one sentence.
 */
export function Masthead({ title, due, deckCount, folderCount }: MastheadProps) {
  const { width } = useWindowDimensions();
  const wide = width >= v4.layout.mastheadGrid;
  const summaryStyle = [
    wide ? v4.type.summaryWide : v4.type.summary,
    { color: colors.onSurfaceVariant, fontVariant: ['tabular-nums'] as const },
  ];

  return (
    <View
      testID="library-masthead"
      style={{
        paddingTop: 22,
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'flex-end' : 'flex-start',
        justifyContent: 'space-between',
        columnGap: 28,
      }}
    >
      <Serif
        headingLevel={2}
        numberOfLines={2}
        style={[wide ? v4.type.mastheadWide : v4.type.masthead, { flexShrink: 1 }]}
      >
        {title}
      </Serif>

      <AppText
        testID="library-summary"
        style={[summaryStyle, { marginTop: wide ? 0 : 10, marginBottom: wide ? 6 : 0 }]}
      >
        <AppText testID="library-due-total" style={[summaryStyle, { color: colors.v4Saffron, fontWeight: '500' }]}>
          {`${due} due today`}
        </AppText>
        <AppText style={[summaryStyle, { color: colors.v4Rule }]}>
          {' / '}
        </AppText>
        <AppText style={summaryStyle}>{plural(deckCount, 'deck', 'decks')}</AppText>
        <AppText style={[summaryStyle, { color: colors.v4Rule }]}>
          {' / '}
        </AppText>
        <AppText style={summaryStyle}>{plural(folderCount, 'folder', 'folders')}</AppText>
      </AppText>
    </View>
  );
}
