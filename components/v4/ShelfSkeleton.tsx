import { View } from 'react-native';
import { Skeleton } from '../Skeleton';
import { v4 } from '../../theme/v4';

/**
 * ShelfSkeleton — the V4 shelf before the index lands.
 *
 * The masthead, its summary, the 44px search line, a section rule and two
 * folder rows with one deck row each: the same boxes the real shelf occupies,
 * so the page does not jump when the data arrives.
 */
export function ShelfSkeleton() {
  return (
    <View testID="shelf-skeleton" accessibilityLabel="Loading library">
      <Skeleton width="58%" height={v4.skeleton.mastheadHeight} radius={10} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Skeleton width={92} height={v4.skeleton.summaryHeight} />
        <Skeleton width={62} height={v4.skeleton.summaryHeight} />
        <Skeleton width={72} height={v4.skeleton.summaryHeight} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: v4.layout.toolsGap }}>
        <Skeleton width="100%" height={v4.skeleton.fieldHeight} radius={v4.control.searchRadius} />
      </View>
      <View style={{ marginTop: v4.layout.sectionGap }}>
        <Skeleton width={110} height={v4.skeleton.sectionHeight} radius={6} />
        <View style={{ marginTop: 14 }}>
          {[0, 1].map((index) => (
            <View key={index}>
              <Skeleton width="100%" height={v4.skeleton.folderHeight} radius={6} />
              <View style={{ paddingLeft: v4.skeleton.indent }}>
                <View style={{ height: 12 }} />
                <Skeleton width="82%" height={v4.skeleton.deckHeight} radius={6} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
