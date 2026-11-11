import { View } from 'react-native';
import { AppText } from '../AppText';

type ShelfBandProps = {
  /** The band's name, e.g. "Folders" or "Unfiled decks". */
  label: string;
  /** How many items the band holds. */
  count: number;
  /** A quiet right-aligned hint, e.g. "Hierarchical" or "Root level". */
  hint?: string;
  /** Omitted for a band that only names a region rendered by the parent. */
  children?: React.ReactNode;
};

/**
 * ShelfBand — the shelf's section marker.
 *
 * The design draws a band as one line of small caps: the name, its count in
 * brackets, and a quiet hint at the far edge. There is no tick, no count pill
 * and no rule any more — the shelf's title is the only page-scale type, and the
 * cards themselves separate the bands with their own fill and air.
 */
export function ShelfBand({ label, count, hint, children }: ShelfBandProps) {
  return (
    <View testID="shelf-band" style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <AppText
            variant="label"
            weight="semibold"
            tone="muted"
            className="uppercase"
            numberOfLines={1}
            style={{ letterSpacing: 0.9 }}
          >
            {label}
          </AppText>
          <AppText
            variant="caption"
            tone="tertiary"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {`(${count})`}
          </AppText>
        </View>

        {hint ? (
          <AppText variant="caption" tone="tertiary" numberOfLines={1}>
            {hint}
          </AppText>
        ) : null}
      </View>

      {children ?? null}
    </View>
  );
}
