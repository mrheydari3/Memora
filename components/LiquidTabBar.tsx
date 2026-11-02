import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { AppText } from './AppText';
import { colors, glass, iconSize, motion, rimColor, shadow, tabBar } from '../theme/tokens';
import { prefersReducedMotion, springLiquidTo } from '../motion';
import { useRtl } from '../services/direction';

type TabBarState = {
  index: number;
  routes: Array<{ key: string; name: string }>;
};

type TabBarOptions = {
  title?: string;
  tabBarAccessibilityLabel?: string;
  tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
};

type LiquidTabBarProps = {
  state: TabBarState;
  descriptors: Record<string, { options: TabBarOptions } | undefined>;
  navigateToTab: (routeKey: string) => void;
  insets: { bottom: number };
};

/** A tab's measured box inside the bar's row. */
type Slot = { x: number; width: number };

/** How far the lens sits inside its tab's box, so neighbours keep a gap. */
const LENS_INSET = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * One tab: a single glyph over its caption, with the selected one settling in
 * at 1.05.
 *
 * The whole pressable is the target and it is as wide as its own label needs
 * (never narrower than a full cell), so a long label — or a reader at 200% text
 * size — widens the tab instead of spilling under its neighbour. The icon is
 * hidden from assistive tech and the accessible label supplies the name.
 */
function TabItem({
  focused,
  label,
  title,
  icon,
  buttonRef,
  onPress,
  onMeasure,
}: {
  focused: boolean;
  /** Accessible name, read by assistive tech. */
  label: string;
  /** Visible caption under the glyph. */
  title: string;
  icon: React.ReactNode;
  buttonRef: (node: unknown) => void;
  onPress: () => void;
  onMeasure: (slot: Slot) => void;
}) {
  // React Native Web honours tabIndex; native ignores it. The cast keeps the
  // DOM-only prop out of the native prop contract.
  const webFocusProps: object = Platform.OS === 'web' ? { tabIndex: 0 } : {};

  return (
    <Pressable
      {...webFocusProps}
      ref={buttonRef}
      onPress={onPress}
      onLayout={(event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        onMeasure({ x, width });
      }}
      style={styles.tab}
      role="tab"
      aria-selected={focused}
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      focusable
    >
      {/*
        A glyph over its caption, both in the same column. Nothing paints behind
        the selected tab beyond the travelling lens.
      */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          minWidth: tabBar.cell,
          height: tabBar.pill,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
        }}
      >
        {icon}
        <AppText
          variant="caption"
          weight={focused ? 'semibold' : 'medium'}
          tone={focused ? 'accent' : 'muted'}
          numberOfLines={1}
          className="mt-px"
        >
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * LiquidTabBar — the floating iOS 26-style glass capsule.
 *
 * A borderless dock: a solid ink fill carries the material and a rounded accent
 * tile marks the active tab, whose glyph and caption turn accent at the same
 * time. The bar draws no shadow and no lower shade; every colour and geometry
 * value comes from the design tokens, so the capsule, the tile and the glyph
 * step stay in sync.
 *
 * The lens is placed from the tabs' own measured boxes rather than from slot
 * arithmetic: a tab that grows to fit a longer label still gets a lens exactly
 * over it, and in a right-to-left document (where the row mirrors) the lens is
 * still on the selected tab instead of on the opposite side of the bar.
 */
export function LiquidTabBar({ state, descriptors, navigateToTab, insets }: LiquidTabBarProps) {
  const count = state.routes.length;
  const rtl = useRtl();

  /** Each tab's box, measured from the row. Empty until the first layout pass. */
  const [slots, setSlots] = useState<Slot[]>([]);
  const measured = slots.length === count && slots.every((slot) => slot && slot.width > 0);

  const hide = useRef(new Animated.Value(0)).current;
  /** The selection lens: its left edge and width, both animated. */
  const lensX = useRef(new Animated.Value(0)).current;
  const lensW = useRef(new Animated.Value(0)).current;
  const [lensReady, setLensReady] = useState(false);

  /** The row that holds the tabs; every tab box is measured against it. */
  const rowRef = useRef<unknown>(null);

  /**
   * Re-reads every tab box from the DOM. A direction flip or a wider label moves
   * a tab without resizing it, and `onLayout` only reports size changes — the
   * rects are always current, so the lens is re-parked after those shifts.
   */
  const measureSlots = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const row = rowRef.current as HTMLElement | null;
    if (!row || typeof row.getBoundingClientRect !== 'function') return;

    const rowBox = row.getBoundingClientRect();
    const boxes: Slot[] = [];
    for (const node of tabRefs.current.slice(0, countRef.current)) {
      const element = node as HTMLElement | null;
      if (!element || typeof element.getBoundingClientRect !== 'function') return;
      const box = element.getBoundingClientRect();
      if (box.width === 0) return;
      boxes.push({ x: box.left - rowBox.left, width: box.width });
    }

    if (boxes.length !== countRef.current) return;
    setSlots((previous) => {
      const same =
        previous.length === boxes.length &&
        previous.every(
          (slot, index) =>
            Math.abs(slot.x - boxes[index].x) < 0.5 &&
            Math.abs(slot.width - boxes[index].width) < 0.5
        );
      return same ? previous : boxes;
    });
  }, []);

  useEffect(() => {
    measureSlots();
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('resize', measureSlots);
    return () => window.removeEventListener('resize', measureSlots);
  }, [measureSlots, rtl, state.index, count]);

  const reportSlot = useCallback((index: number, slot: Slot) => {
    setSlots((previous) => {
      const current = previous[index];
      if (
        current &&
        Math.abs(current.x - slot.x) < 0.5 &&
        Math.abs(current.width - slot.width) < 0.5
      ) {
        return previous;
      }
      const next = previous.slice();
      next[index] = slot;
      return next;
    });
  }, []);

  // Park the lens on the selected tab, and settle it there whenever that tab
  // moves (a resize, or a label that re-measures wider).
  useEffect(() => {
    if (!measured) return;
    const slot = slots[state.index];
    if (!slot) return;

    const targetX = slot.x + LENS_INSET;
    const targetWidth = Math.max(24, slot.width - LENS_INSET * 2);

    if (!lensReady || prefersReducedMotion()) {
      lensX.setValue(targetX);
      lensW.setValue(targetWidth);
      setLensReady(true);
      return;
    }

    springLiquidTo(lensX, targetX);
    Animated.spring(lensW, {
      toValue: targetWidth,
      ...motion.liquidSpring,
      useNativeDriver: false,
    }).start();
  }, [measured, slots, state.index, lensReady, lensX, lensW]);

  // Host handles stay `unknown`: RN 0.88 no longer exports its host element
  // type from the package root, and only the web keyboard code reads them.
  const barRef = useRef<unknown>(null);
  const tabRefs = useRef<unknown[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const dragging = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const dragStart = useRef(state.index);
  const dragProgress = useRef(state.index);

  // Gesture handlers outlive a render; refs keep the latest layout/nav values.
  const countRef = useRef(count);
  const stateIndexRef = useRef(state.index);
  const routesRef = useRef(state.routes);
  const navigateRef = useRef(navigateToTab);
  const slotsRef = useRef<Slot[]>(slots);
  const rtlRef = useRef(rtl);

  countRef.current = count;
  stateIndexRef.current = state.index;
  routesRef.current = state.routes;
  navigateRef.current = navigateToTab;
  slotsRef.current = slots;
  rtlRef.current = rtl;

  /** Puts the lens between two tabs at fractional index `progress`. */
  const placeLens = useCallback(
    (progress: number) => {
      const boxes = slotsRef.current;
      if (boxes.length === 0) return;

      const last = boxes.length - 1;
      const value = clamp(progress, 0, last);
      const low = Math.floor(value);
      const high = Math.min(last, low + 1);
      const t = value - low;
      const a = boxes[low];
      const b = boxes[high] ?? a;
      if (!a || !b) return;

      const x = a.x + (b.x - a.x) * t;
      const width = a.width + (b.width - a.width) * t;
      lensX.setValue(x + LENS_INSET);
      lensW.setValue(Math.max(24, width - LENS_INSET * 2));
    },
    [lensW, lensX]
  );

  const finishDrag = useCallback(() => {
    if (!dragging.current) return;

    dragging.current = false;
    dragIndexRef.current = null;
    setDragIndex(null);

    const max = Math.max(0, countRef.current - 1);
    const nearest = clamp(Math.round(dragProgress.current), 0, max);

    if (nearest !== stateIndexRef.current) {
      const route = routesRef.current[nearest];
      if (route) navigateRef.current(route.key);
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Only claim a deliberate horizontal drag, so taps still reach tabs and
        // vertical swipes still scroll the screen behind the bar.
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          slotsRef.current.length > 0 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragging.current = true;
          dragStart.current = stateIndexRef.current;
          dragProgress.current = stateIndexRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const boxes = slotsRef.current;
          if (boxes.length === 0) return;

          const average =
            boxes.reduce((sum, slot) => sum + slot.width, 0) / boxes.length || tabBar.cell;
          const step = (rtlRef.current ? -gesture.dx : gesture.dx) / average;
          const max = Math.max(0, countRef.current - 1);
          const next = clamp(dragStart.current + step, 0, max);
          dragProgress.current = next;
          placeLens(next);

          const nearest = Math.round(next);
          if (nearest !== dragIndexRef.current) {
            dragIndexRef.current = nearest;
            setDragIndex(nearest);
          }
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
        onPanResponderTerminationRequest: () => false,
      }),
    [finishDrag, placeLens]
  );

  // Arrow keys on web move between tabs, matching the ARIA tab pattern. In a
  // right-to-left row the visual direction is mirrored, so the arrow that moves
  // right steps back through the route list.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const node = barRef.current as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') {
        return;
      }

      const last = Math.max(0, routesRef.current.length - 1);
      const current = stateIndexRef.current;
      const forward = key === 'ArrowRight' ? !rtlRef.current : key === 'ArrowLeft' ? rtlRef.current : false;
      const next =
        key === 'Home'
          ? rtlRef.current
            ? last
            : 0
          : key === 'End'
            ? rtlRef.current
              ? 0
              : last
            : forward
              ? (current + 1) % (last + 1)
              : (current - 1 + last + 1) % (last + 1);

      event.preventDefault();

      const route = routesRef.current[next];
      if (!route) return;

      navigateRef.current(route.key);
      const target = tabRefs.current[next] as HTMLElement | null;
      target?.focus?.();
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, []);

  // Preserve the old bar's "hide on keyboard" behaviour on native.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const animate = (toValue: number) => {
      if (prefersReducedMotion()) {
        hide.setValue(toValue);
        return;
      }
      Animated.timing(hide, {
        toValue,
        duration: toValue === 1 ? motion.fast : motion.base,
        useNativeDriver: true,
      }).start();
    };

    const show = Keyboard.addListener('keyboardDidShow', () => animate(1));
    const hideKeyboard = Keyboard.addListener('keyboardDidHide', () => animate(0));

    return () => {
      show.remove();
      hideKeyboard.remove();
    };
  }, [hide]);

  const dockStyle = {
    opacity: hide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) },
    ],
  };

  const visualIndex = dragIndex ?? state.index;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: Math.max(insets.bottom, tabBar.gutter) }, dockStyle]}
    >
      <View
        ref={(node) => {
          barRef.current = node;
        }}
        style={styles.bar}
        role="tablist"
        accessibilityLabel="Primary tabs"
        {...panResponder.panHandlers}
      >
        {/*
          The material: a real blur under a tinted ink wash, exactly how a
          native tab bar reads the content behind it. The hairline rim keeps the
          capsule's edge defined now that it casts no shadow.
        */}
        <View pointerEvents="none" style={styles.clip}>
          <BlurView intensity={glass.blurTab} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tabOverlay }]} />
          <View style={[StyleSheet.absoluteFill, styles.rim]} />
        </View>

        <View
          ref={(node) => {
            rowRef.current = node;
          }}
          style={styles.row}
        >
          {/* The active state: a faint blur with a hairline rim, parked on the
              selected tab's measured box. Not rendered until every tab has been
              measured: an unmeasured row would flash the lens in the corner. */}
          {measured && (
            <Animated.View
              pointerEvents="none"
              style={[styles.lens, { width: lensW, transform: [{ translateX: lensX }] }]}
            >
              <BlurView intensity={glass.blurLens} tint="dark" style={StyleSheet.absoluteFill} />
              {/* The lens wash: opacity from an accent tint, not a white sheen. */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.lensWash }]} />
            </Animated.View>
          )}

          {state.routes.map((route, index) => {
            const options = descriptors[route.key]?.options;
            const focused = visualIndex === index;
            const color = focused ? colors.primary : colors.onSurfaceVariant;
            const label = typeof options?.title === 'string' ? options.title : route.name;
            const accessibilityLabel =
              typeof options?.tabBarAccessibilityLabel === 'string'
                ? options.tabBarAccessibilityLabel
                : label;
            const icon = options?.tabBarIcon
              ? options.tabBarIcon({ focused, color, size: iconSize.nav })
              : null;

            return (
              <TabItem
                key={route.key}
                focused={focused}
                label={accessibilityLabel}
                title={label}
                icon={icon}
                buttonRef={(node) => {
                  tabRefs.current[index] = node;
                }}
                onMeasure={(slot) => reportSlot(index, slot)}
                onPress={() => {
                  if (dragging.current || index === state.index) return;
                  navigateToTab(route.key);
                }}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  bar: {
    // Intrinsic width: the rail hugs its cells and never stretches with the
    // viewport, so the selection tile always sits exactly on a tab.
    alignSelf: 'center',
    maxWidth: tabBar.maxWidth,
    height: tabBar.height,
    padding: tabBar.padding,
    flexDirection: 'row',
    borderRadius: tabBar.height / 2,
    borderCurve: 'continuous',
    backgroundColor: glass.tab,
    boxShadow: shadow.liquidTab,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: tabBar.height / 2,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  rim: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: rimColor,
    borderRadius: tabBar.height / 2,
  },
  lens: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: tabBar.pill,
    // The lens is the tab's own tile, so the selection reads as a segment
    // rather than a floating dot.
    borderRadius: tabBar.tileRadius,
    overflow: 'hidden',
  },
  tab: {
    // A full cell minimum, and wider when the label needs it (200% text size,
    // or a longer translation), so a caption never spills under its neighbour.
    minWidth: tabBar.cell,
    flexGrow: 1,
    flexShrink: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tabBar.tileRadius,
  },
});
