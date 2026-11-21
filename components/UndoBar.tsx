import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { MaterialIcons } from './Icon';
import { useDeckStore } from '../store/useDeckStore';
import { colors, glass, heights, iconSize, radii, rims, spacing, tabBar } from '../theme/tokens';
import { v3 } from '../theme/v3';

/**
 * UndoBar — the app's one transient confirmation.
 *
 * A deletion removes the folder or deck immediately, but the store keeps what
 * it needs to put it back for a few seconds. The bar sits above the floating
 * dock (never under it) and carries the same smoked-glass material, so it reads
 * as part of the app rather than a browser toast. The message is a polite live
 * region: a screen reader hears what went away, and the Undo button follows it
 * in the tab order.
 */
export function UndoBar() {
  const pending = useDeckStore((s) => s.pendingDelete);
  const undoDelete = useDeckStore((s) => s.undoDelete);
  const insets = useSafeAreaInsets();

  if (!pending) return null;

  const bottom =
    Math.max(insets.bottom, v3.appBar.floatGap) + tabBar.height + v3.appBar.contentGap + 4;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom }]}>
      <View testID="undo-bar" style={styles.bar}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={glass.blurHeader}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.appBar }]} />
        </View>

        <MaterialIcons name="delete-outline" size={iconSize.md} color={colors.onSurfaceVariant} />
        <View
          role="status"
          accessibilityLiveRegion="polite"
          style={styles.message}
        >
          <AppText variant="bodySm" numberOfLines={2}>
            {pending.kind === 'folder' ? 'Folder' : 'Deck'} “{pending.name}” deleted
          </AppText>
        </View>
        <Pressable
          onPress={() => void undoDelete()}
          role="button"
          accessibilityLabel={`Undo delete ${pending.kind}`}
          style={styles.undo}
        >
          <AppText variant="bodySm" weight="semibold" tone="accent">
            Undo
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 60,
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    minHeight: heights.hit + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radii.control,
    overflow: 'hidden',
  },
  message: {
    flex: 1,
    minWidth: 0,
  },
  undo: {
    minWidth: heights.hit,
    minHeight: heights.hit,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
});
