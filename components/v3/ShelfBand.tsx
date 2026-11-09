import { View } from 'react-native';
import { AppText } from '../AppText';

type ShelfBandProps = {
  /** The band's name, e.g. "Folders" or "Unfiled decks". */
  label: string;
  /** How many items the band holds. */
  count: number;
  children: React.ReactNode;
};

/**
 * ShelfBand — the shelf's quiet section marker.
 *
 * Home now reads folder-first: a level names its folders before its loose
 * decks. The count sits at the far edge so the label stays a label, not a
 * second heading competing with the shelf's title.
 */
export function ShelfBand({ label, count, children }: ShelfBandProps) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <AppText variant="label" tone="tertiary" className="uppercase">
          {label}
        </AppText>
        <AppText variant="caption" tone="tertiary">
          {count}
        </AppText>
      </View>
      {children}
    </View>
  );
}
