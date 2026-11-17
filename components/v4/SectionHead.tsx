import { useWindowDimensions, View } from 'react-native';
import { AppText } from '../AppText';
import { Serif } from './Serif';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type SectionHeadProps = {
  /** The section's name, e.g. "Folders" or "Unfiled decks". */
  label: string;
  /** How many items the section holds. */
  count: number;
  /** Optional right-aligned note, e.g. a result split. */
  hint?: string;
  /** Overrides the distance from the previous region. */
  style?: React.ComponentProps<typeof View>['style'];
};

/**
 * SectionHead — the printed section rule.
 *
 * A serif name, a quiet count and one warm hairline: the rule is the section's
 * only frame. It carries `shelf-band` so the existing shelf tests keep reading
 * the same event, even though the visual language moved from small caps to the
 * editorial serif.
 */
export function SectionHead({ label, count, hint, style }: SectionHeadProps) {
  const { width } = useWindowDimensions();
  const gap = width >= v4.layout.wide ? v4.layout.sectionGapWide : v4.layout.sectionGap;

  return (
    <View
      testID="shelf-band"
      style={[
        {
          marginTop: gap,
          paddingBottom: v4.control.sectionHeadPad,
          borderBottomWidth: 1,
          borderBottomColor: colors.v4LineStrong,
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: v4.control.sectionHeadGap,
        },
        style,
      ]}
    >
      <Serif headingLevel={2} numberOfLines={1} style={[v4.type.section, { flexShrink: 1 }]}>
        {label}
      </Serif>
      <AppText
        numberOfLines={1}
        style={[
          v4.type.folderMeta,
          { color: colors.outline, fontVariant: ['tabular-nums'] },
        ]}
      >
        {count}
      </AppText>
      {hint ? (
        <AppText
          numberOfLines={1}
          style={[v4.type.folderMeta, { color: colors.outline, marginLeft: 'auto' }]}
        >
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
