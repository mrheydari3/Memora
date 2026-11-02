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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, glass, iconSize, motion, shadow, tabBar } from '../theme/tokens';
import { prefersReducedMotion, springTo } from '../motion';

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
  icon,
  buttonRef,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: React.ReactNode;
  buttonRef: (node: unknown) => void;
  onPress: () => void;
}) {
  const selected = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    springTo(selected, focused ? 1 : 0);
  }, [focused, selected]);

  const scale = selected.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const haloScale = selected.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
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
      <Animated.View
        style={{
          width: tabBar.pill,
          height: tabBar.pill - 8,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.activePill, { opacity: selected, transform: [{ scale: haloScale }] }]}
        />
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * LiquidTabBar — the floating iOS 26-style glass capsule.
 *
 * A borderless icon dock: expo-blur carries the material, a deep ink tint
 * keeps the capsule fully dark over the content behind it, and a layered shadow
 * plus a lower shade define the edge. There are no labels and no white
 * highlights; the active tab is marked only by its accent and scale, and the
 * bar settles on the nearest tab on release. Every colour and geometry value
 * comes from the design tokens.
 */
export function LiquidTabBar({ state, descriptors, navigateToTab, insets }: LiquidTabBarProps) {
  const count = state.routes.length;
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth =
    count > 0 ? Math.max(0, (barWidth - tabBar.padding * 2) / count) : 0;

  const hide = useRef(new Animated.Value(0)).current;

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
        <View pointerEvents="none" style={styles.clip}>
          <BlurView intensity={glass.blurTab} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tabOverlay }]} />

          <View style={styles.shade}>
            <Svg width="100%" height="100%" viewBox="0 0 360 64" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="tabShade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                  <Stop offset="0.72" stopColor={colors.background} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.background} stopOpacity={0.28} />
                </LinearGradient>
              </Defs>
              <Rect width="360" height="64" fill="url(#tabShade)" />
            </Svg>
          </View>
        </View>

        <View style={styles.row}>
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
              ? options.tabBarIcon({ focused, color, size: iconSize.xl })
              : null;

            return (
              <TabItem
                key={route.key}
                focused={focused}
                label={accessibilityLabel}
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
    width: '92%',
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
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  activePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: (tabBar.pill - 8) / 2,
    backgroundColor: colors.accentActive,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tabBar.pill / 2,
  },
});
