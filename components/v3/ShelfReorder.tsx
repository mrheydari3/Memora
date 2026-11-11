import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';
import { FolderGlyph } from './FolderGlyph';

const ICON_STRIDE = 64;
const ROW_HEIGHT = 56;
const AUTO_SCROLL_EDGE = 120;
const AUTO_SCROLL_MAX = 48;
const AUTO_SCROLL_INTERVAL = 16;

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type ShelfReorderItem = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  kind: 'deck' | 'folder';
  meta: string;
  pinned?: boolean;
};

export type ShelfReorderGroup = {
  key: string;
  label: string;
  items: ShelfReorderItem[];
  onReorder: (from: number, to: number) => void;
};

type ReorderRowProps = {
  item: ShelfReorderItem;
  index: number;
  minIndex: number;
  maxIndex: number;
  onReorder: (from: number, to: number) => void;
  scrollRef?: React.RefObject<ScrollViewInstance | null>;
  /** The owning list's programmatic scroll, used for edge auto-scroll. */
  scrollTo?: (y: number) => void;
  scrollOffsetRef?: React.RefObject<number>;
  viewportHeight: number;
};

function ReorderRow({
  item,
  index,
  minIndex,
  maxIndex,
  onReorder,
  scrollRef,
  scrollTo,
  scrollOffsetRef,
  viewportHeight,
}: ReorderRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState(index);
  const targetRef = useRef(index);
  const pointerYRef = useRef(0);
  const gestureDyRef = useRef(0);
  const scrollDeltaRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
        autoScrollTimer.current = null;
      }
    },
    []
  );

  const panResponder = useMemo(() => {
    const updateDrag = (dy: number) => {
      // Scroll and finger movement both move the row relative to the content.
      // Folding the observed scroll delta into the offset keeps the dragged row
      // under the finger while the page advances.
      const effectiveDy = dy + scrollDeltaRef.current;
      setOffset(effectiveDy);
      const next = Math.max(
        minIndex,
        Math.min(maxIndex, index + Math.round(effectiveDy / ICON_STRIDE))
      );
      if (next !== targetRef.current) {
        targetRef.current = next;
        setTarget(next);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
        autoScrollTimer.current = null;
      }
    };

    const finish = () => {
      stopAutoScroll();
      setDragging(false);
      setOffset(0);
      const to = targetRef.current;
      targetRef.current = index;
      setTarget(index);
      if (to !== index) onReorder(index, to);
    };

    const tick = () => {
      const scroller = scrollRef?.current;
      if ((!scroller && !scrollTo) || !scrollOffsetRef) return;

      const currentScroll = scrollOffsetRef.current ?? 0;
      const observedScroll = currentScroll - lastScrollYRef.current;
      if (observedScroll !== 0) {
        lastScrollYRef.current = currentScroll;
        scrollDeltaRef.current += observedScroll;
        updateDrag(gestureDyRef.current);
      }

      const pointerY = pointerYRef.current;
      const topEdge = AUTO_SCROLL_EDGE;
      const bottomEdge = viewportHeight - AUTO_SCROLL_EDGE;
      let direction = 0;
      if (pointerY < topEdge) {
        const strength = Math.min(1, (topEdge - pointerY) / AUTO_SCROLL_EDGE);
        direction = -Math.max(2, Math.round(strength * AUTO_SCROLL_MAX));
      } else if (pointerY > bottomEdge) {
        const strength = Math.min(1, (pointerY - bottomEdge) / AUTO_SCROLL_EDGE);
        direction = Math.max(2, Math.round(strength * AUTO_SCROLL_MAX));
      }

      if (direction === 0) return;
      // Stop pushing against the group boundary: a pinned row cannot cross its
      // segment, and the last row cannot travel any further down.
      if (
        (direction < 0 && targetRef.current <= minIndex) ||
        (direction > 0 && targetRef.current >= maxIndex)
      ) {
        return;
      }

      const nextScroll = Math.max(0, currentScroll + direction);
      if (nextScroll !== currentScroll) {
        if (scrollTo) scrollTo(nextScroll);
        else scroller?.scrollTo({ y: nextScroll, animated: false });
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        setDragging(true);
        setOffset(0);
        targetRef.current = index;
        setTarget(index);
        pointerYRef.current = gesture.moveY;
        gestureDyRef.current = 0;
        scrollDeltaRef.current = 0;
        lastScrollYRef.current = scrollOffsetRef?.current ?? 0;
        if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
        if ((scrollRef?.current || scrollTo) && scrollOffsetRef) {
          autoScrollTimer.current = setInterval(tick, AUTO_SCROLL_INTERVAL);
        }
      },
      onPanResponderMove: (_, gesture) => {
        pointerYRef.current = gesture.moveY;
        gestureDyRef.current = gesture.dy;
        updateDrag(gesture.dy);
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
    });
  }, [index, maxIndex, minIndex, onReorder, scrollOffsetRef, scrollRef, scrollTo, viewportHeight]);

  const tint = item.color ?? colors.primary;
  const isFolder = item.kind === 'folder';

  return (
    <View
      testID="reorder-row"
      style={{
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 10,
        position: 'relative',
        zIndex: dragging ? 2 : 0,
        borderRadius: 14,
        borderWidth: 1,
        borderColor:
          dragging && target !== index
            ? alpha(colors.primary, 0.5)
            : alpha(colors.outlineSoft, 0.18),
        backgroundColor: dragging ? colors.surfaceControl : colors.surfaceInset,
        opacity: dragging ? 0.97 : 1,
        transform: [{ translateY: offset }],
      }}
    >
      <View
        {...panResponder.panHandlers}
        testID="reorder-handle"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${item.name}`}
        accessibilityHint="Drag up or down to reorder"
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: dragging ? alpha(colors.primary, 0.12) : 'transparent',
          flexShrink: 0,
        }}
      >
        <MaterialIcons
          name="drag-indicator"
          size={iconSize.lg}
          color={dragging ? colors.primary : colors.outline}
        />
      </View>

      {isFolder ? (
        <FolderGlyph icon={item.icon} color={item.color} size={32} />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(tint, 0.13),
            flexShrink: 0,
          }}
        >
          <MaterialIcons
            name={(item.icon ?? 'style') as IconName}
            size={16}
            color={tint}
          />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <AppText
            testID="reorder-name"
            variant="bodySm"
            weight="semibold"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {item.name}
          </AppText>
          {item.pinned && (
            <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
          )}
        </View>
        <AppText variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 1 }}>
          {isFolder ? 'Folder' : 'Deck'} · {item.meta}
        </AppText>
      </View>
    </View>
  );
}

type ShelfReorderProps = {
  groups: ShelfReorderGroup[];
  /** Home's body ScrollView, used only for edge auto-scroll while dragging. */
  scrollRef?: React.RefObject<ScrollViewInstance | null>;
  /** A virtualized list's scroll command, used instead of `scrollRef`. */
  scrollTo?: (y: number) => void;
  /** The live scroll offset, tracked by the owning screen's onScroll. */
  scrollOffsetRef?: React.RefObject<number>;
};

/**
 * ShelfReorder — the edit-layout list.
 *
 * It is intentionally flatter than the shelf board: fixed-height rows make
 * vertical drag targets predictable, and the handle is the only responder so a
 * normal tap cannot navigate away while the user is arranging the level.
 * Holding a row near the viewport edge scrolls the page and carries the row's
 * offset and target with it, so a long list can be rearranged in one gesture.
 */
export function ShelfReorder({ groups, scrollRef, scrollTo, scrollOffsetRef }: ShelfReorderProps) {
  const { height } = useWindowDimensions();
  const populated = groups.filter((group) => group.items.length > 0);

  if (populated.length === 0) {
    return (
      <AppText variant="bodySm" tone="muted" style={{ paddingVertical: 8 }}>
        Nothing to reorder at this level.
      </AppText>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <MaterialIcons name="drag-indicator" size={iconSize.sm} color={colors.outline} />
        <AppText variant="caption" tone="tertiary" style={{ flex: 1 }}>
          Drag a row up or down. Pinned rows stay on top.
        </AppText>
      </View>

      {populated.map((group) => {
        const firstUnpinned = group.items.findIndex((item) => !item.pinned);
        return (
          <View key={group.key} testID={`reorder-group-${group.key}`} style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText variant="label" tone="tertiary" className="uppercase">
                {group.label}
              </AppText>
              <AppText variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                {group.items.length}
              </AppText>
            </View>

            {group.items.map((item, index) => (
              <ReorderRow
                key={item.id}
                item={item}
                index={index}
                minIndex={item.pinned ? 0 : firstUnpinned < 0 ? 0 : firstUnpinned}
                maxIndex={
                  item.pinned
                    ? firstUnpinned < 0
                      ? group.items.length - 1
                      : firstUnpinned - 1
                    : group.items.length - 1
                }
                onReorder={group.onReorder}
                scrollRef={scrollRef}
                scrollTo={scrollTo}
                scrollOffsetRef={scrollOffsetRef}
                viewportHeight={height}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
