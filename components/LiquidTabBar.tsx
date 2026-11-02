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

/**
 * One tab: a single glyph over an accent halo, with the selected one settling
 * in at 1.05.
 *
 * The whole pressable is the target. The icon is hidden from assistive tech and
 * the accessible label supplies the name, so a screen reader never announces
 * the MaterialIcons glyph. The bar renders no visible text.
 */
function TabItem({
  focused,
  label,
  title,
  icon,
  buttonRef,
  onPress,
}: {
  focused: boolean;
  /** Accessible name, read by assistive tech. */
  label: string;
  /** Visible caption under the glyph. */
  title: string;
  icon: React.ReactNode;
  buttonRef: (node: unknown) => void;
  onPress: () => void;
}) {
  // React Native Web honours tabIndex; native ignores it. The cast keeps the
  // DOM-only prop out of the native prop contract.
  const webFocusProps: object = Platform.OS === 'web' ? { tabIndex: 0 } : {};

  return (
    <Pressable
      {...webFocusProps}
      ref={buttonRef}
      onPress={onPress}
      style={styles.tab}
      role="tab"
      aria-selected={focused}
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      focusable
    >
      {/*
        The native arrangement: a glyph over its caption, both in the same
        column. Nothing paints behind the selected tab — iOS marks selection by
        tint, not by a filled tile.
      */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tabBar.cell,
          height: tabBar.pill,
          alignItems: 'center',
          justifyContent: 'center',
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
 */
export function LiquidTabBar({ state, descriptors, navigateToTab, insets }: LiquidTabBarProps) {
  const count = state.routes.length;
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth =
    count > 0 ? Math.max(0, (barWidth - tabBar.padding * 2) / count) : 0;

  const hide = useRef(new Animated.Value(0)).current;
  /** The selection lens: an index that springs from the old tab to the new one. */
  const lens = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    springLiquidTo(lens, state.index);
  }, [lens, state.index]);

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
  const itemWidthRef = useRef(itemWidth);
  const countRef = useRef(count);
  const stateIndexRef = useRef(state.index);
  const routesRef = useRef(state.routes);
  const navigateRef = useRef(navigateToTab);

  itemWidthRef.current = itemWidth;
  countRef.current = count;
  stateIndexRef.current = state.index;
  routesRef.current = state.routes;
  navigateRef.current = navigateToTab;

  const finishDrag = useCallback(() => {
    if (!dragging.current) return;

    dragging.current = false;
    dragIndexRef.current = null;
    setDragIndex(null);

    const max = Math.max(0, countRef.current - 1);
    const nearest = Math.max(0, Math.min(max, Math.round(dragProgress.current)));

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
          itemWidthRef.current > 0 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragging.current = true;
          dragStart.current = stateIndexRef.current;
          dragProgress.current = stateIndexRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const width = itemWidthRef.current;
          if (!width) return;

          const max = Math.max(0, countRef.current - 1);
          const next = Math.max(0, Math.min(max, dragStart.current + gesture.dx / width));
          dragProgress.current = next;

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
    [finishDrag]
  );

  // Arrow keys on web move between tabs, matching the ARIA tab pattern.
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
      const next =
        key === 'Home'
          ? 0
          : key === 'End'
            ? last
            : key === 'ArrowRight'
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

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setBarWidth((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
  };

  const dockStyle = {
    opacity: hide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) },
    ],
  };

  /**
   * The lens sits on the tab's own tile, not on the whole slot: the slot is
   * wider than the glyph-and-caption column, so it is inset by half the
   * difference and then travels one slot per index.
   */
  const lastIndex = Math.max(1, count - 1);
  /** The lens sits 3px inside its slot, so the gap between neighbours matches. */
  const lensInset = Math.min(3, Math.max(0, itemWidth / 4));
  const lensWidth = Math.max(0, itemWidth - lensInset * 2);
  const lensTranslate = lens.interpolate({
    inputRange: [0, lastIndex],
    outputRange: [lensInset, lensInset + itemWidth * lastIndex],
  });

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
        onLayout={handleLayout}
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

        <View style={styles.row}>
          {/*
            The active state: a faint blur with a hairline rim, travelling to the
            selected tab on the damped lens spring instead of blinking in place.
          */}
          {/* Not rendered until the bar has been measured: an unmeasured row
              would park the lens in the corner for one frame. */}
          {itemWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: lensWidth,
                  height: tabBar.pill,
                  transform: [{ translateX: lensTranslate }],
                },
              ]}
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
    // Intrinsic width: the rail hugs its three cells and never stretches with
    // the viewport, so the selection tile always fills its cell exactly.
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
    // The lens is the tab's own tile: same width as the slot minus its gap, so
    // the selection reads as a segment rather than a floating dot.
    borderRadius: tabBar.tileRadius,
    overflow: 'hidden',
  },
  tab: {
    width: tabBar.cell,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tabBar.tileRadius,
  },
});
